# Integridad de backups de biblioteca

## ADDED Requirements

### Requirement: el backup versión 1 representa todos los datos persistidos

El sistema MUST exportar todos los campos persistidos y restaurarlos sin pérdida mediante JSON versión 1.

#### Scenario: ciclo completo

- **GIVEN** un título con todos sus campos persistidos
- **WHEN** el usuario lo exporta e importa en una biblioteca vacía
- **THEN** el título restaurado conserva todos esos campos

### Requirement: validar campos presentes y aplicar valores compatibles a los ausentes

El sistema MUST exigir `provider`, `externalId`, `type` y `title`, rechazar cualquier campo presente con tipo inválido y distinguir ausencia de `null` explícito.

#### Scenario: falta un campo obligatorio

- **GIVEN** un elemento sin `provider`, `externalId`, `type` o `title`
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se intenta escribirlo

#### Scenario: string obligatorio vacío

- **GIVEN** un elemento cuyo `externalId` o `title` es vacío después de aplicar `trim`
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se intenta escribirlo

#### Scenario: id presente vacío

- **GIVEN** un elemento que incluye `id` pero no es un `string` no vacío
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se intenta escribirlo

#### Scenario: un campo presente tiene tipo inválido

- **GIVEN** un elemento con cualquier campo presente cuyo tipo no cumple el contrato
- **WHEN** se valida el backup
- **THEN** el elemento completo se contabiliza como `invalid`
- **AND** el valor no se convierte silenciosamente en ausencia, `null` o valor predeterminado

#### Scenario: inserción con estado y colecciones ausentes

- **GIVEN** un elemento nuevo sin `status`, `tags` ni `genres`
- **WHEN** se importa
- **THEN** se inserta con `status: planned`, `tags: []` y `genres: []`

#### Scenario: inserción con campos anulables ausentes

- **GIVEN** un elemento nuevo sin `year`, `posterUrl`, `overview`, `voteAverage` ni `notes`
- **WHEN** se importa
- **THEN** se inserta con esos campos en `null`

#### Scenario: inserción con fechas ausentes

- **GIVEN** un elemento nuevo donde `createdAt` o `updatedAt` están ausentes
- **WHEN** se importa
- **THEN** se asignan fechas locales coherentes para la inserción

#### Scenario: inserción con fechas válidas

- **GIVEN** un elemento nuevo con `createdAt` y `updatedAt` presentes, finitos y no negativos
- **WHEN** se importa
- **THEN** se persisten las fechas entrantes

#### Scenario: inserción con fecha presente inválida

- **GIVEN** un elemento nuevo donde `createdAt` o `updatedAt` está presente pero no es un número finito y no negativo
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se genera una fecha local en reemplazo
- **AND** no se intenta escribirlo

#### Scenario: coincidencia con campos ausentes

- **GIVEN** un elemento coincidente y más reciente que omite `status`, `tags`, `genres`, `year`, `posterUrl`, `overview`, `voteAverage` o `notes`
- **WHEN** se actualiza la fila
- **THEN** se conservan los valores locales de todos los campos ausentes
- **AND** se conservan siempre `id` y `createdAt` locales

#### Scenario: borrado explícito permitido

- **GIVEN** un elemento coincidente y más reciente que contiene `null` explícito en `year`, `posterUrl`, `overview`, `voteAverage` o `notes`
- **WHEN** se actualiza la fila
- **THEN** el campo correspondiente se guarda como `null`

#### Scenario: null no permitido

- **GIVEN** un elemento que contiene `null` en un campo cuyo contrato no lo admite, como `status`, `tags` o `genres`
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`

### Requirement: proteger cambios locales mediante fechas

El sistema MUST usar un `updatedAt` entrante válido y posterior para habilitar una actualización del mismo título y tipo.

#### Scenario: backup más reciente

- **GIVEN** un elemento con el mismo `provider`, `externalId` y `type` que una fila local
- **AND** su `updatedAt` es válido y posterior
- **WHEN** se importa
- **THEN** se actualizan sólo sus campos presentes según el contrato
- **AND** se conservan `id` y `createdAt` locales
- **AND** se persiste el `updatedAt` entrante sin reemplazarlo por la hora de importación
- **AND** se contabiliza como `updated`

#### Scenario: fecha anterior o igual

- **GIVEN** un elemento coincidente del mismo tipo con `updatedAt` anterior o igual al local
- **WHEN** se importa
- **THEN** se conserva la fila local sin cambios
- **AND** se contabiliza como `skipped`

#### Scenario: updatedAt ausente en una coincidencia

- **GIVEN** un elemento coincidente del mismo tipo donde `updatedAt` está ausente
- **WHEN** se importa
- **THEN** no se considera más reciente
- **AND** se conserva la fila local
- **AND** se contabiliza como `skipped`

#### Scenario: updatedAt presente inválido en una coincidencia

- **GIVEN** un elemento coincidente donde `updatedAt` está presente pero no es un número finito y no negativo
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se escribe ningún cambio

#### Scenario: createdAt ausente en una coincidencia

- **GIVEN** un elemento coincidente donde `createdAt` está ausente
- **WHEN** se aplica una actualización válida por `updatedAt`
- **THEN** se conserva `createdAt` local

#### Scenario: createdAt presente inválido en una coincidencia

- **GIVEN** un elemento coincidente donde `createdAt` está presente pero no es un número finito y no negativo
- **WHEN** se valida el backup
- **THEN** el elemento se contabiliza como `invalid`
- **AND** no se escribe ningún cambio

### Requirement: bloquear conflictos de identidad por tipo

Mientras el esquema SQLite continúe usando `provider + externalId`, el sistema MUST impedir que una coincidencia de esa clave con distinto `type` sobrescriba datos.

#### Scenario: misma clave y mismo tipo

- **GIVEN** un elemento con el mismo `provider`, `externalId` y `type` que la fila local
- **WHEN** se importa
- **THEN** se aplica la política normal de fecha y campos

#### Scenario: misma clave y distinto tipo

- **GIVEN** un elemento con el mismo `provider` y `externalId` que una fila local
- **AND** su `type` es distinto
- **WHEN** se importa
- **THEN** no se escribe ningún campo del elemento
- **AND** se conserva la fila local
- **AND** se contabiliza como `conflicts`

### Requirement: informar antes de confirmar sin hacer un dry-run completo

El sistema MUST validar el archivo antes de confirmar y explicar el comportamiento general sin simular los resultados de SQLite.

#### Scenario: confirmación de importación

- **GIVEN** un backup JSON versión 1 con elementos válidos e inválidos
- **WHEN** termina la validación previa
- **THEN** se muestran las cantidades de válidos e inválidos
- **AND** se explica que el merge no borra títulos ausentes y protege coincidencias locales según tipo y fecha
- **AND** se advierte que el resultado puede ser parcial
- **AND** no se presentan como anticipados los conteos que dependen de escribir en SQLite

### Requirement: informar resultados reales y errores parciales

El sistema MUST procesar independientemente los elementos elegibles y describir el resultado real sin presentar una importación parcial como éxito total.

#### Scenario: resultado final mixto

- **GIVEN** un backup con resultados de distintas categorías
- **WHEN** finaliza la importación
- **THEN** se informan por separado `inserted`, `updated`, `skipped`, `conflicts`, `invalid` y `failed`

#### Scenario: elemento inválido, conflictivo o fallido

- **GIVEN** un elemento que no cumple el contrato, entra en conflicto de identidad o no puede persistirse
- **WHEN** finaliza la importación
- **THEN** el resultado conserva una referencia segura para reconocerlo
- **AND** incluye un motivo breve acorde a su categoría
- **AND** los demás elementos elegibles pueden procesarse

### Requirement: rechazo seguro del archivo completo

El sistema MUST evitar toda modificación de SQLite cuando la estructura principal del backup sea inválida o su versión no sea compatible.

#### Scenario: JSON inválido

- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada

- **GIVEN** un backup cuya versión no es 1
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se informa la versión esperada

### Requirement: mantener el alcance técnico existente

El cambio MUST mantener JSON versión 1 y el esquema SQLite actual, sin dependencias nuevas, cambios en TMDB ni cambios visuales ajenos a los textos de importación.

#### Scenario: aplicación del cambio

- **GIVEN** que se implementan estos requisitos
- **WHEN** se revisan las modificaciones
- **THEN** no existe una migración SQLite ni un cambio de índice
- **AND** la identidad definitiva `provider + type + externalId` queda diferida a un cambio posterior con migración explícita
