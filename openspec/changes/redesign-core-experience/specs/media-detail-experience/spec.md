## MODIFIED Requirements

### Requirement: Jerarquía de ficha según el origen

La ficha MUST abrir con identidad, título según idioma, tipo, año y género disponibles, portada y backdrop permitido cuando exista. La ficha local MUST destacar estado y accesos compartidos a puntuación y colecciones. MUST ofrecer Resumen, Mi registro e Información con encabezado común. Resumen MUST presentar el progreso aplicable antes de la sinopsis. Mi registro MUST ofrecer puntuación, notas, etiquetas y colecciones con edición bajo demanda. Información MUST preservar procedencia, atribución y detalles aplicables. Fijar, actualizar metadata, editar o borrar MUST estar disponibles según origen, contexto y elegibilidad.

#### Scenario: Ficha guardada o manual
- **WHEN** se abre un título local incluso offline
- **THEN** el usuario identifica la obra, consulta estado, posición y marcas cuando aplican y puede abrir los mismos editores desde sus accesos rápidos y secciones

#### Scenario: Ficha remota disponible o restringida
- **WHEN** se abre una ficha de proveedor
- **THEN** la acción principal es Guardar o Abrir en Biblioteca según identidad local resuelta y se conservan atribución, acciones propias, avisos, reintento pertinente y retorno al Inbox cuando aplique

#### Scenario: Formato y arte faltante
- **WHEN** se abre una película, un one-shot o literatura sin arte
- **THEN** se presenta un fallback y solo los controles que admite la clasificación. La literatura serializada elegible permite unidades manuales y no presenta cursor

#### Scenario: Seguimiento vacío o sensible
- **WHEN** se abre un título elegible sin inventario o con contenido protegido
- **THEN** hay un único vacío pertinente con acción útil y sin 0/0. La protección se aplica antes de revelar arte o detalles
