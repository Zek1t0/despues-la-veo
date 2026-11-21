# S2 — Interfaz de progreso personal

Fecha: 2026-11-20 (zona del usuario). **Checkpoint de desarrollo: backup de progreso pendiente de S3. No distribuible.**

## Preflight

- Rama inicial/final: `feat/personal-episodic-progress-foundation`.
- HEAD inicial/final: `62e6c0f9501fcd04b5e90ca33ee9d5445e65431a`, `feat: add personal episodic progress storage foundation`.
- Árbol e índice inicialmente limpios. `git ls-remote --heads origin feat/personal-episodic-progress-foundation` confirmó el mismo SHA publicado, tras reintentar solo lectura fuera del aislamiento de red. Sin fetch ni escritura Git.
- Se leyeron instrucciones apply, proposal, design, tasks, los tres deltas y APIs/consumidores reales de S1. SQLite vigente v9; backup sigue v9 y no incluye progreso.
- OpenSpec: spec-driven, ready, 8/29 marcas iniciales. El usuario informó revisión/checkpoint S1 aprobados; 1.9 estaba aún sin marcar en el archivo y no se modificó su marca dentro de S2.
- Sin cambios ajenos encontrados; no se abrió la base personal ni se ejecutaron migraciones sobre ella. La revisión Web se ejecutó exclusivamente con EXPO_PUBLIC_MEDIA_REVIEW=1, seleccionando ReviewRoot antes de montar persistencia, credenciales o rutas productivas.

## Implementación y tareas

Implementadas y verificadas 2.1–2.5. **2.6 pendiente de revisión externa y aceptación manual completa. S3/S4 sin iniciar.**

- Presentación común para posición completa, texto compacto, esquema, borrador y escala acreditada. Usa el parser/normalizador de S1; no reimplementa rangos de persistencia ni sucesión editorial.
- «Mi progreso» aparece después de Estado y antes del resto de organización/editorial. Posición con type.heading, esquema con type.caption, acción primaria, Editar y Restablecer. Reutiliza OrganizationButton/Input, tokens de tema y espaciado; no nueva pestaña ni panel siempre abierto.
- Episodio continuo: «Episodio 245» / «Ep. 245». Temporada: «Temporada 3 · Episodio 7» / «T3 · E07». Capítulo: «Capítulo 128.5» / «Cap. 128.5». Especial: texto Unicode con etiqueta completa.
- +1 solo en episodios numéricos debajo del máximo; anuncia destino, mantiene temporada y envía destino absoluto con versión esperada. Una ref bloquea doble envío antes del rerender. La UI actualiza solo desde resultado confirmado; el repositorio sigue sin tocar estado/rating/reloj del título.
- Editor expandible con elección explícita, validación comprensible, límites, coma/punto decimal. Cambio de modo solicita confirmación antes de vaciar campos; no convierte posiciones. Cancelar y Escape piden descartar o seguir editando. Reset requiere confirmación independiente y mantiene el estado personal.
- Borradores en memoria durante esta sesión conservan posición base y clasificación; al salir/volver se recuperan sin persistirse en SQLite/backup. Al guardar o descartar se eliminan. Web solicita confirmación de cierre con borrador; Android intercepta hardwareBack mientras está abierto (sin aceptación física todavía). No se promete conservar borradores tras cierre de proceso.
- Una invalidación o lectura concurrente conserva campos editados, identifica base obsoleta y exige actualizar/revisar antes de guardar. Fallos de escritura conservan borrador; lectura fallida mantiene último confirmado y bloquea edición. Incompatibilidad conserva posición sin convertirla ni ofrecer +1.
- Biblioteca: snapshot progressById alimenta línea de Detalle y pie discreto de Mosaico fuera del arte. Colección abierta reutiliza el mismo resumen y mapa; índice de Colecciones e Inbox sin cambios. Etiquetas accesibles del contenedor incluyen posición completa aunque el resumen visual se trunque.
- No cambian filtros, búsqueda, pins, orden updated-desc, clasificación ni membresías. No nuevas llamadas a proveedores. La dependencia de escritura del detalle se carga solo al guardar; los bindings TEST no pueden caer en persistencia personal.
- Escala visual decorativa solo con acreditación explícita de mismo título/referencia activa/numeración continua/total entero positivo. Texto «Posición X de Y», sin porcentaje ni unidades consumidas; las fuentes actuales no aportan esta evidencia y no muestran barra. Fuera de rango o esquema distinto tampoco se muestra.

## Pruebas y evidencia

| Comprobación | Resultado |
| --- | --- |
| `node docs/testing/personal-episodic-progress/s2-ui.cjs` | PASS: diez grupos, hook-host y SQLite TEST real; cero solicitudes de red |
| `node docs/testing/personal-episodic-progress/s2-regressions.cjs` | PASS del runner: doce recorridos con exit 0, dos fallos heredados clasificados con exit 1 esperado |
| `npx tsc --noEmit` | PASS |
| `npx expo export --platform web --output-dir dist/s2-web` | PASS, artefactos locales ignorados, sin publicación |
| `openspec validate add-personal-episodic-progress-foundation --strict` | PASS |
| `git diff --check` + `git diff --no-index --check -- /dev/null <nuevo>` | Sin diagnósticos de whitespace en archivos de texto nuevos/modificados; los JPEG se verifican como binarios |

El runner incluye S1 storage completo con evidencia redirigida a s2-storage-results.json para no modificar la evidencia S1 publicada. s2-results.json contiene la última ejecución de los diez grupos focalizados; s2-regression-results.json conserva salida y exit codes de regresiones.

Matriz focalizada: render por cuatro variantes; nunca registrado/reset; incremento y límite; doble pulsación pendiente; escritura fallida y retry; versión/interpretación obsoleta; cambio de variante confirmado/cancelado; incompatibilidad; decimal canónico y Unicode; ausencia de controles en película ordinaria; escala inválida/ambigua/sin total/fuera de rango; independencia exacta de estado/rating/notas/tags/updatedAt; recuperación de borrador y Escape en captura. Los árboles reales de TitleGridCard y CollectionScreen reciben el mismo progreso compartido y se prueban con 320/1280 px y fontScale 1/2. Son pruebas de composición, no medición visual física al 200 %.

Regresiones: ficha/Biblioteca/Colecciones existentes, UI responsive de Inbox/organización, identidad manual/proveedores, búsquedas/carreras, persistencia de Colecciones/Inbox, compatibilidad histórica de backups, picker y metadata. Todas las bases son TEST aisladas; initDb personal y fetch están bloqueados en la suite focalizada.

Dos fallos heredados quedan explícitos, sin eliminar aserciones ni cambiar producto para satisfacerlos:

1. Metadata storage con reloj real: el evento de 100 ms se poda por retención, `0 !== 1`. El mismo recorrido pasa con Date.now=1000 exclusivamente en el proceso TEST. Reproducido y clasificado en S1; no cambia política de actividad.
2. Test estático antiguo de rating espera nombres/layout anteriores (`personalRatingPresentation?.accessibilityLabel`). Se reproduce leyendo TitleGridCard de HEAD mediante git show, sin checkout. No se modifica esa prueba ni la UI de rating para hacerla pasar. Las pruebas actuales verifican la preservación de rating en SQLite y el contenedor accesible único de la tarjeta.

Durante desarrollo se adaptaron los mocks nuevos para safe-area-context y se mantuvo la carga de almacenamiento fuera de los componentes de presentación. No se relajaron las protecciones que prohíben DB personal/red. Se corrigió Escape con listener en captura porque react-native-web TextInput detiene keydown en burbujeo; verificado en navegador.

Advertencias del tooling: Browserslist con datos antiguos, ExperimentalWarning de node:sqlite y sugerencias de compatibilidad Expo ya instaladas. No se cambiaron dependencias/versiones.

## Revisión Web efectivamente realizada

Servidor local con modo de revisión, bases `media-review-primary.db` y `media-review-restore.db`, corpus/títulos TEST; nunca la base personal. Servidores de prueba detenidos al terminar. El primer servidor dentro del sandbox no era accesible al navegador; se usó localhost autorizado fuera de ese aislamiento. Se reinició Metro CI para tomar cambios y se recargó el navegador.

- Escritorio oscuro: alta manual TEST, progreso T3/E07, sumar→T3/E08, sin cambio de Planeado ni rating. Posición protagonista y controles compactos visibles.
- 320 px oscuro: inputs de temporada/episodio y selección de modo sin overflow horizontal, scroll disponible.
- 320 px claro: formulario, límites, Guardar/Cancelar y foco de input; etiquetas accesibles completas.
- Tras recargar y volver a Biblioteca: T3/E07 persistido en la segunda sesión TEST. Detalle anuncia posición completa; Mosaico muestra T3 · E07 fuera de la portada. El cambio de tema solo modifica la persistencia TEST en memoria.
- Escape desde un TextInput abre «¿Descartar este borrador?» y enfoca «Seguir editando»; descartar deja la posición guardada intacta. El viewport temporal se restableció al finalizar.

Capturas:

- s2-web-desktop.jpg — Estado independiente y sección final oscura.
- s2-web-320-editor.jpg — Editor oscuro estrecho.
- s2-web-320-light.jpg — Inputs/acciones en claro a 320 px.
- s2-web-320-mosaic.jpg — Pie compacto fuera del arte.

No se realizó aceptación en Android físico/emulador, lector de pantalla físico ni medición visual de fuente al 200 %. Los harnesses sí ejercitan dimensiones y fontScale 2. La vista de Colecciones tiene prueba de composición real y regresión; no se navegó a Colecciones productivas para evitar la DB personal. Estas aceptaciones siguen en 2.6, sin marcar.

## Recorrido manual pendiente/repetible

Web: iniciar únicamente con EXPO_PUBLIC_MEDIA_REVIEW=1; crear manual TEST audiovisual/Serie o comic; abrir ficha, elegir numeración, registrar; editar atrás; sumar episodio; confirmar/cancelar cambio de modo y reset; probar Escape; volver a Biblioteca y alternar Detalle/Mosaico; recargar y verificar posición; alternar temas TEST. No usar export v7/v9 de revisión como respaldo de progreso.

Android: usar instalación de desarrollo con el mismo modo TEST, sin abrir biblioteca personal; repetir cuatro variantes, teclado numérico/decimal, doble tap, hardwareBack, reset y reapertura; probar TalkBack, fuente 200 % y ancho reducido. Para Colecciones, usar exclusivamente datos TEST/instalación aislada. Registrar evidencia antes de cerrar 2.6.

## Inventario completo S2

Modificados:

- app/title/[id].tsx
- app/(tabs)/libreria.tsx
- app/organize/collections/[id].tsx
- src/components/browsing/TitleGridCard.tsx
- src/dev/mediaReview/session.ts
- src/dev/mediaReview/MediaReview.tsx
- openspec/changes/add-personal-episodic-progress-foundation/tasks.md (solo marcas 2.1–2.5)

Nuevos:

- src/core/personalProgressPresentation.ts
- src/components/progress/PersonalProgressSection.tsx
- src/components/progress/PersonalProgressSummary.tsx
- docs/testing/personal-episodic-progress/s2-ui.cjs
- docs/testing/personal-episodic-progress/s2-regressions.cjs
- docs/testing/personal-episodic-progress/s2-results.json
- docs/testing/personal-episodic-progress/s2-regression-results.json
- docs/testing/personal-episodic-progress/s2-storage-results.json
- docs/testing/personal-episodic-progress/s2-validation.md
- docs/testing/personal-episodic-progress/s2-web-desktop.jpg
- docs/testing/personal-episodic-progress/s2-web-320-editor.jpg
- docs/testing/personal-episodic-progress/s2-web-320-light.jpg
- docs/testing/personal-episodic-progress/s2-web-320-mosaic.jpg

Estado final: siete archivos rastreados modificados y trece nuevos, todos unstaged/untracked; índice vacío y HEAD sin cambios. Sin staging, commit, push, merge, sync o archive. Sin cambios en migración, repositorio S1, gates, proveedores, dependencias, backup o restauración.

## Riesgos/pendientes

S2 sigue sin portabilidad de progreso: backup v10/restauración pertenecen a S3. No distribuir hasta completar S3/S4. Borradores son solo memoria de sesión; una confirmación de cierre descarta esa memoria. Los informes de pruebas no equivalen a aceptación Android o revisión externa. No se infieren consumo, historia, porcentajes, temporadas editoriales o unidades vistas desde una posición manual.

## Pulido visual y diagnóstico de Buscar — 2026-11-21

Esta sección actualiza la evidencia anterior; conserva sus capturas y sus excepciones de aceptación. Preflight: rama feat/personal-episodic-progress-foundation, HEAD 62e6c0f9501fcd04b5e90ca33ee9d5445e65431a, veinte archivos S2 acumulados sin staging e índice vacío. Se preservó ese trabajo conforme a la instrucción del usuario. No se exigió árbol limpio ni se ejecutó Git de escritura.

### Presentación revisada

- Encabezado pequeño; posición en primer plano; tipo de numeración secundario. Editar permanece secundario también en capítulos y especiales. Sumar episodio conserva el papel principal para las variantes que admiten +1.
- Restablecer pasa al encabezado como acción contextual discreta y mantiene confirmación explícita. OrganizationButton añade la variante link, conservando objetivo táctil de 44 px, etiqueta y foco visible; sus variantes anteriores no cambian.
- Selector de numeración con nombres visuales cortos y etiquetas accesibles completas. Solo aparecen campos de la variante elegida. Temporada/episodio comparten fila cuando caben y pueden envolver según espacio y fontScale.
- Confirmación de cambio de numeración delimitada y compacta, con acciones en fila y wrap. No convierte datos; conservar numeración mantiene campos; cancelar sigue protegiendo el borrador. Ayuda extensa queda tras Límites y ayuda; los errores de parser la expanden.
- Editor cerrado salvo borrador recuperado; se mantienen bloqueo inmediato de doble envío, comparación de versiones, errores recuperables y resultado confirmado antes de actualizar. No se alteran dominio, persistencia, estados personales ni rating.
- Resúmenes de Biblioteca/Colecciones preservados y cubiertos por sus árboles reales y regresiones. Sin nuevos indicadores sobre portadas ni porcentajes. La sección mantiene una composición simple que permite incorporar contenido granular después, sin controles o estructuras futuras ahora.

### Manga manual y formatos

La ruta productiva Biblioteca → Agregar manualmente abre /manual-entry; el guardado utiliza saveManualContent y su decisión atómica existente. Se comprobó esa conexión por inspección y assertions. En navegador se utilizó el botón equivalente Agregar manual TEST, el formulario real, repositorio SQLite TEST y ficha real mediante bindings aislados: Cómic → Manga → formato sin especificar → guardar → Activar seguimiento manual → Capítulos → 128,500 → Guardar progreso. Resultado visible: Capítulo 128.5, Planeado conservado y editor cerrado. La activación explícita corresponde a la clasificación sin formato y no cambia elegibilidad.

El harness agrega creación real y lectura SQLite para manga, manhwa y manhua, con capítulo textual canónico 128.5 y estado planned intacto. Series mantienen temporada/episodio sin saltar de temporada; anime admite episodio continuo. Películas ordinarias permanecen sin controles; incompatibilidades conservan la posición sin reinterpretarla.

Revisión visual adicional: 320 px oscuro con manga guardado; escritorio oscuro con confirmación horizontal de cambio de numeración y conservación/cancelación de borrador. Capturas nuevas:

- s2-polish-manga-320.jpg
- s2-polish-editor-desktop.jpg

Se usaron únicamente media-review-primary.db y media-review-restore.db, nunca la biblioteca personal. Viewport restablecido y servidor local detenido al terminar. Las capturas muestran el encabezado del entorno TEST, que no forma parte del producto.

### Buscar: hechos del repositorio y del historial

searchCategories.ts define Películas/TMDB movie, Series/TMDB tv, Anime/Kitsu anime y Manga/Manhwa/Manhua/MangaUpdates series. No define catálogo remoto genérico de Cómics o Literatura. Los filtros de Biblioteca en libraryView.ts operan sobre clasificación local, incluidos títulos manuales; su presencia no acredita un catálogo remoto.

Matriz comprobada por ejecución sin red:

| Entorno | Categorías de Buscar |
| --- | --- |
| Web desarrollo | Películas, Series, Anime |
| Web producción | Películas, Series |
| Android desarrollo | Películas, Series, Anime, Manga, Manhwa, Manhua |
| Android producción | Películas, Series, Manga, Manhwa, Manhua |
| iOS desarrollo/producción | Películas, Series |

TMDB necesita credencial configurada para solicitar resultados, aunque sus categorías estén visibles. Kitsu availability.enabled exige __DEV__ y Web/Android; productionEnabled sigue false. MangaUpdates productionEnabled exige Android validado; Web permanece browser-cors-blocked e iOS native-validation-pending. El wrapper de búsqueda MangaUpdates también comprueba disponibilidad antes de construir el adaptador.

Historia de solo lectura: a96f3c7 introdujo categorías finitas; 19f21bc la fundación MangaUpdates; 096c16d integró su vertical respetando disponibilidad por plataforma. da5520b añadió Anime/Kitsu sin retirar Manga/Manhwa/Manhua. 1c14377 habilitó la categoría Kitsu en desarrollo mediante enabled, sin cambiar el gate MangaUpdates. Por ello, las tres categorías observadas en Web son coherentes con los gates actuales; no se encontró una regresión de eliminación de categorías durante Kitsu. second-provider-discovery exige ocultar categorías sin transporte habilitado.

Recomendación para un change independiente mínimo: una superficie de disponibilidad de catálogos por plataforma con acceso a la entrada manual existente. Requeriría revisar la regla que hoy oculta categorías no disponibles; podría explicar Manga/Manhwa/Manhua sin ejecutar búsqueda remota Web. Una búsqueda MangaUpdates Web real necesita resolver y validar un transporte permitido y viable frente a CORS; no basta activar una opción. Cómics genéricos/Literatura no tienen adaptador actual y requieren una decisión de catálogo separada. La habilitación productiva de Kitsu también conserva su propio proceso de validación. Nada de esto se implementa en S2.

### Validación de esta revisión

- s2-ui.cjs: PASS, doce grupos, incluidos creación manual manga/manhwa/manhua y matriz de categorías; cero solicitudes de red. Se adaptó el localizador de botones a label o accessibilityLabel para preservar nombres accesibles completos con etiquetas visuales breves. No se retiraron assertions.
- s2-regressions.cjs: PASS del runner; doce recorridos exitosos y dos fallos históricos esperados, reproducidos y clasificados como describe la evidencia anterior. No se modificaron expectativas heredadas para ocultarlos. Incluye storage S1, decisiones manuales, snapshots, Colecciones/Inbox, backups históricos y carreras de búsqueda.
- npx tsc --noEmit: PASS.
- npx expo export --platform web --output-dir dist/s2-web: PASS; salida local ignorada, sin publicación.
- openspec validate add-personal-episodic-progress-foundation --strict: PASS.
- git diff --check y comprobación de cada texto nuevo contra /dev/null: sin errores de whitespace.

No se repite ni se afirma aceptación física Android, lector de pantalla o medición visual real al 200 %. La composición de resúmenes se prueba a 320/1280 y fontScale 1/2; las capturas nuevas son Web oscuro a escala normal. Se conservan las capturas anteriores claro/oscuro y sus limitaciones. 2.6 permanece pendiente; S3/S4 sin iniciar. Backup sigue v9 sin progreso: checkpoint no distribuible.

### Inventario actualizado del diff acumulado S2

A los veinte archivos enumerados en Inventario completo S2 se agregan solamente:

- Modificado: src/components/organization/OrganizationUI.tsx.
- Nuevo: docs/testing/personal-episodic-progress/s2-polish-manga-320.jpg.
- Nuevo: docs/testing/personal-episodic-progress/s2-polish-editor-desktop.jpg.

Total: ocho archivos rastreados modificados y quince nuevos, veintitrés archivos acumulados, sin staging; índice vacío y HEAD sin cambios. Durante este pulido se editaron PersonalProgressSection.tsx, OrganizationUI.tsx y s2-ui.cjs, se actualizaron los tres JSON de resultados y esta evidencia, y se añadieron dos capturas. Los demás archivos acumulados se preservaron. Sin cambios en proveedores, gates, contratos S1, migraciones, dependencias o búsqueda productiva. Sin staging, commit, push, merge, sync ni archive.

## Rediseño de composición — 2026-11-21

Se preservaron los 23 archivos acumulados al inicio. Misma rama feat/personal-episodic-progress-foundation y HEAD 62e6c0f9501fcd04b5e90ca33ee9d5445e65431a; índice vacío. OpenSpec spec-driven ready, 13/29 completadas; 2.6 sigue sin marcar. Este rediseño no inicia otra sección.

### Cambio visual perceptible

PersonalProgressPosition reemplaza la frase única por una composición específica: TEMPORADA 03 y EPISODIO 12 son dos áreas separadas por un divisor, con cifras grandes y tabulares; episodio continuo usa EPISODIO y su cifra; capítulo usa CAPÍTULO y el texto canónico completo; especial presenta POSICIÓN ESPECIAL y la etiqueta Unicode multilínea. No hay tarjetas por dato, elipsis, truncamiento ni redondeo. Una etiqueta accesible completa expresa la posición una sola vez y oculta la duplicación visual al lector. El número es una posición manual, nunca unidades consumidas.

La posición ocupa una franja de superficie secundaria de extremo a extremo, con acento lateral de la paleta activa. En escritorio las acciones se alinean a la derecha; a 320 px envuelven debajo. Sumar episodio sigue principal. Editar es un icono compacto cuando acompaña al incremento y conserva el nombre accesible Editar progreso; capítulos/especiales conservan también la etiqueta visible. Restablecer queda dentro del apartado expandible Más opciones de progreso, cerrado inicialmente, y mantiene su confirmación.

El editor continúa la misma composición debajo de la posición confirmada; no es otra tarjeta. Conserva selector compacto, campos en fila cuando caben, acciones Guardar/Cancelar y confirmaciones con wrap. Se conservan sin cambios semánticos parser, decimales textuales, incremento de uno sin salir de temporada, bloqueo de doble envío, control de versión, manejo de errores, borradores, Escape, reset y elegibilidad. Biblioteca y Colecciones no se rediseñan.

Archivos de producción intervenidos en esta revisión: src/components/progress/PersonalProgressSection.tsx y el nuevo src/components/progress/PersonalProgressPosition.tsx. OrganizationUI.tsx conserva el cambio del pulido previo; no se volvió a editar aquí. Sin cambios de dominio, SQLite v9, repositorios, backup, proveedores, gates ni dependencias.

### Capturas reales y recorrido

Se capturó la interfaz anterior ANTES de editar código, creando una serie manual TEST con temporada 3/episodio 12. Después se reinició Metro CI y se recargó el bundle; se abrió exactamente el mismo título y posición desde Biblioteca TEST. Antes/después usan Web oscuro a 1280 × 900, misma ficha y datos. El scroll puede variar ligeramente al enfocar los controles, pero las capturas son completas y no retocadas. No son mockups.

- s2-redesign-before.jpg: composición previa, frase única y acciones debajo.
- s2-redesign-after.jpg: temporada/episodio, editor cerrado; dos áreas y acciones laterales.
- s2-redesign-editor.jpg: temporada/episodio, editor abierto.
- s2-redesign-manga.jpg: capítulo 128.5 sin redondeo.
- s2-redesign-320.jpg: temporada/episodio a 320 × 900, cifras en dos columnas y acciones debajo.

También se inspeccionó Web claro a 320 px con Más opciones desplegado. Se guardó y mostró el máximo textual 999999.999999 a ese ancho: envuelve en varias líneas sin truncamiento ni pérdida de dígitos; luego se restableció el ejemplo TEST a 128.5 mediante edición normal. Planeado se conservó. Reapertura tras recarga confirmó la persistencia del progreso de la serie. El entorno utilizó exclusivamente media-review-primary.db y media-review-restore.db, sin montar la biblioteca personal. Viewport restablecido y servidor detenido.

### Verificación

- npx tsc --noEmit: PASS.
- npx expo export --platform web --output-dir dist/s2-web: PASS, sin publicación.
- node docs/testing/personal-episodic-progress/s2-ui.cjs: PASS, trece grupos y cero solicitudes de red. Nuevo grupo verifica cifras separadas, padding visual 03, decimal máximo exacto, Unicode, ausencia de truncamiento, tipografía tabular, etiqueta accesible completa y reset contextual cerrado inicialmente. Las assertions anteriores de posición semántica y resúmenes se conservan; el harness inspecciona también el nuevo componente real.
- node docs/testing/personal-episodic-progress/s2-regressions.cjs: PASS del runner, doce recorridos con exit 0 y los dos fallos históricos esperados descritos arriba. No se eliminaron ni debilitaron assertions heredadas.
- openspec validate add-personal-episodic-progress-foundation --strict: PASS.
- git diff --check y revisión individual de todos los textos nuevos contra /dev/null: sin errores de whitespace.

Las excepciones de Android físico/emulador, lector de pantalla y medición visual al 200 % continúan pendientes. El harness conserva las comprobaciones de composición de Biblioteca/Colecciones con fontScale 1/2; no equivalen a aceptación física. No se cierra 2.6. S3/S4 sin iniciar; backup v9 no transporta progreso y el checkpoint sigue sin ser distribuible.

### Inventario completo acumulado tras el rediseño

Ocho archivos rastreados modificados y veintiún archivos nuevos: 29 en total. Se agregaron a los 23 previos únicamente el componente de posición y cinco capturas. Todos sin staging; HEAD intacto. Lista obtenida de Git:
- app/(tabs)/libreria.tsx
- app/organize/collections/[id].tsx
- app/title/[id].tsx
- openspec/changes/add-personal-episodic-progress-foundation/tasks.md
- src/components/browsing/TitleGridCard.tsx
- src/components/organization/OrganizationUI.tsx
- src/dev/mediaReview/MediaReview.tsx
- src/dev/mediaReview/session.ts
- docs/testing/personal-episodic-progress/s2-polish-editor-desktop.jpg
- docs/testing/personal-episodic-progress/s2-polish-manga-320.jpg
- docs/testing/personal-episodic-progress/s2-redesign-320.jpg
- docs/testing/personal-episodic-progress/s2-redesign-after.jpg
- docs/testing/personal-episodic-progress/s2-redesign-before.jpg
- docs/testing/personal-episodic-progress/s2-redesign-editor.jpg
- docs/testing/personal-episodic-progress/s2-redesign-manga.jpg
- docs/testing/personal-episodic-progress/s2-regression-results.json
- docs/testing/personal-episodic-progress/s2-regressions.cjs
- docs/testing/personal-episodic-progress/s2-results.json
- docs/testing/personal-episodic-progress/s2-storage-results.json
- docs/testing/personal-episodic-progress/s2-ui.cjs
- docs/testing/personal-episodic-progress/s2-validation.md
- docs/testing/personal-episodic-progress/s2-web-320-editor.jpg
- docs/testing/personal-episodic-progress/s2-web-320-light.jpg
- docs/testing/personal-episodic-progress/s2-web-320-mosaic.jpg
- docs/testing/personal-episodic-progress/s2-web-desktop.jpg
- src/components/progress/PersonalProgressPosition.tsx
- src/components/progress/PersonalProgressSection.tsx
- src/components/progress/PersonalProgressSummary.tsx
- src/core/personalProgressPresentation.ts
