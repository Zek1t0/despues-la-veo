# Sección 3 — Pósteres, banners y puntuaciones

## Checkpoint y alcance

Inicio: rama `feat/anime-catalog-manual-entries`, HEAD `885ad93fa2d8438fd6611bea7cfedd311ede7cad`, último commit `feat: persist enriched metadata with SQLite v7 and backup v8`. Único worktree: `D:/dev/despues-la-veo`. Worktree y staging limpios. Se inspeccionaron el commit, su inventario y la evidencia de sección 2, incluida la corrección del póster. La revisión externa y el push manual fueron informados por el usuario, no realizados ni comprobados nuevamente contra remoto por este agente. **2.9 cerrada administrativamente** por esa aprobación y checkpoint local confirmado.

Leídos proposal, design, tasks y todos los deltas de specs del change; considerados especialmente D2/D2.1/D3.1 y los límites de sección 4. OpenSpec `spec-driven`, ready. 14/46 al inicio; 19/46 al terminar (2.9 + 3.1–3.4). **3.5 pendiente** de aceptación visual, revisión externa y checkpoint manual. No archive/sync ni modificación del change anterior. No Git de escritura. No cambios de persistencia, proyección aprobada, versiones, merge personal o timestamps; sin dependencias nuevas.

## 3.1 — Evidencia primaria y HTTP real

Consultados el 2026-11-14:

- [JSON:API Kitsu](https://hummingbird-me.github.io/api-docs/): fieldsets e inclusión de relaciones; no prueba por sí sola el payload vigente ni derechos de arte.
- [MediaResource oficial](https://github.com/hummingbird-me/kitsu-server/blob/master/app/resources/media_resource.rb): atributos de imágenes y average_rating.
- [PosterImageUploader](https://github.com/hummingbird-me/kitsu-server/blob/master/app/uploaders/poster_image_uploader.rb) y [CoverImageUploader](https://github.com/hummingbird-me/kitsu-server/blob/master/app/uploaders/cover_image_uploader.rb): derivados de póster distintos de cover. Se usan las dimensiones del payload, no se fabrican desde este código.
- [React Native Image 0.81](https://reactnative.dev/docs/0.81/image) y los archivos instalados descritos abajo.

Reproducción explícita de HTTP, **no ejecutar como parte de suites offline**:

```powershell
node docs/testing/enriched-media-metadata/section-3-live-probe.cjs
node docs/testing/enriched-media-metadata/section-3-live-probe.cjs https://kitsu.io/api/edge
```

Resultados fechados en `section-3-live-evidence.json` y `section-3-live-io-evidence.json`. GET a detalle anime/1 y búsqueda Cowboy Bebop, con el fieldset exacto ampliado por el cliente, HTTP 200 en ambos orígenes. Se comprobó `redirect: error`; sin seguimiento de enlaces recibidos. No credenciales. `averageRating: "82.28"` decimal string; contrato de normalización 0–100, original conservado. La evidencia es una muestra de una obra, no garantía para todo el catálogo.

URLs recibidas de ambos tipos de arte en **media.kitsu.app**:

| Campo | Variantes entregadas | Dimensiones declaradas |
|---|---|---|
| posterImage | tiny, small, medium, large, original | 110×156, 284×402, 390×554, 550×780; original sin dimensiones |
| coverImage | tiny, small, large, original | 840×200, 1680×400, 3360×800; original sin dimensiones |

GET del póster small y cover tiny: HTTP 200, image/jpeg, sin redirect. Se canceló el stream, sin guardar binarios. Las demás variantes fueron verificadas como campos/URLs entregados, **no se descargaron todas**. No se autoriza media.kitsu.io ni cualquier otro host no observado. El soporte de hosts diferentes se verifica además con fixtures explícitos de dos hosts; no se atribuyen esos hosts sintéticos a Kitsu real.

Condiciones: `https://kitsu.app/terms` respondió 403 con desafío; `https://kitsu.io/terms` respondió 200 sin texto utilizable de términos en el HTML recibido. No se resolvieron desafíos ni se aceptó contrato alguno. No se obtuvo una restricción expresa nueva para estas capacidades; tampoco autorización comercial, de hotlink o redistribución. Resultado parcial documentado: capacidad técnica de desarrollo verificada; distribución sin habilitar. Gates Kitsu intactos: solo __DEV__ Web/Android; iOS/producción cerrados. MangaUpdates conserva sus gates, política omit por defecto y único CDN ya permitido.

## 3.2 — Presentación e imágenes

`mediaImagePresentation.ts` reutiliza `metadataImageUrl`, con hosts exactos separados por proveedor: TMDB `image.tmdb.org`, Kitsu de desarrollo `media.kitsu.app`, MangaUpdates `cdn.mangaupdates.com` exclusivamente en Android y sin modificar la autorización previa de covers. Ningún host se autoriza por venir en una respuesta o backup. Las URLs originales admitidas y sus parámetros se conservan. El parser portable existente permite conservar referencias sintácticamente seguras de hosts no revisados; eso **no concede permiso de renderizado**. No se modificaron los parsers/versiones de sección 2: datos estructuralmente inválidos siguen sujetos a su rechazo parcial existente.

Se exige HTTPS, sin credenciales, autoridad ambigua, controles, whitespace, barras invertidas ni puertos no estándar. Hosts exactos excluyen sufijos engañosos; el validador compartido rechaza localhost, sufijos internos, IP literales y representaciones IPv4 alternativas normalizadas por URL, IPv6 y mapped IPv6. Una referencia no admitida no llega a Image y no provoca HEAD/fetch de sondeo. El resto de la ficha y los datos históricos se conservan.

`MediaPoster` elige la menor variante recibida que cubra ancho medido × PixelRatio; si ninguna alcanza usa la mayor con dimensiones conocidas. Variantes sin dimensiones son último recurso determinista. Espera onLayout para evitar la primera descarga especulativa. No construye rutas Kitsu ni supone variantes por nombre. `contain` conserva el arte completo; marcos de póster mantienen los tamaños actuales y banner usa proporción 4.2 con ancho flexible. Caché oportunista de Image/sistema, sin promesa offline ni descarga permanente.

`DetailPoster`, `TitleGridCard`, `PosterPlaceholder`, `usePosterImageError`, tokens y temas actuales se reutilizan. Se añadieron MediaPoster y MediaBanner. Superficies: Buscar lista/grid, Librería lista/grid, Etiquetas grid/collage, detalle guardado, detalle Kitsu y póster del detalle TMDB. Los helpers existentes de perfiles/logos TMDB también pasan por el validador antes del renderer. No nuevo detalle editorial, idiomas, selección de fuentes UI o refresh.

Resolución guardada: `savedMediaPresentation` toma exclusivamente selección y documento activos existentes. Sin fuente inequívoca no atribuye imágenes o score. PosterImages null/[] es autoritativo; omitido puede usar el snapshot proyectado atribuible. Una colección rechazada puede conservar un histórico TMDB validado de la misma referencia; jamás usa ese histórico en Kitsu. `projectMediaMetadata` y su regresión aprobada permanecen intactos. No se mezclan documentos inactivos.

## 3.3 — Renderer y límites efectivos

Inspeccionados localmente `node_modules/react-native/Libraries/Image/ImageProps.js`, `ReactAndroid/src/main/java/com/facebook/react/views/image/ReactImageView.kt`, y `node_modules/react-native-web/src/modules/ImageLoader/index.js`. Web utiliza window.Image y asigna src; Android construye ImageRequest de Fresco desde la URI. La API pública utilizada no expone interceptor previo de cada redirect o resolución DNS. No se confunde el redirect:error del probe/API con un control de Image.

Se admiten URLs directas revisadas. `admittedImageUrl` y el selector aceptan evidencia confiable adicional del adaptador sobre destinos: un redirect conocido sin destinos verificables o un destino conocido rechazado excluye la variante antes de Image. Esa evidencia no forma parte del backup ni del payload portable. No se conoce en la muestra una variante que requiera redirect. `DetailPoster.onLoad` comprueba source.uri cuando se reporta; es solo diagnóstico/fallback posterior, **no certificación del destino final ni prevención de una conexión previa**. No se implementa proxy/downloader.

Límite residual explícito: hostname permitido no prueba una resolución DNS pública, no elimina rebinding y no intercepta cambios futuros de redirects de un servidor permitido. No aislamiento total de red. El error de Image solo reemplaza el arte por placeholder, sin bloquear acciones ni borrar datos. El hook existente aísla callbacks por URL/identidad; MediaPoster incorpora proveedor y referencia al identificador visual. Fixtures comprueban reciclado A→B→A y callbacks viejos, cambio de URL, ancho/densidad, ausente/inválida/fallida y URI reportada no admitida.

## 3.4 — Puntuación pública

Componente PublicRating neutral con etiqueta `Puntuación pública · Kitsu/TMDB`, tokens del tema y jerarquía distinta del badge/editor personal. `publicRatingLabel` presenta un decimal con coma: 82.28/100 → 8,2/10; cero → 0,0/10. El contrato conserva proveedor, originalValue y originalScale; ninguna mutación personal. Null, ausente, no finito y fuera de escala no son cero.

Fuente activa exclusivamente; si declara null no se busca otro score. TMDB permite fallback al voteAverage legacy solo con referencia TMDB atribuible; el snapshot del documento activo también conserva esa autoridad. Sin fuente inequívoca se omite. Kitsu jamás escribe voteAverage; MangaUpdates y manuales no reciben scores inventados. No promedio. Integración en cards/listas y detalles previstos; accesibilidad de filas incluye etiqueta pública y personal por separado.

## Verificación y límites

```powershell
node docs/testing/enriched-media-metadata/section-3-regressions.cjs
npx tsc --noEmit
openspec validate add-enriched-media-metadata-and-library-updates --strict
git diff --check
```

La matriz ejecuta las 24 suites del checkpoint de sección 2, más su regresión específica de póster y tres suites nuevas de backup/presentación/renderer: **28/28 exit 0**. Salidas reproducibles en `section-3-results.json`. Incluye contratos sección 1, SQLite real/migración/recuperación/import1–8, preferencias e invalidación, identidad, materialización, manuales, Kitsu/MangaUpdates y harnesses de UI. Se actualizaron expectativas antiguas para el fieldset explícito nuevo y los componentes reutilizados; un host sintético inyectado ya no puede eludir la política. No se tocaron specs/tareas/evidencia del change anterior. Las pruebas nuevas no hacen red; el replay de la forma del payload real sigue siendo prueba determinista, no HTTP ni aceptación física.

TypeScript, OpenSpec estricto y diff check: exit 0. Validación de colores mediante consumo de tokens y harness; no aceptación visual de temas. El aviso experimental de SQLite Node no es fallo de suite.

Smoke Web intentado con `EXPO_PUBLIC_MEDIA_REVIEW=1`, `npx expo start --web --port 8093 --localhost`: Metro listo. La vista ArtReview dentro de la revisión ya existente usa DBs/tema de prueba, sin biblioteca ni credenciales personales, con controles claro/oscuro, ancho 320 y cambio de identidad. El navegador integrado informó ERR_CONNECTION_TIMED_OUT; luego Computer Use detuvo el acceso a Brave al no poder determinar la URL actual con confianza para aplicar su política. No hubo validación visual ni se intentó eludir ese bloqueo. Se detuvo Metro al finalizar. **Web claro/oscuro, pantalla estrecha, imágenes cargadas en navegador y Android físico/emulador permanecen sin comprobar.** No se encontró adb en PATH ni runtime Android abierto. No se atribuye a los mocks apariencia o aceptación real.

3.1–3.4 completadas con evidencia técnica/determinista y límites anteriores explícitos. **3.5 pendiente**, sección 4 no iniciada, checkpoint Git manual pendiente. La revisión externa debe considerar especialmente esa aceptación visual pendiente y el límite residual de redirects/DNS.

## Inventario de esta entrega

El nuevo round-trip específico también verifica imágenes activas y puntuación con SQLite/v8, personales intactos, host no revisado conservado pero no renderizable, y rechazo parcial existente de un documento con IP privada.

Modificados:

- `app/(tabs)/buscar.tsx`
- `app/(tabs)/etiquetas.tsx`
- `app/(tabs)/libreria.tsx`
- `app/mangaupdates/series/[id].tsx`
- `app/title/[id].tsx`
- `app/tmdb/[type]/[id].tsx`
- `docs/testing/anime-catalog-manual-entries/development-activation-verification.cjs`
- `docs/testing/enriched-media-metadata/section-1-providers.cjs`
- `docs/testing/expanded-media-domain/section-3-ui-verification.cjs`
- `docs/testing/mangaupdates-cover-images/section-2-verification.cjs`
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs`
- `openspec/changes/add-enriched-media-metadata-and-library-updates/tasks.md`
- `src/components/browsing/DetailPoster.tsx`
- `src/components/browsing/TagCollage.tsx`
- `src/components/browsing/TitleGridCard.tsx`
- `src/components/browsing/savedTitleAccessibility.ts`
- `src/dev/mediaReview/MediaReview.tsx`
- `src/providers/kitsu/AnimeDetail.tsx`
- `src/providers/kitsu/client.ts`
- `src/providers/kitsu/product.ts`
- `src/providers/mangaupdates/mapping.ts`
- `src/providers/tmdb/tmdbApi.ts`
- `src/providers/tmdb/tmdbImages.ts`

Nuevos:

- `docs/testing/enriched-media-metadata/section-3-backups.cjs`
- `docs/testing/enriched-media-metadata/section-3-checks.json`
- `docs/testing/enriched-media-metadata/section-3-live-evidence.json`
- `docs/testing/enriched-media-metadata/section-3-live-io-evidence.json`
- `docs/testing/enriched-media-metadata/section-3-live-probe.cjs`
- `docs/testing/enriched-media-metadata/section-3-presentation.cjs`
- `docs/testing/enriched-media-metadata/section-3-regressions.cjs`
- `docs/testing/enriched-media-metadata/section-3-renderer.cjs`
- `docs/testing/enriched-media-metadata/section-3-results.json`
- `docs/testing/enriched-media-metadata/section-3-validation.md`
- `src/components/browsing/MediaBanner.tsx`
- `src/components/browsing/MediaPoster.tsx`
- `src/components/browsing/PublicRating.tsx`
- `src/components/browsing/imageRuntime.ts`
- `src/core/mediaImagePresentation.ts`
- `src/core/mediaPresentation.ts`
- `src/dev/mediaReview/ArtReview.tsx`
