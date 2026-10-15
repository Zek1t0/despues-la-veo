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

El sistema MUST evitar toda modificación persistente cuando la estructura principal del backup sea inválida o su versión no sea 1, 2, 3 ni 4. La invalidez aislada de Appearance dentro de un v4 cuya biblioteca y pins sean procesables MUST NOT convertir el archivo completo en inválido.

#### Scenario: exportedAt ausente

- **GIVEN** un backup versión 1, 2, 3 o 4 que omite `exportedAt`
- **WHEN** se valida el archivo
- **THEN** la envoltura sigue siendo válida

#### Scenario: exportedAt presente con tipo inválido

- **GIVEN** un backup versión 1, 2, 3 o 4 cuyo `exportedAt` presente no es un `string`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo
- **AND** no se modifica la biblioteca, pins ni Appearance

#### Scenario: JSON inválido

- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca, pins ni Appearance
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada

- **GIVEN** un backup cuya versión no es 1, 2, 3 ni 4
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca, pins ni Appearance
- **AND** se informan las versiones compatibles

#### Scenario: corrupción estructural v3 o v4

- **GIVEN** una envoltura v3 o v4 sin arrays `items` o `pins`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo antes de escribir
- **AND** no se modifica la biblioteca, pins ni Appearance

#### Scenario: Appearance v4 incompatible no invalida biblioteca

- **GIVEN** un backup v4 con arrays procesables y una Appearance inválida o desconocida
- **WHEN** se valida el archivo
- **THEN** items y pins continúan elegibles para restauración
- **AND** Appearance se marca como no aplicable

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

### Requirement: el backup versión 4 transporta Appearance portable cuando es confiable

El sistema MUST exportar JSON versión 4 con `items`, `pins` y, cuando exista una intención local confiable, `appearance`. Appearance contiene únicamente la intención portable `scheme` + `palette`. Una row válida MUST aportar la última intención realmente confirmada como persistida; la ausencia válida de row MUST aportar el default contractual Dark + Original. Ante un error real de lectura sin `confirmedPersisted` confiable, el sistema MUST continuar exportando items/pins, MUST omitir Appearance y MUST NOT inventarla desde el fallback visual. El backup MUST NOT incluir effective scheme, scheme actual del sistema, colores resueltos ni la definición completa del theme, y MUST mantener fuera las preferencias Detalle/Mosaico y sorting.

#### Scenario: exportación v4
- **WHEN** el usuario exporta con scheme System y palette Lavanda
- **THEN** obtiene `version: 4` con `appearance: { scheme: "system", palette: "lavender" }`
- **AND** no exporta si el sistema está actualmente light o dark
- **AND** no exporta tokens ni preferencias de browsing

#### Scenario: ausencia válida usa default exportable
- **GIVEN** la lectura de `app_preferences` termina correctamente y no existe row de Appearance
- **WHEN** el usuario exporta
- **THEN** el backup v4 incluye Dark + Original como intención default contractual

#### Scenario: error real de lectura omite Appearance
- **GIVEN** la lectura de Appearance falla y no existe `confirmedPersisted` confiable en runtime
- **WHEN** el usuario exporta
- **THEN** el backup v4 sigue incluyendo items y pins
- **AND** omite `appearance`
- **AND** no serializa Dark + Original sólo porque sea el fallback visual
- **AND** puede informar que Appearance no fue incluida

#### Scenario: row inválida no se presenta como intención confirmada
- **GIVEN** la lectura termina pero la row de Appearance es inválida y no existe otro `confirmedPersisted` confiable
- **WHEN** el usuario exporta
- **THEN** el backup v4 continúa incluyendo items y pins
- **AND** puede omitir `appearance` en vez de exportar el fallback visual como una elección persistida

#### Scenario: round-trip v4 válido
- **WHEN** un backup v4 válido se importa exitosamente
- **THEN** restaura items y pins elegibles bajo sus contratos vigentes
- **AND** aplica y persiste la Appearance portable del backup

#### Scenario: v4 sin Appearance preserva intención local
- **GIVEN** un backup v4 procesable que omite `appearance`
- **WHEN** se importa exitosamente
- **THEN** restaura items y pins elegibles
- **AND** conserva Appearance local
- **AND** la ausencia no vuelve inválido al backup completo

### Requirement: backups anteriores conservan Appearance local

El sistema MUST continuar importando versiones 1, 2 y 3 bajo sus contratos existentes y MUST interpretar la ausencia histórica de Appearance como “no modificar Appearance local”.

#### Scenario: importación v1, v2 o v3
- **GIVEN** una Appearance local Manzana verde + Claro
- **WHEN** se importa exitosamente un backup v1, v2 o v3
- **THEN** la Appearance local permanece Manzana verde + Claro
- **AND** items, ratings y pins se procesan según la versión importada

### Requirement: Appearance se aplica después de confirmar la restauración

El sistema MUST aplicar y persistir Appearance de un v4 válido únicamente después de confirmar que la restauración correspondiente alcanzó un resultado exitoso según el contrato de importación. La selección visual MUST cambiar inmediatamente después de esa confirmación y MUST NOT adelantarse durante preview, confirmación o validación.

#### Scenario: usuario cancela importación
- **WHEN** el usuario selecciona un backup v4 pero cancela antes de restaurarlo
- **THEN** Appearance local no cambia

#### Scenario: archivo principal rechazado
- **WHEN** un backup v4 se rechaza por estructura principal inválida
- **THEN** Appearance local no cambia
- **AND** no se escriben items ni pins

#### Scenario: restauración confirmada
- **WHEN** la importación v4 válida termina con un resultado exitoso
- **THEN** se persiste su Appearance válida
- **AND** la UI adopta esa combinación inmediatamente

#### Scenario: selección posterior prevalece sobre merge tardío
- **GIVEN** el usuario confirma un v4 cuya Appearance es Lavanda
- **WHEN** el merge principal queda pendiente, el usuario selecciona Marea y después el merge termina exitosamente
- **THEN** items y pins elegibles se restauran normalmente
- **AND** Lavanda no se aplica ni se persiste por haber terminado tarde el merge
- **AND** displayed, `confirmedPersisted`, storage y reinicio permanecen en Marea

### Requirement: Appearance incompatible degrada de forma parcial y segura

Si items y pins de un backup v4 son restaurables pero el scheme o palette de Appearance es inválido, desconocido o incompatible con esta versión, el sistema MUST restaurar los datos elegibles, MUST conservar Appearance local y MUST informar por separado que la Appearance del backup no pudo aplicarse.

#### Scenario: palette de una versión futura
- **GIVEN** un backup v4 con items y pins válidos y una palette desconocida
- **WHEN** el usuario confirma la importación
- **THEN** se restauran items y pins elegibles
- **AND** se conserva Appearance local
- **AND** el resultado informa la incompatibilidad de Appearance

#### Scenario: scheme inválido
- **GIVEN** un backup v4 procesable cuyo scheme no es system, light ni dark
- **WHEN** se importa
- **THEN** la restauración prioritaria de biblioteca/pins puede completarse
- **AND** Appearance local permanece intacta
- **AND** el problema se reporta sin presentarlo como fallo de los títulos

### Requirement: el backup vigente representa MediaItems y referencias externas por separado
El sistema MUST conservar la interpretación histórica de un backup versión 5 y MUST exportar actualmente un backup versión 6 donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes.

#### Scenario: exportación de recursos TMDB con ID numérico compartido
- **GIVEN** una biblioteca que contiene `tmdb/movie/123` y `tmdb/tv/123` en MediaItems distintos
- **WHEN** el usuario exporta un backup
- **THEN** ambos items aparecen de forma independiente con sus referencias completas
- **AND** sus datos personales permanecen asociados al item correcto

#### Scenario: exportación de item local-only
- **GIVEN** un MediaItem sin referencias externas que se originó en la representación histórica `manual`
- **WHEN** se exporta el backup
- **THEN** el item se representa sin fabricar un proveedor externo
- **AND** incluye obligatoriamente su `legacyIdentity` estable

#### Scenario: el exporter actual no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas ni `legacyIdentity`
- **WHEN** la versión actual intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

#### Scenario: referencias internas portables
- **GIVEN** un MediaItem con pins contextuales
- **WHEN** se exporta el backup
- **THEN** cada pin refiere la identidad del item dentro del backup
- **AND** no usa una referencia de proveedor como única foreign key hacia el item

#### Scenario: round-trip con ID TMDB compartido entre namespaces
- **GIVEN** MediaItems distintos para `tmdb/movie/77` y `tmdb/tv/77`, cada uno con datos personales propios y ambos pineados en el mismo contexto
- **WHEN** se exporta backup v6 y se importa en una base vacía
- **THEN** el backup contiene dos identidades de item distintas y conserva ambas referencias externas completas
- **AND** cada pin apunta al `itemId` de su MediaItem correspondiente
- **AND** rating, tags, notas, status y pins se restauran en el MediaItem correcto
- **AND** ninguna relación se decide usando únicamente `provider + externalId`

### Requirement: la importación v5 resuelve primero los MediaItems y luego sus relaciones internas
El sistema MUST construir un mapa entre cada identidad de item del backup y el ID local final, MUST resolver o insertar MediaItems antes de importar pins y MUST usar ese mapa para restaurar las relaciones internas incluso cuando un ID entrante elegible deba remapearse.

#### Scenario: ID entrante disponible
- **WHEN** un item nuevo tiene un ID local válido y libre
- **THEN** el import conserva ese ID siempre que no contradiga otra identidad existente

#### Scenario: colisión de ID con referencia externa resoluble
- **GIVEN** un item entrante nuevo cuya referencia externa no existe localmente pero cuyo ID está ocupado por otro MediaItem
- **WHEN** se importa
- **THEN** recibe un ID local libre
- **AND** todos sus pins se asocian al ID final mediante el mapa de importación

#### Scenario: reimportación por referencia externa
- **GIVEN** un item v5 ya importado con un ID remapeado y una referencia externa
- **WHEN** se importa nuevamente el mismo backup
- **THEN** se resuelve el mismo MediaItem por su referencia externa completa
- **AND** no se crea un duplicado

#### Scenario: reimportación local-only por identidad legacy
- **GIVEN** un item v5 local-only originado en `manual` que ya fue importado
- **WHEN** se importa nuevamente con la misma `legacyIdentity`
- **THEN** resuelve el mismo MediaItem aunque su ID haya sido remapeado en el primer import
- **AND** no crea un duplicado ni convierte `manual` en ProviderReference

#### Scenario: item local-only con identidad ocupada por otro item
- **GIVEN** un item entrante sin referencias externas ni identidad legacy cuyo ID ya pertenece a otro MediaItem
- **WHEN** se importa
- **THEN** el item se reporta como conflicto
- **AND** el sistema no remapea el item ni infiere equivalencia por título, año o similitud del snapshot
- **AND** no sobrescribe al ocupante ni reasocia sus datos o pins

#### Scenario: item local-only sin identidad con ID libre
- **GIVEN** un item v5 sintácticamente válido sin referencias externas ni identidad legacy cuyo ID está libre
- **WHEN** se importa
- **THEN** puede insertarse como un MediaItem nuevo conservando el ID entrante

### Requirement: v5 separa resolución de referencias y frescura del contenido
Cuando un item v5 resuelve un MediaItem existente, el sistema MUST preservar su ID local y `createdAt`, MUST aplicar la política vigente de orden por `updatedAt` y presencia explícita de campos al snapshot y los datos personales, y MUST impedir que un item anterior o equivalente sobrescriba datos locales más recientes. La restauración de referencias MUST evaluarse por separado de la frescura del contenido.

#### Scenario: incoming anterior o equivalente
- **GIVEN** un item v5 que resuelve un MediaItem local con `updatedAt` igual o posterior
- **WHEN** se importa
- **THEN** conserva el snapshot, rating, tags, notas, status, `createdAt` e `updatedAt` locales
- **AND** puede restaurar referencias externas compatibles sin tratar su ausencia previa como metadata más reciente

#### Scenario: incoming posterior con campos presentes
- **GIVEN** un item v5 que resuelve un MediaItem local y tiene un `updatedAt` posterior
- **WHEN** se importa
- **THEN** actualiza sólo los campos presentes bajo las reglas vigentes, incluidos valores `null` explícitos permitidos
- **AND** conserva el ID local y el `createdAt` local

#### Scenario: incoming posterior con campos ausentes
- **GIVEN** un item v5 posterior que omite un campo opcional bajo el contrato de presencia
- **WHEN** se importa
- **THEN** conserva el valor local de ese campo en vez de interpretarlo como `null` o default

### Requirement: v5 restaura referencias sin fusionar MediaItems ni eliminar referencias locales
Si las referencias entrantes ya resueltas apuntan todas al mismo MediaItem, el sistema MUST permitir que referencias entrantes todavía libres se adjunten a ese mismo item durante la restauración. Si alguna referencia resuelve otro MediaItem, MUST reportar conflicto y MUST NOT fusionar, vincular ni mover datos entre items. El import MUST conservar toda referencia local existente aunque esté ausente del backup.

#### Scenario: referencias resueltas convergen en un item
- **GIVEN** un item entrante cuyas referencias ya existentes resuelven el mismo MediaItem local y otra referencia entrante está libre
- **WHEN** se importa
- **THEN** puede adjuntar la referencia libre al mismo MediaItem como parte de la restauración
- **AND** aplica la frescura del contenido mediante su política independiente de `updatedAt`

#### Scenario: el item local resuelto tiene otro tipo
- **GIVEN** que una referencia entrante resuelve un MediaItem local cuyo `type` difiere del item v5
- **WHEN** se importa el item
- **THEN** se reporta conflicto antes de adjuntar referencias o identidad legacy y antes de actualizar contenido
- **AND** el item no aporta mapping, por lo que sus pins se reportan como no resolubles

#### Scenario: referencias resueltas divergen
- **GIVEN** un item entrante con referencias que resuelven MediaItems locales distintos
- **WHEN** se importa
- **THEN** reporta el item como conflicto
- **AND** no fusiona items, no adjunta referencias y no mueve rating, tags, notas, status, pins o metadata

#### Scenario: referencia local ausente del backup
- **GIVEN** un MediaItem local con una referencia que no aparece en el item entrante que lo resolvió
- **WHEN** se importa
- **THEN** conserva la referencia local ausente del backup
- **AND** no interpreta la ausencia como unlinking o cambio de proveedor

### Requirement: el backup v5 valida referencias externas e identidad interna
El sistema MUST rechazar y reportar items, referencias o pins que no cumplan su contrato, MUST impedir que una misma referencia externa concreta identifique dos items y MUST evitar toda asociación silenciosa ante una identidad ambigua.

Para referencias cuyo provider sea `tmdb`, el parser/restaurador v5 MUST reutilizar la normalización específica del adaptador TMDB: MUST admitir únicamente namespace `movie` o `tv`, MUST convertir un ID numérico textual válido a la misma representación decimal positiva y segura que usa el runtime, y MUST exigir que el namespace sea compatible con el `TitleType` vigente del item. Estas reglas MUST permanecer fuera del constructor universal; referencias de otros providers conservan su `externalId` opaco bajo las reglas genéricas de ProviderReference.

#### Scenario: referencia externa incompleta
- **WHEN** una referencia omite proveedor, namespace o ID externo válido
- **THEN** se reporta como inválida y no se persiste

#### Scenario: referencia repetida entre items
- **WHEN** dos items entrantes declaran la misma referencia externa completa
- **THEN** la colisión se reporta
- **AND** la referencia no transfiere metadata ni datos personales entre ellos

#### Scenario: referencia TMDB textual se canonicaliza por el adaptador conocido
- **GIVEN** un item movie v5 con referencia `tmdb/movie/00077`
- **WHEN** se valida o restaura el backup
- **THEN** la referencia se canonicaliza a `tmdb/movie/77` mediante la regla TMDB existente
- **AND** no puede crear una segunda referencia lógica ni otro MediaItem frente a `tmdb/movie/77`

#### Scenario: namespace o ID TMDB inválido
- **WHEN** una referencia v5 declara provider `tmdb` con namespace distinto de `movie|tv`, o con ID no numérico, no positivo o no seguro
- **THEN** el item se reporta inválido
- **AND** esa referencia no se almacena como un ID opaco genérico

#### Scenario: namespace TMDB incompatible con el item
- **GIVEN** un item cuyo `type` es `movie`
- **WHEN** declara una referencia `tmdb/tv/N`
- **THEN** el item se reporta inválido y no se crea un estado tipo/namespace contradictorio

#### Scenario: ID externo de otro provider permanece opaco
- **WHEN** una referencia v5 de un provider distinto de TMDB contiene un ID externo canónico para ese provider
- **THEN** el parser universal conserva el string opaco
- **AND** no le aplica parsing numérico ni reglas de namespace de TMDB

#### Scenario: pin hacia item inexistente
- **WHEN** un pin refiere una identidad de item ausente o no resuelta en el backup
- **THEN** se omite y reporta sin asociarlo por similitud de título o proveedor

### Requirement: versiones 1 a 4 conservan su interpretación histórica
El sistema MUST continuar importando backups v1, v2, v3 y v4 con sus validadores y reglas históricas, MUST derivar referencias TMDB mediante `provider + type + externalId` desde cada item elegible y MUST conservar la representación histórica de `manual` sólo como compatibilidad de importación.

#### Scenario: item TMDB de backup histórico
- **GIVEN** un item v1–v4 con provider `tmdb`, type `movie` o `tv` y externalId válido
- **WHEN** se importa
- **THEN** se resuelve mediante la referencia TMDB completa derivada de esos campos

#### Scenario: reimportación de item manual histórico
- **GIVEN** un item v1–v4 con provider `manual` que ya fue migrado o importado
- **WHEN** se importa nuevamente
- **THEN** la identidad legacy aislada resuelve el mismo MediaItem
- **AND** no se presenta `manual` como proveedor externo

#### Scenario: identidad manual histórica resuelve un tipo diferente
- **GIVEN** una identidad manual histórica que ya pertenece a un MediaItem local de otro tipo `movie|tv`
- **WHEN** se reimporta
- **THEN** se reporta conflicto sin cambiar el item local ni resolver sus pins

### Requirement: la identidad manual legacy v5 es exacta y singular por MediaItem
El sistema MUST conservar `legacyIdentity.externalId` exactamente, sin trim ni canonicalización, y MUST mantener como máximo una identidad manual legacy por MediaItem en las escrituras de aplicación. El exporter v5 MUST rechazar un estado preexistente con varias identidades legacy para un mismo item en vez de elegir una fila arbitraria.

#### Scenario: externalId manual con whitespace
- **WHEN** una identidad manual histórica contiene whitespace inicial o final
- **THEN** migración, export v5, parse/import v5 y reimport histórico preservan el string exacto

#### Scenario: segunda identidad legacy diferente
- **GIVEN** un MediaItem que ya tiene una identidad manual legacy
- **WHEN** una importación intenta adjuntar otra identidad manual diferente al mismo item
- **THEN** se reporta conflicto y el savepoint revierte cualquier referencia o contenido del item entrante

#### Scenario: export de estado legacy no representable
- **GIVEN** un MediaItem que contiene varias identidades manuales legacy por datos preexistentes
- **WHEN** se intenta exportar v5
- **THEN** el exporter falla con diagnóstico y no selecciona una identidad mediante orden SQL

#### Scenario: campos futuros no amplían un formato histórico
- **WHEN** los contratos de dominio actuales admiten un provider, namespace o tipo desconocido para v1–v4
- **THEN** los validadores históricos mantienen exactamente sus valores admitidos originales
- **AND** no aceptan el valor nuevo por reutilizar una unión de tipos vigente

### Requirement: los pins históricos usan los items del mismo backup para resolver identidad
Para backups v2–v4, el sistema MUST usar la información de sus items elegibles para complementar la referencia incompleta `provider + externalId` de cada pin, y MUST reportar el pin cuando no pueda determinar un único MediaItem sin adivinar.

#### Scenario: pin TMDB histórico no ambiguo
- **GIVEN** un pin histórico `tmdb + externalId` y exactamente un item elegible del backup con esa identidad y un tipo válido
- **WHEN** se importa
- **THEN** el pin se asocia al MediaItem resuelto mediante la referencia TMDB completa derivada del item

#### Scenario: pin histórico ambiguo
- **GIVEN** un pin histórico y más de un item elegible que comparte `provider + externalId` pero deriva recursos distintos
- **WHEN** se importa
- **THEN** el pin se omite y reporta como ambiguo
- **AND** no se elige un MediaItem por orden, tipo preferido o estado local

#### Scenario: pin sin item asociado
- **GIVEN** un pin histórico sin un item elegible que aporte la identidad necesaria
- **WHEN** se importa
- **THEN** se omite y reporta según el contrato vigente de problemas de pins

### Requirement: v5 conserva la semántica transaccional y de resultado parcial vigente
El sistema MUST procesar los títulos y pins elegibles dentro de una mutación SQLite serializada y una transacción pública, MUST aislar fallos de entradas individuales mediante el comportamiento vigente de importación parcial y MUST aplicar Appearance por separado sólo después de que finalice la restauración principal correspondiente.

#### Scenario: una entrada falla y otra es elegible
- **WHEN** una entrada falla durante su persistencia y otra puede guardarse correctamente
- **THEN** la entrada fallida se revierte y reporta
- **AND** la entrada elegible puede confirmarse junto con sus relaciones válidas

#### Scenario: estructura principal inválida
- **WHEN** el backup v5 no cumple su estructura principal
- **THEN** se rechaza antes de modificar SQLite
- **AND** Appearance tampoco cambia

#### Scenario: Appearance falla después del merge principal
- **WHEN** items y pins se confirman pero la persistencia posterior de Appearance falla
- **THEN** los datos principales permanecen importados
- **AND** el fallo de Appearance se informa por separado sin presentar el merge principal como revertido

### Requirement: backup v6 transporta clasificación y estado local completo
El sistema MUST exportar version 6 con medium obligatorio y contentFamily/primaryFormat presentes y nullable, sin type como segunda autoridad, preservando snapshot, ID, referencias completas, identidad legacy cuando corresponda, estado, tags, notas, ratings, timestamps, pins y Appearance bajo contratos vigentes. MUST validar clasificación y referencias sin coerción, rechazar combinaciones inválidas y exigir personalRating válido. TMDB MUST tener referencia movie/TV canónica y medio audiovisual, sin exigir igualdad namespace/primaryFormat. MUST conservar el rechazo de exportar local-only sin identidad portable y la prohibición de fabricar ProviderReference manual.

#### Scenario: round-trip de distintos medios
- **WHEN** se exportan y restauran anime, manga, manhwa, manhua, cómic y literatura con referencias válidas
- **THEN** clasificación y datos personales se conservan por item y sus pins remapean correctamente

#### Scenario: clasificación o referencia inválida
- **WHEN** un item v6 omite medium, omite un campo nullable de clasificación, tiene vocabulario incompatible, referencia duplicada, identidad TMDB inválida o medio no audiovisual con referencia TMDB
- **THEN** se reporta inválido sin escribir parcialmente el item ni restaurar sus pins

#### Scenario: formato local independiente de TMDB
- **WHEN** se restaura audiovisual/anime/ova o audiovisual/null/null con una referencia tmdb/movie canónica
- **THEN** se conserva la clasificación sin conflicto ni conversión automática a movie

### Requirement: importación v1 a v5 valida historia antes de convertir
El sistema MUST continuar importando v1–v5 con los validadores históricos y después convertir movie/TV a audiovisual con formato equivalente. MUST NOT ampliar los valores admitidos por versiones antiguas. MUST mantener presencia/ausencia de campos, identidad completa o legacy según versión, defaults históricos, reglas de personalRating y Appearance. En actualización histórica MUST tratar la familia no clasificada como no suministrada, sin borrar una familia local refinada; en inserción MUST usar familia null.

#### Scenario: backup histórico movie con familia local conocida
- **GIVEN** un item local audiovisual/anime/movie resuelto por la referencia TMDB del backup
- **WHEN** se importa un v5 más reciente con type movie
- **THEN** se conserva familia anime y se aplican campos históricos elegibles sin inferir familia de metadata

#### Scenario: backup histórico inválido
- **WHEN** un archivo v1–v5 contiene type manga o una estructura nueva en lugar de campos históricos obligatorios
- **THEN** conserva el rechazo histórico y no lo interpreta como v6

### Requirement: merge v6 preserva identidad frescura y relaciones
El sistema MUST resolver items por referencias completas o identidad legacy exacta, conservar ID/createdAt de items resueltos, aplicar campos según presencia y updatedAt, restaurar referencias aditivamente sin fusión y procesar pins mediante mapa del ID final después de items. MUST conservar savepoints y reporte parcial. Diferencias de medium o identidad TMDB inválida/medio incompatible MUST reportarse como conflicto sin cambios; namespace TMDB distinto de primaryFormat MUST NOT ser conflicto. Familia/formato requeridos nullable en v6 MUST representar estado local: valores explícitos elegibles por frescura pueden reemplazar no-null o borrar con null, sin aplicar reglas monotónicas de provider refresh. Familia histórica no suministrada MUST permanecer ausente en actualización. Referencia desconocida MUST NOT convertirse en equivalencia o taxonomía inferida.

#### Scenario: null y ausencia de campo opcional
- **WHEN** un item v6 más reciente omite overview pero suministra notes null
- **THEN** conserva overview local y aplica notes null bajo las reglas de merge vigentes

#### Scenario: clasificación nullable explícita
- **GIVEN** un item local audiovisual/anime/ova con referencia tmdb/movie válida
- **WHEN** un item v6 más reciente suministra contentFamily null y primaryFormat null con medium audiovisual
- **THEN** borra ambos valores locales conocidos sin confundir null con ausencia ni exigir formato movie
- **AND** el mismo null en provider refresh habría conservado anime/ova

#### Scenario: reemplazo explícito de clasificación local restaurada
- **WHEN** un item v6 más reciente y válido restaura comic/manga/one-shot sobre comic/manhwa/webtoon resuelto
- **THEN** puede reemplazar familia/formato como estado local según frescura
- **AND** un refresh remoto con ese snapshot conservaría manhwa/webtoon

#### Scenario: medio incompatible
- **WHEN** un backup resuelve un item audiovisual pero intenta convertirlo en comic
- **THEN** se reporta conflicto sin trasladar sus datos, referencias o pins

#### Scenario: referencias divergentes o item antiguo
- **WHEN** las referencias entrantes resuelven distintos items locales
- **THEN** se reporta conflicto sin fusionarlos
- **WHEN** un item anterior resuelve un único item y aporta una referencia compatible libre
- **THEN** puede restaurarse esa referencia sin sobrescribir metadata más reciente

#### Scenario: colisión de ID y pins
- **WHEN** un item entrante nuevo con referencia portable libre tiene ID ocupado
- **THEN** se asigna ID libre y sus pins usan el mapa final
- **AND** un local-only sin referencia ni legacy con ID ocupado sigue reportándose como conflicto

#### Scenario: Appearance y errores parciales
- **WHEN** la importación v6 tiene items o pins inválidos y Appearance confiable
- **THEN** reporta resultados reales, preserva operaciones válidas bajo el contrato parcial y aplica Appearance únicamente después de confirmar restauración

### Requirement: MangaUpdates reutiliza backup v6 sin autoridad de namespace
La integración MangaUpdates MUST reutilizar la representación v6 vigente, sin backup v7, campos persistidos adicionales ni binarios de portadas. MUST conservar referencia mangaupdates/series/series_id decimal string y clasificación local por separado, sin interpretar series como medio/formato durante import. MUST preservar referencias desconocidas aun sin adaptador disponible y permitir snapshot local útil en plataformas sin transporte MangaUpdates. La restauración MUST conservar su semántica de presencia/null/frescura independiente de refresh remoto.

#### Scenario: round-trip MangaUpdates sin adaptador Web
- **WHEN** un Manga/Manhwa/Manhua guardado se exporta como v6 y se importa en Web sin transporte MangaUpdates
- **THEN** conserva referencia completa/ID externo grande, clasificación nullable, snapshot/datos personales y pins bajo resolución portable vigente
- **AND** no consulta la API, interpreta series como clasificación ni requiere habilitar categorías MangaUpdates

#### Scenario: imagen en backup
- **WHEN** se exporta una obra con posterUrl MangaUpdates HTTPS permitida o null
- **THEN** se conserva el valor bajo el contrato vigente sin incluir binarios ni prometer portada offline
