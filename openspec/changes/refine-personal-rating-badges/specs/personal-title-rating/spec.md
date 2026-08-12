## ADDED Requirements

### Requirement: la presentación pasiva usa una pill semántica consistente
El sistema MUST presentar cada puntuación personal visible en Biblioteca y en una etiqueta abierta mediante una pill pasiva compartida cuyo contenido visual sea únicamente el valor decimal `1.0..10.0`, sin “Mi puntuación”, `/10` ni “de 10”, y MUST derivar ese texto desde el entero canónico sin exponer la escala interna `10..100`.

#### Scenario: valores canónicos se formatean para la interfaz
- **WHEN** las puntuaciones canónicas `74`, `75`, `85` y `100` se presentan en la interfaz
- **THEN** las pills muestran respectivamente `7.4`, `7.5`, `8.5` y `10.0`
- **AND** no muestran la escala canónica ni agregan texto visible dentro de la pill

#### Scenario: valor sin calificar
- **WHEN** `personalRating` es `null`
- **THEN** no se renderiza una pill de puntuación
- **AND** la presentación no reserva un hueco para ella

#### Scenario: rangos semánticos en sus fronteras
- **WHEN** el valor canónico está entre `10` y `74` inclusive
- **THEN** la pill usa un fondo rojo pastel y texto de contraste adecuado
- **WHEN** el valor canónico está entre `75` y `84` inclusive
- **THEN** la pill usa un fondo amarillo o ámbar pastel y texto de contraste adecuado
- **WHEN** el valor canónico está entre `85` y `100` inclusive
- **THEN** la pill usa un fondo verde pastel y texto de contraste adecuado

#### Scenario: semántica accesible sin interacción adicional
- **WHEN** una pill muestra visualmente `7.4`
- **THEN** la información accesible expresa conceptualmente `Mi puntuación: 7.4 de 10`
- **AND** cada superficie aporta esa información desde una única fuente accesible y la anuncia una sola vez
- **AND** cuando el contenedor principal ya incorpora la puntuación en su etiqueta accesible, el badge visual queda fuera del árbol accesible para evitar un anuncio duplicado
- **AND** cuando el propio badge aporta la información accesible, lo hace sin crear un focus target adicional
- **AND** la pill permanece como metadata pasiva, sin rol de botón ni nuevo control interactivo

## MODIFIED Requirements

### Requirement: edición concentrada y presentación pasiva
El sistema MUST permitir editar la puntuación solamente desde el detalle completo, MUST mostrarla pasivamente en las apariencias Detalle y Mosaico de Biblioteca y de una etiqueta abierta, y MUST excluir edición o presentación de Search y de los collages de Etiquetas.

#### Scenario: edición desde detalle completo
- **WHEN** el usuario abre el detalle completo de un título
- **THEN** puede ver, ajustar con precisión `0.1` y quitar su puntuación

#### Scenario: filas Detalle de Biblioteca y Etiquetas
- **WHEN** el título aparece en la apariencia Detalle de Biblioteca o de una etiqueta abierta
- **THEN** la puntuación personal se muestra como información pasiva y diferenciada de TMDB
- **AND** la fila no incorpora un control anidado de edición

#### Scenario: Mosaico de Biblioteca y etiqueta abierta
- **WHEN** un título calificado aparece en el Mosaico de Biblioteca o de una etiqueta abierta
- **THEN** la puntuación personal se muestra mediante la misma presentación pasiva
- **AND** no se agrega un control de rating independiente

#### Scenario: Search permanece sin puntuación personal
- **WHEN** un título aparece en la apariencia Detalle o Mosaico de Search
- **THEN** no se muestra su puntuación personal ni un control de puntuación personal

#### Scenario: collage de Etiquetas permanece sin puntuación personal
- **WHEN** un título aporta una imagen o placeholder a un collage de Etiquetas
- **THEN** el collage no muestra su puntuación personal ni reserva espacio para ella
