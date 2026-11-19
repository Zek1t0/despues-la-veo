## Context

Biblioteca lee un snapshot local con títulos y pins, proyecta idioma y visibilidad y presenta resultados en FlatList. Buscar y Etiquetas también usan TitleGridCard. La ficha local ya separa arte, ficha editorial, selector de fuente y controles personales. Se revisaron estos componentes en el código actual. Las capturas históricas no sirven como referencia visual vigente.

## Goals / Non-Goals

**Goals** — Reutilizar proyecciones, componentes y servicios existentes. Mantener las acciones, los contratos de navegación e identidad y las preferencias. Aislar el selector como cálculo local de solo lectura.

**Non-Goals** — Sistema de diseño exhaustivo, nuevas fuentes de duración, rutas de funcionalidades futuras o configuración persistente del selector.

## Decisions

1. **Fundamentos acotados.** Añadir en `src/theme/presentation.ts` escalas pequeñas para tipografía, espacios y radios, usando los colores de `AppThemeProvider`. En `src/components/browsing/`, ajustar `TitleGridCard.tsx` y `ViewOptionsPanel.tsx`. Compartir primitivas pequeñas para botón, sección, feedback o acción contextual solo donde haya usos repetidos. Conservar `MediaPoster.tsx`, `MediaBanner.tsx`, sus políticas y el tratamiento de contraste. El póster mantiene 2:3 y el pie en superficie temática crece con el texto. Preferir feedback de presión y foco antes que animaciones. Respetar movimiento reducido si se añade una transición.
2. **Biblioteca como entrada, no como tablero.** En `app/(tabs)/_layout.tsx` y `app/(tabs)/libreria.tsx`, unificar el nombre visible. Mantener búsqueda, panel y controles responsivos existentes. Añadir resumen sincronizado, limpieza y acceso secundario al selector. Conservar Agregar manualmente y una acción para ir a Buscar desde el vacío. En Detalle, mantener fijar/desfijar fuera del área de navegación y relegar Borrar a acciones secundarias con confirmación. Mantener sort TMDB con su nombre y semántica actuales según la spec principal. Revisar consumidores en `buscar.tsx` y `etiquetas.tsx`. Actualizaciones y Ajustes reciben una comprobación de navegación y tema.
3. **Ficha local personal primero.** Reordenar `app/title/[id].tsx` en identidad/arte, estado y acciones personales, etiquetas/notas, ficha editorial y procedencia/controles de metadata. Mantener alertas sensibles antes de revelar contenido. Aplicar encabezado y secciones comunes donde aporten en `app/tmdb/[type]/[id].tsx`, `app/mangaupdates/series/[id].tsx` y `src/providers/kitsu/AnimeDetail.tsx`, sin unificar sus servicios. Preservar guardado, crédito, selector de fuente, señales de error y ciclo de refresh. Las entradas manuales usan la ficha local.
4. **Selector con criterios de sesión.** Añadir `app/library-picker.tsx` al stack y enlazarlo desde Biblioteca. Leer el snapshot mediante `libraryScreenSnapshot.ts`, suscribirse mediante `libraryInvalidation.ts` y reutilizar `useMediaLanguages`, `savedContentVisible` y `presentSavedTitle`. Esperar snapshot y preferencias confirmados. Recalcular con el día civil local vigente al cruzar medianoche mientras la pantalla está activa y al recuperar foco. Invalidar resultados anteriores cuando cambien el día, los criterios, el idioma, la visibilidad o el snapshot, incluso si hay una lectura en curso. No heredar consulta, modo, orden ni pins de Biblioteca.
5. **Motor puro.** Añadir `src/core/libraryPicker.ts`. Cruzar criterios activos de estado, medio, familia, formato, etiqueta y género. Estado inicial Planeados, editable. Usar valores de clasificación existentes y opciones sobre el conjunto visible. Para género, usar coincidencia normalizada sin inferir equivalencias entre idiomas. Tras filtrar, ordenar los elegibles por ID para obtener una entrada canónica y muestrear hasta tres sin reemplazo con semilla derivada del día civil local y de los criterios efectivos normalizados. Inyectar la fecha o la semilla en pruebas. «Más cortos primero» ordena por duración, con desconocidos al final y desempate por título mostrado e ID. Devolver hasta tres candidatos con motivos verificables. «Sorprendeme» toma uno con distribución uniforme sobre todos los elegibles con RNG inyectable. Abrir por ID local con contexto Biblioteca. Usar la navegación existente conserva el comportamiento normal de la ficha, incluido el refresh que corresponda según su configuración.
6. **Duración local con significado.** Usar solo valores positivos, finitos y válidos presentes en la metadata de la fuente activa del snapshot local. Para películas, duración total. Para audiovisual episódico, duración por episodio cuando esté informada. Lectura y formato ambiguo quedan sin duración aplicable. Los mapeos de TMDB admiten runtime de película en materialización y refresh, y el normalizador de Kitsu admite duración por episodio. Son campos opcionales y pueden faltar o ser nulos. El selector no inicia refresh ni presupone que una actualización aporte duración. Con límite activo, excluir desconocidos y explicar cómo limpiar el criterio. Mantener la elegibilidad disponible aun cuando no haya arte.

## Risks / Trade-offs

- [Regresión en tarjetas compartidas] → Probar navegación, indicadores y ausencia de arte en Biblioteca, Buscar y títulos de una etiqueta.
- [Detalle con acciones difíciles de encontrar] → Mantener estado y pin accesibles por teclado y toque. Verificar confirmación, foco de retorno y escrituras reales con datos de prueba.
- [Pocos títulos con duración] → Mostrar cobertura y permitir quitar el límite en una acción. Nunca completar datos por inferencia.
- [Cambio de visibilidad durante una lectura] → Evitar mostrar un resultado anterior hasta reconciliar snapshot y preferencias.
- [Coste en listas] → Mantener virtualización y una proyección por cambio relevante. Medir con biblioteca de prueba poblada antes de modificar almacenamiento.

## Migration Plan

Aplicar en tres secciones con checkpoints tras experiencia visual y selector validado. La reversión consiste en retirar los cambios de UI y el acceso al selector. No hay migración ni datos generados por el selector. Las acciones existentes mantienen su semántica de escritura e importación/exportación.

## Open Questions

Ajustar medida del pie, densidad y columnas con la UI vigente en Android y Web al iniciar Apply. Los valores concretos pueden variar dentro de los criterios de legibilidad, proporción y navegación de las specs. Colecciones y bandeja podrán reutilizar la cabecera y las secciones cuando tengan propuestas propias.
