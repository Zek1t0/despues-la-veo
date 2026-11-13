# B3 — catálogo Anime preparado, activación pendiente

Estado posterior, 2026-11-13: activación viva local Web/Android implementada por nueva
decisión del usuario, release público aún cerrado. B4 anterior aceptado externamente.
Ver development-activation-validation.md para la entrega combinada, resultados reales
y pendientes. Las declaraciones inferiores de preparación solo sintética son históricas.

Fecha de proyecto: 2026-11-12, America/Buenos_Aires. Change `add-anime-catalog-and-manual-entries`, schema `spec-driven`.

## Git y alcance

Rama inicial verificada: `feat/anime-catalog-manual-entries`. HEAD y baseline B2 descubierto, sin asumir hash: **e75d813dd3e9508bb417e1b756e52fc22d5d3d08**. `git ls-remote origin refs/heads/feat/anime-catalog-manual-entries` confirmó exactamente ese commit publicado, exit 0 con lectura de red habilitada tras fallo DNS del intento restringido. Árbol e índice iniciales limpios. 2.5 ya estaba marcada; se añadió el cierre USER-REPORTED de revisión externa y aceptación Web/BlueStacks a b2-validation.md, sin inventar build/runtime ni heredar aceptación a B3.

**3.1–3.4 completas como preparación aislada autorizada. Progreso 15/22.** 3.5 sigue pendiente por elegibilidad M y aceptación técnica T; 3.6 por revisión externa/checkpoint y cierre B3. B4 no iniciado. No se declara catálogo activo ni finalización íntegra de B3.

No stage, commit, push, archive, sync ni merge. HEAD conservado. package.json/lock, dependencias, SQLite **v6** y backup **v7** intactos. No se abrió biblioteca personal. No SDK, backend, scraping, proxy, linking ni deduplicación entre proveedores.

## Archivos exactos

Nuevos (16):

- `app/kitsu/anime/[id].tsx`
- `src/providers/kitsu/AnimeDetail.tsx`
- `src/providers/kitsu/availability.ts`
- `src/providers/kitsu/client.ts`
- `src/providers/kitsu/errors.ts`
- `src/providers/kitsu/identity.ts`
- `src/providers/kitsu/mapping.ts`
- `src/providers/kitsu/product.ts`
- `src/providers/kitsu/validation.ts`
- `src/components/search/searchSourcePresentation.ts`
- `src/dev/mediaReview/kitsuFixture.ts`
- `docs/testing/anime-catalog-manual-entries/b3-contracts.cjs`
- `docs/testing/anime-catalog-manual-entries/b3-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b3-eligibility.md`
- `docs/testing/anime-catalog-manual-entries/b3-validation.md`

Modificados (13):

- `app/(tabs)/buscar.tsx` — fuente explícita, capability Anime gated y bindings TEST para preferencias/navegación.
- `app/title/[id].tsx` — procedencia Kitsu desde referencias locales; sin requests ni destino remoto habilitado.
- `src/providers/providerContracts.ts` — AbortSignal opcional en la única capability compartida de búsqueda.
- `src/components/search/searchCategories.ts` — categoría Anime finita, referencias/destino validados, resolución y gate por fuente explícita.
- `src/components/search/useCategorySearch.ts` — abort al invalidar scope, manteniendo debounce/sequence/guard de render existentes.
- `src/dev/mediaReview/MediaReview.tsx` — búsqueda y detalle reales con transporte Kitsu sintético/DBs de revisión.
- `src/dev/mediaReview/session.ts` — saved detection y saveProviderTitle sobre conexiones TEST existentes.
- `docs/testing/provider-abstraction/type-contract.ts` — contrato de cancelación opcional; adaptadores previos siguen compatibles.
- `docs/testing/provider-abstraction/section-3-buscar-verification.cjs` — assertion de llamada con señal.
- `docs/testing/expanded-media-domain/section-4-verification.cjs` — inventario conocido incluye Anime, producto sigue filtrado por gate.
- `docs/testing/expanded-media-domain/section-5-ui-verification.cjs` — boundary TMDB del entorno de revisión no consulta credenciales/red.
- `docs/testing/anime-catalog-manual-entries/b2-validation.md` — cierre B2 confirmado por el usuario.
- `openspec/changes/add-anime-catalog-and-manual-entries/tasks.md` — estado vigente y solo 3.1–3.4 marcadas.

## Evidencia y activación

Ver [b3-eligibility.md](./b3-eligibility.md) para fuentes oficiales, solicitudes diagnósticas y preguntas abiertas. Se investigó Kitsu anime/manga de `kitsu.app` / `hummingbird-me`, no kitsu.cloud.

Resultado: metadata M pendiente, Android T pendiente, Web T pendiente, arte A pendiente/omit. Diagnóstico de escritorio al host actual: búsqueda/detalle GET 200 sin credenciales y ACAO `*`; host histórico kitsu.io timeout y términos kitsu.app 403. No se pudieron acreditar derechos de snapshots locales/retención/backups ni cuotas oficiales vigentes. HTTP/CORS de escritorio y licencia de software no se interpretan como autorización.

Kitsu permanece **deshabilitado en todas las plataformas**, sin flag para eludirlo. No aparece Anime en Buscar productivo. Los wrappers de búsqueda/detalle y ruta directa validan/gatean antes de fetch; el detalle cerrado tampoco llama saved detection ni guarda. Las referencias Kitsu restauradas/sintéticas continúan legibles offline y muestran «Datos: Kitsu», con destino remoto null. No se cambia la activación ni arte de MangaUpdates.

## Implementación

Cliente con fetch explícitamente inyectado para pruebas y real solo detrás del wrapper productivo. Endpoint candidato `https://kitsu.app/api/edge`; GET de anime, sparse fields sin arte/rating, categorías incluidas únicamente para allowlist narrativa. Parser exige recurso `anime`, ID decimal positivo canónico como string, título no vacío y correspondencia del detalle. Descarta mappings y metadata ajena. Opcionales incompletos producen null/vacío; payload estructuralmente inválido, ID inconsistente o duplicado en búsqueda produce error sin writes.

Mapping exacto TV/movie/OVA/ONA/special/music; otro subtipo queda null, sin inferencia por nombres/episodios/runtime/TMDB. Año desde fecha completa válida (incluye calendario/año 1–9999), resumen textual sin renderer HTML ni fetch de links. Géneros desde categorías relacionadas y allowlist narrativa explícita; themes/demográficos/desconocidos y categorías no relacionadas se descartan. initialTags vacío, posterUrl null, voteAverage completamente ausente.

Política propia: cola máxima 16, una solicitud controlada en vuelo, inicios separados 1 s, timeout 15 s sobre fetch y cuerpo, cancelación y protección adicional por scope/sequence. No cache ni retries automáticos. 429 respeta Retry-After segundos/fecha y no acorta esperas largas; ausente/inválido/overflow bloquea ese cliente hasta reconstrucción, sin inventar fallback. No se sigue links.next ni redirects; paginación del cliente con offset local validado y limit 20.

Buscar reutiliza la capability provider-neutral y la UI existente. Errores y nombre de fuente son explícitos: Kitsu no cae en un else MangaUpdates. Loading/empty/error/retry, cards/lista/grid y navegación usan resultados normalizados. El hook conserva scope query/category/source/retry/credencial TMDB y añade abort opcional. El detalle específico usa el mismo input para presentar/guardar, detecta guardado por referencia completa y preserva re-save mediante repositorio existente. ID/ruta/retry/unmount invalidan respuestas y feedback obsoletos; bloqueo síncrono evita doble save simultáneo. La biblioteca local, filtros, personales/pins y backups usan contratos existentes. No hay filtros OVA/ONA ni score Kitsu en voteAverage.

El entorno development TEST existente añade «Anime Kitsu TEST · sin red real». Usa siete registros originales (seis subtipos y desconocido), transporte que construye Response sintética sin delegar a fetch, componente Buscar y detalle reales, preferencias inyectadas y DBs media-review-* separadas. Abrir fuente allí solo muestra un mensaje TEST. La simulación offline es una falla sintética del transporte; no prueba redes nativas. Esto no habilita proveedor ni satisface M/T/A.

## Pruebas y comandos

Ejecuciones finales **exit 0**:

| Comando | Evidencia |
| --- | --- |
| `node docs/testing/anime-catalog-manual-entries/b3-contracts.cjs` | Tipos/IDs/formats/datos faltantes/malformados, fechas/resumen, allowlist, score/arte/mappings omitidos, cola/concurrencia/spacing, offset, errores HTTP/red/timeout/cancelación, Retry-After, sin cache, fixtures TEST y producto cerrado en web/android/ios/unknown |
| `node docs/testing/anime-catalog-manual-entries/b3-verification.cjs` | SQLite real aislado: coexistencia manual/TMDB/Kitsu, ID externo grande exacto, save/re-save, preservación de ID/createdAt/personales/clasificación/pins, backup7 export/import/reimport, cierre/reopen offline y FK |
| `node docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs` | Componentes reales con hook-host: búsqueda Anime lista/grid/loading/empty/error/retry, referencia/destino, cambios rápidos query/source/category/retry/credencial, aborts y completions obsoletos; detalle con error/retry/save/double save/fallo y closed gate sin DB/red/preferencias personales |
| `node docs/testing/anime-catalog-manual-entries/b1-regressions.cjs` | 17/17 suites de identidad/migración/backup/Appearance/ratings/providers/review |
| `node docs/testing/anime-catalog-manual-entries/b2-verification.cjs` | Manuales/SQLite/pins/backup sin regresión |
| `node docs/testing/anime-catalog-manual-entries/b2-ui-verification.cjs` | Formulario manual sin regresión |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | Boundary de Buscar y navegación |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | Detalle TMDB real + SQLite save/re-save |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | Filtros/pins/sorting |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | Resolución finita, TMDB endpoints, races, credenciales y UI Buscar |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | Root review aislado, cero init/preferencias/credenciales personales |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | MangaUpdates identidad/DTO/mapping/errores/policy/gates con transporte falso |
| `node docs/testing/mangaupdates-cover-images/section-4-verification.cjs` | 18 DBs reales aisladas, persistencia/imports históricos/rollback |
| `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs` | Composición proveedor/search/library/detail/tags y arte simulado |
| `npx tsc --noEmit` | Sin errores |
| `openspec validate add-anime-catalog-and-manual-entries --strict` | Válido |
| `git diff --check` | Sin whitespace inválido |
| `git diff --quiet -- package.json package-lock.json` | Ambos intactos |
| `git diff --cached --exit-code` | Índice sin cambios |

Web build/export: `$env:EXPO_PUBLIC_MEDIA_REVIEW='1'; $env:EXPO_OFFLINE='1'; npx expo export --platform web --output-dir "$env:TEMP/dlv-b3-web-export-final-01a1d28f"` — **exit 0**, bundle y worker SQLite fuera del repo. Export usa producción y el gate __DEV__ mantiene review cerrado: es verificación de compilación, no ejecución Web de review ni aceptación SQLite Expo. Expo cargó automáticamente `.env.local`; no se imprimió/inspeccionó su contenido ni se hicieron solicitudes productivas a proveedores.

Fallos iniciales corregidos: TypeScript detectó una llamada accidental a un parámetro platform string como función; se corrigió. El contrato de tipos esperaba un solo parámetro de search y una referencia al alias anterior quedó pendiente al renombrarlo: ambos se actualizaron para señal opcional sin alterar adaptadores históricos. Una assertion textual de search y el inventario conocido de categorías requerían actualizarse por esos contratos. Al importar Buscar para review, el test Node intentó resolver expo-secure-store por el módulo de cliente TMDB, sin ejecutar lectura personal; se agregó el boundary de transporte falso ya usado por las otras suites. Todas las ejecuciones finales pertinentes pasaron; no se relajaron gates ni se abrió DB personal para corregirlas.

Intento visual Web: Metro development TEST iniciado en 8143; IAB no pudo acceder a `http://127.0.0.1:8143` (ERR_CONNECTION_TIMED_OUT). No se obtuvo inspección visual ni aceptación runtime Web. Metro propio detenido con Ctrl+C (exit 1 por interrupción intencional). No se ejecutó BlueStacks/Android físico ni tráfico HTTP Kitsu nativo. Avisos experimentales node:sqlite, NO_COLOR, Browserslist viejo y LF/CRLF no son fallos; no se actualizó ninguna dependencia.

## Checklist manual histórico B3 (actualizado por reconciliación inferior)

Usar exclusivamente perfil/instalación descartable. Para el entorno TEST development:

```powershell
# Web (primera terminal)
$env:EXPO_PUBLIC_MEDIA_REVIEW='1'
$env:EXPO_OFFLINE='1'
npx expo start --web --port 8143

# BlueStacks conectado por ADB (otra ejecución de Metro, no simultánea en ese puerto)
$env:EXPO_PUBLIC_MEDIA_REVIEW='1'
$env:EXPO_OFFLINE='1'
npx expo start --android --port 8143
```

Si el runtime Android de desarrollo necesita recompilarse con las dependencias ya instaladas, usar `npx expo run:android --device --port 8143` en la instalación descartable, sin añadir dev-client ni dependencias. No usar el build/export de producción para acceder al TEST: el guard __DEV__ lo cierra. Si BlueStacks no aparece por ADB, resolver la conexión del emulador antes de atribuir el fallo al proveedor. Registrar plataforma/runtime/build/origen Web/tamaño y resultados por separado.

- [ ] Confirmar banner TEST y nombres media-review-*; «Anime Kitsu TEST · sin red real» → buscar TEST; revisar seis subtipos y unknown, placeholders, lista/grid, tema claro/oscuro, layout estrecho y foco/labels.
- [ ] Cambiar rápidamente query/categoría/página; simular sin red y reintentar; ningún resultado/error previo reemplaza la consulta actual. Sin red real de proveedor o imágenes.
- [ ] Detalle TEST → guardar → detalle local. Añadir status/tags/notas/rating/pins; volver a búsqueda y guardar de nuevo conserva todo y no duplica. Reabrir runtime conserva snapshot y procedencia offline.
- [ ] Exportar TEST v7/restaurar segunda DB; comprobar referencia kitsu/anime/ID, personales/pins y coexistencia con manual/TMDB/MangaUpdates. Solo DBs descartables; no usar datos personales.
- [ ] En modo normal y perfil descartable, Anime no aparece; ruta `/kitsu/anime/1` cerrada sin red/lecturas de biblioteca. TMDB y MangaUpdates conservan categorías/gates previos. Quitar EXPO_PUBLIC_MEDIA_REVIEW y reiniciar Metro para ese control.
- [ ] Aceptación HTTP Kitsu real Android/Web queda pendiente hasta resolver M; entonces revisar endpoints/redirects/headers exactos, CORS/preflight aplicable y errores por plataforma. No considerar fixtures, CORS de escritorio o aceptación B2 como cumplimiento de T.

Limitaciones: no hay aceptación manual B3. M/T/A sin resolver, sin cuotas oficiales establecidas, campos/categories del cliente no probados en runtime vivo. El cliente soporta offsets pero Buscar mantiene la primera página de hasta 20, como su capability actual; no hay scroll infinito. 429 inválido exige reconstruir cliente después de revisar la causa, no un retry automático. Los tests UI simulan hooks/vistas; Node SQLite no prueba Expo SQLite Android/Web. Sin activación, arte, linking ni garantías de release físico.

## Bundle único de revisión B3

El baseline es el checkpoint B2 verificado, e incluye la reconciliación documental B2. ScriptsCheckpoint verificado con git show y ancestry. PowerShell 7.2+, desde la raíz:

```powershell
$b3ReviewDirectory = Join-Path $env:TEMP ('dlv-b3-review-' + [guid]::NewGuid().ToString('N'))
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline e75d813dd3e9508bb417e1b756e52fc22d5d3d08 -OutputDirectory $b3ReviewDirectory -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint a793d459c841814291c1e3c0887c8bf7b77ecc10
Get-Content -LiteralPath (Join-Path $b3ReviewDirectory 'manifest.md')
```

Comando entregado, sin publicar bundle automáticamente. Estado final esperado: 13 archivos tracked modificados y 16 nuevos, nada staged; HEAD B2 intacto. **STOP para revisión externa B3**, sin marcar 3.5/3.6 ni avanzar B4.

### Manual acceptance — B3 technical checkpoint

- Web / Kitsu TEST: PASS, confirmed by user.
- BlueStacks: NOT TESTED successfully; application launch failed.
- User explicitly deferred repeating this B3 test on BlueStacks.
- Production Kitsu activation: BLOCKED pending usage eligibility.
- External static code review: APPROVED.
- This checkpoint covers technical preparation, not production activation.

## Reconciliación del checkpoint — 2026-11-13

Esta sección actualiza el estado histórico de entrega anterior, incluidos sus avisos
STOP/no iniciar B4, limitaciones manuales y baseline B2. El usuario confirmó revisión
externa aceptada de la preparación técnica B3 y PASS manual Web/Kitsu TEST. No se
inspeccionaron nuevamente esos artefactos externos ni se inventan versión de navegador,
build, origen o medidas que no fueron aportados. El checkpoint resultante es
`da5520b8465478553587856bdc86a4a013eb666d` (`feat: prepare conditional Kitsu anime catalog`),
verificado con git rev-parse, tracking local y git ls-remote origin en esta ejecución;
árbol inicial limpio en feat/anime-catalog-manual-entries.

BlueStacks no pudo iniciar la aplicación; el usuario difirió expresamente repetir B3.
La investigación ambiental sigue pendiente, sin atribuir causa al emulador, Metro,
SQLite o Kitsu. No se solicita otra aceptación B3 idéntica. Android físico permanece
diferido al hito final de desarrollo acordado.

Este checkpoint técnico aceptado autoriza B4 independiente. No habilita Kitsu:
3.5 sigue pendiente por M/T; 3.6 conserva pendiente la decisión explícita de alcance
antes de cerrar el catálogo activo. Ninguna plataforma productiva activa; arte omit,
scores externos ausentes. Ver b4-validation.md para regresión actual y revisión pendiente.
