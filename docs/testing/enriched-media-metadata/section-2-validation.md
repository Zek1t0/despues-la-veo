# Sección 2 — Persistencia y backups

## Alcance y checkpoint

Baseline confirmado: rama `feat/anime-catalog-manual-entries`, HEAD `083131c56362eeba270bed816b5deb084362579f`, padre `1c14377bd95c31a3240bf9846ab2272cf45c1c55`. Worktree limpio al iniciar. El commit `feat: add enriched media metadata contracts and provider mappings` registra los 29 archivos de contratos, mappers, pruebas y artefactos de la entrega aprobada. La aprobación externa fue informada por el usuario; no se afirma haber realizado esa revisión nuevamente. **1.6 se cierra administrativamente** por esa aprobación y el checkpoint verificado, sin cambiar su implementación.

Autorización de esta ejecución: **2.1–2.8**. **2.9 permanece pendiente** de revisión externa y checkpoint manual. No se ejecutaron secciones 3–8 ni operaciones Git de escritura. El change anterior continúa abierto, 22/24; su carpeta OpenSpec no se modificó ni se presupone archive, sync o integración.

## Persistencia implementada

SQLite **v7**, con migración aditiva desde v6 y conservación de la cadena histórica:

- `media_metadata`: documento normalizado v1 por `(saved_title_id, provider, resource_namespace, external_id)`, versión, reloj de cambio, consulta, fecha del proveedor y revisión. FK compuesta a referencias y UNIQUE compuesto del padre.
- `media_metadata_selection`: fuente seleccionada y reloj propio; baseline histórico versionado e independiente, con referencia conocida o desconocida.
- `media_title_aliases`: títulos/abreviaciones derivados por fuente, índice para búsqueda local, reconstrucción transaccional y cascade.
- `media_refresh_state`: generación y campos operativos separados; no se implementa aquí coordinador, throttling ni solicitudes HTTP.
- `library_update_runs`: estructura local de revisiones y estados; permanece sin coordinador ni pantalla.
- `library_activity_events`: eventos con ID portable, operación idempotente, fecha/tipo/campos, sin notas completas ni payloads remotos. No se implementan aún los hooks generales de actividad personal de sección 6.
- Nuevas preferencias versionadas en `app_preferences`, con timestamp propio; sin sustituir Appearance u otras claves.

Se conserva la autoridad de las referencias completas, nunca del título o del orden del array. Varios proveedores sin origen inequívoco conservan selección desconocida. No se crean documentos/consultas remotas en el backfill. Los IDs locales/manuales/legacy, referencias, pins, preferencias y todos los campos personales se comparan íntegramente antes/después. La migración verifica también que las seis tablas v6 conservadas no hayan cambiado antes y después de publicar la versión.

Precisión de implementación dentro del diseño: el documento por fuente puede conservar **el snapshot ya normalizado del contrato existente**, junto al documento enriquecido. Así se mantiene, por ejemplo, un año sin inventar una fecha completa. No es JSON bruto de Kitsu y no contiene personales; se valida por referencia y medio. El baseline histórico sigue siendo un dato diferente. La proyección compatible y la selección del documento activo están centralizadas en funciones puras, compartidas por materialización y validación de exportación/importación.

Los relojes nuevos de metadata/selección son enteros seguros. El reloj del baseline histórico conserva el dominio anterior de timestamps finitos no negativos, incluidos fracciones y valores grandes: no se fuerza a entero ni se cambia el timestamp personal. Un save sin evidencia de consulta mantiene `checkedAt` desconocido; una consulta verificada explícita puede renovar frescura sin producir evento o invalidación semántica.

## Escrituras, lecturas y concurrencia

Los parches distinguen `not-provided`, `unknown` y `known`. Se releen título, propiedad y generación dentro de la transacción; una respuesta obsoleta o una obra eliminada no se recrea. Snapshot, documento, proyección, alias y evento se confirman o revierten juntos. Los documentos inactivos no rellenan campos de la fuente activa y un null autoritativo no activa fallback. La clasificación local conocida se conserva.

Save/re-save usa el camino de metadata sobre registros existentes y preserva `SavedTitle.updatedAt`, notas, tags, estado, rating y pins. La creación sigue usando la materialización existente, con rechazo de ID generado ocupado antes de escribir. Los manuales conservan su edición local y su identidad portable. Los lectores y snapshots existentes reciben metadata y alias locales, sin HTTP.

La invalidación es una suscripción acotada de biblioteca, publicada por los dueños públicos de transacción **después del commit**. Los helpers `WithDb` no publican antes del commit de su caller. Las consultas sin cambios no invalidan presentación. Se agrupan lecturas en vuelo, se filtran IDs relevantes y se descartan resultados obsoletos/unmounted. Biblioteca, Etiquetas y detalle reutilizan lecturas existentes; el detalle mantiene borradores e intents personales. No se agregaron imágenes, scores visuales, pantallas o filtros.

## Backup JSON v8

La exportación habitual de Ajustes ahora genera **v8**: personales, referencias/identidades, pins, Appearance, documentos por fuente, baseline, selección/reloj, títulos alternativos, puntuación original/escala, referencias de imágenes, preferencias y actividad portable retenida. No incluye binarios, credenciales, runs operativos, errores HTTP, backoff ni cachés.

Los parsers **v1–v7 no se modificaron**. El parser v8 compone su validación personal/identitaria vigente y añade validación de la metadata; una proyección plana contradictoria se rechaza por item. El merge conserva las reglas históricas de personales y separa relojes/documentos por referencia, baseline y selección. Omitido conserva, empates conservan local y contenido de metadata contradictorio con igual reloj produce conflicto dentro del savepoint. Se remapean pins/eventos al ID resuelto; una reimportación no duplica identidad ni actividad. Se reportan preferencias y actividad inválidas de forma parcial. Los observers de preferencias solo reciben publicación poscommit.

La exportación pública observa una transacción consistente, también frente a un escritor concurrente en WAL. Las preferencias tienen su reloj y precedencia propios; la activación Appearance conserva el mecanismo deferred existente, extendido a v8.

Las URLs de documentos nuevos se validan para almacenamiento seguro sin convertir el host recibido en aprobación de renderizado. Las referencias siguen siendo URLs; Kitsu continúa sin hosts de arte habilitados por defecto y sin ampliación de gates. La integración final de validación/fallback de todos los renderers, incluidas referencias legacy preservadas bajo sus contratos históricos, corresponde a sección 3 y **no se considera completada aquí**.

## Recuperación y límites

La suite 2.1 usa exclusivamente archivos de fixtures en directorios temporales. `VACUUM INTO` crea una copia consistente v6 incluyendo páginas confirmadas que siguen en WAL; esa copia reabre con los mismos registros y FKs válidas. No se copia solo el archivo principal mientras WAL está activo. Para datos reales debe prepararse copia consistente/export v7 con la versión anterior antes de migrar; esta ejecución no abrió ni migró una base personal.

Ante fallo de fase, publicación, verificación o commit, rollback restaura v6 sin tablas/índices nuevos parciales. Después de una migración exitosa, la recuperación con versión anterior usa la copia v6 consistente, nunca un downgrade borrando tablas o cambiando user_version. Restaurar esa copia no incluye cambios posteriores: se debe preservar previamente el export v8 de esos cambios. No se garantiza importar v8 en una app antigua.

No hay cambio funcional de alcance ni de versiones respecto de OpenSpec. Las precisiones técnicas son el snapshot normalizado por fuente y el reloj histórico sin coerción. Las pruebas heredadas se ajustaron al esquema vigente, al nuevo camino metadata-only y a la extensión de datos: sus comparaciones históricas siguen comparando **todos los campos originales**, excluyendo únicamente los sidecars v8 que no tienen autoridad en versiones anteriores. Las suites nuevas validan esos sidecars explícitamente.

## Evidencia reproducible

Resultados por comando y salida real: `section-2-results.json`; checks adicionales: `section-2-checks.json`. Matriz final: **24/24 scripts con exit 0**, incluyendo dos suites de sección 1, seis suites nuevas de sección 2 y regresiones de identidad, materialización, manuales, Kitsu, MangaUpdates, Appearance y harnesses de UI. Ejecutadas además:

- `npx tsc --noEmit`: exit 0.
- `openspec validate add-enriched-media-metadata-and-library-updates --strict`: exit 0.
- `git diff --check`: exit 0.

Cobertura nueva: fixtures v6 vacíos/mixtos; bootstrap0→7; migraciones históricas mediante regresiones; timestamps históricos fraccionarios/grandes; rollback de cuatro fases más commit y corrupción; reapertura/verificación FKs; imports1–8; campos personales completos; conflictos/empates/remap/reimport/savepoints; selección múltiple; documento antiguo tras refresh; preferencias poscommit; export consistente ante escritura WAL concurrente; invalidación/no-op/borradores, generaciones y unmount.

Las pruebas utilizan SQLite real de Node y transportes/hosts sintéticos, con módulos de UI simulados cuando corresponde. **No acreditan validación real Web/Android, apariencia visual ni migración de datos personales.** Node muestra su aviso de API SQLite experimental; no es un error de las suites. No se instalaron dependencias ni se ejecutó red de proveedores.

## Inventario de archivos

El listado siguiente corresponde al diff de esta sección contra el checkpoint verificado; no incluye cambios de implementación de sección 1.

### Creados

- `docs/testing/enriched-media-metadata/section-2-checks.json`
- `docs/testing/enriched-media-metadata/section-2-backups.cjs`
- `docs/testing/enriched-media-metadata/section-2-history-consistency.cjs`
- `docs/testing/enriched-media-metadata/section-2-migration.cjs`
- `docs/testing/enriched-media-metadata/section-2-observers.cjs`
- `docs/testing/enriched-media-metadata/section-2-recovery.cjs`
- `docs/testing/enriched-media-metadata/section-2-results.json`
- `docs/testing/enriched-media-metadata/section-2-storage.cjs`
- `docs/testing/enriched-media-metadata/section-2-validation.md`
- `docs/testing/enriched-media-metadata/sqlite-fixtures.cjs`
- `src/core/libraryBackupV8.ts`
- `src/core/mediaMetadataState.ts`
- `src/core/mediaPreferences.ts`
- `src/core/metadataSemanticKey.ts`
- `src/storage/libraryInvalidation.ts`
- `src/storage/mediaMetadataImport.ts`
- `src/storage/mediaMetadataRepo.ts`
- `src/storage/mediaMetadataSchema.ts`
- `src/storage/mediaPreferencesRepo.ts`
- `src/storage/savedTitleRows.ts`

### Modificados

- `app/(tabs)/ajustes.tsx`
- `app/(tabs)/etiquetas.tsx`
- `app/(tabs)/libreria.tsx`
- `app/title/[id].tsx`
- `docs/testing/anime-catalog-manual-entries/b1-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b2-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b3-verification.cjs`
- `docs/testing/expanded-media-domain/section-2-verification.cjs`
- `docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs`
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs`
- `openspec/changes/add-enriched-media-metadata-and-library-updates/tasks.md`
- `src/core/libraryBackup.ts`
- `src/core/libraryView.ts`
- `src/core/savedTitle.ts`
- `src/storage/databaseSchema.ts`
- `src/storage/libraryBackupExport.ts`
- `src/storage/libraryBackupMerge.ts`
- `src/storage/manualContentEntries.ts`
- `src/storage/savedTitleIntegrity.ts`
- `src/storage/savedTitleStorage.ts`
- `src/storage/savedTitlesRepo.ts`

## Corrección puntual de póster histórico — 2026-11-14

La revisión externa detectó que `projectMediaMetadata` convertía toda colección presente de `posterImages` en null al usar una política vacía. Se corrigió exclusivamente esa rama: conserva el póster del snapshot de la misma referencia TMDB (snapshot del documento o baseline atribuible), validándolo con `metadataImageUrl` y el host exacto `image.tmdb.org` ya utilizado por `tmdbImages.ts`. No selecciona nuevas URLs del documento. Omitido conserva el comportamiento previo; null explícito y colección vacía autoritativa borran. Una URL recibida no autorizada no sustituye ni borra un histórico permitido. Un histórico inseguro no se recupera mediante esta rama.

Ambigüedad acotada: OpenSpec D2.1/D3.1 define autoridad, seguridad y preservación, pero no la selección de nuevas variantes durante esta fase con arte todavía cerrado. Se adopta la alternativa mínima de conservar exclusivamente el snapshot TMDB permitido. No se crea una política global ni se autoriza un host recibido por backup. Kitsu no utiliza el póster TMDB aunque su documento lo incluya o posea un snapshot con esa URL. Los documentos inactivos no aportan fallback.

Regresión reproducible: `node docs/testing/enriched-media-metadata/section-2-poster-regression.cjs` (exit 0). Cubre histórico TMDB enriquecido, omitido, null, vacío, URL no autorizada, históricos inseguros, Kitsu cerrado, baseline sin autoridad, cambio TMDB→Kitsu→TMDB, legacy sin documento y round-trip SQLite v7/backup v8 a una base vacía, comparando personales y estado de metadata.

Se volvieron a ejecutar los 24 scripts registrados previamente en `section-2-results.json`: **24/24 exit 0**; salidas de esta ejecución en `section-2-poster-results.json`. Incluyen metadata, migración SQLite, recuperación, almacenamiento, backups históricos/v8 y consistencia. TypeScript (`npx tsc --noEmit`), OpenSpec estricto y `git diff --check`: exit 0.

Límites restantes: pruebas deterministas con SQLite real y datos sintéticos; sin aceptación visual Web/Android, sin HTTP ni datos personales. La selección de arte nuevo y controles efectivos de redirects/DNS continúan en sección 3. Esta corrección no recupera valores que ya no existan en ningún snapshot; sí rematerializa el histórico permitido cuando sigue disponible. No se modificaron versiones, dependencias, gates ni el change anterior. **2.9 continúa pendiente de revisión del diff corregido y checkpoint manual; sección 3 no iniciada.**
