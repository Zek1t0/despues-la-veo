## Context

Ver [proposal.md](./proposal.md) para la motivación. `SavedTitle` se persiste en `saved_titles`; sus etiquetas son strings dentro de `tags_json` y la pantalla Etiquetas deriva en memoria un `Map<string, SavedTitle[]>` usando trim exterior e identidad exacta posterior. No existe una entidad Tag ni una operación global de renombrado.

Biblioteca carga todos los títulos y aplica búsqueda, filtros y sort en memoria. Una etiqueta abierta mantiene `selectedTag` como estado local, usa la apariencia de Biblioteca pero ordena sus títulos por el comparador propio de actualización reciente. `TitleGridCard` es un único `Pressable` con overlays no interactivos. `/title/[id]` recibe hoy sólo `id`.

SQLite está en `user_version = 1`, contiene `saved_titles`, `idx_saved_titles_provider_external` y `app_preferences`, y rechaza versiones futuras. El backup v1 exporta `SavedTitle[]` y hace merge por `provider + externalId`, conservando cambios locales iguales o más recientes. Este cambio cruza dominio, persistencia, backup, navegación y tres presentaciones, por lo que requiere diseño explícito.

## Goals / Non-Goals

**Goals:**

- Representar una relación título × contexto sin alterar `SavedTitle` ni su `updatedAt`.
- Mantener integridad aunque la pertenencia a tags continúe dentro de JSON.
- Migrar SQLite 1→2 sin pérdida y con verificación estructural.
- Mantener importación v1 y agregar exportación/importación v2 parcial, reportable e idempotente.
- Integrar acciones e indicadores siguiendo los contratos de interacción Detail/Grid existentes.
- Separar cada checkpoint de Apply para que persistencia, backup y UI puedan revisarse antes de continuar.

**Non-Goals:**

- Crear una entidad Tag, resolver equivalencias de mayúsculas/acentos o agregar renombrado global.
- Crear infraestructura genérica de atributos personales para ratings futuros.
- Incorporar orden manual, posición de pin, drag-and-drop, pin masivo o selección múltiple.
- Cambiar collages, ViewOptionsPanel, filtros, sorts disponibles o preferencias de vista.
- Hacer sincronización bidireccional, tombstones o restauración autoritativa.
- Agregar dependencias.

## Decisions

### 1. Dominio de contexto acotado y separado de `SavedTitle`

Se agregará un tipo discriminado equivalente a:

```ts
type PinContext =
  | { type: "library"; key: "" }
  | { type: "tag"; key: string };
```

La construcción/parseo en TypeScript aplica exactamente `String.prototype.trim()` como única autoridad de normalización. Para tags, la clave resultante debe ser no vacía y se persiste ya normalizada; para Biblioteca la clave debe ser exactamente `""`. Después del trim no se aplican lower-case, eliminación de acentos ni equivalencias. Los tipos se ubicarán en un módulo específico como `src/core/contextualPin.ts`, no dentro de `savedTitle.ts`.

Alternativas descartadas:

- Campos o mapas en `SavedTitle`: acoplan múltiples contextos al agregado y a su `updatedAt`.
- JSON de pins: impide integridad, unicidad y consultas contextuales sencillas.
- Tabla genérica de atributos: mezcla anticipadamente pins con ratings.
- Entidad Tag: cambia el modelo de producto fuera de alcance.

### 2. Tabla relacional `title_pins`

El esquema final propuesto es:

```sql
CREATE TABLE IF NOT EXISTS title_pins (
  saved_title_id TEXT NOT NULL,
  context_type TEXT NOT NULL,
  context_key TEXT NOT NULL,
  pinned_at INTEGER NOT NULL CHECK (
    typeof(pinned_at) = 'integer' AND
    pinned_at >= 0 AND
    pinned_at <= 9007199254740991
  ),

  PRIMARY KEY (saved_title_id, context_type, context_key),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK (
    (context_type = 'library' AND context_key = '') OR
    (context_type = 'tag' AND context_key <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_title_pins_context
ON title_pins(context_type, context_key, saved_title_id);
```

La PK impide duplicados y permite un título en múltiples contextos. El índice adicional sirve a la consulta predominante: obtener todos los pins del contexto visible. `pinned_at` determina en presentación la prioridad descendente dentro del grupo fijado, pero no requiere incorporarse al índice porque cada vista carga en lote el contexto completo y ordena en memoria. El contrato de dominio y backup exige `typeof value === "number"`, `Number.isSafeInteger(value)` y `value >= 0`; `Date.now()` cumple naturalmente esas condiciones. El CHECK SQL defiende tipo entero y el mismo rango seguro, pero la validación TypeScript sigue siendo obligatoria.

El CHECK contextual de SQLite valida sólo las combinaciones `library`/key vacía y `tag`/key no vacía. No usa `trim(context_key)` porque el trim de SQLite no reproduce necesariamente todos los caracteres eliminados por `String.prototype.trim()`. La normalización exacta, el rechazo de un tag que resulte vacío y la persistencia de la key ya normalizada pertenecen al helper de dominio/repositorio; SQLite queda como defensa adicional, no como autoridad de normalización.

Se activará `PRAGMA foreign_keys = ON` inmediatamente después de abrir la conexión y antes de iniciar transacciones; se verificará que haya quedado activo. La FK con cascade es una segunda barrera, no el único mecanismo de limpieza.

### 3. Migración SQLite 1→2 verificada antes de publicar la versión

`DATABASE_SCHEMA_VERSION` pasa de 1 a 2. La inicialización conservará el rechazo temprano de `currentVersion > 2`. Para una conexión admitida:

1. Activar y verificar `foreign_keys` fuera de transacción.
2. Asegurar el esquema base existente necesario para instalaciones nuevas/legadas.
3. Ejecutar dentro de una transacción la evolución pendiente: asegurar `app_preferences`, crear `title_pins` e índice, y verificar estructura completa mediante `sqlite_master`, `PRAGMA table_info`, `PRAGMA foreign_key_list` y `PRAGMA index_list/index_info`.
4. Establecer `PRAGMA user_version = 2` únicamente después de todas las verificaciones.
5. Releer la versión dentro de la transacción y exigir exactamente 2.

`CREATE ... IF NOT EXISTS` permite reapertura idempotente, pero no se considera verificación: una tabla preexistente con nombre correcto y columnas incorrectas debe fallar. Un error revierte estructura y versión juntas. La migración no modifica ni reconstruye `saved_titles`, su índice o `app_preferences`.

Para una base v0 o nueva se conserva la evolución acumulativa hasta el mismo esquema final v2; la prueba específica de compatibilidad crítica parte de una fixture v1 real.

Rollback: no habrá downgrade automático, `DROP TABLE` ni reducción de `user_version`. Una versión anterior que sólo admite v1 puede rechazar correctamente la DB v2; la recuperación operativa es volver al código compatible o restaurar un backup. El esquema aditivo conserva los datos para un retorno posterior.

### 4. `titlePinsRepo` es la autoridad de las escrituras contextuales

Un repositorio nuevo bajo `src/storage/titlePinsRepo.ts` expondrá operaciones acotadas para:

- listar pins de un contexto;
- leer si un título está fijado en un contexto;
- fijar con `pinned_at` suministrado o local;
- desfijar;
- eliminar pins de un título;
- eliminar pins de tags que ya no pertenecen al título;
- insertar pins de backup con semántica `insert if absent`.

El repositorio mantiene dos contratos de escritura deliberadamente distintos. `pinTitle` usa
`INSERT ... ON CONFLICT DO NOTHING`: un duplicado conserva el `pinned_at` local y sostiene el
merge aditivo del backup. Las intenciones directas de UI usan `setTitlePinState`: `null` elimina
el pin exacto y un número crea o actualiza la fila con exactamente ese `pinned_at`. Por lo tanto,
si esa escritura autoritativa resuelve, tanto la pertenencia como `pinned_at` en storage coinciden
con la última intención confirmada; esta operación no se reutiliza para el merge de backup.

Antes de fijar en tag, el repositorio consulta el título dentro de la misma operación y compara la clave con el conjunto de tags normalizadas por trim e identidad exacta. Los parámetros de navegación nunca sustituyen esta validación.

Las operaciones no llaman `upsertSavedTitle` ni escriben `saved_titles.updated_at`. Para dobles pulsaciones, cada superficie mantiene por título/contexto una cola serializada y un identificador de intención semejante al patrón de preferencias: actualización optimista, confirmación en orden y rollback sólo si el error corresponde a la intención todavía vigente. No se crea una abstracción general hasta demostrar repetición suficiente.

### 5. Cambios de tags y eliminación coordinan limpieza explícita

Toda ruta que pueda reemplazar `tags_json` debe comparar el conjunto normalizado anterior con el nuevo y eliminar pins `tag` cuyas claves dejaron de pertenecer. Esto incluye:

- guardado desde el detalle;
- upsert ordinario;
- actualización durante merge de backup.

La escritura del título y la limpieza se agrupan en una transacción para no dejar una fila nueva con pins viejos ni perder pins si falla el guardado. Cambiar `Acción` por `Accion` produce eliminación del pin anterior y ninguna inserción automática para la clave nueva.

`deleteSavedTitle` elimina explícitamente todos los pins y luego el título dentro de una transacción; el cascade cubre ejecuciones alternativas y protege integridad si la eliminación llega por otra ruta.

Para evitar duplicar SQL sensible, `savedTitlesRepo` y el merge recibirán helpers internos que acepten la conexión/transacción activa. No se hará un refactor general de repositorios.

### 6. Orden: filtrar, particionar y reutilizar comparadores existentes

Biblioteca conserva su pipeline de pertenencia implícita, búsqueda y filtros. Después crea un `Map` de ID a `pinnedAt` para los pins de Biblioteca, particiona los resultados, ordena los fijados por `pinnedAt` descendente usando `compareLibraryTitles` sólo como desempate, ordena los no fijados con `compareLibraryTitles` y concatena.

Etiquetas conserva `tagMap`, `selectedTag` y `compareTitlesForCollage` para la lista abierta. Obtiene los pins sólo de esa clave exacta, particiona `tagMap.get(selectedTag)`, ordena los fijados por `pinnedAt` descendente usando `compareTitlesForCollage` sólo como desempate y ordena los no fijados con ese comparator propio. No lee pins ni sort de Biblioteca.

Los collages siguen llamando a `selectCollageTitles` sobre el conjunto original, sin partición por pins. `pinned_at` sólo ordena la lista visible dentro del grupo fijado y no afecta collages. Esta composición evita nuevos sorts y garantiza que pinning no reintroduzca elementos excluidos.

### 7. Navegación transporta contexto, persistencia lo revalida

Las navegaciones desde Biblioteca usarán parámetros equivalentes a `pinContext=library`. Desde una etiqueta usarán `pinContext=tag&tag=<clave exacta codificada>`. Se utilizará la forma tipada/objeto de Expo Router para que el encoding sea correcto y la URL sobreviva recargas web y deep links.

`app/title/[id].tsx` parsea sólo los valores permitidos. Para tag exige clave no vacía y pertenencia exacta actual del título. Ante cualquier ausencia, valor desconocido o pertenencia obsoleta deriva `{type: "library", key: ""}` y muestra texto explícito de Biblioteca. El repositorio repite la validación en el instante de escritura para cubrir carreras.

No se intenta inferir el origen desde el historial de navegación ni desde `router.back()`, porque no es estable ante recarga o deep link.

### 8. UX preserva los límites de interacción existentes

En Detail de Biblioteca, la acción corta `Fijar`/`Desfijar` será hermana del `Pressable` de navegación, junto a las acciones existentes, con label accesible contextual completo. La fila Detail dentro de una etiqueta adoptará la misma composición de contenedor más controles hermanos sin anidarlos.

`TitleGridCard` recibirá una prop contextual booleana y añadirá un indicador visual no accesible por separado, con `pointerEvents="none"`, que no parezca un botón. La primera implementación recomendada es un badge en la esquina superior derecha con icono de pin y `Fijado`, manteniendo el tipo arriba a la izquierda. La tarjeta continúa siendo el único `Pressable`; su label exterior incluye el estado contextual.

El detalle completo añade una acción explícita `Fijar en ...`/`Desfijar de ...`. No se usa ViewOptionsPanel, long press, hover ni menú de tres puntos. Durante el checkpoint visual en PC y celular pueden ajustarse texto, icono, tamaño, truncamiento y posición del indicador Grid si la implementación recomendada no resulta legible; deben conservarse siempre su semántica contextual, su carácter no interactivo, su apariencia no-botón y la única acción de la card.

### 9. JSON v2 extiende el backup sin debilitar v1

Se conservará `libraryBackupV1.ts` como contrato/parser v1. Un módulo v2 y un dispatcher seleccionarán por `version` después de validar la envoltura. Forma conceptual:

```json
{
  "version": 2,
  "exportedAt": "2026-08-08T00:00:00.000Z",
  "items": ["SavedTitle v1-compatible fields"],
  "pins": [
    {
      "provider": "tmdb",
      "externalId": "268",
      "contextType": "tag",
      "contextKey": "Superhéroes",
      "pinnedAt": 1786147200000
    }
  ]
}
```

Los items mantienen su validación y merge actuales. `pins` debe ser un array para que la envoltura v2 sea estructuralmente válida. Cada elemento se valida independientemente: identidad lógica no vacía, contexto permitido, combinación key/context correcta y un `pinnedAt` cuyo tipo sea `number`, para el cual `Number.isSafeInteger` sea verdadero y que sea mayor o igual que cero. Esto rechaza decimales, `Infinity`, `NaN` y enteros fuera del rango seguro. Los pins no usan el `id` local exportado.

Un v1 no contiene ni importa una colección de pins, y la ausencia de esa colección nunca significa desfijar. Sin embargo, sus `items` atraviesan el merge normal de `SavedTitle`: si una actualización elegible realmente reemplaza `tags_json`, la misma transacción elimina los pins de tags que dejaron de pertenecer al título. Pins de Biblioteca y pins de tags que continúan perteneciendo se conservan. Esa limpieza deriva de la integridad del título actualizado, no de una semántica de pins del backup v1. En v2, después del merge de títulos y de esa misma limpieza, cada pin entrante resuelve la fila final por `provider + externalId`; luego valida pertenencia tag y persiste. Pins inválidos, huérfanos o con fallos se reportan individualmente y no revierten elementos elegibles, siguiendo el carácter parcial del importador actual.

### 10. Merge de pins estrictamente aditivo

La operación usa la PK contextual con `INSERT ... ON CONFLICT DO NOTHING` o equivalente:

- ausente local: insertar con `pinnedAt` entrante;
- existente local: conservar fila y `pinned_at` local;
- ausente del backup: no tocar;
- repetición: no duplicar ni actualizar.

El resultado de pins distingue como mínimo insertados, conservados/omitidos, inválidos y fallidos, con referencias seguras y motivos breves integrados en el resumen actual. No se crean tombstones; por diseño, ausencia nunca significa desfijar.

### 11. Archivos y capas afectados

- `src/core/contextualPin.ts` (nuevo): contexto y normalización/validación acotada.
- `src/storage/db.ts`: versión 2, foreign keys, DDL, índice y verificación de migración.
- `src/storage/titlePinsRepo.ts` (nuevo): consultas, mutaciones y merge aditivo.
- `src/storage/savedTitlesRepo.ts`: delete y upsert transaccionales con limpieza.
- `src/storage/libraryBackupMerge.ts`: limpieza de tags durante updates y coordinación de identidad final.
- `src/core/libraryBackupV1.ts`: se conserva compatible; sólo se tocará si hace falta exponer helpers sin cambiar contrato.
- `src/core/libraryBackupV2.ts` (nuevo): contrato, normalización y parser v2/dispatcher.
- `app/(tabs)/ajustes.tsx`: export v2, import v1/v2 y resumen ampliado.
- `app/(tabs)/libreria.tsx`: pins de Biblioteca, partición, acción Detail y parámetros.
- `app/(tabs)/etiquetas.tsx`: pins de tag, partición, acción Detail y parámetros.
- `app/title/[id].tsx`: parseo/fallback de origen y acción explícita.
- `src/components/browsing/TitleGridCard.tsx`: indicador no interactivo y accesibilidad exterior.
- `src/components/browsing/index.ts`: sólo si debe exportar tipos nuevos del componente.
- Fixtures/documentación de pruebas bajo `docs/testing/` para migración y backups.

`ViewOptionsPanel`, `TagCollage`, `viewPreferencesRepo`, TMDB, `app.json` y `package.json` no requieren cambios.

## Risks / Trade-offs

- [La pertenencia de tags vive en JSON y no admite FK] → validar antes de fijar y limpiar todas las rutas que reemplazan tags dentro de la misma transacción.
- [Una escritura de título podría omitir la limpieza] → centralizar el helper con DB activa y cubrir upsert, merge, quitar tag y delete mediante pruebas de repositorio.
- [Foreign keys puede estar desactivado por conexión] → activar y verificar al abrir, pero mantener eliminación explícita.
- [Una DB con tabla homónima incorrecta engaña a `IF NOT EXISTS`] → verificar columnas, PK, FK e índice antes de actualizar `user_version`.
- [Una versión anterior rechaza DB v2] → no prometer downgrade; conservar migración aditiva y documentar restauración desde backup/código compatible.
- [Contexto URL manipulado u obsoleto] → fallback de presentación a Biblioteca y validación autoritativa dentro del repositorio.
- [Actualización optimista fuera de orden] → cola por título/contexto, identificador de intención y rollback al último confirmado.
- [Import v2 parcial deja algunos pins fuera] → reporte por categoría; conservar progreso elegible como en el merge actual.
- [Merge aditivo no transporta desfijados] → documentar que ausencia no elimina; sincronización/tombstones quedan fuera de alcance.
- [La primera propuesta de indicador Grid puede no funcionar en cards pequeñas] → verificar PC/móvil y ajustar texto, icono, tamaño, truncamiento o posición sin convertirlo en botón ni agregar interacción.
- [Más consultas al enfocar pantallas] → cargar pins por contexto en lote, nunca una consulta por card.

## Migration Plan

1. Agregar tipos, DDL y verificadores con fixtures de base v1 antes de conectar UI.
2. Migrar una copia controlada v1 a v2 y comprobar datos, índices, FK, idempotencia, rollback inyectado y rechazo futuro.
3. Agregar repositorio e integridad transaccional; comprobar que pins no cambian `updatedAt`.
4. Agregar v2 manteniendo pruebas v1 sin cambios y verificar export/import en fixtures antes de actualizar Ajustes.
5. Integrar Biblioteca, Etiquetas y detalle por checkpoints, ejecutando `npx tsc --noEmit` tras cada sección.
6. Verificar manualmente web y móvil, incluyendo responsive, accesibilidad, errores y ausencia de `Pressable` anidados.

No se ejecutará migración descendente. Ante fallo previo a publicar `user_version = 2`, la transacción deja la base v1. Ante necesidad de revertir después de una migración exitosa, se conserva la DB y se vuelve al código v2 corregido o a un backup; eliminar `title_pins` requeriría otro cambio explícito.
