## Purpose

Mostrar clasificaciones y advertencias de cada fuente con su significado original, y permitir ocultar contenido marcado explícitamente sin borrar datos de la biblioteca.

## ADDED Requirements

### Requirement: Clasificación y advertencias con fuente
El sistema MUST presentar edad, guía y marca sensible disponibles con su proveedor y sin equivalencia argentina inventada. MUST distinguir marca sensible, edad y otras advertencias; nsfw MUST NOT representar automáticamente todas las formas de contenido adulto y datos desconocidos MUST NOT interpretarse como aptitud garantizada.

#### Scenario: Edad y marca distintas
- **WHEN** Kitsu devuelve ageRating R y una guía pero no marca sensible explícita
- **THEN** se muestran los datos de Kitsu sin convertir R a una edad argentina ni ocultar automáticamente la obra por esa clasificación

### Requirement: Catálogo visible por defecto y filtro reversible
El sistema MUST mantener por defecto todo el catálogo visible. Con el filtro opcional activado MUST ocultar de búsqueda, descubrimiento existente y listas de biblioteca solo contenido marcado sensible por una fuente con semántica explícita documentada, sin borrarlo ni modificarlo. MUST mantener desconocidos visibles, indicar que el filtro no garantiza cobertura y ofrecer acceso deliberado a una ficha guardada oculta con aviso y opción de mostrarla. El filtro MUST NOT reducir el alcance de exportación ni revisión global.

#### Scenario: Filtro desactivado
- **WHEN** se usa la configuración inicial o se desactiva el filtro
- **THEN** se muestran contenidos marcados y no marcados sin perder estado, pins ni datos

#### Scenario: Filtro activo con datos incompletos
- **WHEN** una lista mezcla sensible=true, sensible=false y sensible desconocido
- **THEN** solo se oculta el primero, se informa el filtrado y no se afirma que los restantes sean aptos para menores

#### Scenario: Fuente sin capacidad de filtrado remoto
- **WHEN** un proveedor no puede filtrar o carece de marca conocida en una respuesta
- **THEN** se aplica filtrado local sobre señales ya disponibles sin consultas por cada resultado ni prometer cobertura remota completa
