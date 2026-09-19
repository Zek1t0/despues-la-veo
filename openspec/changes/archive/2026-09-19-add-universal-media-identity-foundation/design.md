## Context

`saved_titles.id` ya es la clave local usada por `/title/[id]`, ratings, pins y listas. Sin embargo, `saved_titles` también contiene `provider` y `external_id`, y `idx_saved_titles_provider_external` más los upserts hacen de ese par la identidad efectiva de escritura. TMDB identifica recursos por `movie|tv + id`, por lo que el esquema actual no puede representar dos namespaces TMDB con el mismo ID.

SQLite está en `user_version = 3`. `initializeDatabase()` ejecuta `ensureLibrarySchema()` antes de `evolveDatabaseSchema()`, de modo que el bootstrap actual puede crear el índice viejo antes de migrar. Las mutaciones públicas de títulos usan la composición `initDb → runSerializedStorageMutation → withTransactionAsync → helperWithDb`; los helpers internos no deben reingresar a ninguna de esas capas.

El backup actual es v4: sus items reproducen `SavedTitle`, mientras sus pins apuntan a `provider + externalId`. El import valida primero, realiza un merge transaccional con savepoints por entrada y aplica Appearance posteriormente mediante su coordinador. Esta propuesta preserva esa semántica exacta.

## Goals / Non-Goals

**Goals:**

- Mantener `saved_titles.id` como ID local opaco y preservar los IDs existentes.
- Separar referencias externas en una relación uno-a-varios sin convertirlas en identidad local.
- Distinguir `tmdb/movie/N` de `tmdb/tv/N` en esquema, lookup, guardado e import.
- Migrar schema v3 a v4 sin red, reset ni pérdida de datos.
- Exportar backup v5 capaz de representar el nuevo estado y continuar importando v1–v4.
- Mantener la aplicación TMDB actual y `/title/[id]` funcional después de cada checkpoint de implementación. Las secciones 2, 3, 4 y 5 forman un único checkpoint de identidad funcional: el schema v4 necesita repositorios v4, backup v5 necesita portabilidad completa y los consumidores runtime deben poder leer todos los estados válidos de cero o varias ProviderReferences sin pasar por la proyección singular legacy.

**Non-Goals:**

- Renombrar `saved_titles` o `SavedTitle` sólo por pureza conceptual.
- Crear una interfaz general para proveedores o activar más de uno.
- Definir una taxonomía universal, reconciliar metadata o generalizar `voteAverage`.
- Implementar linking, merge/split, cambio de proveedor, progreso, hijos, relaciones o sync.
- Rediseñar tags, browsing, rutas, Appearance o credenciales.

## Decisions

### 1. Conservar `saved_titles` como tabla de MediaItems y mover identidad externa

El schema v4 conservará `saved_titles` y su `id` como primary key. La tabla final contendrá el snapshot y los datos personales actuales, incluido `type`, pero dejará de contener `provider` y `external_id`.

Se agregará:

```sql
CREATE TABLE media_provider_references (
  provider TEXT NOT NULL,
  resource_namespace TEXT NOT NULL,
  external_id TEXT NOT NULL,
  saved_title_id TEXT NOT NULL,
  PRIMARY KEY (provider, resource_namespace, external_id),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK (provider = trim(provider) AND length(provider) > 0),
  CHECK (resource_namespace = trim(resource_namespace) AND length(resource_namespace) > 0),
  CHECK (length(trim(external_id)) > 0)
);

CREATE INDEX idx_media_provider_references_saved_title
ON media_provider_references(saved_title_id);
```

La composite primary key garantiza que una referencia concreta pertenezca como máximo a un MediaItem. El índice por `saved_title_id` soporta carga, exportación y cascade. No se impone unicidad sobre `saved_title_id`, por lo que un item puede tener varias referencias.

`provider` y `resource_namespace` se validan/canonicalizan en aplicación y el schema rechaza cualquier token almacenado con whitespace exterior, vacío o compuesto sólo por whitespace. La igualdad usa los tres valores almacenados de la composite key. `external_id` es un string opaco para la capa universal: el adaptador de cada proveedor debe producir su forma canónica y storage no aplica case folding, parsing ni reglas previstas para proveedores futuros.

El adaptador TMDB produce exclusivamente `provider = "tmdb"`, `resource_namespace = "movie" | "tv"` y `external_id = String(idNumericoValidado)`. Por ello representaciones de ruta como `00123` y `123`, si ambas representan el ID numérico TMDB válido 123, alcanzan storage como `"123"`. Ninguna regla de TMDB se promueve a normalización universal.

`type` permanece en `saved_titles` como contrato actual de snapshot, filtros, labels y backups legacy. No participa en la identidad externa genérica. Para TMDB, el adaptador crea una referencia con `resource_namespace = type`, pero esa igualdad es una regla de TMDB y no del dominio universal.

Alternativas consideradas:

- Ampliar el índice a `(provider, type, external_id)`: resuelve la colisión inmediata, pero mantiene proveedor y taxonomía acoplados y no permite múltiples referencias ni items local-only limpios.
- Agregar la tabla y conservar `provider/external_id` como columnas activas: reduce el rebuild inicial, pero deja dos fuentes de verdad y exige valores artificiales para items sin proveedor.
- Renombrar toda la tabla/modelo a `media_items`: añade migración y propagación sin aportar una capacidad observable en esta fase.

### 2. Reconstruir `saved_titles` y `title_pins` dentro de una única migración v3 → v4

SQLite no ofrece una eliminación de columnas que preserve por sí sola todos los constraints e índices que se necesitan verificar. La migración reconstruirá las tablas de forma controlada:

1. Antes del rebuild, conservar la normalización histórica que hacía el bootstrap pre-v4: convertir `genres_json IS NULL` a `'[]'` y convertir `tags_json IS NULL` a `'[]'` sólo en una estructura histórica donde esa condición sea legal. En el schema v3 válido `tags_json` es `NOT NULL`, por lo que esa rama documenta compatibilidad histórica pero no habilita reparación de datos v4 ni relaja el contrato válido.
2. Renombrar `title_pins` y `saved_titles` a nombres temporales v3, haciendo que la foreign key histórica siga apuntando a la tabla histórica.
3. Crear el `saved_titles` v4 sin `provider/external_id`, preservando las demás columnas y el CHECK exacto de `personal_rating`.
4. Copiar cada fila conservando `id`, snapshot, rating, tags, notas, status y timestamps, después de la normalización histórica anterior.
5. Crear `media_provider_references` y su índice.
6. Por cada fila TMDB histórica, insertar `('tmdb', type, external_id, id)`; la migración falla ante cualquier valor que no permita una referencia válida.
7. Por cada fila manual histórica, no crear una referencia externa y registrar su clave de compatibilidad legacy.
8. Crear `title_pins` v4 con la misma primary key, checks, foreign key hacia el nuevo `saved_titles` e índice contextual; copiar todas las filas y timestamps.
9. Eliminar primero las tablas temporales dependientes y luego la tabla histórica.
10. Verificar columnas, primary keys, foreign keys, checks, índices, conteos, ausencia de huérfanos y correspondencia exacta de referencias TMDB.
11. Publicar `PRAGMA user_version = 4` sólo después de todas las verificaciones.

Toda la secuencia vive dentro del `withTransactionAsync` de evolución ya existente. No se desactiva `foreign_keys` dentro de la transacción. Los nombres temporales evitan que borrar la tabla histórica dispare cascades sobre los pins nuevos.

`ensureLibrarySchema()` dejará de ser un bootstrap que publica el schema v3 antes de conocer la versión. La inicialización se separará en: habilitar/verificar foreign keys, leer/rechazar versiones futuras y ejecutar un bootstrap/evolución consciente de la versión. Para una base nueva se crea directamente v4 dentro del mismo flujo verificable; para v3 se usa la migración anterior. Bases v0–v2 continúan evolucionando sin saltarse los contratos históricos antes de alcanzar v4.

La normalización de JSON anterior pertenece exclusivamente al camino histórico pre-v4. Una fila histórica válida con `genres_json` SQL NULL llega a v4 con `'[]'`, reproduciendo el bootstrap anterior. Como `tags_json` es `NOT NULL` en el schema histórico válido, los tests deben demostrar esa restricción en vez de fabricar una regla de reparación nueva. La reapertura o escritura normal de una base v4 no ejecuta ninguna normalización equivalente.

Alternativa considerada: crear v4 de forma aditiva y retirar columnas después. Se descarta porque mantendría el índice incompatible o columnas NOT NULL que obligan a duplicar identidad.

### 3. Aislar identidad manual histórica en una tabla de compatibilidad

Se agregará una estructura privada, fuera de las referencias externas:

```sql
CREATE TABLE legacy_saved_title_identities (
  legacy_format TEXT NOT NULL,
  legacy_provider TEXT NOT NULL,
  legacy_external_id TEXT NOT NULL,
  saved_title_id TEXT NOT NULL,
  PRIMARY KEY (legacy_format, legacy_provider, legacy_external_id),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE
);

CREATE INDEX idx_legacy_saved_title_identities_saved_title
ON legacy_saved_title_identities(saved_title_id);
```

En esta fase `legacy_format` tendrá el valor estable `library-backup-v1-v4`; sólo se crearán filas para identidades históricas `manual`. El código de runtime y la búsqueda TMDB no consultarán esta tabla. Su única responsabilidad es conservar el matching de migración e imports legacy repetidos.

Backup v5 serializará obligatoriamente esa identidad legacy en todo item local-only que esta versión pueda exportar, ya que esos items proceden de filas históricas `manual`. Así, un round-trip v5 conserva la capacidad de reconocer posteriormente el backup histórico original y de repetir el propio import v5 aun si el ID fue remapeado. El parser v5 la validará como compatibilidad, no como `ProviderReference`.

El `legacy_external_id` se conserva como token histórico exacto: no recibe trim ni las reglas de ProviderReference. La capa de aplicación mantiene como máximo una identidad manual legacy por MediaItem. Readjuntar la misma identidad es idempotente; una identidad diferente produce conflicto dentro del savepoint. Si storage ya contiene varias filas para un item, el exporter v5 falla de forma diagnóstica porque el contrato v5 singular no puede representarlas.

Un archivo v5 externo puede contener sintácticamente un item sin referencias ni identidad legacy. Se insertará sólo si su ID está libre. Si está ocupado, se reportará conflicto: no se remapeará, no se comparará por título/año/snapshot y no se sobrescribirá el ocupante. El exporter de esta versión considera inválido y no emite ese estado. Una futura capacidad de crear items local-only nuevos deberá definir su estrategia portable en su propio change; esta propuesta no agrega otro ID universal.

Alternativas consideradas:

- Tratar `manual` como provider: contradice el modelo decidido y obliga a inventar un namespace.
- Descartar `externalId`: puede duplicar items ante imports v1–v4 repetidos.
- Matching heurístico por título/año: puede fusionar items diferentes y está prohibido por el criterio conservador de identidad.

### 4. Reemplazar repositorios provider-pair por referencias completas

Los contratos internos introducirán conceptos mínimos equivalentes a:

```ts
type ProviderReference = {
  provider: string;
  resourceNamespace: string;
  externalId: string;
};

type SavedMediaItem = SavedTitle & {
  providerReferences: ProviderReference[];
};
```

El nombre concreto puede conservar `SavedTitle` para evitar una renombrada transversal, pero `provider` y `externalId` dejan de ser campos singulares del item. Los helpers de storage recibirán la conexión activa y una referencia completa.

El guardado TMDB se resolverá así dentro de una transacción pública:

1. Buscar exactamente `tmdb + type + externalId` en `media_provider_references`.
2. Si existe, cargar el MediaItem por `saved_title_id`, preservar `id`, `createdAt` y campos personales, refrescar el snapshot y mantener la semántica vigente de avance monotónico de `updatedAt` mediante `nextSavedTitleUpdatedAt`.
3. Si no existe, crear un MediaItem con un ID libre y luego su referencia TMDB.
4. No buscar por número TMDB solo y no reutilizar un item de otro namespace.

No se implementará una API pública para agregar una segunda referencia manualmente. La multiplicidad queda garantizada por el esquema y contratos, lista para cambios posteriores.

Las secciones 2, 3, 4 y 5 son un solo checkpoint de identidad funcional. Las revisiones intermedias pueden registrar findings, pero no habilitan un checkpoint manual: schema v4, repositorios v4, backup v5 y consumidores locales/TMDB deben aprobar juntos la revisión externa final de Sección 5. La revisión combinada 2+3+4 confirmó schema, migración, persistencia, modelo v5, import histórico, savepoints y Appearance, pero detectó dos bloqueos que continúan hacia la corrección y Sección 5: canonicalización TMDB en referencias v5 y consumidores runtime todavía dependientes de la proyección singular legacy.

Hasta que la sección 4 introduzca backup v5, los adaptadores de backup v4 son sólo una transición de implementación. Pueden proyectar items TMDB y manuales elegibles, pero no pueden serializar fielmente todo estado runtime válido: un pin v4 contiene `provider + externalId + context` y omite `resourceNamespace`. Si existen `tmdb/movie/N` y `tmdb/tv/N`, un pin `tmdb + N` no identifica a cuál pertenece. No se prohibirá esa coexistencia ni sus pins, no se fusionarán items y no se elegirá un namespace por orden o heurística. Backup v5 elimina la ambigüedad haciendo que cada pin apunte al `itemId` interno del backup. Los formatos v1–v4 mantienen su interpretación histórica hasta ser reemplazados como formato de exportación.

Archivos/capas afectadas:

- `src/core/savedTitle.ts`: separación de item y referencias manteniendo `TitleType`.
- `src/core/tmdbSavedTitle.ts`: materialización desde una referencia TMDB explícita.
- `src/storage/databaseSchema.ts` y `src/storage/db.ts`: schema v4, migración, bootstrap y verificación.
- `src/storage/savedTitlesRepo.ts` y `savedTitleIntegrity.ts`: lookup/upsert/delete transaccional por referencia completa.
- `src/storage/titlePinsRepo.ts` y snapshots: carga/exportación con identidad local, sin cambiar pinning observable.
- `app/tmdb/[type]/[id].tsx`: status/save con referencia TMDB completa.
- Consumidores locales de `SavedTitle`: adaptación mecánica donde actualmente leen el provider singular, especialmente el link remoto del detalle.

### 5. Mantener rutas locales y adaptar sólo el link TMDB

`/title/[id]` no cambia. El detalle guardado carga por ID local y obtiene sus referencias junto con el snapshot. Si encuentra una referencia TMDB reconocida puede construir `/tmdb/[namespace]/[externalId]`; si no existe, conserva el detalle local sin link remoto.

Biblioteca y las APIs de lectura usadas por consumidores locales devolverán el MediaItem con su colección completa de ProviderReferences. Deben funcionar tanto con múltiples referencias como con cero referencias, incluido un local-only defensivo importado desde v5 sin identidad legacy. Rating, tags, notas, status, pins, filtros, ordenamientos y detalle offline continúan resolviéndose por ID/snapshot local. Ningún consumidor elegirá arbitrariamente una referencia para reconstruir `provider/externalId`; la proyección singular v4 se retira de los caminos runtime normales y queda sólo en helpers internos de compatibilidad histórica donde sea necesaria.

`/tmdb/[type]/[id]` continúa siendo una ruta TMDB. Su `type` es el namespace del recurso TMDB y además alimenta el `TitleType` actual durante la normalización. No se crea una ruta genérica de providers en este cambio.

### 6. Definir backup v5 con referencias internas por item

El envelope conserva `version`, `exportedAt`, `items`, `pins` y `appearance`. La forma conceptual es:

```ts
type BackupMediaItemV5 = {
  id: string; // identidad del item dentro del backup
  providerReferences: Array<{
    provider: string;
    resourceNamespace: string;
    externalId: string;
  }>;
  legacyIdentity?: { // requerido por el exporter para todo local-only histórico
    format: "library-backup-v1-v4";
    provider: "manual";
    externalId: string;
  };
  // snapshot + datos personales actuales
};

type BackupPinV5 = {
  itemId: string;
  contextType: "library" | "tag";
  contextKey: string;
  pinnedAt: number;
};
```

El import v5 prevalidará IDs duplicados dentro del archivo y referencias externas repetidas. Para cada item:

- cada referencia pasa primero por una frontera provider-aware: providers desconocidos conservan el ID opaco validado por el constructor universal; `provider=tmdb` reutiliza `createTmdbProviderReference`, admite sólo `movie|tv`, canonicaliza exclusivamente IDs numéricos positivos y seguros, y exige que el namespace coincida con el `TitleType` actual del item;

- si una o más referencias resuelven un único item local, todas deben resolver ese mismo item; las referencias entrantes todavía libres pueden adjuntarse a ese item como restauración de identidad;
- si distintas referencias resuelven items locales distintos, se reporta conflicto y no se fusionan;
- ninguna referencia local existente se elimina por estar ausente del backup;
- si ninguna referencia resuelve pero una identidad legacy manual resuelve un item, se usa ese mismo item y se conserva `manual` fuera de ProviderReference;
- si ninguna referencia resuelve y el ID está libre, se conserva el ID;
- si ninguna resuelve, el ID está ocupado y existe al menos una referencia válida nueva, se genera un ID libre;
- si es local-only sin identidad legacy y su ID está ocupado, se reporta conflicto sin remap ni matching heurístico.

La resolución de identidad/referencias sucede antes y separada del merge de contenido. Una vez resuelto un item local existente:

- el `type` local debe coincidir con el `type` entrante; la discrepancia es un conflicto evaluado al inicio del savepoint, antes de adjuntar referencias, identidad legacy o contenido;
- se preservan siempre el `id` local y el `createdAt` local;
- el `updatedAt` entrante conserva la política vigente: ausente, anterior o igual omite la actualización de contenido; posterior habilita el merge;
- un merge habilitado reemplaza sólo campos presentes y distingue ausencia de `null` explícito, igual que el contrato actual;
- rating, tags, notas, status, snapshot y timestamps nunca se mueven a otro item para resolver una colisión de referencias;
- restaurar referencias libres compatibles no vuelve más nuevo el snapshot ni permite que contenido anterior/equivalente sobrescriba al local.

Adjuntar una referencia libre durante import es restauración declarada por el archivo, no matching automático ni una API pública de linking. Si una referencia entrante ya pertenece a otro item, todo el item entrante se reporta como conflicto antes de adjuntar referencias o aplicar contenido.

El mapa `backup itemId → local final id` se mantiene durante la importación y es la única vía para aplicar pins v5. Los savepoints preservan el aislamiento por item/pin actual. Un item fallido no aporta mapping; sus pins se reportan como no resolubles.

La regresión de portabilidad del checkpoint debe crear `tmdb/movie/77` y `tmdb/tv/77` como MediaItems distintos, asignarles datos personales independientes y pinear ambos en el mismo contexto. El export v5 debe producir identidades de item distintas, conservar ambas referencias completas y apuntar cada pin a su `itemId`. Al importar en una base vacía, rating, tags, notas, status y pins deben volver al MediaItem correcto sin resolver ninguna relación mediante el par incompleto `provider + externalId`.

Los parsers v1–v4 conservarán tipos literales históricos propios (`manual|tmdb`, `movie|tv`) en lugar de derivarlos del dominio live. Para TMDB, el item legacy aporta el namespace faltante. Los pins v2–v4 se agruparán por `provider + externalId` contra los items válidos del mismo archivo:

- una única identidad de item compatible permite resolver el pin;
- cero o más de una producen reporte inválido/ambiguo;
- un item manual usa `legacy_saved_title_identities` para reimportación determinista.

Appearance conserva exactamente la secuencia v4: se reserva antes, se activa sólo después del merge principal exitoso y sus fallos se reportan por separado. Browsing preferences y credenciales siguen excluidas.

Archivos principales afectados: `src/core/libraryBackup.ts`, nuevos contratos v5, contratos v1–v4 desacoplados del tipo live, `src/storage/libraryBackupExport.ts`, `libraryBackupMerge.ts`, `titlePinsBackup.ts`, `titlePinsRepo.ts` y la orquestación de `app/(tabs)/ajustes.tsx`.

### 7. No introducir una abstracción general de providers

Se agregarán sólo constructores/validadores de referencia y operaciones TMDB concretas. DTOs, endpoints, credenciales, imágenes, watch providers y atribución permanecen en `src/providers/tmdb` y sus pantallas actuales.

Alternativa considerada: definir ahora interfaces de búsqueda/detalle universales. Se difiere porque la taxonomía, capacidades opcionales y siguiente provider todavía no tienen contratos de producto; una interfaz anticipada cristalizaría supuestos no validados.

### 8. Mantener invariantes personales y de UI sin reinterpretación

`personalRating` sigue siendo `null` o entero `10..100`; `voteAverage` conserva semántica TMDB. `TitleType`, `TitleStatus`, tags, notas, clocks, pin contexts, ordenamientos y filtros conservan sus valores actuales. En particular, `updatedAt` continúa participando tanto en refresh de metadata y ordenamiento/import como en mutaciones personales; esta separación de identidad no lo congela ni lo redefine como timestamp exclusivamente personal. Appearance, view preferences y credenciales no cambian de ownership ni almacenamiento.

No se agregan dependencias.

## Risks / Trade-offs

- [Rebuild de tablas con foreign keys activas] → Renombrar primero las tablas dependientes, copiar y verificar dentro de una transacción, borrar temporales en orden dependiente→padre e inyectar fallos en cada fase.
- [El bootstrap actual recrea el índice viejo] → Hacer que bootstrap y evolución compartan una única definición versionada antes de retirar `idx_saved_titles_provider_external`.
- [Datos SQLite fuera de los unions TypeScript] → Validar toda fila antes de copiar; abortar la migración completa con un error diagnosticable en vez de omitir o coercionar datos.
- [Pins v2–v4 ambiguos] → Resolver mediante items del mismo backup y reportar ambigüedad; nunca elegir por orden ni por el estado local.
- [IDs local-only colisionados en v5] → Reportar conflicto si no existe una referencia/identidad legacy que pruebe equivalencia.
- [Un backup anterior intenta sobrescribir contenido local nuevo mientras restaura referencias] → Resolver identidad y referencias por separado, aplicar contenido sólo bajo el orden vigente de `updatedAt` y nunca eliminar referencias locales ausentes.
- [Dos referencias entrantes apuntan a distintos items locales] → Rechazar el item como conflicto; linking/merge permanece fuera de alcance.
- [Versiones viejas no leen schema v4 ni backup v5] → Publicar versión sólo tras verificación y documentar rollback mediante copia/backup previo compatible; mantener import v1–v4 en la versión nueva.
- [Cambio transversal difícil de revisar] → Implementar por secciones revisables, tratando schema v4, repositorios v4, backup v5 y migración de consumidores como un único checkpoint funcional 2+3+4+5, y ejecutar la revisión externa combinada antes del checkpoint manual.
- [Backup v5 introduce una variante TMDB no canónica] → Reutilizar la canonicalización del adaptador TMDB sólo en la frontera de referencias v5; rechazar namespace/ID inválidos o incompatibilidad con `TitleType`, manteniendo opacos los IDs de otros providers.
- [Un estado v5 válido rompe consumidores singulares] → Migrar Biblioteca, detalle local y lecturas públicas al MediaItem con referencias; no elegir una referencia arbitraria y reservar la conversión singular para import histórico dedicado.
- [La multiplicidad existe sin UI para gestionarla] → No exponer operaciones de linking; sólo migración y backup pueden materializar el estado estructural permitido.

## Migration Plan

1. Antes de escribir, verificar que la versión sea compatible y que las estructuras v3 requeridas existan.
2. Ejecutar el rebuild, copia de datos, creación de referencias y copia de pins dentro de una sola transacción de evolución.
3. Verificar schema y equivalencia de datos antes de publicar `user_version = 4`.
4. Ante cualquier fallo, dejar que la transacción revierta nombres, tablas, índices, datos y versión; cerrar la conexión como hace la inicialización actual.
5. Después de publicar v4, usar exclusivamente `media_provider_references` para identidad externa y `legacy_saved_title_identities` sólo para compatibilidad manual v1–v4.
6. Exportar únicamente v5 desde la aplicación nueva y mantener parsers/importers explícitos para v1–v4.

Rollback operativo: antes de distribuir la versión, conservar un backup v4/base v3 de prueba y verificar su restauración. Una vez que una instalación publica schema v4 o datos representables sólo en backup v5, volver al binario anterior requiere restaurar la base/backup previo; no se hará downgrade destructivo automático.

## Open Questions

No queda una decisión de producto que bloquee esta implementación. Los nombres finales de tipos auxiliares y tablas temporales pueden ajustarse durante APPLY sin cambiar los contratos, siempre que mantengan las cuatro identidades separadas: ID local, referencia externa, `TitleType` actual y namespace del proveedor.
