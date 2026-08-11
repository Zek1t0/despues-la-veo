## Context

Ver `proposal.md` para la motivación y los delta specs para el contrato observable. Hoy `SavedTitle.voteAverage`/`vote_average REAL` representa exclusivamente TMDB; `saved_titles` no posee rating personal. El schema está en v2, `updatedAt` gobierna el merge de items de backup y los pins contextuales viven en `title_pins` con `pinnedAt` propio.

El repositorio usa objetos `SavedTitle` completos para upsert. En particular, `app/tmdb/[type]/[id].tsx` reconstruye un título existente conservando sólo `id` y `createdAt`, por lo que hoy puede resetear `status`, `tags` y `notes`. La incorporación de rating no puede perpetuar esa pérdida de metadata.

Capas y archivos previstos:

- Dominio: `src/core/savedTitle.ts` y un helper pequeño de rating en `src/core/`.
- SQLite: `src/storage/databaseSchema.ts`, `src/storage/db.ts` y pruebas/fixtures de migración.
- Mapping y escritura: `src/storage/libraryBackupMerge.ts`, `src/storage/savedTitleIntegrity.ts`, `src/storage/savedTitlesRepo.ts`, `src/storage/storageMutationQueue.ts`.
- TMDB: `app/tmdb/[type]/[id].tsx` sin cambiar la API externa.
- Backup: `src/core/libraryBackup.ts`, `libraryBackupV1.ts`, `libraryBackupV2.ts`, nuevo contrato v3, export/merge y `app/(tabs)/ajustes.tsx`.
- Sort/preferencias: `src/core/viewPreferences.ts`, `src/core/libraryView.ts`, `src/storage/viewPreferencesRepo.ts`, `app/(tabs)/libreria.tsx`.
- UI: `app/title/[id].tsx`, filas Detail/list de `app/(tabs)/libreria.tsx` y `app/(tabs)/etiquetas.tsx`.
- Fuera de los archivos afectados: `src/components/browsing/TitleGridCard.tsx`, `TagCollage.tsx` y `app/(tabs)/buscar.tsx`.

## Goals / Non-Goals

**Goals:**

- Mantener una única interpretación canónica de `personalRating` entre dominio, SQLite, backup, sorting y UI.
- Evolucionar datos existentes sin reescribir o perder títulos, preferencias o pins.
- Proveer un setter que actualice sólo una fila existente y serialice cambios rápidos.
- Separar explícitamente metadata TMDB de metadata personal al re-save.
- Mantener compatibilidad de preferencias y backups anteriores.

**Non-Goals:**

- Crear una tabla de ratings, timestamps separados o historial.
- Generalizar todos los upserts o construir una capa ORM.
- Añadir dependencias de slider/control numérico.
- Añadir rating a Grid, Search, collages, filtros o contextos de tags.
- Cambiar identidad lógica, esquema de pins o ordering manual.

## Decisions

### 1. `personalRating` usa décimas enteras también en el dominio

`SavedTitle.personalRating` será `number | null`, pero todo valor no-null significará siempre un entero canónico `10..100`, no el decimal visible `1.0..10.0`. El mismo entero viajará por dominio, repositorio, SQLite, backup y comparators.

Helpers explícitos concentrarán los boundaries:

- validación/assert: `Number.isInteger(value) && value >= 10 && value <= 100`;
- format: `87 → "8.7"`;
- parse de input visible: sólo produce un entero si la entrada representa exactamente una décima válida;
- incremento/decremento: suma/resta enteros, nunca floats.

Esto elige la opción A solicitada. Evita que `8.7 * 10`, comparaciones o serialización introduzcan ambigüedad binaria y evita que distintos módulos interpreten `personalRating` en escalas diferentes. La alternativa B —decimal visible en dominio y conversión sólo en storage— hace más amable el tipo superficial, pero permite errores de precisión y múltiples conversiones implícitas. Un branded type podría reforzar aún más el contrato, pero se difiere salvo que TypeScript demuestre que un alias simple aporta valor sin sobreabstraer.

### 2. Columna nullable con constraint y schema v3

SQLite almacenará `personal_rating INTEGER NULL` protegido para aceptar sólo `NULL` o enteros `10..100`. `DATABASE_SCHEMA_VERSION` pasa de 2 a 3.

La evolución seguirá el orquestador transaccional existente:

1. Leer y rechazar versiones futuras antes de mutar.
2. Asegurar/verificar las estructuras previas requeridas.
3. Si la columna no existe, añadirla de forma no destructiva con default implícito `NULL` y constraint de dominio compatible con SQLite.
4. Si existe, verificar nombre, afinidad, nullabilidad y protección de dominio; no ejecutar otro `ALTER`.
5. Verificar que `saved_titles`, su índice único, `app_preferences` y `title_pins` continúan íntegros.
6. Publicar `PRAGMA user_version = 3` sólo después de todas las verificaciones.

Esto soporta v0→v1→v2→v3, v1→v2→v3, v2→v3, v3 idempotente y rechazo de future versions. No se recreará `saved_titles` si `ALTER TABLE ... ADD COLUMN ... CHECK` resulta compatible con las versiones objetivo; si un spike de implementación demuestra lo contrario, se usará reconstrucción transaccional con copia y verificaciones explícitas, nunca una migración destructiva improvisada.

Alternativa considerada: tabla `title_ratings`. Facilita constraints y timestamps propios, pero exige joins, backup separado y otra semántica de ausencia sin aportar valor para un único rating global.

### 3. Mapping y escrituras validan el dominio en cada boundary

`rowToSavedTitle`, materializadores de backup, export y cualquier setter validarán `personal_rating`/`personalRating`. No se hará clamp ni rounding. Un valor SQLite inválido debe fallar de manera visible durante lectura/verificación, no convertirse silenciosamente en `null`.

El upsert completo incluirá la columna para los flujos que realmente reemplazan un item. La edición del rating no usará ese upsert: tendrá una operación específica equivalente a:

```text
UPDATE saved_titles
SET personal_rating = ?, updated_at = ?
WHERE id = ?
```

El resultado debe demostrar que se actualizó exactamente una fila; cero filas significa título inexistente y falla. No habrá `INSERT` ni `ON CONFLICT` en el setter, por lo que una escritura pendiente no puede resucitar un título eliminado. La operación participará en `runSerializedStorageMutation` y en una transacción cuando sea necesario.

### 4. Re-save TMDB separa campos remotos y personales

La ruta TMDB resolverá primero el `SavedTitle` existente por `provider + externalId`. Para existentes conservará:

- `id`, `createdAt`;
- `status`, `tags`, `notes`, `personalRating`.

Actualizará desde TMDB:

- `type`, `title`, `year`, `posterUrl`, `overview`, `genres`, `voteAverage`;
- `updatedAt` con la hora del re-save, según el comportamiento vigente.

Para títulos nuevos seguirá inicializando estado/tags/notas según el comportamiento actual y `personalRating: null`. Se implementará como composición explícita del objeto, limitada a esta ruta; no se hará un refactor general de repositorios. `voteAverage: null` nunca afectará `personalRating`.

### 5. `updatedAt` es el único reloj del rating

Asignar, cambiar o quitar `personalRating` escribirá el nuevo `updatedAt`. Esto hace que la edición participe en “Actualizados recientemente” y en el merge existente. No habrá `personalRatingUpdatedAt`, porque introducir dos relojes requeriría una política de merge por campo distinta a la aprobada.

Las escrituras serializadas deberán producir un `updatedAt` no decreciente y conservar el orden lógico de ediciones confirmadas. Para `87@T → 88 → 89`, el resultado final será `89` y su timestamp no será anterior al confirmado para `88`. Durante implementación se elegirá la solución mínima compatible con el repositorio —por ejemplo, derivar cada timestamp del máximo entre el reloj actual y el último confirmado, avanzando una unidad cuando el contrato de merge necesite distinguir estrictamente dos writes ocurridos en el mismo milisegundo— sin crear otro reloj ni timestamp de rating.

### 6. Sorts extienden el union type sin invalidar preferencias

El union actualmente llamado `LibrarySort` (no existe `LibrarySortMode` separado en el código) añadirá `personal-rating-desc` y `personal-rating-asc`. `rating-desc` seguirá aceptado y conservará su significado TMDB; sólo cambiará su label visible a uno inequívoco.

El comparator personal trabajará directamente con enteros canónicos. Para ambos sentidos:

1. valores presentes antes que `null`/ausentes;
2. valor ascendente o descendente;
3. título con el collator actual;
4. `id`.

`selectVisibleLibraryTitles` no cambia de pipeline: filtra, separa por el mapa de pins, ordena pinned por `pinnedAt DESC` y usa el comparator activo sólo en empate; luego ordena unpinned normalmente. Etiquetas sólo muestra el valor pasivamente en este alcance; no se añade sort de rating allí.

### 7. Backup v3 extiende items y conserva pins v2

Se añadirá un parser/contrato v3 que reutilice deliberadamente normalización de items y pins sin hacer que v1/v2 adquieran accidentalmente requisitos v3. El envelope será:

```text
version: 3
exportedAt?: string
items: SavedTitle[] con personalRating
pins: contrato portable v2
```

La representación normalizada interna de `personalRating` conservará presencia:

```text
{ present: false } // sólo formatos que legítimamente no poseen el campo, principalmente v1/v2
{ present: true, value: null }
{ present: true, value: 10..100 }
```

En v3 la propiedad es obligatoria en cada item. Su ausencia invalida y reporta el item; nunca se transforma en `present: false`. El export v3 siempre la emite, incluso cuando vale `null`.

Reglas de materialización/merge:

- insert v1/v2 ausente → `null`;
- insert v3 número/null → valor exacto;
- coincidencia con fecha anterior, igual o ausente → skip completo;
- coincidencia v3 más reciente → número reemplaza y `null` borra;
- coincidencia v1/v2 más reciente con campo legítimamente ausente → preserva el rating local mientras actualiza los demás campos elegibles.

La identidad continúa siendo `provider + externalId`, con conflicto de `type` existente. Items se procesan antes que pins. Los pins v3 reutilizan merge aditivo/idempotente, validación contextual e informes de v2. Preferencias siguen excluidas.

Se elige v3 en vez de añadir silenciosamente un campo a v2: una app antigua debe rechazar de forma segura un backup que no puede restaurar completamente, no aceptarlo y perder la puntuación al reexportar.

### 8. UI inicial usa editor local sin dependencia nueva

El detalle completo mostrará tarjetas o secciones inequívocas para “Tu puntuación” y “TMDB”. El editor combinará un valor actual claramente visible, decremento/incremento exacto de `0.1`, una forma razonable de recorrer rápidamente el rango y una acción separada “Quitar puntuación”. Durante Apply podrá elegirse entre entrada numérica validada, control rápido nativo disponible o combinación, siempre que cumpla los specs y la revisión manual.

No se fija una dependencia Slider. Usar controles React Native existentes reduce riesgo web/móvil. No se renderizarán 91 botones.

Biblioteca y Etiquetas Detail/list formatearán el entero con el helper compartido y lo mostrarán pasivamente. Los controles seguirán siendo hermanos del `Pressable` de navegación cuando corresponda; no se añadirán controles nested. Grid, `TitleGridCard`, `TagCollage` y Search permanecen intactos.

### 9. Rapid writes usan una cola específica mínima

Si el editor permite cambios antes de completar la escritura anterior, un `PersonalRatingIntentQueue` pequeño mantendrá:

- `confirmed`: último valor persistido;
- `latest`: última intención visible;
- secuencia monotónica;
- cola de persistencia serial.

Cada request aplica optimistic UI. Una escritura exitosa avanza `confirmed`. Una falla sólo hace rollback cuando sigue siendo la última secuencia relevante; una falla superada no pisa `latest`. Antes de recargar/navegar en un flujo que pueda reemplazar estado, se aguardará la cola o se invalidará su generación de manera explícita.

La misma secuencia coordinará la asignación monotónica de `updatedAt`: cada write confirmado conservará el orden de intenciones aun cuando dos lecturas de `Date.now()` colisionen. El detalle exacto queda para la implementación mínima del setter/cola, pero no puede introducir `personalRatingUpdatedAt`.

No se reutiliza `ContextualPinIntentQueue`: aunque el patrón confirmed/latest es útil, sus nombres, payload `pinnedAt` y semántica contextual no corresponden al rating. Tampoco se generaliza hasta que exista un segundo consumidor real.

## Risks / Trade-offs

- [Un `number` no expresa por sí solo la unidad de décimas] → helper central, naming/documentación explícitos y tests de boundaries; considerar alias liviano sólo si mejora seguridad sin casts dispersos.
- [Upsert TMDB puede borrar metadata personal] → composición explícita de campos preservados y regresiones que cubran estado, tags, notas y rating.
- [Una migración parcialmente aplicada puede publicar v3 incorrectamente] → transacción, detección de columna, verificación previa a `user_version` y fixtures por cada versión de entrada.
- [SQLite puede no permitir el constraint deseado en un ADD COLUMN en algún target] → comprobar en la tarea de migración; reconstrucción transaccional sólo si es necesaria y con conteos/integridad verificados.
- [Cambios rápidos producen resultados fuera de orden] → cola confirmed/latest específica y storage mutation queue.
- [Dos writes rápidos reciben el mismo `Date.now()`] → asignación monotónica mínima dentro de la escritura serializada para no perder el orden exigido por el merge.
- [Un título se borra durante una escritura] → setter UPDATE-only y verificación de filas afectadas.
- [Backups viejos posteriores pueden borrar rating moderno] → presencia explícita; campo ausente preserva local en updates.
- [Apps antiguas no leen v3] → rechazo explícito por versión; conservar import v1/v2 en apps nuevas.
- [Más información rompe filas angostas] → indicador pasivo compacto y QA manual móvil/web, sin rediseño general.
- [Cambio local preexistente en `TitleGridCard.tsx`] → mantener el archivo fuera del diff de esta feature y revisar el diff externo antes de Archive.

## Migration Plan

1. Añadir helpers/tipo y soporte de lectura nullable sin publicar v3 antes de que todos los mappings estén preparados.
2. Probar evolución sintética desde v0, v1 y v2; probar apertura repetida de v3 y rechazo de versión futura.
3. Ejecutar la migración transaccional, verificar estructuras/datos y sólo entonces establecer `user_version = 3`.
4. Incorporar setter, backup v3, sorting y UI en checkpoints separados con `npx tsc --noEmit` y pruebas focalizadas.
5. Antes de release/export v3, crear y verificar un backup recuperable de datos de prueba y completar pruebas de round-trip v1/v2/v3.

Rollback:

- Antes de publicar v3: revertir código sin tocar datos.
- Después de publicar v3: no bajar `user_version` ni eliminar la columna. Volver a una build compatible con v3 o restaurar un backup verificado. La columna nullable permite mantener datos anteriores intactos, pero una build v2 no debe abrir deliberadamente una DB marcada v3.

## Open Questions

- La composición visual exacta del control rápido (entrada numérica, controles incrementales y/o control nativo existente) puede decidirse durante Apply y QA manual siempre que no cambie precisión, accesibilidad, dependencias ni superficies habilitadas.
