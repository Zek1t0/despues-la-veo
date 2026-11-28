## MODIFIED Requirements

### Requirement: Ficha y resúmenes accesibles coherentes
La ficha local MUST incluir «Mi progreso» en acciones personales antes de la ficha editorial, con posición destacada y separada de las marcas, esquema comprensible y acceso a registrar/editar, suma elegible y restablecer bajo demanda. MUST distinguir carga, nunca registrado, restablecido, incompatibilidad y fallo recuperable; una lectura fallida MUST NOT mostrarse como ausencia confirmada. Biblioteca MUST mostrar una línea en Detalle y texto discreto en Mosaico sin superponer póster, rating o estado; miembros de Colecciones MUST reutilizar esa representación del mismo título sin copia. Biblioteca y Colecciones MUST omitir únicamente el valor del cursor si no hay una posición aplicable. Una posición histórica incompatible MUST conservarse con explicación en ficha y su resumen MUST identificar la incompatibilidad cuando corresponda, sin presentarla como avance aplicable. Las marcas granulares MUST seguir visibles según sus reglas vigentes incluso con cursor ausente, restablecido o incompatible. Ambas representaciones MUST usar lecturas agrupadas e independientes y conservar filtros sensibles y retornos según la navegación principal vigente. Web/Android MUST permitir 320 px, fuente 200 %, scroll, teclado, foco visible y lectores de pantalla con acciones nombradas y resultado anunciado. Las superficies montadas MUST actualizarse solo tras commit, sin perder borradores ni mostrar resultados obsoletos.

#### Scenario: Cambio visible en varias superficies
- **WHEN** se confirma una corrección en ficha
- **THEN** Biblioteca y Colecciones muestran la misma posición confirmada sin modificar membresías ni exigir reiniciar

#### Scenario: Accesibilidad y carga fallida
- **WHEN** se usa tema claro/oscuro con pantalla estrecha y fuente ampliada o falla la lectura
- **THEN** se puede operar con teclado/lector sin solapamientos y se ofrece reintentar conservando el último dato confirmado

#### Scenario: Combinaciones independientes en Biblioteca y Colecciones
- **WHEN** se consulta un título con solo cursor aplicable, solo marcas, ambos, o ninguno
- **THEN** se muestra respectivamente el cursor, las marcas, ambos con etiquetas independientes, o ningún resumen de progreso
- **AND** un cursor restablecido deja visibles las marcas existentes y los recuentos y etiquetas accesibles coinciden entre superficies

#### Scenario: Cursor incompatible con marcas
- **WHEN** un título conserva una posición incompatible y tiene unidades marcadas
- **THEN** se muestran las marcas con su propia etiqueta y la ficha conserva la posición histórica con su explicación de incompatibilidad
