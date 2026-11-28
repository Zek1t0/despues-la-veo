## MODIFIED Requirements

### Requirement: Organizar conserva la navegación y accesibilidad existentes
Biblioteca MUST ofrecer accesos a Colecciones y Bandeja de recomendaciones, con retorno predecible y compatibilidad para la ruta Organizar existente. Ambos destinos MUST estar disponibles y funcionales. MUST conservar Mosaico, vista Detalle y «¿Qué veo hoy?»; la acción de ficha MUST abrir el selector de membresías compartido entre el acceso rápido y Mi registro, y las tarjetas conservan su acceso principal. Las nuevas superficies MUST reutilizar temas/paletas, textos españoles, estados de carga/error/vacío y controles accesibles Android/Web, sin depender de hover, color o gestos exclusivos.

#### Scenario: Pantalla estrecha y fuente ampliada
- **WHEN** se usa Organizar en Android o Web a 320 px de ancho con escala de fuente 200 por ciento
- **THEN** nombres, acciones, formularios y confirmaciones permiten completar el flujo sin solapamientos ni controles inaccesibles, con scroll cuando corresponda

#### Scenario: Teclado y regreso
- **WHEN** se navega en Web con teclado o se vuelve en Android desde una colección
- **THEN** los controles tienen nombre y foco visibles, se regresa a Organizar/Biblioteca de forma predecible y los destinos de organización permanecen operables desde Biblioteca
