# S7 — Contenido sensible y preferencias

Fecha: 2026-11-16. Alcance exclusivo 7.1–7.3. 7.4 pendiente de revisión externa, aceptación visual y checkpoint manual; S8 no iniciada.

## Checkpoint y alcance

Rama `feat/anime-catalog-manual-entries`; HEAD inicial `6ddd893d1e809ec9c6378b37953d25d63743247b`, commit `feat: add library updates feed and activity history`. Staging, worktree y archivos no registrados inicialmente vacíos. Se comprobó en HEAD la corrección del reloj de retención en ambos escritores. 6.6 se cerró administrativamente por checkpoint/revisión externa y siete comprobaciones visuales Web informadas por el usuario; Android no comprobado. No hubo Git de escritura.

## Semántica y evidencia primaria

Solo se utiliza el booleano explícito `nsfw` de Kitsu anime, normalizado por S1 como `fields.sensitive`. `true`, `false` y desconocido permanecen distintos. El selector exige referencia concordante y respeta el documento activo de D3.1. Documentos inactivos, ambigüedad, manuales e históricos sin señal no hacen sensible una obra. Edad, guía, advertencias, géneros y texto nunca se convierten en una señal.

Fuentes técnicas primarias consultadas por HTTP, no respuestas reales del catálogo:

- [AnimeResource de Kitsu](https://raw.githubusercontent.com/hummingbird-me/kitsu-server/master/app/resources/anime_resource.rb): expone `nsfw` delegando a `nsfw?`.
- [AgeRatings de Kitsu](https://raw.githubusercontent.com/hummingbird-me/kitsu-server/master/app/models/concerns/age_ratings.rb): implementación particular del flag; no representa todas las formas de contenido adulto. La aplicación no reproduce esa inferencia usando edad: necesita el flag recibido.

Se agregó `nsfw` al fieldset enriquecido de la consulta existente y se declararon los campos ya soportados en refresh. Sin endpoints, consultas adicionales ni cambios de gates. Las pruebas usan fixtures sintéticos; no se verificaron payloads reales de búsqueda/detalle en esta sección.

## Presentación y persistencia

Preferencia inicialmente desactivada, guardada mediante transacción serializada que actualiza únicamente `hideSensitive` y su reloj de preferencia. Conserva idiomas, auto-refresh y el merge existente de backup v8. No cambia SQLite v7 ni contratos portables.

Selectores compartidos filtran Biblioteca (detalle/grid), Etiquetas (grupos, collages, conteos y colecciones) y búsqueda remota existente. No existe otra pantalla independiente de descubrimiento en este árbol. La búsqueda filtra la respuesta disponible sin consultas de relleno ni promesas de cobertura/paginación total. No añade peticiones por tarjeta. Desconocidos siguen visibles. El aviso de cobertura aclara que no garantiza aptitud para menores.

Las preferencias se hidratan antes de mostrar contenido. Una lectura fallida mantiene el aviso con reintento. Los observadores existentes actualizan las superficies sin escribir títulos/documentos. La ficha guardada bloqueada monta solo un aviso genérico, sin póster/banner/URI ni panel automático. Permite revelar y volver; un enlace sin historial regresa a Biblioteca. La autorización local se invalida por identidad, salida, reloj de preferencia, selección o cambio semántico del documento activo. No elimina borradores personales. Ocultar/revelar no cuenta como una apertura automática adicional.

El alcance de exportación y el coordinador global siguen usando la biblioteca completa. La prueba SQLite exporta/restaura cinco obras aunque solo cuatro sean visibles y ejecuta el coordinador real con capacidad simulada incluyendo la obra oculta. No se crean eventos por activar/desactivar/revelar.

## Validación reproducible

Desde la raíz:

```text
node docs/testing/enriched-media-metadata/section-7-contracts.cjs
node docs/testing/enriched-media-metadata/section-7-preferences.cjs
node docs/testing/enriched-media-metadata/section-7-ui.cjs
node docs/testing/enriched-media-metadata/section-7-regressions.cjs
node docs/testing/enriched-media-metadata/section-7-fixture-diagnostics.cjs
npx tsc --noEmit
openspec validate add-enriched-media-metadata-and-library-updates --strict
git diff --check
```

Las tres suites nuevas pasan: contratos puros, SQLite real aislado y componentes reales ejecutados mediante un host de hooks simulado. Incluyen marcas inválidas/null/omitidas, R sin señal, autoridad por fuente, reversibilidad, no-op/rollback de preferencia inválida, clocks/merge de importación, datos personales/pins/timestamps intactos, alcance completo de export/global, pendientes y fallos de hidratación, reintento, acceso directo, retorno sin historial, identidad/fuente/metadata/preferencia, borrador de notas, limpieza de listeners y ausencia de HTTP adicional. Se verifican tokens de temas claro/oscuro y roles/botones accesibles mediante árboles sintéticos; no equivalen a una aceptación visual o de lector de pantalla.

`section-7-results.json`: **53/58 comandos originales pasan**, con resultados y errores completos conservados. Las cinco excepciones se distinguen:

1. Escáner histórico TMDB: detecta el nombre de una variable en el log Metro ya committeado en `section-5-checks.json`. No se cambió el escáner, el change anterior ni la evidencia. Este hallazgo de nombre no demuestra por sí mismo exposición de un valor secreto; no se identificó una consecuencia de seguridad nueva de S7.
2. `section-2-storage.cjs`: espera un evento de epoch 100 después de que la retención corregida S6 lo expire. Se reprodujo el mismo fallo cargando fuentes de HEAD mediante `git show`, sin checkout ni escritura Git. Con reloj explícito 1000 la suite original pasa.
3. Tres suites antiguas de UI (`expanded-media-domain/section-3-ui`, `expanded-media-domain/section-4`, `mangaupdates-cover-images/section-2`): no preparan el repositorio de preferencias; ahora quedan correctamente pendientes/fallidas hasta conocer la política. Pasan con un preload explícito de preferencia desactivada/lista. Las suites originales no se modificaron; la hidratación real del hook se comprueba aparte en S7 UI.

`section-7-fixture-results.json` conserva la reproducción esperada del fallo baseline y los cuatro pases con adaptaciones explícitas. Estos pases no reemplazan ni ocultan los cinco errores originales. No se declara la matriz completa verde.

TypeScript, OpenSpec estricto y diff whitespace pasan. Expo Web exportó 993 módulos a `.expo/s7-web-validation-20261116` con código 0 (compilación; no aceptación visual). Advertencias no bloqueantes de Browserslist antiguo y variables de color del terminal; no se actualizaron dependencias. No se realizaron smoke visual S7 Web, Android ni pruebas de renderer nativo/lector de pantalla. No se atribuye a S7 la aceptación visual previa de S6.

## Entrega

Inventario exacto en `section-7-inventory.json`. 7.1–7.3 completas dentro de los límites automatizados descritos. 7.4 pendiente; sin checkpoint Git, S8, nuevos servicios de moderación, matching ni control parental.
