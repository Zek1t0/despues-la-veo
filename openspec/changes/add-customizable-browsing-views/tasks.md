# Tareas

Aplicar una sola tarea por vez. Antes de marcar cualquier tarea como completa, ejecutar `npx tsc --noEmit` además de la comprobación específica indicada. Al terminar cada sección, detener la implementación y presentar cambios, comprobaciones y riesgos para revisión antes de continuar con la sección siguiente.

## 1. Persistencia y tipos de preferencias

- [x] 1.1 Crear `src/core/viewPreferences.ts` con uniones literales, claves, opciones válidas y predeterminados para las tres apariencias y los órdenes de Biblioteca y Etiquetas; comprobar con TypeScript que acepta cada valor permitido y rechaza valores fuera del contrato.
- [x] 1.2 Agregar validadores por clave que conviertan ausencia o texto desconocido en el predeterminado correspondiente sin usar casts no verificados; comprobar manualmente todas las claves con valor válido, ausente e inválido.
- [x] 1.3 Actualizar `src/storage/db.ts` con una evolución SQLite aditiva e idempotente `0 → 1` que cree sólo `app_preferences`; comprobar sobre una copia de base existente que `PRAGMA user_version` queda en `1`, que la tabla tiene `key`, `value` y `updated_at`, y que `saved_titles` conserva cantidad, IDs y campos.
- [x] 1.4 Hacer idempotente y verificable la inicialización, incluida la defensa ante estructura inesperada y versión futura no soportada; comprobar dos inicializaciones consecutivas y confirmar que no duplica estructuras, no modifica títulos ni recrea `idx_saved_titles_provider_external`.
- [x] 1.5 Crear `src/storage/viewPreferencesRepo.ts` con lectura tipada y upsert por clave, aislado de `savedTitlesRepo`; comprobar persistencia de cada clave cerrando y reabriendo la conexión o aplicación de prueba.
- [x] 1.6 Implementar fallbacks independientes para errores o datos corruptos de lectura y una señal de error para fallos de escritura; comprobar que una clave inválida no afecta las demás y que ninguna ruta escribe en `saved_titles`.
- [x] 1.7 Verificar la compatibilidad con rollback de código: abrir una base evolucionada ignorando el repositorio nuevo y confirmar que la biblioteca y su índice siguen utilizables, sin tratar la evolución como reversible, ejecutar `DROP TABLE` ni reducir automáticamente `PRAGMA user_version`.
- [x] 1.8 Detenerse para revisión de la sección 1 y presentar versión anterior/nueva, carácter aditivo, SQL ejecutado, resultados de idempotencia, rollback de código e integridad de datos junto con `npx tsc --noEmit` antes de avanzar.

## 2. Componentes visuales compartidos necesarios

- [ ] 2.1 Crear `PosterPlaceholder` neutro y no interactivo, sin signo `+`, con tamaños configurables; comprobarlo en proporción de tarjeta y en las cuatro celdas de un collage.
- [ ] 2.2 Crear `TitleGridCard` con póster predominante `2:3` ocupando casi toda la tarjeta, indicador pequeño `Película`/`Serie` arriba a la izquierda y título superpuesto abajo sobre contraste oscuro, limitado a dos líneas con truncado; no incluir metadatos, acciones, botones ni zonas táctiles secundarias, y hacer que el placeholder conserve exactamente la estructura y que la tarjeta completa sea la única navegación. Comprobar cada regla con película, serie, título corto/largo, póster ausente y error de carga, sin acoplar `SavedTitle` con `TmdbSearchItem`.
- [ ] 2.3 Crear `LayoutOption` y `ViewOptionsPanel` como componentes controlados, con secciones configurables, estados seleccionados e iconos o miniaturas distinguibles; comprobar que cada selección se aplica inmediatamente, que omitir una sección no deja espacios vacíos y que no existen botones `Aplicar`/`Restablecer` ni estado provisional de filtros.
- [ ] 2.4 Implementar la presentación responsive del panel con modal o panel inferior táctil en móvil y control compacto en web usando APIs existentes; comprobar apertura, cierre, foco y selección en ambos entornos sin hover obligatorio.
- [ ] 2.5 Agregar etiquetas accesibles, roles/estados y áreas táctiles adecuadas a controles de sólo icono, opciones y tarjetas; comprobar navegación por teclado en web y lector/inspector de accesibilidad disponible en móvil.
- [ ] 2.6 Crear utilidades compartidas sólo para traducciones de presentación realmente reutilizadas (`Película`, `Serie` y estados), manteniendo valores internos en inglés; comprobar todas las entradas del dominio.
- [ ] 2.7 Detenerse para revisión de la sección 2 y presentar catálogo de componentes, casos visuales, accesibilidad y `npx tsc --noEmit` antes de avanzar.

## 3. Biblioteca en Detalle/Mosaico y controles responsive

- [ ] 3.1 Incorporar carga y guardado de apariencia y orden de Biblioteca con `Detalle` y `Actualizados recientemente` como predeterminados, evitando grabar antes de finalizar la lectura; comprobar primera apertura, recuperación y fallo simulado.
- [ ] 3.2 Extraer o conservar la tarjeta Detalle sin perder información ni acciones actuales, traduciendo sus etiquetas visibles; comprobar abrir detalle, cambiar estado y borrar sin regresiones.
- [ ] 3.3 Agregar el Mosaico de Biblioteca con el contrato completo de `TitleGridCard`: póster o placeholder predominante `2:3`, tipo arriba a la izquierda, título inferior de hasta dos líneas sobre contraste y navegación única de tarjeta completa, sin metadatos ni controles internos; comprobar títulos con y sin póster y confirmar que estado/borrado sólo siguen disponibles en Detalle.
- [ ] 3.4 Implementar los cinco órdenes con valores ausentes al final y desempates por título e ID; comprobar conjuntos con puntuación/año presentes, ausentes, iguales y títulos repetidos.
- [ ] 3.5 Aplicar búsqueda, estado, tipo y orden desde un único resultado memorizado; comprobar combinaciones, lista completa, cero coincidencias y que la búsqueda interna mantiene la apariencia elegida.
- [ ] 3.6 Implementar Biblioteca web con búsqueda y chips frecuentes visibles más el panel de Apariencia/Ordenar/Filtrar sobre una única fuente de estado; comprobar que apariencia, orden, estado y tipo se aplican al seleccionarlos, que chips y panel se actualizan juntos y que no hay confirmación, restablecimiento ni filtros provisionales.
- [ ] 3.7 Implementar Biblioteca móvil con encabezado `Biblioteca`, botones accesibles de búsqueda y opciones, búsqueda que reemplaza el título y sin menú de tres puntos; comprobar activación, escritura, cierre y navegación en pantalla móvil.
- [ ] 3.8 Implementar la barra horizontal de una línea para `Todos`, `Planeados`, `Viendo`, `Terminados` y `Abandonados`, dejando tipo en el panel; comprobar aplicación inmediata, desplazamiento y sincronización bidireccional de barra y panel sobre el mismo estado, sin copia provisional.
- [ ] 3.9 Calcular columnas y ancho de tarjeta desde `useWindowDimensions()` y remontar `FlatList` mediante una key que incluya apariencia y columnas; comprobar Detalle↔Mosaico, rotación, redimensionado web y ausencia de advertencias de `numColumns` inválido.
- [ ] 3.10 Agregar estados de carga y vacío correctos para biblioteca vacía o filtros sin resultados en ambas apariencias; comprobar que no aparecen tarjetas ficticias ni acciones inválidas.
- [ ] 3.11 Detenerse para revisión de la sección 3 y presentar matriz web/móvil, órdenes, sincronización, datos ausentes y `npx tsc --noEmit` antes de avanzar.

## 4. Buscar en Detalle/Mosaico

- [ ] 4.1 Incorporar carga y guardado de la apariencia independiente de Buscar con `Detalle` predeterminado; comprobar primera apertura, recuperación y que cambiarla no altera Biblioteca ni Etiquetas.
- [ ] 4.2 Conservar la tarjeta Detalle y normalizar sus textos visibles al español sin cambiar consulta, debounce, filtrado de tipos ni navegación TMDB; comprobar búsquedas de película y serie.
- [ ] 4.3 Agregar el Mosaico de Buscar reutilizando sin variantes el contrato completo de `TitleGridCard`: póster o placeholder predominante `2:3`, tipo arriba a la izquierda, título inferior de hasta dos líneas sobre contraste y tarjeta completa como única navegación, sin metadatos, acciones ni botones; comprobar póster presente/ausente, error de imagen, título largo y apertura del detalle remoto.
- [ ] 4.4 Agregar el control de opciones con sólo Apariencia y sin secciones vacías de Ordenar o Filtrar; comprobar la composición en web y móvil.
- [ ] 4.5 Mantener exactamente el orden natural recibido de `searchMulti()` y no agregar parámetros, género, año ni orden remoto; comprobar comparando IDs recibidos y renderizados para una consulta reproducible.
- [ ] 4.6 Aplicar cálculo responsive y key de `FlatList` para cambios de apariencia/columnas, más estados de consulta vacía, carga, error y cero resultados; comprobar redimensionado web y pantalla móvil.
- [ ] 4.7 Detenerse para revisión de la sección 4 y presentar independencia, orden TMDB, estados visuales y `npx tsc --noEmit` antes de avanzar.

## 5. Etiquetas en Mosaico/Lista y collages

- [ ] 5.1 Derivar estructuras de etiqueta exclusivamente desde `SavedTitle.tags`, con nombre, títulos y cantidad, sin inventar fechas, entidades persistentes ni almacenamiento para etiquetas con cero títulos; agregar los tres órdenes con desempates estables y comprobar cantidades iguales, mayúsculas/acentos y nombres repetibles.
- [ ] 5.2 Incorporar carga y guardado de apariencia y orden de Etiquetas con `Mosaico` y `Mayor cantidad de títulos` como predeterminados; comprobar primera apertura, recuperación e independencia respecto de las otras pantallas.
- [ ] 5.3 Crear `TagCollage` 2×2 seleccionando hasta cuatro títulos por `updatedAt` descendente y desempate por título e ID; comprobar etiquetas con uno, dos, tres, cuatro y más de cuatro títulos.
- [ ] 5.4 Completar imágenes o lugares ausentes con placeholders neutros sin `+` ni interacción individual y aplicar contraste legible; comprobar mezcla de pósters claros, oscuros, URLs ausentes y errores de carga.
- [ ] 5.5 Implementar tarjetas de Mosaico con collage, nombre, cantidad y una única área táctil, más Lista como alternativa navegable; comprobar apertura tocando distintas zonas y confirmar que las celdas no son botones separados.
- [ ] 5.6 Migrar la colección principal a una lista virtualizada con columnas responsive y key de layout; comprobar una columna móvil, dos en ancho intermedio, hasta tres en web ancho y cambio Mosaico↔Lista sin layout inválido.
- [ ] 5.7 Hacer que al abrir una etiqueta sus títulos lean y usen la apariencia de Biblioteca, sin guardar otra clave; comprobar Detalle y Mosaico, cambios posteriores de Biblioteca y cierre/retorno a la lista de etiquetas.
- [ ] 5.8 Conservar búsqueda de etiquetas y separar tres estados: ningún `SavedTitle` contiene etiquetas, la búsqueda no coincide con etiquetas derivadas y una etiqueta abierta pierde todos sus títulos por un cambio concurrente; comprobar mensajes comprensibles o retorno seguro al listado, sin crear ni conservar una entidad de etiqueta vacía.
- [ ] 5.9 Detenerse para revisión de la sección 5 y presentar matriz 0/1/2/3/4+ títulos, estabilidad de collage, herencia de Biblioteca y `npx tsc --noEmit` antes de avanzar.

## 6. Traducción y pulido responsive de pantallas afectadas

- [ ] 6.1 Inventariar y normalizar textos visibles de Biblioteca, Buscar y Etiquetas a español, incluidos tipos, estados, `Estado` y `Etiquetas`; comprobar que no queden `Movie`, `Movies`, `TV`, `Planned`, `Watching`, `Done`, `Dropped`, `Status` ni `Tags` visibles en esas pantallas.
- [ ] 6.2 Normalizar en `app/title/[id].tsx` los textos afectados, incluidos tipo, estados, Etiquetas y fecha de actualización, sin cambiar valores persistidos; comprobar editar estado, etiquetas y notas de película y serie.
- [ ] 6.3 Revisar anchos móviles, tablet y web para evitar controles en varias líneas desordenadas, recortes de texto y áreas táctiles pequeñas; comprobar al menos un ancho móvil estrecho, uno intermedio y uno web amplio.
- [ ] 6.4 Incorporar una transición breve y discreta sólo si las APIs existentes la permiten sin inestabilidad; comprobar que desactivarla no afecta ninguna función y que navegación/información no dependen de hover.
- [ ] 6.5 Confirmar que no se agregó selector de idioma, sistema i18n, menú de tres puntos, signo `+` en placeholders ni acciones de mosaico; comprobar mediante revisión de las cuatro pantallas y búsqueda textual relevante.
- [ ] 6.6 Detenerse para revisión de la sección 6 y presentar capturas o descripción reproducible por breakpoint, inventario de textos y `npx tsc --noEmit` antes de avanzar.

## 7. Pruebas y verificación integral

- [ ] 7.1 Ejecutar `npx tsc --noEmit` sobre el cambio completo y resolver todos los errores sin actualizar dependencias; comprobar salida exitosa con código `0`.
- [ ] 7.2 Revisar manualmente en web Biblioteca, Buscar, Etiquetas y detalle, cubriendo búsqueda, chips, paneles, todos los órdenes, filtros, layouts y navegación; registrar ancho probado y resultados.
- [ ] 7.3 Revisar manualmente en una pantalla móvil física o emulador las mismas pantallas, incluidos encabezado de Biblioteca, búsqueda activable, barra horizontal, modal/panel, áreas táctiles y rotación; registrar dispositivo o viewport y resultados.
- [ ] 7.4 Cambiar todas las preferencias, cerrar por completo y volver a abrir la aplicación; comprobar recuperación de cada valor y luego cambiar una por vez para confirmar que no afecta a las otras.
- [ ] 7.5 Probar preferencias ausentes, desconocidas y errores simulados de lectura/escritura; comprobar defaults independientes, reversión visual tras fallo de guardado y biblioteca utilizable.
- [ ] 7.6 Comparar una biblioteca existente antes y después de la evolución SQLite aditiva —conteo, IDs, identidad `provider + externalId`, campos e índice— y comprobar que todos los datos permanecen intactos.
- [ ] 7.7 Exportar un backup JSON v1 antes y después de cambiar preferencias, comprobar que sigue en `version: 1` y no contiene preferencias, e importar una copia verificando el comportamiento existente sin reemplazar configuración local.
- [ ] 7.8 Verificar placeholders y estados vacíos en las tres pantallas: contrato visual completo de `TitleGridCard` con póster ausente/error, biblioteca vacía, búsqueda sin resultados, ningún título con etiquetas, búsqueda de etiquetas sin coincidencias, etiqueta abierta que pierde sus títulos y collages incompletos, siempre sin `+`, metadatos extra ni interacción indebida.
- [ ] 7.9 Confirmar por diff de `package.json`, tipos y SQL que no se actualizaron dependencias, no cambió `SavedTitle`, no cambió el índice actual y no se agregaron filtros TMDB, fijados ni refactorizaciones ajenas.
- [ ] 7.10 Ejecutar `npx.cmd openspec validate add-customizable-browsing-views --strict` y corregir únicamente inconsistencias de los artefactos o de cumplimiento detectadas; comprobar validación exitosa.
- [ ] 7.11 Detenerse para revisión final y presentar resultados, evidencia de compatibilidad, riesgos residuales y estado de todas las tareas antes de proponer el archivado en un paso separado.
