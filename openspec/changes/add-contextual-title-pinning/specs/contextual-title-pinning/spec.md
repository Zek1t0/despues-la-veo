## Purpose

Permitir que el usuario mantenga títulos importantes al comienzo de Biblioteca o de una etiqueta concreta mediante estados de fijado independientes, accesibles y coherentes en web y móvil.

## ADDED Requirements

### Requirement: los pins son independientes por contexto

El sistema MUST mantener un estado de fijado independiente para Biblioteca y para cada etiqueta exacta a la que pertenece un título, sin propagar ese estado entre contextos.

#### Scenario: fijar sólo en Biblioteca
- **WHEN** el usuario fija un título en Biblioteca
- **THEN** el título queda fijado en Biblioteca
- **AND** no queda fijado en ninguna etiqueta por esa acción

#### Scenario: fijar en una etiqueta
- **WHEN** el usuario fija un título dentro de una etiqueta concreta
- **THEN** el título queda fijado sólo en esa etiqueta
- **AND** no cambia su estado en Biblioteca ni en otras etiquetas

#### Scenario: múltiples contextos simultáneos
- **WHEN** un título está fijado en Biblioteca y en más de una etiqueta
- **THEN** cada contexto conserva y permite cambiar su estado independientemente

### Requirement: pinning prioriza sin cambiar pertenencia

El sistema MUST aplicar búsqueda y filtros antes de priorizar pins, MUST colocar primero los fijados del contexto visible y MUST ordenar fijados y no fijados por separado con el criterio que ya corresponde a esa vista.

#### Scenario: Biblioteca con sort activo
- **WHEN** Biblioteca contiene títulos fijados y no fijados que pasan búsqueda y filtros
- **THEN** muestra primero los fijados de Biblioteca usando el sort activo
- **AND** muestra después los no fijados usando el mismo sort

#### Scenario: fijado excluido por búsqueda
- **WHEN** un título fijado no coincide con la búsqueda actual
- **THEN** no aparece solamente por estar fijado

#### Scenario: fijado excluido por filtro
- **WHEN** un título fijado no cumple un filtro de estado o tipo
- **THEN** no aparece solamente por estar fijado

#### Scenario: limpiar búsqueda o filtro
- **WHEN** el usuario elimina la condición que excluía un título todavía fijado
- **THEN** el título reaparece dentro del grupo fijado al comienzo del resultado

#### Scenario: lista abierta de etiqueta
- **WHEN** el usuario abre una etiqueta con títulos fijados y no fijados
- **THEN** ve primero los pins de esa etiqueta usando el orden propio actual de sus títulos
- **AND** ve después los no fijados usando ese mismo orden
- **AND** no se heredan el sort ni los pins de Biblioteca

#### Scenario: collage de etiqueta
- **WHEN** una etiqueta contiene títulos fijados
- **THEN** su collage conserva el criterio actual de selección y orden de imágenes
- **AND** los pins sólo afectan la lista abierta de títulos

### Requirement: las vistas Detalle ofrecen una acción individual contextual

El sistema MUST permitir fijar y desfijar cada título desde las vistas Detalle mediante una acción separada de la zona de navegación, utilizable sin hover y sin controles táctiles anidados.

#### Scenario: acción en Biblioteca
- **WHEN** el usuario ve un título en Detalle de Biblioteca
- **THEN** dispone de una acción corta `Fijar` o `Desfijar`
- **AND** su etiqueta accesible dice `Fijar en Biblioteca` o `Desfijar de Biblioteca`

#### Scenario: acción dentro de etiqueta
- **WHEN** el usuario ve un título en Detalle de la etiqueta `Acción`
- **THEN** dispone de una acción corta `Fijar` o `Desfijar`
- **AND** su etiqueta accesible dice `Fijar en Acción` o `Desfijar de Acción`

#### Scenario: navegación y acción separadas
- **WHEN** el usuario interactúa con la acción de pin de una fila Detalle
- **THEN** cambia el pin del contexto visible sin abrir el título
- **AND** la acción no está anidada dentro del control que abre el título

### Requirement: Mosaico indica pins sin agregar otra acción

El sistema MUST conservar la tarjeta completa de Mosaico como única acción de navegación y MUST representar el estado fijado del contexto visible mediante un indicador visual contextual, reconocible y no interactivo que no parezca un botón.

#### Scenario: título fijado en Mosaico
- **WHEN** un título está fijado en el contexto visible y se muestra en Mosaico
- **THEN** aparece un indicador visual que permite reconocer su estado fijado en ese contexto
- **AND** el indicador no reemplaza ni oculta de forma impropia el tipo o título de la card
- **AND** la etiqueta accesible de la tarjeta informa el estado contextual

#### Scenario: interacción con badge de pin
- **WHEN** el usuario toca o hace clic sobre el área visual del badge
- **THEN** se ejecuta la única acción de la tarjeta para abrir el título
- **AND** no existe un control interactivo secundario

### Requirement: el detalle completo actúa sobre un origen validado

El sistema MUST conservar en la navegación el contexto de origen Biblioteca o etiqueta, MUST validarlo contra el título guardado y MUST usar Biblioteca como fallback explícito cuando el contexto falte o sea inválido.

#### Scenario: detalle abierto desde Biblioteca
- **WHEN** el usuario abre el detalle completo desde Biblioteca
- **THEN** la acción dice `Fijar en Biblioteca` o `Desfijar de Biblioteca`
- **AND** sólo cambia el pin de Biblioteca

#### Scenario: detalle abierto desde etiqueta válida
- **WHEN** el usuario abre el detalle desde la etiqueta `Acción` y el título todavía contiene exactamente esa etiqueta
- **THEN** la acción dice `Fijar en Acción` o `Desfijar de Acción`
- **AND** sólo cambia el pin de esa etiqueta

#### Scenario: recarga o deep link válido
- **WHEN** el detalle se reconstruye desde una URL con contexto válido
- **THEN** conserva la acción y el estado del contexto indicado

#### Scenario: contexto ausente o desconocido
- **WHEN** el detalle se abre sin contexto o con un tipo de contexto desconocido
- **THEN** usa explícitamente Biblioteca como contexto
- **AND** no mezcla pins de etiquetas

#### Scenario: etiqueta obsoleta
- **WHEN** la navegación indica una etiqueta que está vacía o que el título ya no contiene exactamente
- **THEN** el detalle usa explícitamente Biblioteca como fallback
- **AND** no crea un pin para la etiqueta obsoleta

### Requirement: errores de escritura no dejan un estado visual falso

El sistema MUST mantener utilizables las acciones de pin ante pulsaciones rápidas o fallos de persistencia y MUST representar finalmente el último estado confirmado.

#### Scenario: doble pulsación rápida
- **WHEN** el usuario solicita cambios de pin consecutivos antes de finalizar la primera escritura
- **THEN** las escrituras se resuelven en orden
- **AND** una respuesta antigua no sobrescribe visualmente una intención posterior confirmada

#### Scenario: escritura rechazada
- **WHEN** no se puede persistir un cambio de pin
- **THEN** la interfaz vuelve al último estado confirmado
- **AND** informa el fallo de forma comprensible
- **AND** el usuario puede volver a intentar la acción
