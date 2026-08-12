## Context

Ver `proposal.md` para la motivación. `personalRating` ya es `number | null`, se valida como entero `10..100` y `formatPersonalRating(...)` lo convierte a `1.0..10.0`. Biblioteca y Etiquetas formatean y presentan actualmente el dato por separado en Detalle; sus mosaicos comparten `TitleGridCard` con Buscar, que hoy sólo recibe datos visuales comunes y un `isPinned` opcional. `TagCollage` recibe únicamente id y póster.

El cambio cruza componentes compartidos, dos pantallas y tokens visuales, pero no modifica dominio ni persistencia. Debe preservar un solo `Pressable` en `TitleGridCard`, los pins contextuales y la exclusión deliberada de Search y `TagCollage`.

## Goals / Non-Goals

**Goals:**

- Centralizar formato, clasificación semántica, apariencia y semántica accesible del rating en una pieza reutilizable.
- Permitir que las superficies con `SavedTitle` opten explícitamente por pasar el valor canónico a la card compartida.
- Mantener estable la composición con póster, placeholder o error de imagen y con cualquier combinación de pin/rating.
- Usar tokens semánticos compatibles con el sistema visual oscuro actual y reutilizables en web y móvil.

**Non-Goals:**

- Cambiar validación, edición, escritura, sorting, timestamps, almacenamiento, backups o metadata del título.
- Hacer contextual la puntuación, cambiar el pin contextual o incorporar rating a Search/`TagCollage`.
- Crear un sistema dinámico de temas, agregar dependencias o rediseñar las cards completas.

## Decisions

### 1. Un componente compartido recibe el valor canónico

Crear un componente de presentación equivalente a `PersonalRatingBadge` dentro de la UI compartida de browsing. Recibe `number | null` (o sólo un valor no nulo si el caller decide la ausencia), valida/formatea mediante las utilidades vigentes y resuelve un único variant semántico `low | medium | high` desde los límites canónicos `74/75` y `84/85`.

La utilidad compartida devuelve sólo valor canónico, texto, rango semántico y descripción accesible conceptual; permanece independiente de la paleta. El componente renderiza sólo el texto producido por esa utilidad, resuelve el rango semántico contra los tokens visuales vigentes y queda siempre excluido del árbol accesible. La navegación o contenedor principal de cada superficie será la única fuente accesible y usará la descripción centralizada, mientras el badge continúa como `View` visual sin `Pressable`, rol interactivo ni focus target. Alternativas descartadas: repetir condiciones y estilos en cada pantalla, porque divergirían; clasificar sobre el decimal visible, porque el contrato de rangos está definido sobre el entero canónico; acoplar la utilidad semántica a la paleta, porque dificultaría un futuro cambio visual.

### 2. Colores semánticos en el tema vigente

Agregar tokens reutilizables para fondo y texto de rating bajo, medio y alto en `src/theme/colors.ts`. Los nombres describen la semántica del rating, no colores genéricos ni un futuro theme. Cada par fondo/texto debe mantener contraste legible sobre la pill.

Alternativas descartadas: colores inline por pantalla, por duplicación; dependencia visual, por ser innecesaria; infraestructura de theme dinámico, por estar fuera de alcance.

### 3. `TitleGridCard` recibe datos, no contexto

Extender la API con una prop opcional equivalente a `personalRating?: number | null`. Biblioteca y la etiqueta abierta pasan `item.personalRating`; Buscar omite la prop. La card no conoce nombres de pantallas ni consulta stores. La ausencia de prop y `null` producen el mismo resultado visual: ningún badge ni espacio reservado.

La región inferior de contraste agrupa badge y título en flujo vertical para que el rating quede inmediatamente encima del título sólo cuando existe. Tipo y pin conservan sus esquinas superiores. El badge se monta dentro del único `Pressable` como descendiente pasivo, por lo que pin y rating pueden coexistir sin zonas táctiles nuevas.

Alternativa descartada: variantes `library/tags/search`, porque acoplan el componente a callers y vuelven frágil su reutilización.

### 4. La card compone una sola etiqueta accesible

Cuando recibe una puntuación no nula, `TitleGridCard` incorpora “Mi puntuación: X de 10” al `accessibilityLabel` de su `Pressable` principal, junto con el estado de pin si corresponde. En este contexto el badge visual queda explícitamente fuera del árbol accesible: el `Pressable` principal es la única fuente accesible de la puntuación y la anuncia una sola vez. Los indicadores internos permanecen pasivos, sin foco ni rol interactivo.

En las filas Detalle se aplica la misma regla: la navegación principal incorpora la puntuación en su etiqueta accesible y el badge visual permanece decorativo. En todas las superficies previstas se anuncia “Mi puntuación: X de 10” una sola vez y el badge nunca adquiere interacción ni foco propio.

### 5. Integración mínima y exclusiones explícitas

Biblioteca reemplaza su `Pill` textual de rating por el componente compartido y pasa el valor a su grid. `DetailTitleRow` de Etiquetas hace lo mismo y la card de la etiqueta abierta recibe el valor. Buscar mantiene su llamada actual sin la prop. `TagCollage` no cambia porque su contrato no contiene rating y su exclusión es deliberada.

## Risks / Trade-offs

- [El badge aumenta la altura de la región inferior y reduce espacio disponible para el título en cards angostas] → mantener el título en dos líneas, usar métricas compactas y validar móvil/web/viewport angosto con y sin rating.
- [Contraste pastel insuficiente o inconsistente entre plataformas] → definir pares explícitos fondo/texto y verificarlos manualmente en web y móvil, además de una comprobación focalizada de selección de tokens.
- [Anuncio accesible duplicado por herencia entre padre e hijo] → elegir explícitamente una sola fuente accesible por superficie, excluir la otra del árbol y validar con herramientas accesibles; los indicadores internos no serán focus targets.
- [Regresión de navegación por un control anidado] → el badge será una vista pasiva y las verificaciones estructurales confirmarán un único `Pressable` principal en la card.
- [Cambiar el requisito de grid podría interpretarse como rating en Search] → la API es opt-in y tanto los deltas como las tareas exigen comprobar explícitamente que Buscar y `TagCollage` siguen sin rating.

## Migration Plan

No hay migración de datos ni cambio de schema. Implementar primero la presentación compartida y sus comprobaciones, detenerse para revisión, y luego integrar las superficies. La reversión elimina las props/integraciones y restaura la presentación anterior; los valores persistidos permanecen intactos.
