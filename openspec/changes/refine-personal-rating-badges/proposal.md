## Why

La puntuación personal se presenta hoy con textos extensos y estilos distintos entre Biblioteca y Etiquetas, y no aparece en sus mosaicos. Una pill semántica compartida hará el dato más reconocible y consistente sin cambiar su dominio, edición ni persistencia.

## What Changes

- Presentar las puntuaciones personales calificadas como una pill compacta que muestra visualmente sólo el valor `1.0..10.0`, formateado desde el entero canónico `10..100`.
- Aplicar fondo pastel rojo para `10..74`, ámbar para `75..84` y verde para `85..100`, con texto de contraste adecuado y colores semánticos reutilizables.
- Reutilizar una única clasificación, formato y presentación accesible en Biblioteca Detalle, Biblioteca Mosaico, Etiqueta abierta Detalle y Etiqueta abierta Mosaico.
- Incorporar el rating al mosaico mediante datos explícitos de la card compartida, sin que la card detecte la pantalla y sin alterar el indicador contextual de pin ni su única acción de navegación.
- Mantener `null` sin badge ni hueco reservado y mantener deliberadamente Buscar y `TagCollage` sin puntuación personal.
- Conservar para accesibilidad el significado “Mi puntuación: 7.4 de 10” aunque el contenido visual de la pill sea sólo “7.4”.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `personal-title-rating`: cambia la presentación pasiva para usar un badge semántico compartido y amplía su presencia a los mosaicos de Biblioteca y de una etiqueta abierta, manteniendo Search excluido.
- `customizable-browsing-views`: permite la puntuación personal como metadata pasiva en las cards de mosaico guardadas de Biblioteca y Etiquetas, preservando la card completa como única navegación y manteniendo el mosaico de Buscar sin rating.

## Impact

- UI compartida de browsing, especialmente `TitleGridCard` y un componente reutilizable de badge.
- Integraciones de Biblioteca y Etiquetas; Buscar conserva su llamada sin rating y `TagCollage` no cambia.
- Tokens semánticos del sistema visual actual para fondos y texto de los tres rangos.
- No cambia `SavedTitle`, SQLite, schema version, migraciones, backups, sorting, editor, intent queue, setters, timestamps, TMDB, dependencias ni configuración de la app.
- Riesgo para datos existentes: ninguno; el cambio sólo lee el valor canónico vigente para presentarlo.
- Reversión: retirar las integraciones y el componente/tokens visuales restaura la presentación anterior sin transformar ni migrar datos.
