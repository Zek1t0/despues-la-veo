## Why

La biblioteca sólo conserva y ordena hoy la puntuación comunitaria de TMDB, por lo que el usuario no puede registrar su propia valoración de un título sin confundir ambos conceptos. Se necesita una puntuación personal local, global por `SavedTitle`, portable en backups y compatible con el ordenamiento y el pinning contextual existentes.

## What Changes

- Añadir una puntuación personal opcional, global y editable exclusivamente desde el detalle completo del título, con escala visible `1.0..10.0` en pasos exactos de `0.1` y `null` como “Sin calificar”.
- Persistir la puntuación canónicamente como décimas enteras `10..100` en una nueva columna nullable de `saved_titles`, mediante una evolución SQLite transaccional de versión 2 a 3.
- Mostrar por separado la puntuación personal y la puntuación TMDB en el detalle completo, y mostrar pasivamente la puntuación personal en las vistas Detail/list de Biblioteca y Etiquetas.
- Preservar toda metadata personal —incluida la puntuación— cuando un título existente se vuelve a guardar desde TMDB.
- Mantener el sort TMDB existente `rating-desc` con un label inequívoco y añadir `personal-rating-desc` y `personal-rating-asc`, colocando siempre los títulos sin puntuación al final.
- Mantener intacta la prioridad de pins contextuales: el comparator activo sólo desempata pins con el mismo `pinnedAt` y ordena normalmente los elementos no fijados.
- Incorporar backup versión 3, donde cada item contiene obligatoriamente `personalRating` como `null` o entero `10..100`; sólo v1/v2 se normalizan legítimamente como campo ausente para preservar el valor local durante un merge más reciente.
- Soportar cambios rápidos que converjan a la última intención, mantengan `SavedTitle.updatedAt` no decreciente ante colisiones del reloj, hagan rollback sólo del último fallo relevante y rechacen limpiamente escrituras sobre títulos eliminados.
- Mantener fuera de alcance Grid, Search, ratings contextuales, filtros por rating, estadísticas y cambios de pins o collages.

## Capabilities

### New Capabilities

- `personal-title-rating`: Define el dominio, persistencia, edición, presentación, validación, accesibilidad y protección de metadata de la puntuación personal global.
- `rating-aware-library-sorting`: Define los sorts inequívocos de TMDB y puntuación personal, sus desempates, tratamiento de ausentes y composición con pins contextuales.

### Modified Capabilities

- `library-backup-integrity`: Evoluciona el contrato a backup v3 con puntuación personal, preservando compatibilidad v1/v2, merge por `updatedAt`, identidad portable y semántica de pins.

## Impact

- Afecta el tipo `SavedTitle`, schema/migración SQLite, serializers, repositorios y setters de almacenamiento.
- Afecta el re-save desde el detalle TMDB para evitar pérdida de estado, tags, notas y puntuación personal.
- Afecta preferencias y comparators de Biblioteca, sin invalidar el modo persistido `rating-desc`.
- Afecta el detalle completo y las filas Detail/list de Biblioteca y Etiquetas; no afecta `TitleGridCard`, `TagCollage` ni Search.
- Afecta parser, exportación, importación, fixtures y reportes de backup v1/v2/v3.
- No requiere una dependencia nueva; cualquier incorporación futura necesitará justificación separada.
- Riesgo principal: pérdida silenciosa de metadata personal por upserts completos o merges incorrectos. La implementación debe preservar campos personales y validar las tres representaciones de presencia antes de publicar schema/backup v3.
- Reversión: antes de publicar SQLite v3 debe existir backup verificable; una vez escrita la columna, el rollback seguro es volver al código compatible con v3 o restaurar un backup, no bajar `user_version` ni eliminar la columna de manera destructiva.
