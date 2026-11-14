# Sección 1 — Contratos y normalización

Alcance autorizado: tareas **1.1–1.5** de `add-enriched-media-metadata-and-library-updates`. Implementadas y verificadas; **1.6 pendiente** de revisión externa del diff y checkpoint manual. No se ejecutó trabajo de secciones 2–8.

## Baseline y decisiones

Rama `feat/anime-catalog-manual-entries`; HEAD `1c14377bd95c31a3240bf9846ab2272cf45c1c55`. Al iniciar solo estaba sin seguimiento la carpeta de este change (artefactos preexistentes de PROPOSE); se preservó su contenido salvo estado/checks de tareas autorizadas. El change anterior sigue abierto, 22/24, sin archive/sync/integración inferida. SQLite continúa v6 y export/import backup v7.

Se revisaron los cuatro artefactos y las siete specs, especialmente D2/D2.1/D3.1/D4. La aprobación conceptual de SQLite7/backup8 y defaults no autoriza implementarlos en esta sección. Los límites/gates existentes permanecen vigentes. No commits/staging/push/checkout/reset/stash/archive/sync/merge ni dependencias nuevas.

## Archivos

Nuevos contratos y funciones puras:

- `src/core/enrichedMediaMetadata.ts`: documento v1, procedencia, campos enriquecidos y diagnósticos acotados por campo/motivo.
- `src/core/publicRating.ts`: valor decimal original (string o número), escala y proveedor; validación y proyección numérica sobre 10 sin redondeo ni combinación de fuentes.
- `src/core/metadataValidation.ts`: allowlist de campos, validación estricta normalizada, límites, calendario real, timestamps independientes, copia inmutable y comprobación de referencia.
- `src/core/metadataPatch.ts`: `not-provided`, `unknown` y `known`, sin operaciones de merge/persistencia. Null autoritativo distinto de ausencia; cero/false/colección vacía válidos.
- `src/core/metadataImageUrl.ts`: política de hosts inyectable, HTTPS, rechazo de userinfo, autoridades ambiguas, hosts locales y literales IP (también formas normalizadas alternativas), sin construir URLs, resolver DNS ni hacer HTTP.
- `src/providers/kitsu/enrichedMetadata.ts`: extracción de campos permitidos con desconocidos/diagnósticos; títulos/idiomas/scripts, sinopsis textual, imágenes recibidas, score 0–100, fechas/estado, episodios/duración, edad/guía/sensible y relaciones completas.
- `src/providers/tmdb/publicMetadata.ts`: proyección pública TMDB 0–10 independiente del snapshot legacy.

Modificados:

- `src/providers/providerContracts.ts`: `metadata?` opcional en búsqueda/detalle/materialización; `ProviderLocalSnapshot` y `SavedTitle` sin cambios.
- `src/providers/kitsu/validation.ts`: parser extendido y opciones puras de hosts; límites para relaciones incluidas. Identidad externa string/namespace y validación del ID solicitado intactas.
- `src/providers/kitsu/mapping.ts`: propaga metadata aparte, conserva clasificación/initialTags/póster legacy y omisión de voteAverage; reutiliza validación de calendario y sanitización existentes sin comportamiento visual nuevo.
- `src/providers/tmdb/tmdbMappers.ts` y `tmdbTypes.ts`: score público opcional en contratos compartidos y propagación al input, sin cambiar valor/comportamiento legacy ni tags.
- `docs/testing/provider-abstraction/type-contract.ts` y `section-2-tmdb-mapping-verification.cjs`: ajustados a la extensión opcional; conservan las aserciones de snapshot legacy y agregan comprobación de score/fuente.
- `openspec/changes/add-enriched-media-metadata-and-library-updates/tasks.md`: estado parcial y checks 1.1–1.5; todas las demás casillas permanecen pendientes.

Pruebas nuevas: `section-1-contracts.cjs`, `section-1-providers.cjs` y `type-contract.ts` en esta carpeta.

## Decisiones y límites de esta entrega parcial

- Campos localizados y abreviaciones se conservan en grupos separados (`titles`/`abbreviatedTitles`), ambos tipados, para que la omisión de una colección no vacíe la otra. Es una precisión de representación dentro del alcance aprobado.
- La metadata nunca contiene notas, estado personal, rating personal, identidad local, pins ni updatedAt personal. La procedencia se liga a referencia completa; fetchedAt/checkedAt permanecen null porque un parser puro no acredita una consulta local. sourceUpdatedAt solo se acepta si es válido.
- Colecciones incompletas o imágenes inseguras no producen un reemplazo parcial engañoso. Géneros narrativos derivados de categorías usan la allowlist existente; categorías se conservan aparte, nunca como tags personales. No se calcula duración total por multiplicación ni se traduce texto.
- La política de hosts de imágenes está **vacía por defecto**. Hosts sintéticos distintos se inyectan solo en pruebas. No se habilitaron hosts de Kitsu, imágenes visibles, proyecciones HTTP enriquecidas o gates nuevos. El examen de hosts reales/renderer de sección 3 sigue pendiente.
- El validador URL comprueba la cadena y host, **no** resolución DNS, rebinding ni destinos de redirects del renderer. La selección/fallback visual y verificación de destinos finales quedan en la sección autorizada correspondiente; no hay binarios, proxy ni descargas permanentes.
- TMDB conserva exactamente su voteAverage legacy, incluso la aceptación histórica de números fuera de escala; esos números se omiten en la nueva proyección pública. Ausente/invalid no equivale a score cero ni null; null explícito sí representa desconocido.
- MangaUpdates y manuales no producen documentos nuevos ni cambian sus contratos. La materialización actual sigue preservando personales y avanzando su updatedAt como antes; **no** se implementó refresh remoto ni se cambió ese comportamiento legacy en esta sección.
- Los documentos se transmiten como metadata opcional en memoria. SQLite6/backup7 todavía no los almacenan ni exportan; esa integración corresponde a sección 2. Tampoco se implementó resolución de fuente activa, import, invalidación UI o preferencias. Los contratos separan propiedad/presencia para habilitarlas sin adelantar esas tareas.

No hay desviación funcional de OpenSpec: esta es la entrega parcial autorizada. No se afirma que la ficha offline enriquecida o la UI de Actualizaciones ya estén disponibles.

## Validación ejecutada

Todos los siguientes comandos finalizaron con **exit 0**. Las suites usan fixtures propios, transportes simulados y, cuando corresponde, SQLite aislado en directorios temporales; ninguna accede a la biblioteca personal ni acredita aceptación real Web/Android.

| Comando | Cobertura |
|---|---|
| `node docs/testing/enriched-media-metadata/section-1-contracts.cjs` | 5 grupos: score/escala, URLs, fechas/números, documento/procedencia/propiedad e inmutabilidad/presencia de patches |
| `node docs/testing/enriched-media-metadata/section-1-providers.cjs` | 5 grupos de Kitsu/TMDB/MangaUpdates/manuales y un transporte Kitsu inyectado, sin red ni activación de arte |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | Contratos TMDB y creación legacy con nueva proyección |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | Materialización y guardado existentes |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | Consumidores actuales de detalle mediante harness sintético |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | Dominio/contratos MangaUpdates existentes |
| `node docs/testing/mangaupdates-cover-images/section-2-verification.cjs` | Mapping e imágenes MangaUpdates sin cambios de permisos |
| `node docs/testing/anime-catalog-manual-entries/b2-verification.cjs` | Manuales e identidad/persistencia actuales aisladas |
| `node docs/testing/anime-catalog-manual-entries/b3-contracts.cjs` | Kitsu: IDs, subtipos, transporte/errores/límites/gates y contrato legacy sin arte/score |
| `node docs/testing/anime-catalog-manual-entries/b3-verification.cjs` | Integración Kitsu con SQLite6/backup7 existentes |
| `node docs/testing/anime-catalog-manual-entries/development-activation-verification.cjs` | Gates/transporte existentes mediante fixtures; no aceptación viva |
| `npx tsc --noEmit` | Tipado de aplicación y contratos, incluidos tests de tipos nuevos |
| `openspec validate add-enriched-media-metadata-and-library-updates --strict` | Coherencia/estructura OpenSpec |
| `git diff --check` | Sin errores de whitespace en diff versionado |

Comprobación adicional de alcance: hashes de archivos versionados idénticos al baseline para `app/`, `src/storage/`, parsers/backups, MangaUpdates y el change anterior; sin diff en package/lock, cliente/product/gates Kitsu. Las siete specs, proposal y design aprobados no se editaron durante APPLY. Diff de código revisado localmente para preparar entrega; no sustituye revisión externa ni checkpoint de **1.6**.
