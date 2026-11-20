# media-detail-experience Specification

## Purpose

Ordenar las fichas multimedia para que la identidad y las acciones habituales se encuentren antes de la información secundaria.

## Requirements

### Requirement: Jerarquía de ficha según el origen

La ficha MUST presentar primero identidad y arte disponible. En fichas guardadas MUST seguir con estado y acciones personales, organización personal y, después, ficha editorial y procedencia. Las acciones y avisos existentes MUST seguir accesibles según origen y disponibilidad.

#### Scenario: ficha guardada o manual
- **WHEN** el usuario abre una ficha local, incluso sin conexión
- **THEN** puede identificar el título y encontrar estado, puntuación, pin cuando corresponda, etiquetas y notas antes de la sección editorial
- **AND** conserva las acciones de edición y los avisos aplicables, incluida la protección previa a revelar contenido oculto

#### Scenario: ficha remota disponible o restringida
- **WHEN** el usuario abre una ficha remota
- **THEN** encuentra su acción de guardado o apertura local cuando corresponda y conserva atribución, datos y acciones propias del proveedor
- **AND** si el proveedor está restringido o la lectura falla, el estado informa la situación y ofrece reintento solo cuando corresponda
