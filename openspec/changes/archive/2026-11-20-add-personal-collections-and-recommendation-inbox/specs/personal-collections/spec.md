## Purpose

Permitir agrupar títulos ya guardados en colecciones personales locales, independientes de las etiquetas y sin duplicar obras ni alterar los datos de Biblioteca.

## ADDED Requirements

### Requirement: Colecciones personales editables y vacías
El sistema MUST permitir crear, renombrar, editar descripción opcional y eliminar colecciones offline, con ID estable y fechas de creación/modificación. MUST admitir colecciones vacías y nombres repetidos sin fusionarlas. MUST rechazar nombres vacíos tras quitar espacios exteriores y entradas malformadas sin perder el formulario ni presentar éxito falso. Eliminar MUST requerir confirmación y MUST borrar solo colección y membresías, nunca títulos ni sus personales.

#### Scenario: Crear editar y vaciar
- **WHEN** se crea una colección sin descripción, se renombra y se retira su último título
- **THEN** conserva identidad, nombre editado y existencia aunque esté vacía

#### Scenario: Nombre inválido y cancelación
- **WHEN** se intenta guardar un nombre solo de espacios o se cancela la confirmación de borrado
- **THEN** no se altera la colección persistida ni se pierde el texto editable

#### Scenario: Borrar una colección poblada
- **WHEN** se confirma eliminar una colección con títulos compartidos con otra
- **THEN** desaparece solo esa colección y sus membresías, conservando Biblioteca, la otra colección y todos los datos personales

### Requirement: Membresías múltiples sin copias de títulos
El sistema MUST permitir agregar y retirar títulos desde cada colección y gestionar sus colecciones desde la ficha local guardada. MUST reutilizar el ID local existente, permitir varias colecciones por título y evitar duplicar una membresía al repetir una acción. MUST mantener independientes etiquetas y pins, sin introducir pins de colección. MUST rechazar títulos o colecciones inexistentes y eliminar las membresías de un título borrado de Biblioteca sin borrar sus colecciones.

#### Scenario: Gestión desde ambos puntos
- **WHEN** se agrega el mismo título desde su ficha a dos colecciones y se repite el agregado desde una de ellas
- **THEN** existe un solo título y una membresía por pareja, y retirar una conserva la otra

#### Scenario: Borrado concurrente o miembro ausente
- **WHEN** el título deja de existir antes de confirmar el agregado
- **THEN** se informa el cambio sin membresía huérfana, copia del título ni éxito falso

### Requirement: Orden y portada derivados de contenido visible
El sistema MUST ofrecer incorporación más reciente primero y título A–Z, con desempates estables, sin orden manual ni arrastre. MUST derivar la portada del miembro visible más recientemente incorporado con arte permitido y utilizable, independiente del orden de lectura; si ninguno sirve MUST usar placeholder. MUST aplicar filtro sensible y proyección/validación de arte vigentes sin nuevas consultas por miembro, sin portada de un título oculto ni inferir que desconocidos son aptos. MUST distinguir colección vacía de colección sin miembros visibles y conservar todos sus datos en backup. Las preferencias de orden MUST permanecer locales e independientes de Biblioteca.

#### Scenario: Cambiar orden o visibilidad
- **WHEN** se alterna A–Z e incorporación y se activa el filtro sensible
- **THEN** el listado se reordena de forma determinista, la portada solo usa miembros visibles permitidos y ningún título pierde su membresía

#### Scenario: Sin arte utilizable
- **WHEN** una colección está vacía, todos sus miembros están ocultos o sus imágenes fallan
- **THEN** muestra placeholder y un estado comprensible sin revelar arte oculto ni bloquear sus acciones

### Requirement: Organizar conserva la navegación y accesibilidad existentes
Biblioteca MUST ofrecer «Organizar» con acceso a «Colecciones» y «Bandeja de recomendaciones», manteniendo las cinco pestañas. En S1 MUST ofrecer Colecciones funcionales e indicar claramente que Bandeja aún no está disponible, sin capturas simuladas; desde S2 ambas MUST funcionar. MUST conservar Mosaico, vista Detalle y «¿Qué veo hoy?»; la nueva acción de ficha MUST integrarse en organización personal sin rediseñar la ficha ni añadir controles a tarjetas. Las nuevas superficies MUST reutilizar temas/paletas, textos españoles, estados de carga/error/vacío y controles accesibles Android/Web, sin depender de hover, color o gestos exclusivos.

#### Scenario: Pantalla estrecha y fuente ampliada
- **WHEN** se usa Organizar en Android o Web a 320 px de ancho con escala de fuente 200 por ciento
- **THEN** nombres, acciones, formularios y confirmaciones permiten completar el flujo sin solapamientos ni controles inaccesibles, con scroll cuando corresponda

#### Scenario: Teclado y regreso
- **WHEN** se navega en Web con teclado o se vuelve en Android desde una colección
- **THEN** los controles tienen nombre y foco visibles, se regresa a Organizar/Biblioteca de forma predecible y las cinco pestañas y sus comportamientos previos se conservan

### Requirement: Persistencia aditiva recuperable
La actualización MUST conservar todos los títulos, identidades, datos personales, metadata, actividad y preferencias existentes sin red ni reset. MUST asignar IDs estables a las nuevas colecciones, validar integridad antes de publicar la evolución y revertir completamente un fallo. Las mutaciones MUST ser recuperables e idempotentes ante reintentos; una lectura fallida MUST mostrarse como error recuperable, no como colección vacía confirmada.

#### Scenario: Instalación anterior y reapertura
- **WHEN** se actualiza una instalación con datos históricos y luego se reinicia
- **THEN** conserva los datos previos y las colecciones nuevas, sin repetir migración ni generar duplicados

#### Scenario: Fallo de escritura o evolución
- **WHEN** falla una operación antes de confirmarse
- **THEN** permanece el último estado íntegro y se permite reintentar sin registros parciales ni publicación de versión fallida
