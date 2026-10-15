# Sección 4 — categorías finitas de Buscar

Fecha: 2026-10-12. Change: `add-expanded-media-domain-and-second-provider-foundation`. Alcance exclusivo: **4.1–4.4**.

## Resultado y límite de implementación

4.1–4.4 implementadas y verificadas. Se conserva el estado previo de todas las demás tareas: 1–3 estaban completas al iniciar esta sesión, incluida 3.4; 5–9 permanecen sin cambios. Progreso final: **20/36**. No se ejecutó Git para comprobar/cambiar la rama indicada por el usuario.

- Catálogo finito movie/tv/manga/manhwa/manhua y resolución explícita de source/capability/destino. No categoría anime remota, registry ni DetailCapability.
- Producción Web/Android/iOS expone **Películas y Series**, respaldadas por TMDB. MangaUpdates no tiene adapter en ninguna plataforma; sus definiciones/destino futuro no habilitan búsqueda, pantalla o red. Otras plataformas no se presumen elegibles.
- TMDB usa `/search/movie` y `/search/tv` con página 1, es-AR e include_adult false; normaliza DTOs antes de Buscar. La capability multi existente queda preservada para consumidores/pruebas previas. Endpoints contrastados con documentación oficial: https://developer.themoviedb.org/reference/search-movie y https://developer.themoviedb.org/reference/search-tv.
- Navigation valida provider/namespace/ID y categoría conocida. Solo rutas explícitas; referencias arbitrarias/no canónicas o de otra categoría no se activan. Destino MangaUpdates existe únicamente como contrato futuro/test, sin ruta real.
- Hook de lifecycle con query trim, categoría, source, sequence, retry y generación de configuración solo TMDB; debounce 350 ms. Limpieza de efectos y comparación de identidad ignoran completions viejos/unmount. Render oculta inmediatamente resultados/loading/error no pertenecientes al scope actual, antes del cleanup.
- Shell productivo TMDB conserva contexto/acciones/errores propios. SearchScreen y hook no requieren contexto de credenciales para bindings sintéticos exclusivamente de tests. No credenciales, error hierarchy ni API-key settings universales.
- Detalle/Mosaico y preferencias existentes preservados. Categorías tienen estado seleccionado nativo y aria-pressed Web, foco/44 px; loading tiene label/live region, empty/error anuncio textual; fila oculta descendientes decorativos para no duplicar el nombre de activación. Grid conserva componente real existente.

No Sección 5+: ningún catálogo fixture productivo, review route/DB/bootstrap/TEST backup flow ni implementación MangaUpdates. Cero requests MangaUpdates productivos: el único resolver ejecutable entrega capabilities TMDB, no se añadió cliente/endpoint/DTO/mapper/error/cover/attribution MangaUpdates. Los stubs sintéticos viven únicamente en el script de verificación.

## Archivos creados

- `src/components/search/searchCategories.ts`
- `src/components/search/useCategorySearch.ts`
- `docs/testing/expanded-media-domain/section-4-verification.cjs`
- `docs/testing/expanded-media-domain/section-4-validation.md`
- `docs/testing/expanded-media-domain/section-4-buscar-narrow-web.png`

## Archivos modificados

- `app/(tabs)/buscar.tsx`
- `src/providers/tmdb/tmdbAdapter.ts`
- `src/providers/tmdb/tmdbApi.ts`
- `docs/testing/provider-abstraction/section-3-buscar-verification.cjs`
- `docs/testing/tmdb-user-credential/section-4-verification.cjs`
- `docs/testing/global-appearance-themes/section-7-verification.cjs`
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md` (solo checkboxes 4.1–4.4)

Las tres regresiones modificadas tenían assertions estáticas del cableado anterior (capability multi en pantalla, helpers TMDB en Buscar y ruta interpolada). Se actualizaron al hook/resolver reales; se preservaron tests de preferencias, CTA/credenciales, detalle TMDB, frontera normalizada e identidad, añadiendo rechazo de provider arbitrario. No se cambió implementación de Secciones 1–3 para hacerlas pasar.

## Automatización — comandos y resultados finales

| Comando | Exit |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-4-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-7-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |
| `git diff --check --` seguido exclusivamente por los archivos de esta sección listados arriba | 0 |

Verificación nueva: catálogo/disponibilidad por plataforma, resolvers e IDs, defaults/endpoints TMDB, debounce determinista, misma query al cambiar categoría, orden invertido de respuestas, retries consecutivos/errores viejos, resets, empty query, generación TMDB y ausencia de ella en no-TMDB, pending response tras unmount, ranking de una fuente sin mezcla, credential missing/storage/invalid/network/retry, ambos destinos y modos, 390 px y nombres accesibles. Ejecuta hook y SearchScreen reales en host de hooks con timer/transport stubs, sin framework/dependencia nuevos. No reemplaza navegador ni renderer nativo. Un assert inicial atrapó la palabra registry en un comentario; se ajustó la inspección a código sin comentarios. Las tres regresiones de cableado inicialmente fallaron y pasan tras su adaptación descrita.

## Revisión Web realmente realizada

Servidor: `$env:EXPO_OFFLINE='1'; npx expo start --web --localhost --port 8104`. El proceso sandbox anunció estar listo pero el browser no pudo conectar; se detuvo y arrancó el mismo comando fuera del aislamiento de red. IAB abrió **http://127.0.0.1:8104/buscar**, origen de prueba; no se usó biblioteca personal ni se importaron datos. La app compiló/cargó. No se configuró credencial, leyó/copió token ni se usó el antiguo token de entorno: TMDB permaneció no configurado en este origen.

Observado en navegador/árbol accesible/DOM y captura:

- Solo Películas/Series, sin Manga/Manhwa/Manhua/Anime ni selector de marcas.
- Campo Películas, query Alien → estado TMDB no configurado y acciones Obtener token/Configurar TMDB.
- Cambio a Series conserva Alien y cambia label/placeholder; mismo estado específico sin resultados de otra categoría.
- Estado seleccionado aria-pressed verificable; labels de categoría anunciados una vez. Tab desde textbox enfoca Abrir opciones de Buscar.
- Panel Apariencia con Detalle/Mosaico, selección Mosaico y cierre; luego consulta vacía vuelve a invitación inicial sin CTA de credencial residual.
- Viewport 390×844: categorías/input/opciones y tabs sin overflow; DOM innerWidth=390 y scrollWidth=390. Captura `section-4-buscar-narrow-web.png`; override se restableció al terminar.

**Límite manual:** no hubo búsquedas TMDB con token, resultados/live loading/errores HTTP ni navegación desde resultado real en navegador. Esos recorridos están cubiertos por host determinista y regresión TMDB, no se presentan como prueba de red real. No se configuraron credenciales para ampliar QA ni se simularon datos productivos en navegador.

**Plataformas:** navegador Web real y Web responsive; host de componentes con stubs. Sin ejecución manual Android/iOS, TalkBack/VoiceOver o proveedor nativo. No se repitió revisión de Sección 3 ni se crearon AVDs.

Al terminar se restableció viewport, cerró la pestaña temporal y detuvo Expo con Ctrl+C (exit 1 de terminación voluntaria, no fallo de compilación). Metro compiló entry y worker SQLite; warnings NO_COLOR/FORCE_COLOR y node:sqlite experimental en regresiones. No se cambiaron dependencias para eliminarlos.

## Higiene y diferidos

Comparación SHA256 de archivos previos: core/storage, contratos ProviderReference/snapshot/materialización, SQLite v5/backup v6, credenciales/SecureStore, otros consumidores de Biblioteca/detalle, package.json y package-lock.json sin cambios de esta sesión. Scripts android=`expo run:android`, ios=`expo run:ios` intactos. Sin migración/dependencias nuevas. Checkboxes fuera de 4.1–4.4 idénticos a inicio.

Revisión del cambio contra el estado inicial sin Git diff adicional: solo catálogo/lifecycle/UI Buscar, operaciones TMDB por categoría, verificación, captura, informe y cuatro checkboxes. Whitespace comprobado también en archivos nuevos (git diff --check no inspecciona untracked). Git solo se utilizó para el diff --check solicitado; sin add/stage/commit/push/checkout/reset/stash ni otras operaciones. Avisos LF/CRLF no son errores de whitespace.

MangaUpdates real, eligibility/transport/DTOs/mapping/caché/atribución/covers y detalle pertenecen a 6–8. Harness neutral y review aislado pertenecen a 5. Web MangaUpdates sigue bloqueado por CORS; nada en esta entrega lo habilita. Anime, literatura remota, manual local y ratings universales quedan diferidos.
