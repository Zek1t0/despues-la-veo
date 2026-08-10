# library-backup-integrity Specification

## Purpose
TBD - created by archiving change protect-library-data-integrity. Update Purpose after archive.
## Requirements
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

El sistema MUST evitar toda modificación de SQLite cuando la estructura principal del backup sea inválida o su versión no sea 1, 2 ni 3.

#### Scenario: exportedAt ausente

- **GIVEN** un backup versión 1, 2 o 3 que omite `exportedAt`
- **WHEN** se valida el archivo
- **THEN** la envoltura sigue siendo válida

#### Scenario: exportedAt presente con tipo inválido

- **GIVEN** un backup versión 1, 2 o 3 cuyo `exportedAt` presente no es un `string`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo
- **AND** no se modifica la biblioteca

#### Scenario: JSON inválido

- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada

- **GIVEN** un backup cuya versión no es 1, 2 ni 3
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se informan las versiones compatibles

#### Scenario: corrupción estructural v3

- **GIVEN** una envoltura v3 sin arrays `items` o `pins`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo antes de escribir
- **AND** no se modifica la biblioteca

### Requirement: mantener el alcance técnico existente

El cambio MUST mantener compatibilidad de importación con JSON versión 1, MUST incorporar JSON versión 2 y la evolución SQLite explícita para pins, y MUST evitar dependencias nuevas, cambios en TMDB o cambios visuales ajenos al fijado contextual y sus textos de backup.

#### Scenario: aplicación del cambio

- **GIVEN** que se implementan estos requisitos
- **WHEN** se revisan las modificaciones
- **THEN** la migración preserva `saved_titles`, `idx_saved_titles_provider_external` y `app_preferences`
- **AND** la identidad definitiva `provider + type + externalId` continúa diferida a un cambio posterior
- **AND** no se agregan dependencias ni se modifica la API de TMDB

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

### Requirement: el backup versión 3 transporta puntuaciones personales y pins
El sistema MUST exportar JSON versión 3 con `items` y `pins`, MUST incluir `personalRating` dentro de cada item, MUST identificar pins mediante `provider + externalId` y MUST mantener las preferencias locales fuera del backup.

#### Scenario: exportación v3
- **WHEN** el usuario exporta una biblioteca con títulos puntuados, sin calificar y pins contextuales
- **THEN** obtiene un backup `version: 3` con items que contienen `personalRating` numérico o `null`
- **AND** contiene todos los pins válidos bajo el contrato v2
- **AND** no contiene preferencias de vista

#### Scenario: ciclo completo v3
- **WHEN** un backup v3 se importa en una biblioteca vacía
- **THEN** se restauran títulos, puntuaciones personales y pins elegibles

### Requirement: v3 exige y valida la puntuación personal sin coerción
Cada item del backup v3 MUST contener la propiedad `personalRating`; el sistema MUST aceptar únicamente `null` o un entero entre `10` y `100` inclusive, y MUST rechazar y reportar el item si la propiedad está ausente o no cumple ese dominio.

#### Scenario: propiedad ausente en v3
- **WHEN** un item v3 omite la propiedad `personalRating`
- **THEN** el item se contabiliza como inválido y se reporta
- **AND** la ausencia no se normaliza silenciosamente como preservación del valor local

#### Scenario: valores válidos
- **WHEN** un item v3 contiene `personalRating: null`, `10`, `57`, `87` o `100`
- **THEN** el campo es válido

#### Scenario: valores inválidos
- **WHEN** un item v3 contiene `0`, `9`, `101`, `87.5`, un valor no finito, string, objeto o array
- **THEN** el item se contabiliza como inválido
- **AND** el valor no se clampa, redondea ni convierte

### Requirement: presencia y merge de personalRating preservan datos modernos
El sistema MUST normalizar `personalRating` como ausente únicamente para formatos anteriores que legítimamente no poseen el campo, principalmente v1/v2; MUST normalizar todo item v3 válido como presente con `null` o presente con número; y MUST aplicar el valor sólo cuando el item entrante es elegible por el contrato vigente de `updatedAt`.

#### Scenario: insert desde v1 o v2
- **WHEN** un título nuevo se importa desde v1 o v2, donde `personalRating` está ausente
- **THEN** se inserta con `personalRating: null`

#### Scenario: insert desde v3
- **WHEN** un título nuevo v3 contiene número o `null`
- **THEN** se inserta exactamente con ese valor

#### Scenario: incoming anterior o igual
- **WHEN** un item coincide localmente y su `updatedAt` es anterior o igual al local
- **THEN** se preserva el título local completo, incluida su puntuación personal

#### Scenario: incoming posterior con número presente
- **WHEN** un item coincidente y posterior contiene `personalRating` numérico
- **THEN** reemplaza la puntuación personal local

#### Scenario: incoming posterior con null presente
- **WHEN** un item coincidente y posterior contiene `personalRating: null`
- **THEN** borra la puntuación personal local

#### Scenario: incoming v1 o v2 posterior con campo ausente
- **WHEN** un item coincidente y posterior de v1 o v2 se normaliza con `personalRating` ausente
- **THEN** conserva la puntuación personal local

#### Scenario: reimportación idempotente
- **WHEN** el mismo backup se importa nuevamente y su `updatedAt` ya es igual al local
- **THEN** no vuelve a modificar la puntuación ni los demás campos

### Requirement: v3 conserva el merge aditivo de pins
El sistema MUST procesar primero los items y después los pins v3, y MUST aplicar sin cambios la validación contextual, identidad portable, merge aditivo e informes de pins definidos para v2.

#### Scenario: pin nuevo y pin existente en v3
- **WHEN** un backup v3 contiene un pin válido ausente y otro ya presente localmente
- **THEN** inserta el ausente y conserva el existente con su `pinnedAt` local

#### Scenario: pin semánticamente inválido en v3
- **WHEN** un pin v3 refiere un título inexistente, contexto inválido o tag no perteneciente
- **THEN** se omite y reporta sin impedir otros elementos elegibles
