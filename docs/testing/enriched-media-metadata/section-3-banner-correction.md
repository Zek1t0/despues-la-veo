# Corrección mínima S3 — Banner inexistente

Baseline de esta corrección: rama `feat/anime-catalog-manual-entries`, HEAD `885ad93fa2d8438fd6611bea7cfedd311ede7cad`, staging vacío. El bundle S3 previo seguía presente: 23 modificados y 17 nuevos. La revisión externa fue informada por el usuario. No se considera un commit nuevo ni aceptación visual.

## Cambio

`MediaBanner` comprueba únicamente si la metadata de la fuente correspondiente declara al menos una variante horizontal. Si falta metadata o bannerImages es omitido/null/[], devuelve null antes de montar MediaPoster: no hay View, proporción, placeholder ni espacio reservado por el banner. Se aplica a las fichas guardadas y Kitsu sin modificar sus call sites.

Si existen variantes, sigue delegando selección, autorización y fallback en MediaPoster/DetailPoster. Una URL rechazada conserva el placeholder seguro existente y no llega a Image; una imagen admitida que falla también conserva ese fallback. No se duplica la política URL ni se construyen rutas. No se cambian los pósteres normales, la proyección histórica TMDB o la autoridad entre fuentes.

## Inventario exclusivo de esta corrección

Modificados respecto del bundle S3 revisado:

- `src/components/browsing/MediaBanner.tsx`: cuatro líneas añadidas; guardia de presencia y procedencia.
- `docs/testing/enriched-media-metadata/section-3-renderer.cjs`: regresiones del banner en el harness existente.

Nuevos:

- `docs/testing/enriched-media-metadata/section-3-banner-correction-results.json`: salidas de las 28 suites reejecutadas, sin sobrescribir section-3-results.json.
- `docs/testing/enriched-media-metadata/section-3-banner-correction.patch`: diff incremental de implementación y pruebas respecto del bundle S3 previo; no incluye todo el diff acumulado contra HEAD.
- `docs/testing/enriched-media-metadata/section-3-banner-correction.md`: este registro.

## Pruebas y resultados

Las regresiones añadidas comprueban:

1. Manual sin banner: retorno null, sin marco visual.
2. TMDB histórico sin banner enriquecido: retorno null.
3. Kitsu con variantes admitidas: conserva MediaPoster/context banner y elección por ancho medido.
4. Kitsu con banner omitido/null/vacío: retorno null.
5. Banner de host no revisado: nunca entrega URL al renderer y mantiene placeholder.
6. Banner admitido cuyo Image dispara onError: mantiene PosterPlaceholder.
7. Cambio con banner → sin banner → con banner: elimina/restaura el hijo y el remontaje no hereda el fallo anterior.
8. Metadata de otro proveedor: no aporta banner.
9. Póster normal sin imagen: conserva su marco habitual.

`node docs/testing/enriched-media-metadata/section-3-renderer.cjs`: exit 0. Se reejecutaron además los 28 comandos registrados en section-3-results.json: **28/28 exit 0**, con nuevas salidas en section-3-banner-correction-results.json. Incluyen presentación, backup v8, regresión histórica TMDB, contratos/proveedores, SQLite/migración/recuperación y harnesses de las fichas existentes. Son fixtures y harnesses deterministas, no aceptación visual Web/Android. Sin solicitudes HTTP ni datos personales.

- `npx tsc --noEmit`: exit 0.
- `openspec validate add-enriched-media-metadata-and-library-updates --strict`: exit 0.
- `git diff --check`: exit 0.

Sin cambios en SQLite v7, backup v8, gates, dependencias, contratos personales o tareas OpenSpec. Sin Git de escritura. OpenSpec sigue 19/46; **3.5 pendiente** de revisión final, aceptación visual y checkpoint manual. S4 no iniciada.
