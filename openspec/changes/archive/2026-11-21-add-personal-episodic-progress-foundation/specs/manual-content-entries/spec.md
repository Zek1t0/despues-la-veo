## MODIFIED Requirements

### Requirement: edición manual conserva identidad y datos personales
El sistema MUST permitir editar título, medio, familia, formato, año y resumen de entradas local-only desde su detalle local usando el mismo formulario. MUST preservar ID local, identidad portable o histórica, createdAt, status, tags, notas, rating personal, pins y progreso personal con su reloj propio; MUST avanzar updatedAt del título según el contrato vigente de edición manual. MUST validar combinaciones y MUST exigir revisar campos incompatibles al cambiar medio, sin borrar selecciones silenciosamente. Si la nueva clasificación vuelve incompatible un progreso activo, MUST impedir guardar hasta que el usuario elija cancelar, conservar la posición como incompatible sin convertirla, o restablecerla explícitamente; la elección y edición MUST confirmarse juntas sin estados parciales. Solo restablecer explícitamente MUST avanzar el reloj de progreso. Este flujo MUST NOT editar snapshots de entradas con referencias externas ni aplicar reglas de refresh remoto a correcciones manuales explícitas.

#### Scenario: corrección de formato conocido
- **WHEN** el usuario corrige explícitamente un manual de tv a ova y guarda
- **THEN** cambia el formato conservando identidades, createdAt, campos personales y progreso compatible

#### Scenario: cambio incompatible de medio
- **WHEN** un manual anime cambia a comic conservando familia anime
- **THEN** no se guarda hasta que el usuario confirme una clasificación compatible

#### Scenario: entrada importada histórica
- **WHEN** se edita una entrada manual histórica sin referencias externas
- **THEN** conserva su legacyIdentity exacta y sigue reimportándose por la identidad histórica

#### Scenario: progreso incompatible conservado
- **WHEN** un manual con episodio pasa a comic y el usuario elige conservar la posición
- **THEN** se guarda la clasificación y el episodio con su reloj intacto, visible como incompatible sin conversión a capítulo

#### Scenario: reset atómico y cancelación
- **WHEN** se elige restablecer progreso al cambiar clasificación y falla el commit o se cancela
- **THEN** permanecen íntegros la clasificación y el progreso previos
