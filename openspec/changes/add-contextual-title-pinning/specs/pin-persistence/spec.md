## Purpose

Conservar pins contextuales de forma relacional, íntegra y separada del contenido de cada título, protegiendo los datos existentes durante la evolución del esquema local.

## ADDED Requirements

### Requirement: cada pin identifica exactamente título y contexto

El sistema MUST persistir como máximo un pin por combinación de título, tipo de contexto y clave de contexto, MUST representar Biblioteca con una clave vacía y MUST representar una etiqueta con su string exacto no vacío después de aplicar `String.trim()` antes de persistir.

#### Scenario: pin de Biblioteca
- **WHEN** se fija un título en Biblioteca
- **THEN** se conserva un único estado con contexto `library` y clave vacía

#### Scenario: pin de etiqueta
- **WHEN** se fija un título dentro de la etiqueta `Acción`
- **THEN** se conserva un único estado con contexto `tag` y clave exacta `Acción`

#### Scenario: etiquetas con identidad diferente
- **WHEN** un título pertenece a etiquetas cuyos strings posteriores al trim difieren en mayúsculas o acentos
- **THEN** cada string puede mantener un pin independiente

#### Scenario: contexto inválido
- **WHEN** se intenta persistir Biblioteca con clave no vacía, una etiqueta con clave vacía o un tipo de contexto desconocido
- **THEN** la escritura se rechaza sin crear un pin

#### Scenario: etiqueta vacía después de String.trim
- **WHEN** la clave de una etiqueta contiene únicamente caracteres eliminados por `String.trim()`
- **THEN** la escritura se rechaza sin crear un pin

### Requirement: pinning no modifica el contenido actualizado del título

El sistema MUST persistir fijar y desfijar independientemente de las escrituras normales de `SavedTitle` y MUST conservar sin cambios su fecha de actualización.

#### Scenario: fijar título existente
- **WHEN** el usuario fija o desfija un título
- **THEN** cambia únicamente su estado contextual de pin
- **AND** `SavedTitle.updatedAt` conserva su valor anterior

#### Scenario: fecha de fijado
- **WHEN** se crea un pin nuevo
- **THEN** se conserva un `pinned_at` de tipo number, entero seguro según `Number.isSafeInteger` y mayor o igual que cero
- **AND** esa fecha determina la prioridad descendente dentro del grupo fijado del contexto visible
- **AND** no modifica la pertenencia ni el orden normal del grupo no fijado

#### Scenario: fecha de fijado inválida
- **WHEN** se intenta persistir un `pinned_at` decimal, infinito, `NaN`, negativo o fuera del rango entero seguro
- **THEN** la escritura se rechaza sin crear ni reemplazar un pin

### Requirement: sólo se admiten pins de etiquetas a las que pertenece el título

El sistema MUST validar la pertenencia exacta del título al contexto de etiqueta antes de crear el pin y MUST mantener la misma semántica actual de strings derivados sin crear entidades persistentes de etiqueta.

#### Scenario: etiqueta perteneciente al título
- **WHEN** el título contiene exactamente `Acción` después del trim exterior y se solicita fijarlo allí
- **THEN** se permite crear el pin contextual

#### Scenario: etiqueta ajena al título
- **WHEN** se solicita fijar un título en una etiqueta que no contiene exactamente
- **THEN** la escritura se rechaza sin crear el pin

#### Scenario: cambio de texto de etiqueta
- **WHEN** un título pierde `Acción` y agrega `Accion`
- **THEN** se elimina cualquier pin anterior de `Acción`
- **AND** no se transfiere automáticamente al nuevo string `Accion`

### Requirement: eliminar pertenencia o título limpia los pins relacionados

El sistema MUST eliminar explícitamente los pins que ya no puedan ser válidos cuando se quite una etiqueta o se borre un título.

#### Scenario: quitar etiqueta
- **WHEN** se quita una etiqueta de un título
- **THEN** se elimina también el pin de ese título para esa etiqueta
- **AND** se conservan sus pins de Biblioteca y de otras etiquetas

#### Scenario: borrar título
- **WHEN** se borra un título guardado
- **THEN** se eliminan todos sus pins contextuales
- **AND** no quedan pins huérfanos

### Requirement: SQLite evoluciona de versión 1 a versión 2 de forma segura

El sistema MUST incorporar la persistencia de pins mediante una evolución aditiva, transaccional, idempotente y verificada antes de establecer `user_version = 2`, preservando las estructuras y datos existentes.

#### Scenario: migración desde versión 1
- **WHEN** se abre una base válida con `user_version = 1`
- **THEN** se incorpora la estructura e índice requeridos para pins
- **AND** sólo después de verificarlos se establece `user_version = 2`
- **AND** se preservan `saved_titles`, sus índices, `app_preferences` y todos sus datos

#### Scenario: reapertura de versión 2
- **WHEN** se inicializa nuevamente una base ya migrada correctamente
- **THEN** la operación es idempotente
- **AND** no duplica ni altera títulos, preferencias o pins

#### Scenario: fallo durante migración
- **WHEN** falla la creación o verificación de cualquier estructura nueva
- **THEN** la transacción se revierte
- **AND** `user_version` no queda establecido en 2
- **AND** los datos anteriores permanecen intactos

#### Scenario: versión futura
- **WHEN** la aplicación encuentra una base con `user_version` mayor que 2
- **THEN** rechaza explícitamente la versión sin modificar la base

#### Scenario: integridad referencial habilitada
- **WHEN** se inicializa una conexión compatible
- **THEN** se habilita la integridad referencial de SQLite
- **AND** la limpieza explícita de repositorio continúa protegiendo las operaciones relacionadas

### Requirement: la persistencia rechaza resultados contextuales obsoletos

El sistema MUST verificar nuevamente la existencia del título y la pertenencia a una etiqueta al ejecutar una escritura, sin confiar exclusivamente en el estado de navegación o de pantalla.

#### Scenario: título borrado antes de escribir
- **WHEN** se solicita fijar un título que ya no existe
- **THEN** no se crea ningún pin
- **AND** se devuelve un fallo utilizable por la interfaz

#### Scenario: etiqueta quitada antes de escribir
- **WHEN** la pantalla todavía muestra una etiqueta pero el título la perdió antes de persistir el pin
- **THEN** no se crea el pin obsoleto
- **AND** los otros pins del título permanecen intactos
