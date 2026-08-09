## ADDED Requirements

### Requirement: el backup versión 2 representa títulos y pins deliberados

El sistema MUST exportar JSON versión 2 con los títulos guardados y todos sus pins contextuales, MUST mantener las preferencias de vista fuera del backup y MUST identificar en cada pin su título por `provider + externalId` en vez del identificador local.

#### Scenario: exportación con pins contextuales
- **WHEN** el usuario exporta una biblioteca que contiene pins de Biblioteca y etiquetas
- **THEN** obtiene un backup `version: 2` con colecciones `items` y `pins`
- **AND** cada pin contiene identidad lógica del título, tipo de contexto, clave de contexto y `pinnedAt`
- **AND** no se exportan preferencias de apariencia u orden

#### Scenario: ciclo completo v2
- **WHEN** se exporta una biblioteca con títulos y pins y se importa en una biblioteca vacía
- **THEN** se restauran los títulos elegibles
- **AND** se restauran sus pins válidos en los contextos correspondientes

### Requirement: la importación versión 2 procesa títulos antes que pins

El sistema MUST resolver primero el merge y la identidad local final de los títulos y MUST procesar después cada pin contra el título resultante.

#### Scenario: identidad local cambia por colisión
- **WHEN** un título entrante obtiene un identificador local distinto durante el merge
- **THEN** sus pins se asocian al título resuelto por `provider + externalId`
- **AND** no dependen del identificador local incluido en el backup

#### Scenario: título referido inexistente
- **WHEN** un pin refiere una identidad lógica que no existe después de procesar títulos
- **THEN** el pin se omite y se reporta
- **AND** los demás elementos elegibles continúan procesándose

### Requirement: los pins importados se validan de forma contextual

El sistema MUST aceptar sólo tipos y claves de contexto válidos y MUST exigir que el título contenga exactamente la etiqueta referida por un pin de tag.

#### Scenario: pin válido de Biblioteca
- **WHEN** un pin refiere un título existente con contexto `library` y clave vacía
- **THEN** es elegible para el merge de pins

#### Scenario: pin válido de etiqueta
- **WHEN** un pin refiere un título existente con contexto `tag`, clave no vacía y etiqueta exacta perteneciente al título
- **THEN** es elegible para el merge de pins

#### Scenario: combinación contextual inválida
- **WHEN** un pin usa un contexto desconocido, Biblioteca con clave no vacía o tag con clave vacía
- **THEN** se omite y se reporta sin abortar los demás elementos

#### Scenario: etiqueta ausente
- **WHEN** un pin de tag refiere un string que el título no contiene exactamente
- **THEN** se omite y se reporta sin crear una etiqueta ni un pin huérfano

#### Scenario: pinnedAt inválido
- **WHEN** un pin contiene un `pinnedAt` que no es number, no cumple `Number.isSafeInteger`, es negativo, decimal, infinito, `NaN` o está fuera del rango entero seguro
- **THEN** se omite y se reporta sin sustituirlo silenciosamente por una fecha local

### Requirement: el merge de pins es aditivo e idempotente

El sistema MUST insertar pins válidos ausentes, MUST conservar sin cambios los pins locales coincidentes y MUST conservar los pins locales ausentes del backup.

#### Scenario: pin entrante nuevo
- **WHEN** un pin válido no existe localmente
- **THEN** se inserta con el `pinnedAt` del backup

#### Scenario: pin ya existente
- **WHEN** la misma combinación contextual ya existe localmente
- **THEN** se conserva la fila local
- **AND** no se reemplaza su `pinnedAt`

#### Scenario: pin local ausente del backup
- **WHEN** un pin local no aparece en el backup importado
- **THEN** permanece fijado
- **AND** la importación no lo interpreta como un desfijado

#### Scenario: importación repetida
- **WHEN** el mismo backup se importa más de una vez
- **THEN** no crea pins duplicados
- **AND** conserva los `pinnedAt` locales existentes

### Requirement: el resultado de importación informa problemas de pins

El sistema MUST separar en el resultado los pins insertados, conservados, inválidos y fallidos, y MUST evitar presentar una importación parcial como éxito total.

#### Scenario: resultado mixto de pins
- **WHEN** un backup v2 contiene pins nuevos, existentes, inválidos y fallidos
- **THEN** el resumen informa cada categoría con referencias seguras y motivos breves
- **AND** conserva los títulos y pins que sí pudieron persistirse

#### Scenario: corrupción estructural v2
- **WHEN** la envoltura v2 o su colección `pins` no cumple la estructura principal requerida
- **THEN** se rechaza el archivo completo antes de modificar SQLite
- **AND** se informa un error comprensible

## MODIFIED Requirements

### Requirement: el backup versión 1 representa todos los datos persistidos

El sistema MUST continuar importando sin pérdida todos los campos de título representados por JSON versión 1, MUST NOT importar pins desde esa versión ni interpretar su ausencia como un desfijado, y MUST mantener la integridad de los pins respecto de los tags que resulten del merge normal del título.

#### Scenario: ciclo completo

- **GIVEN** un título con todos los campos persistidos por el contrato v1
- **WHEN** el usuario lo exportó como v1 y lo importa en una biblioteca vacía
- **THEN** el título restaurado conserva todos esos campos
- **AND** no se intenta importar ninguna colección de pins desde v1

#### Scenario: v1 no desfija por ausencia de pins

- **GIVEN** un título local con pins de Biblioteca y tags que continúan perteneciendo al título después del merge
- **WHEN** se importa un backup v1 elegible que no contiene colección `pins`
- **THEN** se conservan esos pins válidos
- **AND** la ausencia de pins en v1 no se interpreta como un desfijado

#### Scenario: actualización v1 elimina pertenencia a etiqueta

- **GIVEN** un título local fijado en `Acción` cuya lista local de tags contiene `Acción`
- **AND** un item v1 elegible y más reciente reemplaza sus tags por una lista que no contiene `Acción`
- **WHEN** se aplica el merge normal del título
- **THEN** se elimina el pin de `Acción` porque ya no es válido
- **AND** se conservan sus pins de Biblioteca y de tags que continúan perteneciendo al título
- **AND** la limpieza se atribuye al cambio de pertenencia del `SavedTitle`, no a la ausencia de una colección `pins` en v1

### Requirement: rechazo seguro del archivo completo

El sistema MUST evitar toda modificación de SQLite cuando la estructura principal del backup sea inválida o su versión no sea 1 ni 2.

#### Scenario: exportedAt ausente

- **GIVEN** un backup versión 1 o 2 que omite `exportedAt`
- **WHEN** se valida el archivo
- **THEN** la envoltura sigue siendo válida

#### Scenario: exportedAt presente con tipo inválido

- **GIVEN** un backup versión 1 o 2 cuyo `exportedAt` presente no es un `string`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo
- **AND** no se modifica la biblioteca

#### Scenario: JSON inválido

- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada

- **GIVEN** un backup cuya versión no es 1 ni 2
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se informan las versiones compatibles

### Requirement: mantener el alcance técnico existente

El cambio MUST mantener compatibilidad de importación con JSON versión 1, MUST incorporar JSON versión 2 y la evolución SQLite explícita para pins, y MUST evitar dependencias nuevas, cambios en TMDB o cambios visuales ajenos al fijado contextual y sus textos de backup.

#### Scenario: aplicación del cambio

- **GIVEN** que se implementan estos requisitos
- **WHEN** se revisan las modificaciones
- **THEN** la migración preserva `saved_titles`, `idx_saved_titles_provider_external` y `app_preferences`
- **AND** la identidad definitiva `provider + type + externalId` continúa diferida a un cambio posterior
- **AND** no se agregan dependencias ni se modifica la API de TMDB
