## Why

La biblioteca identifica localmente cada título mediante un `id` estable, pero sus escrituras y backups todavía deduplican por `provider + externalId`, mientras TMDB necesita además distinguir su recurso `movie` o `tv`. Esa diferencia impide representar correctamente una película y una serie TMDB con el mismo ID numérico y puede reasociar metadata con datos personales de otro título.

## What Changes

- Establecer el ID local opaco existente como identidad estable del MediaItem y propietario de rating personal, tags, notas, estado, pins y timestamps.
- Separar las referencias externas en una relación capaz de almacenar `provider + resource namespace + external ID`, admitir varias referencias por MediaItem y admitir MediaItems sin referencia.
- Migrar de forma determinista los títulos TMDB existentes, preservando sus IDs locales, snapshots, datos personales y pins sin consultar la red.
- Conservar los títulos manuales históricos como MediaItems locales sin convertir `manual` en un proveedor externo; mantener información de compatibilidad sólo donde sea necesaria para reimportar backups anteriores de forma repetible.
- Corregir en conjunto el esquema, su bootstrap/verificación, los repositorios y la adaptación mínima de TMDB para que `tmdb/movie/N` y `tmdb/tv/N` se resuelvan como recursos distintos.
- Introducir un backup posterior a v4 donde items, referencias externas y relaciones internas como pins puedan restaurarse mediante identidad local al backup y un mapa explícito hacia los IDs locales finales.
- Mantener en backup v5 el merge vigente por `updatedAt` y presencia explícita de campos después de resolver identidad, adjuntando referencias nuevas sólo cuando todas las ya resueltas señalan al mismo MediaItem y sin borrar referencias locales ausentes del backup.
- Garantizar reimports deterministas de items local-only históricos exportando su identidad legacy manual; la versión actual no emitirá items local-only sin referencia externa ni identidad legacy.
- Mantener la interpretación histórica de backups v1–v4 y reportar referencias legacy ambiguas o inválidas sin adivinar su destino.
- Preservar el detalle local `/title/[id]`, los flujos TMDB actuales, la semántica de importación parcial con integridad transaccional y la aplicación posterior e independiente de Appearance.
- Mantener fuera de alcance la abstracción completa de providers, nuevos providers, una taxonomía universal, progreso, relaciones, sync y rediseños de UI.

## Capabilities

### New Capabilities

- `universal-media-identity`: Define la identidad local estable de MediaItem, las referencias externas calificadas por namespace y la convivencia segura de recursos TMDB con IDs numéricos iguales.

### Modified Capabilities

- `library-backup-integrity`: Evoluciona el backup para representar MediaItems y sus referencias externas sin usar identidad de proveedor como foreign key interna, preservando importación v1–v4 y sus fallos parciales reportables.

## Impact

- Afecta contratos de dominio en `src/core`, el esquema SQLite y su evolución en `src/storage`, las consultas/upserts de títulos y pins, y la normalización mínima del flujo TMDB en `app/tmdb` y `src/providers/tmdb`.
- Requiere una migración SQLite transaccional, idempotente y verificada que preserve instalaciones existentes; un fallo debe revertir el nuevo esquema y conservar la versión y los datos anteriores.
- Requiere un nuevo contrato de backup y compatibilidad explícita con versiones 1–4. No cambia ratings `10..100 | null`, tags, notas, estados, pinning, browsing preferences, Appearance ni credenciales TMDB.
- Las referencias externas usan tokens canónicos de provider/namespace y un ID externo opaco normalizado por cada adaptador; para TMDB esto fija `tmdb`, `movie|tv` y una única representación decimal del ID numérico.
- No agrega dependencias. Una versión anterior de la aplicación no podrá abrir una base publicada con la nueva `user_version`; la reversión operativa consiste en restaurar el binario anterior junto con un backup/base anterior compatible, no en intentar que código antiguo interprete el esquema nuevo.
