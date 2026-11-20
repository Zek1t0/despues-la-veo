## Why

En Biblioteca, los indicadores y acciones compiten con las portadas, y en la ficha local la información editorial antecede a varias acciones personales. Una renovación focalizada y un selector basado en la biblioteca guardada mejoran el uso cotidiano con el mismo modelo de datos.

## What Changes

- Unificar el nombre visible «Biblioteca» en la navegación y la pantalla, manteniendo la ruta interna y las cinco pestañas.
- Refinar Detalle y Mosaico con una jerarquía sobria, portadas protagonistas, filtros activos visibles y acciones personales fáciles de encontrar.
- Reordenar la ficha local y aplicar patrones visuales comunes a los detalles remotos donde correspondan.
- Agregar «¿Qué veo hoy?» como pantalla secundaria de Biblioteca. Ofrece hasta tres títulos guardados con razones y una opción «Sorprendeme» entre los elegibles.
- Fuera de alcance quedan Colecciones, bandeja, progreso, descubrimiento externo, swipe, IA y sincronización. La cabecera deja espacio para evolución futura sin accesos ficticios.

## Capabilities

### New Capabilities

- `local-library-picker` — selección local, explicable y de solo lectura.
- `media-detail-experience` — jerarquía de ficha y acciones según el origen del título.

### Modified Capabilities

- `customizable-browsing-views` — composición compartida de Mosaico, nombre visible, resumen de filtros y recuperación en Biblioteca.

## Impact

Expo Router, Biblioteca y fichas, componentes de exploración, tokens de presentación y lógica pura del selector. Buscar y Etiquetas reciben el Mosaico compartido. Se preservan contratos de datos, SQLite v7, backup v8 e importación v1–v8, preferencias, fuentes, refresh y gates productivos, incluido Kitsu M/T/A. No se requieren dependencias ni permisos nuevos.

Los riesgos para datos existentes se concentran en la reorganización de controles ya conectados a escrituras. Se mantienen sus servicios e intenciones y se verifica la persistencia de las acciones y preferencias con una biblioteca de prueba. El selector usa criterios de sesión y carece de escrituras propias.
