## MODIFIED Requirements

### Requirement: las tarjetas de títulos en Mosaico priorizan el póster y una navegación única
El sistema MUST usar en los Mosaicos de Biblioteca, Buscar y una etiqueta abierta una tarjeta donde el póster sea el elemento predominante, ocupe visualmente casi toda la superficie y conserve una proporción aproximada `2:3`; la misma tarjeta MUST admitir los indicadores pasivos de tipo, pin contextual cuando corresponda y puntuación personal cuando la superficie la proporciona explícitamente, sin inferir su contexto.

#### Scenario: composición visual de una tarjeta guardada con póster
- **WHEN** un título guardado con póster se muestra en el Mosaico de Biblioteca o de una etiqueta abierta
- **THEN** el indicador pequeño `Película` o `Serie` aparece en la esquina superior izquierda del póster
- **AND** el indicador contextual de pin, cuando corresponde, aparece en la esquina superior derecha
- **AND** la puntuación personal calificada aparece abajo a la izquierda, inmediatamente por encima del título
- **AND** el título aparece sobre la parte inferior del póster con una capa oscura o tratamiento de contraste equivalente
- **AND** el título ocupa como máximo dos líneas y se trunca de forma comprensible cuando no cabe
- **AND** tipo, pin contextual y puntuación personal son los únicos indicadores de metadata autorizados cuando corresponden a la superficie
- **AND** no se muestran año, estado, descripción, etiquetas ni ninguna metadata adicional no autorizada

#### Scenario: pin y puntuación simultáneos
- **WHEN** un título guardado está fijado en el contexto visible y además tiene puntuación personal
- **THEN** los indicadores de pin y puntuación aparecen simultáneamente en sus posiciones respectivas
- **AND** ninguno reemplaza ni cambia el significado del otro

#### Scenario: título guardado sin puntuación
- **WHEN** un título guardado con `personalRating: null` aparece en Mosaico
- **THEN** no aparece la pill de puntuación
- **AND** no queda un hueco visual reservado para ella

#### Scenario: Buscar en Mosaico no recibe metadata personal
- **WHEN** un resultado remoto se muestra en el Mosaico de Buscar
- **THEN** conserva el indicador de tipo y el título inferior
- **AND** no muestra puntuación personal ni indicador contextual de pin

#### Scenario: interacción de la tarjeta de mosaico
- **WHEN** el usuario interactúa con una tarjeta del Mosaico de Biblioteca, una etiqueta abierta o Buscar
- **THEN** la tarjeta completa es la única acción de navegación
- **AND** el tipo, pin y puntuación visibles son indicadores pasivos
- **AND** no contiene acciones, botones ni zonas táctiles secundarias

#### Scenario: tarjeta guardada con póster ausente o fallido
- **WHEN** un título guardado sin póster o cuya imagen falla se muestra en el Mosaico de Biblioteca o de una etiqueta abierta
- **THEN** un placeholder neutro ocupa la misma estructura predominante y proporción aproximada `2:3`
- **AND** conserva el indicador de tipo, la puntuación si existe, el pin contextual si corresponde y el título inferior
- **AND** la tarjeta completa continúa siendo la única acción de navegación

#### Scenario: resultado de Buscar con póster ausente o fallido
- **WHEN** un resultado sin póster o cuya imagen falla se muestra en el Mosaico de Buscar
- **THEN** un placeholder neutro conserva el indicador de tipo y el título inferior con la misma estructura
- **AND** no muestra puntuación personal ni indicador contextual de pin
- **AND** la tarjeta completa continúa siendo la única acción de navegación
