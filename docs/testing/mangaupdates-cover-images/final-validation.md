# Validación técnica final — preparación inactiva de portadas MangaUpdates

Fecha: 2026-11-09, America/Buenos_Aires. Cambio: `enable-mangaupdates-cover-images`, esquema `spec-driven`. Esta entrega ejecuta 7.1 y prepara el entregable de 7.2. **7.2 queda sin marcar:** faltan revisión externa del diff completo, resolución de hallazgos bloqueantes y aprobación del checkpoint manual por el usuario. No se archiva ni se activa arte.

## A. Resultado y comportamiento

Se preparó selección provider-specific original inicialmente válido → thumbnail inicialmente válido → null, validación inicial estricta y composición coherente search/detail/save con omit explícito. Se añadieron fallbacks reutilizables en filas Detalle y protección por identidad/URL frente a callbacks tardíos en grid, detalle remoto/local y collages. La compatibilidad SQLite v5/backup v6/import histórico se verificó sin cambiar sus implementaciones.

El cambio productivo visible es recuperación a placeholder ante errores de imagen en Buscar/Biblioteca Detalle y aislamiento de errores entre identidades/URLs en las superficies compartidas, incluidas imágenes TMDB y locales. Las filas sin imagen reutilizan ahora PosterPlaceholder. Se conservan dimensiones/crop, navegación, foco declarado y datos personales. El detalle remoto tiene una rama Image preparada pero recibe null productivo. La preferencia original antes que thumbnail solo produce imagen al invocar explícitamente la capacidad técnica fuera de la composición productiva.

Producción MangaUpdates permanece **coverPolicy="omit"**: no se entregó activación de artwork. Siguen disponibles los metadatos Android, bloqueadas las rutas/API productivas Web/iOS, y conservados atribución, identidad, ratings TMDB, schema/backup, imports genéricos y datos existentes. No se añaden downloader, proxy, cache propia, binarios a exportación, backfill, permisos de red, dependencias ni toggles productivos.

## B. Inventario del cambio completo

Inventario obtenido de `git diff --name-status 99650f88b0fefb6885e639c76dc35741e5f8f829 HEAD`, más los cambios de esta entrega. A = introducido, M = modificado. Los paths completos figuran en las tablas al final. No se atribuye al cambio la modificación personal de package.json.

Producción: 10 archivos (dos nuevos y ocho modificados). Tests/fixtures: nueve archivos antes de esta entrega; se incorpora como décimo el ajuste mínimo de assertions obsoletas en personal-title-rating/section-2-integration-verification.cjs. Informes: seis previos más este informe final. Artefactos OpenSpec: cinco archivos nuevos del cambio activo; en esta entrega solo se marca 7.1 en tasks.md. El inventario incluye adapter/client/storage únicamente como dependencias verificadas en otras secciones, no como archivos modificados de esta iniciativa.

## C. Trazabilidad de requisitos

Fuente normativa: [propuesta](../../../openspec/changes/enable-mangaupdates-cover-images/proposal.md), [diseño](../../../openspec/changes/enable-mangaupdates-cover-images/design.md), [delta spec](../../../openspec/changes/enable-mangaupdates-cover-images/specs/second-provider-discovery/spec.md), [tasks](../../../openspec/changes/enable-mangaupdates-cover-images/tasks.md).

| Requisito / decisión | Implementación y verificación concreta | Alcance no verificado |
| --- | --- | --- |
| Preparación inactiva; diseño 1/3, spec atribución/portadas | mapping.ts defaults omit; mangaUpdatesSearch.ts/productSearch omit explícito; app/mangaupdates/series/[id].tsx dos materializaciones omit y mismo input para save. Cover tests 1/2/4/5; expanded 4/6/8 y 8-ui. | Activación real no es requisito actual. |
| Selección inicial segura; diseño 2 | src/providers/mangaupdates/mapping.ts: mangaUpdatesPoster/mapMangaUpdatesDetails/mapMangaUpdatesSearchResult/mangaUpdatesMaterializationInput. Cover test 1: selección, 4 URLs aceptadas/76 rechazadas, sin fetch. | Enforcement tras redirects nativos no implementado ni probado. |
| Rendering/fallback/reset; diseño 3/4 | DetailPoster, usePosterImageError, TitleGridCard, TagCollage/CollageCell, LocalPoster y detalle remoto; identidades suministradas por Buscar/Biblioteca. Cover 2/3/5: null/error/reset/ABA/callbacks obsoletos, layout, accesibilidad, navegación/save y cero writes por error. | Hook-host/Image simulados; sin reciclado/decode nativo físico. |
| Offline sintético sin garantía de cache | Cover 5 ejecuta detalle local/edit con error offline simulado; Browser review verifica fallback tras puerto inseguro. | No prueba interrupción de red real ni persistencia binaria offline. |
| Persistencia/compatibilidad; diseño 5 | saveProviderTitle → materializeProviderSavedTitle y SQLite real aislada; libraryBackupExport/createLibraryBackupV6/parseLibraryBackup/mergeLibraryBackupWithDb. Cover 4, universal 1–5, expanded 1/2/8, ratings 1/2/3/6 y controlled-sqlite-failure. | Driver/selector nativo y restore a DB Android vacía no acreditados por estas suites. |
| Atribución y plataformas; diseño 6 | attribution.ts/mangaUpdatesProvenance, detalle remoto/local, About; availability.ts/product.ts/client.ts y categorías finitas. Cover 2/5; expanded 4/6/8/8-ui; navegador previo. | Atribución específica de arte y uso físico iOS no verificados. |
| Sin bypass; separación de assets/URL-policy y review | Cover 1 valida strings CDN sin transporte; cover 2/3/5 inyectan assets propios solo en proceso de test. Expanded 5/5-ui: gates, SQLite separada, cero DB/preferencias/credenciales personales; smoke previo confirma OPFS. | No garantía universal de cero requests de URLs importadas. |
| Derechos, redirects y cierre independiente; diseño 1/2/6 | [handoff Sección 6](section-6-handoff.md), registro I1–I10/E1–E6/O1–O6 y gates A–F. | Derechos y aceptación física Android del arte pendientes expresamente; no se presenta cobertura inexistente. |

Los paths técnicos de esta tabla están enlazados con funciones/tests en el registro I1–I10 del handoff; los comandos exactos ejecutados se enumeran abajo. No hay un requisito actual de preparación sin evidencia identificado; las limitaciones anteriores impiden afirmar aceptación nativa o licencia de arte, y la revisión integral sigue pendiente.

## D. Matriz de plataformas y tipo de evidencia

| Entorno | Probado realmente | Lo que no acredita |
| --- | --- | --- |
| Android nativo histórico | [expanded section-8-validation](../expanded-media-domain/section-8-validation.md): dispositivo modelo 23129RA5FL, Android 15, binario de desarrollo existente; bundle vía Metro. Usuario operó búsqueda/detail/save/edit/refresh/restart/offline/recovery e import en misma DB; inspección de runtime/backup confirmó campos y referencia. Metadata con cover null. | No fue una nueva ejecución de esta sección ni prueba del renderer modificado con arte; import a DB vacía y carga/redirect/cache de portadas reales siguen sin aceptación física. No release APK certificado. |
| Android simulado actual | Cover 2/5 y expanded 8/8-ui ejecutan ramas Android, disponibilidad, materialización/save, fallbacks e identidades con stubs. | No transporte/decode/cancelación/reciclado físico de Image. |
| Web producción Chrome headless previo | [Sección 5](section-5-validation.md), corrida 6: Chrome 156.0.8078.80, CDP 1.3/Windows; 26 checks, producción antes/después de review, Buscar/Series, biblioteca vacía, modalidades, ruta MangaUpdates bloqueada, estado sin credencial TMDB. | No búsqueda TMDB remota exitosa con token, ni renderer Android. No se repitió: no hay cambio productivo nuevo ni brecha que lo justifique. |
| Web manual previo | Sección 5 conserva relato del usuario: biblioteca de 13 títulos con pósteres, detalle/campos personales, 13 WebP HTTP200 y Slow4G sin regresión obvia. | No identifica todos los proveedores ni demuestra cero API/CDN MangaUpdates, errores/offline o redirects. |
| iOS | Gates automatizados actuales impiden API productiva antes de HTTP/cache; compatibilidad local comprobada por suites genéricas. | Sin dispositivo, simulador, UI ni aceptación física iOS. |
| Review browser/SQLite | Sección 5: browser contexts separados, OPFS lógico primary/restore y producción propia, save/edit/navigate; hoy expanded 5/5-ui pasan con DBs aisladas, round-trip y guardas de acceso personal. | No licencia de catálogo ni activación del proveedor; Image de componentes es stub en Node. |

Precisión del browser: se mantienen las correcciones revisadas de Sección 6: 38 requests = **30 respuestas HTTP 200 + una carga data: con estado 200 + siete fallos Image ERR_UNSAFE_PORT**. El codec SVG propio 40×60/PNG corrupto fue separado de la app. CDP Fetch estuvo habilitado en páginas, sin intentos MangaUpdates que bloquear; workers tuvieron Network sin Fetch.enable disponible. No hubo redirects observados ni requests MangaUpdates API/CDN en el recorrido. La redacción histórica de Sección 5 sobre “31 HTTP200/no se activó” se interpreta con estas precisiones aprobadas, sin reescribir el informe histórico.

## E. Integridad de datos

Cover test 4 usa 18 SQLite reales aisladas, sin abrir la DB personal: lookup por tuple provider/namespace/externalId, IDs grandes como strings, ID local opaco y createdAt conservados al re-save, clasificación según refineMediaClassification, initialTags creación-only y MangaUpdates sin voteAverage. Status, tags, notas, personalRating y pins permanecen según sus contratos. TMDB conserva metadata y ownership de su rating sin duplicación.

posterUrl es metadata string/null en poster_url TEXT nullable. Refresh explícito puede sustituir URL por otra o por null; omit productivo materializa null incluso al re-save. El error de Image no persiste null. No hay backfill ni purga de URLs históricas. Backup v6 exporta la referencia, no descarga la imagen. Parse/import v1–v6 conservan diferencias de campo ausente/null, versiones de rating, timestamp/merge, colisión/remap de ID y pins; el importer no se estrecha con allowlist MangaUpdates. Rollback de save/import/commit fallido y foreign_key_check se verifican con SQL real. Schema sigue **5**, export sigue **6**. Véanse [informe 4](section-4-validation.md) y handoff, Retención y backups.

Retener/exportar URL no equivale a retener/exportar bytes ni garantiza portada offline. El contrato genérico histórico de string tampoco se convierte aquí en un filtro universal de data/base64. Cache interna del renderer/OS no medida; no se garantiza cero bytes cacheados.

## F. Seguridad y límites de red

La validación inicial requiere HTTPS absoluto y hostname exacto cdn.mangaupdates.com; rechaza credenciales, controles/whitespace/backslashes, escapes malformados, relativos/protocol-relative, hosts engañosos y puertos inesperados. Selecciona candidatos independientemente original→thumbnail→null, sin sondeos ni cascada tras onError. Ese control **no valida destinos finales después de redirects**.

El cliente API de metadata usa fetch redirect:error y comprobación de origen; no demuestra control sobre RN Image nativo. No se presume interceptable toda imagen mediante JavaScript fetch. Android requiere instrumentación posterior de transporte, redirects, decode/cache/lifecycle. Los fallos HTTP/red/decode del test de componentes son eventos simulados; ERR_UNSAFE_PORT previo fue un rechazo real de Chrome antes de HTTP.

Omit explícito y defaults se conservan; no hubo nuevas solicitudes productivas MangaUpdates en los flujos browser instrumentados. Los lectores genéricos pueden cargar URLs locales/importadas históricas sin API; esa posibilidad no constituye nueva activación ni permite afirmar cero GET universal. Esta regresión no ejecutó el test live, no solicitó arte ni agregó infraestructura/red/permisos.

## G. Derechos y futuros bloqueos

El [handoff de Sección 6](section-6-handoff.md) contiene fuentes oficiales exactas, autoridad, fecha de consulta, fallos de acceso y separación de permiso/restricción histórica/hecho técnico/desconocido/supuesto. **No se verificó independientemente permiso suficiente para mostrar arte real.** Acceso API o URL HTTPS funcional no implican derechos. No se reauditaron fuentes externas ni se contactó al proveedor en Sección 7.

Hotlink, atribución de arte, cache binaria, retención/export de URL y redirects siguen OPEN (O1–O6). La aceptación física Android de covers reales no está completa. La posible `activate-mangaupdates-cover-images-android` requerirá propuesta nueva aprobada, derechos compatibles, red/destinos controlados, condiciones de persistencia/cache, pruebas en hardware y decisión explícita de producto. No se crea ahora ni se prescribe proxy/downloader/intercepción sin aprobación.

Estos bloqueos pertenecen a activación futura y no impiden cerrar la preparación inactiva después de revisión y checkpoint. Archivar preparación no autoriza arte.

## H. Ejecución final, fallos y correcciones

Descubrimiento real: `rg --files docs/testing` filtrado por .cjs encontró **52** runners; package.json solo define start/android/ios/web, sin test runner agregado. Se seleccionaron **50 suites deterministas** de todos los grupos relacionados. Appearance completo y ratings/pins/runtime consumers son regresiones vecinas pertinentes porque los pósteres comparten temas, cards, fuentes locales y accesibilidad. Se excluyeron `expanded-media-domain/section-6-live-verification.cjs` (red real no necesaria) y `mangaupdates-cover-images/section-5-browser-verification.cjs` (evidencia aprobada ya disponible, sin brecha nueva).

Windows/PowerShell, Node v22.18.0; ejecución secuencial de cada comando node listado abajo mediante subprocess Python, captura stdout/stderr y exit individual. El wrapper preserva los bytes de TEST-section5-review-v6.json antes y los restaura en finally; comparación posterior true, sin diff de fixture. Las suites usan DBs temporales/in-memory y sus propios cleanups, sin datos personales.

Primera pasada: **49/50 exit 0**, integración personal-title-rating/section-2-integration-verification.cjs exit **1**. Causa: assertions estáticas exigían el setter inline anterior `onError={() => setImageFailed(true)}` en Grid y Collage, eliminado por la implementación revisada de Sección 3. No se encontró fallo productivo: cover 3/5 ya verificaban ejecutablemente el comportamiento nuevo. Corrección limitada al test: comprobar binding identity/URL de usePosterImageError, gating !imageFailed, onError={onImageError} y placeholder; se conservan assertions de rating, foco, accesibilidad y ausencia de rating en Search/Collage. No se elimina la obligación de manejar errores ni se cambia producto para acomodar el test.

Reejecución de `node docs/testing/personal-title-rating/section-2-integration-verification.cjs`: **0**. Reejecución focalizada de `node docs/testing/mangaupdates-cover-images/section-3-verification.cjs` y `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs`: ambas **0**. Resultado final: **50 suites distintas aprobadas**, no se afirma una segunda pasada completa. La tabla conserva exit inicial/final de cada comando.

Warning significativo: `ExperimentalWarning: SQLite is an experimental feature and might change at any time`, emitido por 18 suites con node:sqlite; sin fallo de assertions. Se conservan warnings en logs, sin suprimirlos. Los mensajes de fallos SQL controlados pertenecen a casos negativos esperados, no fallos de suite. No hay fallos de producto ni validación pendientes detectados por esta regresión.

Incidente de orquestación: primer wrapper Python devolvió **1** al intentar guardar logs en TEMP del sandbox (PermissionError); alcanzó el primer runner pero no retuvo su resultado, por lo que no se cuenta como evidencia. Se cambió únicamente el destino de logs a la raíz de visualizaciones autorizada y se ejecutaron las 50 suites. No se alteraron permisos ni tests para sortear ese error. La búsqueda inicial `rg --files -g AGENTS.md` devolvió 1 por ausencia de coincidencias; no es fallo de test.

Logs de la pasada completa y salida original del fallo: `C:/Users/elias/.codex/visualizations/2026/11/10/01a1c327-2846-7ae3-abbd-5f266fe95f83/section7/results.json`. Es evidencia auxiliar fuera del repo, no un diff bundle/ZIP. Los resultados finales de los tres reintentos constan en esta sección y en la ejecución terminal.

| Check adicional | Exit |
| --- | --- |
| `npx tsc --noEmit` | 0, sin diagnósticos |
| `openspec validate enable-mangaupdates-cover-images --strict` | 0, cambio válido |
| `git diff --check` | 0 |
| Comprobación directa Python de whitespace del informe nuevo no tracked | 0, sin whitespace final/EOF extra |

## I. Baseline para revisión externa integral

Baseline propuesta: **`99650f88b0fefb6885e639c76dc35741e5f8f829`**, padre inmediato del checkpoint inicial de propuesta `960a297f6d80d1b891a5db5a265287631f8b4357`. Se inspeccionaron log, show --stat y diff --name-status read-only. La propuesta introdujo exclusivamente los cinco artefactos activos. El baseline previo es limpieza de líneas vacías de otro trabajo, posterior al merge expanded media (`24a690f`), y se excluye junto con la integración anterior. No se selecciona main/merge-base por su nombre ni HEAD, que omitiría la implementación ya committed.

| Checkpoint | Alcance |
| --- | --- |
| 960a297 | Propuesta/diseño/delta/tasks/.openspec.yaml iniciales |
| 18b3fc9 | Sección 1: mapper y pruebas |
| a88e73d | Sección 2: composición omit y pruebas |
| d822f60 | Sección 3: fallbacks/reset y pruebas |
| 3b5fec3 | Sección 4: SQLite/backup y harness histórico |
| ef0e58a | Sección 5: composición y Chrome/CDP |
| 23c68b257aa92232209bf8a8430d03a53d2b7adc (HEAD al inicio) | Sección 6: handoff y 6.1/6.2 checked; ambas correcciones browser presentes |
| Working tree de esta entrega | Assertion histórica corregida, este informe y marca 7.1; package.json personal separado |

La revisión completa debe abarcar baseline → árbol final entregado, incluidos archivos nuevos no tracked y modificaciones de esta sección; excluir explícitamente el diff personal de package.json. Una comparación baseline→HEAD sola perdería esta entrega, y HEAD→working tree perdería Secciones 1–6. No se genera artefacto de revisión ni se ejecuta Git mutable. El usuario generará el diff real manualmente.

**Readiness:** regresión técnica aprobada, entregable final preparado; revisión integral aún pendiente. 7.1 checked, 7.2 unchecked, progreso **13/14**. Solo después de revisión externa completa, resolución de bloqueantes y aprobación manual del checkpoint puede cerrarse 7.2; archive requiere pedido separado. No es necesario resolver permisos futuros para cerrar el cambio inactivo.

## Archivos protegidos y alcance de esta iteración

Se creó únicamente este informe; se modificaron únicamente el test histórico de rating mencionado y tasks.md (7.1). Código productivo, política omit, gates, SQLite/backup, dependencias/lockfile, canonical/archived specs y permisos intactos. Ningún cambio nuevo OpenSpec, archive, sync, integración, staging/commit/push/reset/rebase. Sin Computer Use, navegador nuevo, requests de artwork ni contacto externo.

SHA256 inicial/final de package.json personal: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`. package-lock.json: `7EB6A96DF94D78B76C89A3E0B305AD95E1316DD91D7BB0B7B18DC4B13F3EED05`. Se restauró la fixture review byte a byte. Se detiene para revisión externa.

## Registro exacto de comandos de suites

| Comando | Exit inicial | Exit final |
| --- | --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-8-ui-verification.cjs` | 0 | 0 |
| `node docs/testing/expanded-media-domain/section-8-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-10-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-11-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-12-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-2-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-3-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-4-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-5-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-6-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-7-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-8-verification.cjs` | 0 | 0 |
| `node docs/testing/global-appearance-themes/section-9-verification.cjs` | 0 | 0 |
| `node docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs` | 0 | 0 |
| `node docs/testing/mangaupdates-cover-images/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/mangaupdates-cover-images/section-2-verification.cjs` | 0 | 0 |
| `node docs/testing/mangaupdates-cover-images/section-3-verification.cjs` | 0 | 0 |
| `node docs/testing/mangaupdates-cover-images/section-4-verification.cjs` | 0 | 0 |
| `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-1-badge-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-2-integration-verification.cjs` | 1 | 0 |
| `node docs/testing/personal-title-rating/section-2-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-3-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-4-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-5-verification.cjs` | 0 | 0 |
| `node docs/testing/personal-title-rating/section-6-verification.cjs` | 0 | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 | 0 |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 | 0 |
| `node docs/testing/tmdb-user-credential/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/tmdb-user-credential/section-2-verification.cjs` | 0 | 0 |
| `node docs/testing/tmdb-user-credential/section-3-verification.cjs` | 0 | 0 |
| `node docs/testing/tmdb-user-credential/section-4-verification.cjs` | 0 | 0 |
| `node docs/testing/tmdb-user-credential/section-5-verification.cjs` | 0 | 0 |
| `node docs/testing/universal-media-identity/section-1-verification.cjs` | 0 | 0 |
| `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | 0 | 0 |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | 0 | 0 |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | 0 | 0 |
| `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | 0 | 0 |

## Inventario exacto por categoria

### Produccion (10)

| Estado | Path |
| --- | --- |
| M | `app/(tabs)/buscar.tsx` |
| M | `app/(tabs)/libreria.tsx` |
| M | `app/mangaupdates/series/[id].tsx` |
| M | `app/title/[id].tsx` |
| A | `src/components/browsing/DetailPoster.tsx` |
| M | `src/components/browsing/TagCollage.tsx` |
| M | `src/components/browsing/TitleGridCard.tsx` |
| A | `src/components/browsing/usePosterImageError.ts` |
| M | `src/components/search/mangaUpdatesSearch.ts` |
| M | `src/providers/mangaupdates/mapping.ts` |

### Tests y fixtures (10)

| Estado | Path |
| --- | --- |
| M | `docs/testing/expanded-media-domain/section-6-verification.cjs` |
| M | `docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs` |
| A | `docs/testing/mangaupdates-cover-images/fixtures/developer-poster.svg` |
| A | `docs/testing/mangaupdates-cover-images/section-1-verification.cjs` |
| A | `docs/testing/mangaupdates-cover-images/section-2-verification.cjs` |
| A | `docs/testing/mangaupdates-cover-images/section-3-verification.cjs` |
| A | `docs/testing/mangaupdates-cover-images/section-4-verification.cjs` |
| A | `docs/testing/mangaupdates-cover-images/section-5-browser-verification.cjs` |
| A | `docs/testing/mangaupdates-cover-images/section-5-verification.cjs` |
| M | `docs/testing/personal-title-rating/section-2-integration-verification.cjs` |

### Informes (7)

| Estado | Path |
| --- | --- |
| A | `docs/testing/mangaupdates-cover-images/final-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-1-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-2-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-3-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-4-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-5-validation.md` |
| A | `docs/testing/mangaupdates-cover-images/section-6-handoff.md` |

### OpenSpec (5)

| Estado | Path |
| --- | --- |
| A | `openspec/changes/enable-mangaupdates-cover-images/.openspec.yaml` |
| A | `openspec/changes/enable-mangaupdates-cover-images/design.md` |
| A | `openspec/changes/enable-mangaupdates-cover-images/proposal.md` |
| A | `openspec/changes/enable-mangaupdates-cover-images/specs/second-provider-discovery/spec.md` |
| A | `openspec/changes/enable-mangaupdates-cover-images/tasks.md` |
