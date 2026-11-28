## MODIFIED Requirements

### Requirement: los controles de Biblioteca se adaptan a web y móvil

Biblioteca MUST ofrecer búsqueda local, chips de categoría, conteo y resumen de filtros activos, con controles independientes para orden, filtros y presentación. Un chip MUST editar la misma dimensión del mismo estado que su filtro equivalente. MUST conservar todas las opciones vigentes y permitir limpiar consulta y filtros sin alterar presentación ni orden.

#### Scenario: Controles en Android y Web
- **WHEN** se abre el control de orden, Filtros o la presentación
- **THEN** cada control ofrece únicamente su categoría de ajustes, con opciones de orden desde Recientes cuando ese sea el valor activo, y con selector de presentación si hay más de dos vistas

#### Scenario: Filtro compartido
- **WHEN** se cambia una categoría por chip o panel
- **THEN** el otro control y los resultados reflejan inmediatamente el mismo valor

#### Scenario: Búsqueda estrecha
- **WHEN** se busca dentro de Biblioteca con fuente ampliada
- **THEN** el campo y el contenido siguen disponibles con la vista de Biblioteca y el teclado abierto

### Requirement: el panel de opciones es extensible, accesible y responsive

Buscar y Etiquetas MUST usar un único control de opciones con icono de ajustes o deslizadores, MUST mostrar sólo `Apariencia`, `Ordenar` y `Filtrar` cuando correspondan a la pantalla y MUST aplicar cada selección inmediatamente sobre la única fuente de estado de la pantalla.

Biblioteca MUST usar los accesos separados de su contrato de controles y aplicar los mismos principios de accesibilidad e interacción inmediata.

#### Scenario: opciones en móvil
- **WHEN** el usuario abre opciones en móvil
- **THEN** aparece un panel inferior o modal apropiado para interacción táctil
- **AND** las áreas táctiles son adecuadas y los botones de sólo icono tienen etiquetas accesibles

#### Scenario: opciones en web
- **WHEN** el usuario abre opciones en web
- **THEN** aparece un popover, menú o panel compacto adecuado al espacio disponible
- **AND** toda función se puede usar sin depender de hover

#### Scenario: opciones de apariencia distinguibles
- **WHEN** el usuario revisa la sección `Apariencia`
- **THEN** puede distinguir visualmente `Detalle` y `Mosaico`, o `Mosaico` y `Lista` según la pantalla

#### Scenario: selección inmediata sin confirmación
- **WHEN** el usuario selecciona apariencia, orden, estado o tipo en un control donde esa opción corresponde
- **THEN** la selección se aplica inmediatamente al contenido
- **AND** chips web, barra móvil y panel que representan ese valor se actualizan juntos
- **AND** el panel no mantiene una copia provisional de filtros
- **AND** no se exige `Aplicar` ni `Restablecer` para guardar una opción. Biblioteca ofrece Limpiar para búsqueda y filtros

#### Scenario: transición de apariencia
- **WHEN** el usuario cambia la apariencia
- **THEN** el contenido adopta el nuevo layout sin conservar posiciones o dimensiones inválidas
- **AND** cualquier transición es breve y discreta

## ADDED Requirements

### Requirement: Biblioteca permite retomar títulos en curso

Retomar MUST usar títulos locales visibles en estado en curso y orden descendente por la última mutación personal de progreso confirmada de cada título, tomando la más reciente entre cursor y decisiones granulares. Solo cuando un título carece de un reloj de progreso disponible MUST usar su recencia de edición como respaldo. MUST desempatar por ID local estable. Estos relojes MUST usarse para ordenar y MUST NOT presentarse como fechas de consumo. MUST mostrar portada o fallback, título, tipo, estado y progreso confirmado si existe. MUST permitir abrir la ficha, indicar que hay más y ofrecer acceso a todos cuando haya más de cuatro elegibles. MUST mostrar hasta cuatro tarjetas iniciales y conservar el mismo orden en Ver todos. El carrusel MUST admitir gesto horizontal y acceso por tecnologías de asistencia sin scrollbar visible. MUST omitirse cuando no hay elegibles y MUST funcionar con lecturas agrupadas, sin red ni consultas por tarjeta, sin modificar timestamps ni requerir migraciones.

#### Scenario: Actividad de progreso confirmada
- **WHEN** se confirma una marca, un desmarcado o una corrección de posición sin cambiar la fecha de edición del título
- **THEN** el orden usa ese reloj si es el más reciente de su progreso y se actualiza al leer el snapshot confirmado
- **AND** los borradores, los fallos de escritura y las actualizaciones editoriales de la guía no se tratan como progreso confirmado

#### Scenario: Respaldo y tramo inicial
- **WHEN** hay más de cuatro títulos elegibles y algunos carecen de reloj de progreso
- **THEN** se ordena cada título con su reloj de progreso o su respaldo de edición, se desempata por ID y Ver todos conserva el mismo orden

#### Scenario: Datos incompletos
- **WHEN** un título en curso carece de cursor o marcas
- **THEN** se muestra su estado sin inventar consumo ni próximo episodio

#### Scenario: Sensibilidad y orden
- **WHEN** hay títulos ocultos o empates de recencia
- **THEN** se excluyen los ocultos y se usa el mismo desempate estable al repetir la lectura
