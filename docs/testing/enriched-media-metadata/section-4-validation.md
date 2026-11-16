# Sección 4 — Detalle enriquecido e idiomas

## Baseline y alcance autorizado

Rama `feat/anime-catalog-manual-entries`, HEAD `faa552a77c1dc225dce282e6df51ac33f540a507`, último commit `feat: add enriched media images and public ratings`. Único worktree `D:/dev/despues-la-veo`; working tree y staging limpios al comenzar. El commit incorpora S3 y la guardia de MediaBanner para arte horizontal ausente. El usuario informó revisión externa y checkpoints manuales S1–S3. Se verificó el checkpoint local; no se afirmó verificar push remoto ni realizar de nuevo la revisión externa.

**3.5 cerrada administrativamente** por ese checkpoint y la aceptación Web limitada informada; **Android no comprobado**. No se modificó la implementación S3 para cerrar la tarea. El change anterior sigue sin asumirse archivado, integrado o cerrado; no se editó.

Leídos proposal/design/tasks y los deltas de specs del change, con atención a D2/D3.1/D4.1/D9. OpenSpec spec-driven, ready; 19/46 iniciales, **23/46 al terminar** (3.5 administrativa + 4.1–4.3). **4.4 queda pendiente** de revisión externa, aceptación manual y checkpoint Git del usuario. Sin trabajo S5–S7, versiones nuevas, dependencias o Git de escritura.

## 4.1 — Ficha editorial

`editorialPresentation.ts` construye filas de texto neutrales y `EditorialDetails` usa los tokens y componentes React Native existentes. Se integra en detalle Kitsu, detalle TMDB compatible y ficha guardada. El componente no consulta APIs ni conoce campos específicos del JSON Kitsu.

Campos según disponibilidad: título canónico y variantes con idioma/script conocidos (o sin identificar), sinopsis e idioma declarado, inicio/finalización editorial, estado editorial original y etiqueta normalizada, episodios, minutos por episodio, duración total informada, géneros narrativos, categorías/temas editoriales, advertencias explícitas, clasificación de edad y guía atribuidas, formato/clasificación. Episodios se omiten para medios no audiovisuales conocidos. No se usa nsfw como sustituto de advertencias ni se introduce filtro sensible.

Presencia: omitido no crea una afirmación de ausencia; null presente se muestra como desconocido; cero se conserva; colección vacía presente se etiqueta “Ninguno informado”. No se calcula duración total ni episodios restantes. Fechas del contrato vigente son ISO de día completo; se muestran con esa precisión. Un año legacy se identifica como “solo año conocido”. No se fabrican meses/días, temporadas, equivalencias argentinas o traducciones.

La ficha guardada consume el documento activo de S2 y su snapshot compatible, con procedencia histórica identificada. Null autoritativo no dispara fallback y documentos inactivos no aportan campos. Manuales conservan la autoridad local. Datos editoriales no escriben personales; se distinguen de los controles de estado y puntuación personal ya existentes. Imágenes y puntuaciones siguen usando los componentes S3, incluida la guardia de banner ausente y la regresión histórica TMDB intacta.

El fieldset de desarrollo Kitsu ahora solicita los campos editoriales soportados por su normalizador S1; el cliente sin opciones explícitas sigue usando la proyección mínima. No se amplían gates. TMDB conserva snapshot y voteAverage y añade al documento editorial los datos ya disponibles en su DTO de detalle: canónico, fecha válida, sinopsis/idioma desconocido, géneros y runtime de película como total informado; no se deriva total de series ni se atribuye el idioma original del audio a la sinopsis. MangaUpdates conserva su contrato actual y su snapshot, sin nuevas capacidades remotas.

### HTTP real separado de fixtures

Reproducción explícita: `node docs/testing/enriched-media-metadata/section-4-live-probe.cjs`. No forma parte de las suites offline ni se llama al cambiar idioma/fuente. Evidencia fechada en `section-4-live-evidence.json`: GET de detalle anime/1 y búsqueda Cowboy Bebop sobre `https://kitsu.io/api/edge`, con el fieldset exacto del cliente, ambos HTTP 200 y sin redirects. La muestra entregó description, abbreviatedTitles, endDate, status, episodeCount, episodeLength, totalLength, ageRating, ageRatingGuide y updatedAt. Normalización del detalle sin diagnósticos. No se descargaron imágenes ni se usaron datos personales/credenciales; es HTTP Node, no aceptación Web/Android ni garantía de cobertura de todo el catálogo. No se infirieron derechos comerciales o nuevas condiciones de proveedores.

## 4.2 — Idiomas

`resolveMediaTitle` aplica el orden persistido; default S2 conservado **es → en → ja-Latn → canónico**. Después: otra variante en orden determinista por idioma/script/valor y título histórico/local. El mapper Kitsu existente conserva en_jp como ja/Latn y ja_jp como ja/Jpan: la presentación no transforma romanizado en inglés ni inventa idioma para variantes sin identificar. Español genérico admite regiones con desempate estable, dando prioridad a es exacto. La resolución conserva lenguaje/script del título elegido y etiqueta los fallbacks en detalle cuando corresponde. No traducción ni consultas por idioma.

La pantalla `app/settings/metadata-languages.tsx`, accesible desde Ajustes con su PrimaryButton existente, permite subir/bajar, quitar, agregar códigos de idioma/script y restablecer el orden inicial. Tiene controles accesibles, mínimos de toque, estado de guardado, error y reintento. No ofrece preferencias de refresh o filtro sensible.

Reutiliza `metadata.preferences` de SQLite v7/backup v8. `setMediaLanguages` relee la preferencia dentro de la transacción y modifica solamente languages; conserva autoRefresh/hideSensitive y notifica solo después del commit. Un no-op no publica ni avanza el reloj. El validador existente ahora también rechaza duplicados de idioma que difieren solo en capitalización. Imports inválidos se reportan parcialmente sin descartar los títulos restaurables. No se cambian esquema/versiones de DB/backup ni reglas personales.

`useMediaLanguages` se suscribe antes de hidratar; un read antiguo no pisa una preferencia más reciente, se desuscribe y descarta resultados tras unmount. Las vistas inyectadas de revisión usan sus propios servicios/DBs; no hidratan preferencias personales. Cambiar idiomas solo deriva el título visible: no altera documentos, title persistido, identidades, referencias, pins ni relojes personales.

## 4.3 — Proyección, selección y búsqueda

`presentSavedTitle` parte de `projectMediaMetadata` de S2 y del documento activo usado por S3; deriva una copia de presentación con el título resuelto. Biblioteca (cards/listas, filtros y ordenamiento por título), Etiquetas (lista/grid/collage), detalle guardado y búsqueda remota compatible comparten la resolución. Manuales y su título editable tienen prioridad local; no existe otro contrato de override personal explícito en el modelo inspeccionado y no se inventa uno por diferencias de texto o timestamps.

La acción existente de estado en Biblioteca fue protegida: sus filas ahora tienen título de presentación, por lo que el upsert usa **el item original** de su snapshot, nunca la fila localizada ni resolvedTitle. La regresión UI comprueba que una fila visible “English Kitsu” guarda “Kitsu Canon” al cambiar estado. Esto conserva las reglas personales existentes; no añade otra mutación de metadata.

`MetadataSourceSelector` ofrece solo referencias guardadas de la obra, con proveedor/namespace/ID y si tienen ficha local. No matching ni creación de documentos/referencias para habilitar opciones. Si varias referencias no tienen selección inequívoca se identifica el fallback histórico/ambiguo y no se elige ganador por orden, score o fecha. También se permite seleccionar una referencia existente sin documento, indicando esa limitación; solo puede presentar su histórico compatible.

La selección llama al repositorio transaccional S2 `selectMetadataSource`; no solicita HTTP. La invalidación poscommit existente actualiza vistas montadas por IDs y conserva documentos A/B, notas, tags, estado, puntuación personal, pins, identidad y timestamps personales. La ficha mantiene su item original y sus borradores/colas de intents; idioma solo cambia presentación y fuente relee mediante el observer existente.

La búsqueda local consume `localAliases` leídos de `media_title_aliases` existente. `matchesLocalMediaQuery` normaliza case/acentos conservando scripts para consultar título, aliases y tags; no hace SQL nuevo por fila ni HTTP. Biblioteca mantiene filtros, ordenamiento y prioridad de pins; deduplica por ID local. Etiquetas puede encontrarse por su nombre o por los títulos/alias de sus obras, y dentro de una etiqueta incorpora un campo de búsqueda por título/alias. `selectVisibleTagTitles` comparte el predicado y conserva orden/pins con deduplicación por ID. Alias de fuentes inactivas siguen buscándose sin aportar campos visibles; modificar/eliminar un documento reconstruye o elimina sus aliases bajo los mecanismos S2 existentes. No se agregó una operación productiva nueva de eliminación documental: su regresión usa una eliminación SQL aislada seguida de rematerialización para comprobar lectura e invalidación.

## Verificación reproducible

```powershell
node docs/testing/enriched-media-metadata/section-4-regressions.cjs
npx tsc --noEmit
openspec validate add-enriched-media-metadata-and-library-updates --strict
git diff --check
```

**33/33 suites exit 0**, salidas en `section-4-results.json`: 28 suites S1–S3 (incluidos contratos, SQLite real, imports históricos, v8, autoridad/observadores, TMDB/Kitsu/MangaUpdates, personales y regresión de póster/banner/score) + cinco nuevas:

- `section-4-editorial.cjs`: fichas completas/parciales/manuales/legacy, fechas imposibles, unidades, cero/null/omitido/vacío, fuente, sin total calculado ni mutación de entrada.
- `section-4-languages.cjs`: español regional, ausencia de español con inglés, ja-Latn frente a ja, canónico/variante sin idioma/histórico, override explícito pasado al resolver, preferencias inválidas y duplicadas.
- `section-4-preferences.cjs`: SQLite real, commit/no-op/rollback de idiomas, notificación poscommit, otros defaults y todas las tablas personales/identitarias/pins conservadas; export/parse v8 y duplicados inválidos con reporte parcial.
- `section-4-sources.cjs`: SQLite real A→B→A, ambiguo, parcial/null, alias compartidos/inactivos con acentos/scripts, filtros y dedup, observación montada, selección sin documento, eliminación documental aislada, v8 tras selección y personales/identidades intactos; fetch prohibido en la suite.
- `section-4-ui.cjs`: harness de los componentes reales de detalle, selector y Ajustes; cambio de fuente con nota sin guardar, cambio de idioma, carrera de hidratación y unsubscribe, reordenamiento/save/duplicados; acción personal de Biblioteca sin persistir el título localizado. Son módulos UI/storage simulados; no se presentan como aceptación física.

Se ajustaron dos harnesses heredados para inspeccionar filas de EditorialDetails y la proyección memoizada de presentación TMDB, manteniendo sus controles de solicitudes, guardado e identidad.

TypeScript, OpenSpec estricto y diff check: **exit 0**. SQLite de Node avisa API experimental; no representa un fallo. No se actualizaron dependencias sugeridas por Expo.

## Smoke Web y límites

Metro se inició con `EXPO_PUBLIC_MEDIA_REVIEW=1`, `CI=1`, `npx expo start --web --port 8094 --localhost`. El root de revisión separa DBs/tema de prueba de la biblioteca/credenciales personales. El servidor dentro del sandbox no era accesible para IAB/Brave; se reinició con escalación autorizada, siempre limitado a localhost. Brave pudo abrir la revisión. Se fijó la altura de la cabecera de controles de **esa herramienta de revisión**, que se colapsaba; no se cambió el layout de cards del producto.

Comprobación visual efectiva en Brave de escritorio, tema oscuro y zoom del navegador observado 110%: búsqueda Kitsu TEST con transporte sintético, lista de resultados, apertura de ficha, placeholder de póster, ausencia de franja de banner, título/fallback, ficha editorial, sinopsis con idioma sin identificar, fecha completa y atribución de fuente. Se observó el texto esperado y el layout en pantalla. No se guardó o migró una base personal.

Se ampliaron fixtures TEST con variantes es/en/ja-Latn y campos editoriales para facilitar revisión posterior. Los botones de idioma TEST operan sobre preferencias de DB aislada y el selector usa el repositorio real sobre esa misma DB. Antes de completar visualmente el cambio de idioma, Computer Use detuvo el control al no poder determinar la URL actual con suficiente confianza para aplicar su política. Se respetó la detención y se apagó Metro. **No se declara verificado visualmente cambio de idioma/fuente, Ajustes productivo, tema claro, ancho estrecho ni Android**. No se encontró adb en PATH ni runtime Android activo. Las pruebas automatizadas cubren esos comportamientos funcionales dentro del alcance que documentan.

No hay desvío funcional de OpenSpec ni defecto bloqueante de SQLite/backup. Límites: fechas solo con la precisión del contrato existente, capacidades editoriales remotas parciales por proveedor, smoke Web parcial y Android pendiente. **4.1–4.3 completas con esos límites; 4.4 pendiente**. Sin S5/S6/S7, gates ampliados, nuevos permisos de proveedores o Git de escritura.

## Inventario

Modificados:

- `app/(tabs)/ajustes.tsx`
- `app/(tabs)/buscar.tsx`
- `app/(tabs)/etiquetas.tsx`
- `app/(tabs)/libreria.tsx`
- `app/kitsu/anime/[id].tsx`
- `app/title/[id].tsx`
- `app/tmdb/[type]/[id].tsx`
- `docs/testing/expanded-media-domain/section-3-ui-verification.cjs`
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs`
- `openspec/changes/add-enriched-media-metadata-and-library-updates/tasks.md`
- `src/core/libraryView.ts`
- `src/core/mediaPreferences.ts`
- `src/core/tagView.ts`
- `src/dev/mediaReview/MediaReview.tsx`
- `src/dev/mediaReview/kitsuFixture.ts`
- `src/dev/mediaReview/session.ts`
- `src/providers/kitsu/AnimeDetail.tsx`
- `src/providers/kitsu/client.ts`
- `src/providers/tmdb/tmdbMappers.ts`
- `src/storage/mediaPreferencesRepo.ts`

Nuevos:

- `app/settings/metadata-languages.tsx`
- `docs/testing/enriched-media-metadata/section-4-checks.json`
- `docs/testing/enriched-media-metadata/section-4-editorial.cjs`
- `docs/testing/enriched-media-metadata/section-4-languages.cjs`
- `docs/testing/enriched-media-metadata/section-4-live-evidence.json`
- `docs/testing/enriched-media-metadata/section-4-live-probe.cjs`
- `docs/testing/enriched-media-metadata/section-4-preferences.cjs`
- `docs/testing/enriched-media-metadata/section-4-regressions.cjs`
- `docs/testing/enriched-media-metadata/section-4-results.json`
- `docs/testing/enriched-media-metadata/section-4-sources.cjs`
- `docs/testing/enriched-media-metadata/section-4-ui.cjs`
- `docs/testing/enriched-media-metadata/section-4-validation.md`
- `src/components/browsing/EditorialDetails.tsx`
- `src/components/browsing/MetadataSourceSelector.tsx`
- `src/components/browsing/useMediaLanguages.ts`
- `src/core/editorialPresentation.ts`
- `src/core/mediaTitlePresentation.ts`
- `src/core/mediaViewProjection.ts`
