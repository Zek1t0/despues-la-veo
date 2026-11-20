## ADDED Requirements

### Requirement: Biblioteca identifica su entrada y resume la consulta activa

La pestaña y el encabezado normal MUST usar «Biblioteca». La pantalla MUST mostrar cantidad de resultados visibles, criterios aplicados y orden, con una acción para limpiar la consulta y filtros sin cambiar el orden ni la apariencia elegidos.

#### Scenario: filtros activos en Android y Web
- **WHEN** el usuario cambia la búsqueda o un filtro desde la cabecera o el panel
- **THEN** resumen, contador y lista reflejan los mismos criterios y no cuentan títulos ocultos como resultados visibles
- **AND** Limpiar vuelve a la consulta sin filtros y conserva orden y apariencia

#### Scenario: vacío, carga o fallo
- **WHEN** la Biblioteca está vacía, no coincide con los filtros o falla su lectura
- **THEN** distingue ambos vacíos de la carga y del error
- **AND** ofrece buscar o agregar manualmente si está vacía, limpiar criterios si excluyen los resultados y reintentar si falla la lectura

## MODIFIED Requirements

### Requirement: las tarjetas de títulos en Mosaico priorizan el póster y una navegación única

Biblioteca, Buscar y una etiqueta abierta MUST usar la misma estructura de tarjeta. La tarjeta completa MUST conservar una proporción aproximada 2:3 y usar la portada como fondo. El tipo, el pin contextual y la puntuación personal MUST ser pasivos. El pin y la puntuación MUST aparecer solo si la superficie los proporciona explícitamente, sin inferir su contexto. La tarjeta completa MUST abrir el detalle correspondiente.

#### Scenario: composición visual de una tarjeta guardada con póster
- **WHEN** se muestra un título guardado en Mosaico
- **THEN** la clasificación aparece arriba a la izquierda y el título se lee en una banda inferior de contraste con altura uniforme para la misma configuración de ancho y tamaño de texto, espacio para dos líneas y títulos de una línea alineados arriba
- **AND** si el título no cabe, se trunca de forma comprensible y conserva su nombre accesible completo
- **AND** la puntuación personal, si existe, se superpone a la esquina inferior derecha de la portada, encima de la banda del título
- **AND** el pin contextual aparece arriba a la derecha y se anuncia en la etiqueta accesible
- **AND** el Mosaico reserva puntuación pública, estado y demás metadata para otras vistas

#### Scenario: pin y puntuación simultáneos
- **WHEN** el título está fijado y tiene puntuación personal
- **THEN** ambos se distinguen sin superposición ni cambio de significado

#### Scenario: título guardado sin puntuación
- **WHEN** el título carece de puntuación personal
- **THEN** la portada omite el indicador sin reservar un hueco

#### Scenario: Buscar en Mosaico no recibe metadata personal
- **WHEN** Buscar muestra un resultado en Mosaico
- **THEN** la tarjeta muestra título y clasificación, sin pin ni puntuación personal

#### Scenario: interacción de la tarjeta de mosaico
- **WHEN** el usuario activa cualquier parte de una tarjeta por toque o teclado
- **THEN** abre su ficha y los indicadores carecen de acciones propias

#### Scenario: tarjeta guardada con póster ausente o fallido
- **WHEN** un título guardado carece de arte permitido o la carga falla
- **THEN** un placeholder neutro conserva la proporción, la banda, la clasificación, los indicadores aplicables y la navegación única

#### Scenario: resultado de Buscar con póster ausente o fallido
- **WHEN** un resultado remoto carece de arte permitido o la carga falla
- **THEN** un placeholder neutro conserva la proporción, el título, la clasificación y la navegación única
- **AND** no muestra pin ni puntuación personal

#### Scenario: tamaño de texto aumentado
- **WHEN** se usa texto grande en Android o zoom en Web
- **THEN** la banda y el número de columnas se adaptan sin superponer indicadores
- **AND** se puede consultar el título completo desde la ficha y mediante el nombre accesible
