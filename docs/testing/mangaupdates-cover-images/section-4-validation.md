# Sección 4 — persistencia y backup, preparación inactiva

Fecha: 2026-11-09. Cambio: enable-mangaupdates-cover-images, esquema spec-driven. Solo se completaron 4.1 y 4.2; progreso 8/14. No se implementaron Secciones 5–7. Se detiene para revisión externa del diff real y checkpoint manual del usuario antes de Sección 5.

## Archivos exactos de esta sección

Creados:

- docs/testing/mangaupdates-cover-images/section-4-verification.cjs
- docs/testing/mangaupdates-cover-images/section-4-validation.md

Modificados:

- docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs
- openspec/changes/enable-mangaupdates-cover-images/tasks.md (solo checkboxes 4.1 y 4.2)

No se modificó código productivo. El test histórico de fallo controlado tenía DDL obsoleto con columna type y ejecutaba el merge actual, que usa medium/content_family/primary_format. Se sustituyó exclusivamente su preparación de DB por ensureLibrarySchema real y un adaptador node:sqlite compatible con parámetros array/variádicos. Se conservaron el trigger de fallo, sus tres entradas y todas las assertions existentes. Se añadieron verificaciones de user_version 5, integridad de claves foráneas y ausencia de título huérfano. No se cambió el contrato productivo para hacer pasar un test.

## Ejecución real y límites del harness

Entorno: Windows, PowerShell, Node v22.18.0, TypeScript instalado en el proyecto. El test focalizado crea **18 conexiones SQLite independientes :memory:** mediante node:sqlite DatabaseSync; activa foreign_keys y llama a ensureLibrarySchema sobre cada una. El adaptador convierte la interfaz async del repositorio en consultas SQL reales; no simula filas, repositorios, materializadores, parsers, exportadores o merges. Todas las conexiones se cierran al finalizar, también ante error. Nunca abre despues-la-veo.db.

Se sustituye únicamente el módulo expo-sqlite por un guard que rechaza apertura accidental; la DB de prueba se pasa por los parámetros WithDb o el argumento database de saveProviderTitle. fetch y cargas de módulos de red HTTP/HTTPS/net/TLS/http2 o clientes del proveedor están prohibidos; contador final de intentos: 0. Las URLs del CDN son strings TEST controlados, sin peticiones, sondeos, Image ni renderizado. No se usó arte real.

Funciones reales ejercitadas por el test nuevo:

- parseSeries y mangaUpdatesMaterializationInput.
- providerReferenceKey y validación de referencias a través del mapper/repositorio/parser.
- saveProviderTitle, su cola serializada/transacción, saveProviderTitleWithDb, materializeProviderSavedTitle, validateProviderMaterializationInput y refineMediaClassification.
- getSavedTitleWithReferencesByIdWithDb, getSavedTitleByProviderReferenceWithDb, attachProviderReferenceWithDb, listSavedTitlesWithDb y conversión de filas.
- updateSavedTitleMetadataWithDb, setPersonalRatingWithDb y upsertSavedTitleAndCleanPinsWithDb.
- setTitlePinStateWithDb, listAllPinsForBackupV5WithDb y limpieza/merge de pins reales.
- createTmdbSavedTitleMaterializationInput y createTmdbProviderReference para verificar ownership de rating.
- getLibraryBackupExportDataWithDb → createLibraryBackupV6 → JSON → parseLibraryBackup → mergeLibraryBackupWithDb dentro de transacción real → lecturas y re-export real.

No se ejercita el selector de archivos de Ajustes ni el driver nativo expo-sqlite en dispositivo. Los wrappers de backup con WithDb son las implementaciones reales que usan los wrappers públicos; no se reemplazan con mocks. La regresión expanded-media-domain/section-2 también ejercita el wrapper público de merge y sus transacciones. No hubo validación visual, nativa o física Android en esta sección de persistencia.

## Resultados 4.1

- Manga, Manhwa y Manhua se materializan y guardan con provider=mangaupdates y namespace=series. IDs como 9007199254740993123456789012345678900 quedan exactamente como TEXT y strings en lecturas/referencias.
- Lookup por el tuple completo: mismo externalId con otro provider o namespace no resuelve el título MangaUpdates. No se implementó matching entre proveedores.
- Re-save usa el ID local existente sin invocar generador; createdAt se conserva, updatedAt avanza y no hay duplicación. Se comprueba el número exacto de títulos después de múltiples re-saves.
- Status watching/done/dropped, notas, tags, personalRating y todas las ProviderReferences permanecen iguales. Se conservan pins de biblioteca y etiqueta, incluidos pinnedAt.
- La clasificación genérica refina primaryFormat desconocido a one-shot/webtoon; input posterior menos específico o con familia distinta no reemplaza clasificación conocida. Un cambio de medium se rechaza sin alterar datos.
- MangaUpdates crea con initialTags=[], planned y ratings null. initialTags vacío o distinto en refresh no reemplaza tags personales.
- MangaUpdates no incluye voteAverage en su input; suministrarlo como número, null o undefined se rechaza sin escrituras. Un valor histórico existente se preserva cuando no está presente en input. TMDB conserva su capacidad de crear/actualizar su rating mediante el pipeline real.
- Poster string → otra URL → null → string persiste exactamente. El dato visual no participa de estas escrituras; solo los refresh explícitos las producen.
- Un título anterior con poster null conserva íntegros datos y timestamps después de lecturas, revalidación de esquema y refresh de otros títulos: no hay backfill.
- Materialización omit explícita y default real producen null; un save con omit persiste null. reference-https se usa únicamente como argumento explícito del test.

## Resultados 4.2

- Export v6 desde SQLite, parse/import en otra DB y re-export recuperan exactamente títulos URL/null, ID local, createdAt/updatedAt, datos personales, clasificación, referencias múltiples, IDs externos grandes y pins.
- Reimportar el mismo backup no duplica: metadata skipped y pins preserved según contratos existentes.
- Un backup más nuevo resuelto por referencia conserva ID local y createdAt; aplica los campos entrantes, incluidos poster null, clasificación explícita, status/notas/tags/rating. Esto sigue el merge de backups, cuya semántica difiere del refresh de proveedor.
- Se prueba que import más viejo o igual no reemplaza metadata; un input compatible viejo puede añadir una referencia libre conforme al contrato existente.
- Pin de biblioteca existente conserva su timestamp; eliminar una etiqueta limpia su pin; un pin de etiqueta nueva se restaura. Una colisión de ID con otro título remapea ID/pins entrantes sin modificar al ocupante.
- El importer genérico acepta y persiste una URL propia fuera del host MangaUpdates; no se añadió allowlist a backups. En v6, posterUrl ausente preserva el valor, mientras null explícito lo limpia en una actualización elegible.
- Los items exportados tienen exactamente las claves actuales de SavedTitle + providerReferences. Solo contienen strings/null de posterUrl; no hay campos nuevos, binarios, data:image, base64 ni sentinels en los backups generados por estos casos. No se añade una nueva regla restrictiva al formato genérico histórico.
- Las 18 DBs terminan con PRAGMA user_version=5 y foreign_key_check vacío. Los exports siguen version=6. Además se compara sqlite_master antes/después de save/restore sin cambios de tablas/índices/campos.

Rollback en bases separadas:

- Trigger SQL de fallo al adjuntar referencia: saveProviderTitle revierte el título y referencia en la misma transacción.
- Trigger SQL de fallo al actualizar poster_url: refresh URL → null rechazado conserva snapshot completo de títulos/referencias/datos personales/pins.
- Trigger SQL durante import: el savepoint del item fallido no deja título/referencias/pins huérfanos; el peer válido se guarda y se reportan counts y pin inválido correctos.
- Aborto antes de COMMIT de la transacción externa: revierte todos los títulos/referencias/pins del import; posterior reintento recupera el backup exacto.

## Compatibilidad histórica

Para cada versión 1–6 se crea una DB independiente, se ejecutan parse e import reales, actualización con poster/metadata ausentes, actualización con poster y notas null explícitos, export actual v6 y reimport en otra DB independiente. Se comprueban identidad, createdAt, pins, tags/status/rating y referencias finales.

v1/v2 ignoran personalRating como campo no perteneciente a esas versiones; se verifica rating null al insertar y que una puntuación local posterior sobrevive una actualización histórica sin rating. v3–v6 requieren personalRating explícito según el contrato existente. Los archivos v1–v5 siguen usando la taxonomía audiovisual histórica, sin intentar habilitar MangaUpdates en esos formatos. La regresión existente cubre las fixtures históricas v1 (incluidas opcionales ausentes y null explícito), v3, v5 y el pipeline v1–v6 sobre SQLite v5.

## Comandos y exit codes

Desde D:/dev/despues-la-veo. Las **14 suites** siguientes finalizaron con **exit 0**. No se editaron ni debilitaron los tests de Secciones 1–3.

| Comando exacto | Exit final |
| --- | --- |
| node docs/testing/mangaupdates-cover-images/section-4-verification.cjs | 0 |
| node docs/testing/mangaupdates-cover-images/section-1-verification.cjs | 0 |
| node docs/testing/mangaupdates-cover-images/section-2-verification.cjs | 0 |
| node docs/testing/mangaupdates-cover-images/section-3-verification.cjs | 0 |
| node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs | 0 |
| node docs/testing/universal-media-identity/section-3-persistence-verification.cjs | 0 |
| node docs/testing/expanded-media-domain/section-8-verification.cjs | 0 |
| node docs/testing/expanded-media-domain/section-2-verification.cjs | 0 |
| node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs | 0 |
| node docs/testing/personal-title-rating/section-3-verification.cjs | 0 |
| node docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs | 0 |
| node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs | 0 |
| node docs/testing/expanded-media-domain/section-1-verification.cjs | 0 |
| node docs/testing/expanded-media-domain/section-6-verification.cjs | 0 |
| npx tsc --noEmit | 0 |
| git diff --check | 0 |

Fallos/correcciones registrados:

1. node docs/testing/mangaupdates-cover-images/section-4-verification.cjs: una ejecución intermedia devolvió **1** (null !== 71) por expectativa incorrecta del test nuevo sobre personalRating de v1/v2. Se inspeccionó el parser real, se corrigió el test para comprobar el contrato histórico, se añadió preservación de rating local posterior y se reejecutó: **0**. Los escenarios previos de save/backup/rollback ya pasaban en esa ejecución. No hubo cambio productivo.
2. node docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs: ejecución inicial **1** (inserted 0 !== 2), porque el harness obsoleto creaba type en vez del esquema actual. Se reemplazó la preparación por ensureLibrarySchema real y se reejecutó: **0**, inserted=2, failed=1 por el trigger previsto, sin huérfanos y sin afectar el peer posterior. La DB temporal en disco se cerró y eliminó mediante el cleanup existente.
3. Node emite ExperimentalWarning de node:sqlite. No es un fallo de suite. TypeScript no emitió diagnósticos.

## Invariantes y estado final

Producción MangaUpdates sigue omit explícito en búsqueda y ambas materializaciones del detalle. No se modificaron política productiva, mapper, cliente API, gates Web/iOS, allowlist, repositorios, SQL productivo, SQLite v5, backup v6, UI, dependencias ni lockfiles. No hay nuevos proveedores, caché, descargas, backfill o sincronización. No se tocaron canonical specs ni archivos archivados.

package.json era la única modificación personal inicial. Su SHA256 al inicio fue 262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78; se verifica el mismo valor al cierre. No se escribió ese archivo. Se usaron git status/diff/diff --check solo para lectura; sin staging, commits, pushes u otras mutaciones Git.

Pendientes y sin marcar: 5.1, 5.2, 6.1, 6.2, 7.1 y 7.2. No se hace archive ni sync. La preparación sigue inactiva y no afirma derechos de arte, enforcement de redirects, aceptación Android o disponibilidad offline de portadas.
