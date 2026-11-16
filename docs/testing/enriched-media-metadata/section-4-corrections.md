# Correcciones A/B de S4 — revisión externa

Fecha: 2026-11-15. Rama `feat/anime-catalog-manual-entries`, HEAD `faa552a77c1dc225dce282e6df51ac33f540a507`. El bundle S4 previo seguía sin commit: 20 modificados y 18 nuevos, staging vacío. Autorización limitada a estas dos correcciones. OpenSpec spec-driven/ready, 23/46 completas; **4.4 continúa pendiente**, sin modificar tasks.md durante esta corrección.

## A — Búsqueda Unicode

`normalizeMediaSearch` mantiene NFD para separar los diacríticos, pero elimina marcas únicamente si acompañan una letra del script Latin. Después recompone NFC y aplica minúsculas. Así se conservan acentos latinos/case-insensitivity sin eliminar dakuten/handakuten de kana ni marcas de otros sistemas. NFC admite equivalencia canónica entre formas compuestas/descompuestas; no hace transliteración, equivalencia hiragana/katakana o conversión de ancho.

```ts
value.normalize("NFD")
  .replace(/(\p{Script=Latin})\p{M}+/gu,"$1")
  .normalize("NFC").toLocaleLowerCase("es")
```

Pruebas positivas: ÁRBOL/arbol, CANCIÓN y su forma descompuesta, Pokémon/POKEMON, English TITLE/english title, が/か+3099, ぱ/は+309A y sus equivalentes katakana. Negativas: が/か, ぱ/は, ガ/カ, パ/ハ, hiragana frente a katakana y marcas devanagari preservadas.

La nueva suite crea SQLite aislado con variantes en documentos Kitsu y TMDB de la misma identidad local, selecciona TMDB y consulta Biblioteca/Etiquetas por aliases de ambas fuentes. Comprueba acentos/case, kana compuestos/descompuestos, rechazo de coincidencias falsas y un único resultado por ID. Compara el item y las filas originales de media_title_aliases antes/después; no se modifican strings, IDs ni almacenamiento. fetch está prohibido dentro de la prueba.

## B — Detalle TMDB

La primera ficha sigue conteniendo póster, título/año, datos principales, puntuación, hasta cuatro badges de géneros, dirección y sinopsis expandible. **EditorialDetails se monta después de esa ficha principal** y sigue siendo el componente editorial compartido.

La proyección complementaria omite el canónico si ya coincide con el título visible, la sinopsis si está en el control expandible, y la duración total de película si ya se muestra en los datos principales. Los cuatro géneros de los badges no se repiten; si hay más, aparecen como “Géneros narrativos adicionales” en el componente compartido. Se conservan campos complementarios, por ejemplo la fecha completa frente al año del encabezado, un canónico distinto del título localizado, o datos desconocidos/cero que no estén representados en la ficha principal. La duración por episodio de TV no se confunde con duración total.

El harness existente ejecuta la pantalla real con red/UI simuladas y SQLite de fixtures. Comprueba orden de componentes, presencia de póster/título, filas complementarias sin duplicados, fecha completa conservada y badges únicos. Con sinopsis larga comprueba Ver más → Ver menos → Ver más, el texto expandido una sola vez y seis géneros repartidos entre cuatro badges y dos adicionales. También verifica conservación de dirección, reparto, disponibilidad/links, guardado, política de tags e identidades, y que el recorrido no añada requests.

## Inventario exclusivo de esta corrección

Cambiados respecto del bundle S4 revisado (dos archivos productivos y un harness):

- `src/core/mediaViewProjection.ts` — normalización Unicode limitada a diacríticos de letras latinas.
- `app/tmdb/[type]/[id].tsx` — derivación complementaria y posición de EditorialDetails después de la ficha principal.
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs` — regresiones de orden, duplicados y controles preservados.

Nuevos:

- `docs/testing/enriched-media-metadata/section-4-correction-unicode.cjs` — prueba Unicode y búsqueda de aliases con SQLite real aislado.
- `docs/testing/enriched-media-metadata/section-4-correction-results.json` — salidas actuales, sin sobrescribir resultados anteriores.
- `docs/testing/enriched-media-metadata/section-4-corrections.md` — este registro.

Se comparó por SHA-256 el conjunto de archivos del bundle fuera de los tres archivos previstos (excluyendo solo los nuevos artefactos con prefijo section-4-correction): permaneció idéntico al inicio. No se alteraron preferencias, selección de fuentes, schema/backup, gates, dependencias, datos personales o el change anterior. No Git de escritura.

## Validación

- `node docs/testing/enriched-media-metadata/section-4-correction-unicode.cjs`: exit 0.
- `node docs/testing/provider-abstraction/section-5-detail-verification.cjs`: exit 0.
- Los 33 comandos de section-4-results.json más la nueva suite Unicode: **34/34 exit 0**, resultados completos en section-4-correction-results.json. Incluyen las regresiones S1–S4, imports históricos/v8, autoridad, imágenes/puntuaciones, preferencias y UI simulada.
- `npx tsc --noEmit`: exit 0.
- `openspec validate add-enriched-media-metadata-and-library-updates --strict`: exit 0.
- `git diff --check`: exit 0.

Las suites son deterministas; SQLite es real y la pantalla utiliza un harness de componentes/transportes simulados. El aviso experimental de node:sqlite no es fallo. **No se realizó aceptación visual Web ni Android de estas correcciones**. No hubo HTTP real en esta ejecución ni cambios en controles de red. El resultado funcional del harness no sustituye inspección de layout en dispositivos.

**4.4 pendiente** de revisión externa final, aceptación visual y checkpoint manual. No se inició S5 ni otra sección.
