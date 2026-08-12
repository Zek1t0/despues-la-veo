# personal-title-rating Specification

## Purpose

Permite que cada título guardado tenga una única puntuación personal local, precisa y portable, inequívocamente separada de la puntuación comunitaria de TMDB.

## Requirements

### Requirement: la puntuación personal es global y opcional
El sistema MUST asociar como máximo una puntuación personal global a cada `SavedTitle`, MUST usar `null` para “Sin calificar” y MUST mantenerla independiente de tags, contextos y pins.

#### Scenario: mismo valor en todos los contextos
- **GIVEN** un título puntuado con `8.7`
- **WHEN** se consulta desde Biblioteca, una o más etiquetas y el detalle completo
- **THEN** se muestra la misma puntuación personal en todos esos lugares

#### Scenario: título sin calificar
- **WHEN** un título no tiene puntuación personal o el usuario la quita
- **THEN** su valor es `null` y se presenta como “Sin calificar”
- **AND** no se usa `0`, un sentinel ni un valor no numérico

### Requirement: la escala admite décimas exactas
El sistema MUST aceptar valores visibles desde `1.0` hasta `10.0` inclusive en pasos exactos de `0.1`, y MUST rechazar todo valor que no corresponda exactamente a una décima válida sin clamp ni redondeo silencioso.

#### Scenario: extremos y valor intermedio válidos
- **WHEN** el usuario establece `1.0`, `5.7` o `10.0`
- **THEN** el sistema guarda y vuelve a mostrar exactamente ese valor

#### Scenario: valor fuera de rango o no representable
- **WHEN** se intenta guardar un valor menor que `1.0`, mayor que `10.0`, no finito o que no corresponde a un paso de `0.1`
- **THEN** se rechaza la operación
- **AND** se conserva el último valor confirmado

### Requirement: cambiar la puntuación actualiza el título
El sistema MUST actualizar `SavedTitle.updatedAt` tanto al establecer o cambiar una puntuación personal como al quitarla, y MUST evitar que una secuencia de ediciones confirmadas haga retroceder ese único reloj o pierda su orden lógico por colisiones de resolución temporal.

#### Scenario: asignar o cambiar
- **WHEN** la puntuación cambia de `null` a `8.7` o de `8.7` a `8.8`
- **THEN** se persiste el nuevo valor y un `updatedAt` correspondiente a la edición

#### Scenario: quitar puntuación
- **WHEN** la puntuación cambia de `9.1` a `null`
- **THEN** se persiste “Sin calificar” y se actualiza `updatedAt`

#### Scenario: dos cambios confirmados inmediatos
- **GIVEN** un título con `personalRating: 87` y `updatedAt: T`
- **WHEN** se confirman inmediatamente cambios a `88` y luego a `89`
- **THEN** el valor final es `89`
- **AND** el `updatedAt` final representa la última edición y no es anterior al de la edición a `88`
- **AND** si el merge necesita distinguir estrictamente ambas ediciones, una colisión del reloj no las vuelve indistinguibles

### Requirement: TMDB y puntuación personal permanecen separadas
El sistema MUST conservar `voteAverage` como puntuación TMDB y `personalRating` como puntuación personal, y MUST mostrarlas con fuente y significado inequívocos.

#### Scenario: detalle con ambas puntuaciones
- **GIVEN** un título con puntuación personal `8.7` y TMDB `7.9`
- **WHEN** se abre el detalle completo
- **THEN** se muestran por separado “Tu puntuación 8.7 / 10” y “TMDB 7.9 / 10”

#### Scenario: valores ausentes independientes
- **WHEN** una de las dos puntuaciones está ausente
- **THEN** su ausencia se presenta sin ocultar ni alterar la otra puntuación

### Requirement: volver a guardar desde TMDB preserva metadata personal
El sistema MUST preservar `id`, `createdAt`, `status`, `tags`, `notes` y `personalRating` al volver a guardar un `SavedTitle` existente desde TMDB, mientras actualiza únicamente metadata proveniente de TMDB y el `updatedAt` según la semántica vigente.

#### Scenario: re-save de título personalizado
- **GIVEN** un título TMDB existente con estado, tags, notas y puntuación personal editados
- **WHEN** el usuario vuelve a guardarlo desde su detalle TMDB
- **THEN** se actualizan `title`, `year`, `posterUrl`, `overview`, `genres` y `voteAverage` con los datos TMDB disponibles
- **AND** se conservan sin cambios `id`, `createdAt`, `status`, `tags`, `notes` y `personalRating`

#### Scenario: TMDB sin vote average
- **WHEN** el re-save recibe una puntuación TMDB ausente
- **THEN** `voteAverage` puede quedar en `null`
- **AND** `personalRating` permanece intacto

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
- **AND** el contenedor principal incorpora la puntuación en su etiqueta accesible
- **AND** el badge visual queda fuera del árbol accesible para evitar un anuncio duplicado o un target adicional
- **AND** la pill permanece como metadata pasiva, sin rol de botón ni nuevo control interactivo

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

### Requirement: el editor es accesible y responsive
El sistema MUST ofrecer ajuste exacto en todo el rango sin presentar 91 botones, MUST anunciar el valor actual, MUST ofrecer acciones claramente etiquetadas para incrementar, disminuir y quitar, y MUST ser operable con teclado web y targets táctiles razonables.

#### Scenario: interacción accesible
- **WHEN** una persona navega el editor mediante lector de pantalla, teclado o tacto
- **THEN** puede conocer el valor actual, cambiarlo en pasos de `0.1` y quitarlo mediante acciones diferenciadas

#### Scenario: ancho reducido y web
- **WHEN** el editor se usa en un móvil angosto o en web
- **THEN** mantiene legibles el valor, los controles y sus estados sin rediseñar la pantalla completa

### Requirement: cambios rápidos convergen a la última intención
El sistema MUST reflejar optimísticamente los cambios rápidos permitidos por el editor, MUST serializar su persistencia, MUST converger a la última intención, MUST conservar el orden lógico de sus `updatedAt` confirmados y MUST revertir sólo el último fallo todavía relevante.

#### Scenario: secuencia rápida
- **WHEN** el usuario realiza `null → 8.7 → 8.8 → 9.1 → null` antes de completar todas las escrituras
- **THEN** la UI converge a `null`
- **AND** el storage final coincide con la última intención confirmada

#### Scenario: falla una intención superada
- **WHEN** falla una escritura que ya fue reemplazada por una intención posterior
- **THEN** esa falla no restaura un valor obsoleto sobre la intención más reciente

#### Scenario: falla la última intención
- **WHEN** falla la última escritura relevante
- **THEN** la UI vuelve al último valor confirmado y comunica el error

### Requirement: una escritura no resucita títulos eliminados
El sistema MUST actualizar únicamente un título existente y MUST fallar limpiamente si fue eliminado antes de aplicar una escritura pendiente de puntuación.

#### Scenario: borrado durante write pendiente
- **GIVEN** una escritura de puntuación pendiente
- **WHEN** el título se elimina antes de que la escritura pueda aplicarse
- **THEN** la escritura no inserta ni recrea el `SavedTitle`
- **AND** el fallo se resuelve sin corromper otros títulos
