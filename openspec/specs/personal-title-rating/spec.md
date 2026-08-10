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

### Requirement: edición concentrada y presentación pasiva
El sistema MUST permitir editar la puntuación solamente desde el detalle completo, MUST mostrarla pasivamente en Biblioteca Detail/list y Etiquetas Detail/list, y MUST excluir edición o presentación de Grid y Search en esta capacidad.

#### Scenario: edición desde detalle completo
- **WHEN** el usuario abre el detalle completo de un título
- **THEN** puede ver, ajustar con precisión `0.1` y quitar su puntuación

#### Scenario: filas de Biblioteca y Etiquetas
- **WHEN** el título aparece en una fila Detail/list de Biblioteca o Etiquetas
- **THEN** la puntuación personal se muestra como información pasiva y diferenciada de TMDB
- **AND** la fila no incorpora un control anidado de edición

#### Scenario: Grid y Search
- **WHEN** el título aparece en Grid o en Search
- **THEN** esta feature no añade rating ni controles de rating a esas superficies

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
