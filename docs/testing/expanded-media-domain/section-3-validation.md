# Sección 3 — validación de UI local y browsing

Fecha: 2026-10-09. Change: `add-expanded-media-domain-and-second-provider-foundation`.
Alcance: exclusivamente 3.1–3.4. SQLite **v5**, backup actual **v6**, importadores **v1–v6** conservados, sin cambios de almacenamiento/validadores.

## Estado por tarea

| Tarea | Estado | Evidencia y límite |
| --- | --- | --- |
| 3.1 | Completada, checkbox marcado | Nueve predicados finitos; estado único entre chips y panel; composición texto/estado/clasificación; pins solo dentro del resultado; orden rating-desc TMDB, preferencia sin renombrar. Tests, tsc y revisión web pasan. Implementación compartida de controles web/nativos; sin nueva preferencia de filtro. |
| 3.2 | Completada, checkbox marcado | Biblioteca y etiqueta abierta en Detalle/Mosaico usan presenters compartidos, nombre accesible con clasificación/estado/rating una vez, descendientes decorativos ocultos también mediante aria-hidden en web. Estado visible en mosaico, placeholders, navegación por ID, badges/pins y collages conservados. Tests y revisión web pasan. |
| 3.3 | Completada, checkbox marcado | Editor según medio, clasificación y contexto de año, snapshot textual/géneros y portada con fallback local. Rating personal siempre disponible; bloque TMDB solo con rating finito o referencia aplicable. Cero/múltiples referencias sin API remota. Tests y revisión web de editores/persistencia pasan. |
| 3.4 | Código y verificación automatizada/web completos | Quedó completada tras revisión Web previa y validación manual en un dispositivo Android físico; iOS no se declaró validado desde el entorno Windows. |

1.x y 2.x siguen completos. Solo se marcaron 3.1–3.3; 3.4 y 4.1 en adelante siguen unchecked. Total **15/39**, 24 pendientes. No se debilitó la condición de revisión móvil para marcar 3.4.

## Predicados y estado

`LibraryClassificationFilter`, catálogo de opciones e `isLibraryClassificationFilter` viven en libraryView.ts. `matchesLibraryClassification` aplica un solo predicado activo y el selector filtra antes de agrupar/ordenar pins. No crea tipos exclusivos ni uniones que dupliquen una obra.

| Opción | Predicado |
| --- | --- |
| Todos | todos los items |
| Películas | audiovisual y primaryFormat=movie, independientemente de familia |
| Series | audiovisual y primaryFormat=tv |
| Anime | contentFamily=anime, cualquier formato |
| Manga / Manhwa / Manhua | familia correspondiente |
| Cómics | medium=comic, con/sin familia |
| Literatura | medium=literature |

La película anime aparece al seleccionar Películas y Anime por separado, una vez por resultado. Texto sigue buscando título y tags; status y clasificación se combinan por AND. Ningún pin fuerza la aparición de un item excluido. Pins mantienen prioridad y pinnedAt dentro de coincidencias. No se persiste el filtro de clasificación; recargar restaura Todos sin cambiar viewMode/sort guardados.

Tokens planned/watching/done/dropped intactos. Filtros globales usan En curso; tarjetas/filas/editor usan Viendo para audiovisual y Leyendo para comic/literature mediante titleStatusLabel.

## Orden de rating

`rating-desc` y el comparador existente se conservan. Visible: **Puntuación TMDB**. Solo voteAverage finito descendente; null/ausente/no-finito después, dentro de cada grupo contextual. Empates por título español e ID. Ningún fallback a personalRating ni score inventado. Orden personal asc/desc separado. Tests cubren diferencias personales irrelevantes, empates, ausencias, finite/nonfinite y prioridad de pins. Etiquetas conserva su orden contextual propio, no adopta una política nueva de rating externo.

## Presentación y detalle local

La composición accesible local se comparte en savedTitleAccessibility.ts. Las filas incluyen rating personal ahí; el mosaico lo añade una vez en TitleGridCard, junto al pin. Clasificación y estado se anuncian una vez en ambos. Los descendientes visuales/decorativos se ocultan al árbol accesible, conservando acciones separadas de filas. Search sigue recibiendo kindLabel normalizado; no interpreta taxonomía local ni recibe categorías.

Ejemplos verificados: Película; Anime · Película; Anime · OVA; Manga; Manhwa · Webtoon; Cómic; Novela; Novela ligera. Null no inventa familia/origen. Mosaico incluye el estado personal visible. PosterPlaceholder mantiene su presentación y ahora se oculta explícitamente al árbol web. Portada local usa URL persistida y cae a placeholder ante ausencia/error; no promete cache offline de imágenes.

El detalle por ID muestra clasificación, `Estreno / inicio` o `Inicio / publicación`, año nullable (`Sin fecha`), resumen/géneros existentes y todos los editores personales. No consulta metadatos de proveedor. No hay campos de fecha nuevos. Tu puntuación permanece independiente y siempre visible; TMDB se muestra solo con voteAverage finito o vínculo TMDB singular reconocido. Un item no-TMDB sin rating/referencia no recibe un bloque falso TMDB. Varias referencias no seleccionan una fuente arbitraria.

## Compatibilidad TMDB

Producción conserva findUnambiguousTmdbReference y las rutas /tmdb/movie/[id], /tmdb/tv/[id]. El helper requiere medio audiovisual, referencia canónica y un único match reconocido; no exige formato igual al namespace. No se cambió el archivo remoto TMDB ni el mapper/transport para introducir llamadas extras.

- Hook-host del detalle local real: anime/OVA + tmdb/movie/123 → /tmdb/movie/123, OVA intacta.
- Hook-host: anime/null + tmdb/movie/123 válido y con vínculo movie.
- Screen host remoto real + SQLite v5: re-save de anime/OVA movie/123 conserva familia, OVA, ID, createdAt, status, notes, tags, rating personal y referencias.
- Screen host remoto: anime/null movie/124 es válido; refresh movie refina el formato desconocido a movie sin borrar anime. Esto es refinamiento aprobado, no igualdad permanente de namespace.
- Regresión movie/TV normal, runtime/seasons, créditos/reparto/director, imágenes, disponibilidad, credenciales y errores intactos. APIs simuladas en tests: ninguna llamada real a candidatos.
- Web: OVA del archivo TEST movie/88 enlaza /tmdb/movie/88; null-format movie/124 enlaza /tmdb/movie/124; TV enlaza /tmdb/tv/77. Se observó el estado existente de credencial no configurada sin configurar token ni pedir metadata. Re-save con red real no se hizo en web; el guardado se ejecutó en screen host con SQLite real y API simulada.

## Automatización: comandos exactos y resultados finales

| Comando | Exit code |
| --- | --- |
| `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-1-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | 0 |
| `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-11-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-1-badge-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-4-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-5-verification.cjs` | 0 |
| `node docs/testing/personal-title-rating/section-6-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-5-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-6-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-8-verification.cjs` | 0 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-expanded-media-domain-and-second-provider-foundation --strict` | 0 |

**21 suites pasan**, más tsc y validación estricta. Las dos suites antiguas que fallaron inicialmente se corrigieron sin debilitar sus comportamientos: personal-title-rating/5 sigue comprobando el presenter personal, ahora a través de la composición compartida; personal-title-rating/6 conserva carreras/edición y usa campos actuales v5 en su base de prueba. Los dos call sites de pruebas del selector usan classificationFilter; no se alteraron validadores históricos.

section-3-verification prueba predicados/solapamiento/no duplicación, búsqueda por título/tags + estado, vacíos, exclusión/prioridad de pins y rating TMDB determinista sin fallback. section-3-ui-verification ejecuta componentes locales y grid reales en un host de hooks sin nueva dependencia: labels/editor/status token, año, metadata local, cero/múltiples referencias, bloque rating, links OVA/null/ambiguos, fallback de imagen y anuncios únicos de grid/list vía presenter compartido. El host no sustituye un renderer nativo ni un lector de pantalla físico.

La regresión incluye Secciones 1/2, identidad universal, mapping/materialización/Búsqueda/detalle TMDB, rating personal y themes/browsing/tag contracts. Algunas suites conservan nombres históricos v4/v5 aunque validan la evolución vigente; no se avanzó ninguna versión en esta sección.

## Revisión web realmente realizada

Servidor: `$env:EXPO_OFFLINE='1'; npx expo start --web --localhost --port 8098`, dependencias existentes. Arrancó y sirvió la aplicación; se detuvo voluntariamente mediante Ctrl+C (exit 1 de terminación, no fallo de validación). Pestaña temporal cerrada y override de viewport restablecido.

Origen de prueba http://localhost:8098, distinto de los usados previamente. Archivo TEST-section3-web-backup-v6.json con trece obras originales/sintéticas importadas por Ajustes normal: **13 insertadas, 4 pins insertados, 0 conflictos/invalidaciones/fallos**. No se implementó ningún harness, ruta dev, DB de review, adapter ficticio ni referencia fixture-review. Los ProviderReferences genéricos del archivo son datos de prueba, no una fuente de runtime.

Observado en UI/DOM/accesibilidad y capturas:

- Biblioteca Detalle y Mosaico; Películas=2 y Anime=4, incluida la misma película anime sin duplicación ni pins no coincidentes.
- Manga=3, Manhwa=1, Manhua=1, Cómics=6, Literatura=2; labels Viendo/Leyendo y filtro global En curso.
- Literatura + texto light-novel + En curso → 1; Planeados → 0, estado vacío. Panel y chips comparten selección. Recargar restablece filtro Todos sin persistencia nueva.
- Selección Puntuación TMDB, orden de pins visible y ausencia de rating externo fabricado para la película anime con rating personal 10.0. Casos finitos/ausentes/empates/no fallback comprobados automáticamente.
- Etiquetas en lista y mosaico/collage, conteo 13; etiqueta abierta en ambas apariencias de Biblioteca. Manhwa fijado en etiqueta aparece primero, sin depender de los pins de Biblioteca. Navegación local preservada.
- DOM antes/después de ocultar descendientes: nombre de botón con clasificación/estado/rating una vez; aria-hidden aplicado a contenidos decorativos. No hubo revisión TalkBack/VoiceOver real.
- Manga sin referencias/año/resumen: Manga, Inicio/publicación: Sin fecha, sin TMDB, placeholder y editores disponibles; cambio Planeado→Leyendo y reload persistieron.
- OVA multirreferenciada: Anime · OVA, Estreno/inicio: 2026, Viendo; enlace movie/88; null-format y TV usan sus rutas externas correctas.
- Novela ligera: Leyendo, Inicio/publicación: 2026, sin TMDB. Nota guardada y reabierta; rating 8.0→8.1→8.0; tag TEST edit agregado/quitarlo; pin de Biblioteca activado/desactivado, manteniendo otros datos personales.
- Web a **390 px**: panel con los nueve filtros y Puntuación TMDB; selección Literatura → dos resultados. Esto es web estrecha, **no** verificación Android/iOS.
- Buscar conserva campo película/serie y consulta TMDB, sin controles Anime/Manga ni proveedor nuevo; no se inició búsqueda de red.

Capturas: section-3-library-grid-web.jpg, section-3-tags-grid-web.jpg, section-3-local-reading-web.jpg, section-3-narrow-web.jpg.

Advertencias reales: SQLite experimental de Node; Metro NO_COLOR/FORCE_COLOR; validación de dependencias omitida por modo offline. El selector de archivo tardó varios minutos en devolver el control; se verificó su resultado completado, no solo la acción. Un Guardar y volver desde URL local abierta directamente produjo el aviso de desarrollo GO_BACK sin historial; la nota se persistió y se comprobó al reabrir. El handler de navegación existente no se modificó en este alcance. No se actualizaron dependencias para eliminar warnings.

## Móvil físico pendiente — criterio que mantiene 3.4 unchecked

Se comprobó el entorno Windows. Android SDK y Android Studio están instalados en la ruta real de C:/Users/elias, aunque las variables del sandbox inicialmente apuntaban a otro directorio. `C:\\Users\\elias\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe devices -l` terminó exit 0 y mostró **ningún dispositivo**. `emulator.exe -list-avds`, con ANDROID_AVD_HOME dirigido al directorio real, terminó exit 0 sin AVDs. No hay runtime real conectado/configurado disponible; no se creó ni descargó un AVD ni se instaló software. El daemon adb iniciado por esta comprobación se detuvo. iOS no está disponible en este host Windows.

Checklist para terminar la revisión manual de 3.4 en una instalación de prueba controlada por el revisor, sin contaminar datos personales:

1. Arrancar Android/iOS real con los scripts actuales, sin editar package.json; preparar las obras sintéticas en una instalación/base de prueba del revisor mediante el importador existente, sin harness nuevo.
2. Revisar Biblioteca Detalle/Mosaico y panel nativo: los nueve filtros, solapamiento Anime/Películas, búsqueda+estado, vacíos y pins ocultos fuera de coincidencias; En curso global. Confirmar rating-desc TMDB y órdenes personales separados.
3. Revisar Etiquetas/lista/collages y etiqueta abierta en ambas vistas, pin contextual y tap por ID; comprobar placeholders y lector TalkBack/VoiceOver sin anuncios repetidos de clasificación/estado/rating.
4. Revisar manga/cómic/literatura Leyendo y audiovisual Viendo, año/publicación y null, cero/múltiples referencias; editar notas/tags/estado/pins/rating personal y reabrir. Probar detalle local sin red y fallback de portada.
5. Verificar OVA + movie/123 y null-format + movie/124, TV normal, ruta TMDB por namespace y estado de credenciales. Con el contexto TMDB de prueba autorizado del revisor, confirmar re-save genérico que conserva anime/OVA y datos personales, y comportamiento movie/TV/créditos/disponibilidad existente.
6. Registrar dispositivo/runtime, pasos y resultado. Solo entonces marcar 3.4 si todos pasan. Una revisión de navegador estrecho no sustituye este punto.

## Archivos creados

- `src/components/browsing/savedTitleAccessibility.ts`
- `docs/testing/expanded-media-domain/section-3-library-grid-web.jpg`
- `docs/testing/expanded-media-domain/section-3-local-reading-web.jpg`
- `docs/testing/expanded-media-domain/section-3-narrow-web.jpg`
- `docs/testing/expanded-media-domain/section-3-tags-grid-web.jpg`
- `docs/testing/expanded-media-domain/section-3-ui-verification.cjs`
- `docs/testing/expanded-media-domain/section-3-verification.cjs`
- `docs/testing/expanded-media-domain/TEST-section3-web-backup-v6.json`
- `docs/testing/expanded-media-domain/section-3-validation.md`

## Archivos modificados

- `src/components/browsing/index.ts`
- `src/components/browsing/PosterPlaceholder.tsx`
- `src/components/browsing/TitleGridCard.tsx`
- `src/core/libraryView.ts`
- `app/(tabs)/etiquetas.tsx`
- `app/(tabs)/libreria.tsx`
- `app/title/[id].tsx`
- `docs/testing/personal-title-rating/section-4-verification.cjs`
- `docs/testing/personal-title-rating/section-5-verification.cjs`
- `docs/testing/personal-title-rating/section-6-verification.cjs`
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs`
- `docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs`
- `openspec/changes/add-expanded-media-domain-and-second-provider-foundation/tasks.md`

## Límites y archivos protegidos

Sin Sección 4+ implementada: no Search por categorías/fuentes, ningún harness, API/adaptador/eligibilidad nueva, registry, rutas/detalles remotos universales, progreso, relaciones, recomendaciones, matching/linking/fusión/prioridad o almacenamiento de ratings por fuente.

SQLite queda **v5**, backup **v6**, imports **v1–v6**. Hashes de schema, almacenamiento, backup/validadores, mappers/transporte TMDB y Search sin cambios respecto al inicio. `rating-desc` sigue usando voteAverage; personalRating conserva 10..100|null.

package.json antes/después: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`. Scripts `android: expo run:android` e `ios: expo run:ios` intactos. No dependencias añadidas. No Git, commit/push/staging/reset/stash/checkout/cambio de rama. Se trabajó en el checkout existente indicado por el usuario; no se ejecutó Git para comprobar/cambiar su rama.

