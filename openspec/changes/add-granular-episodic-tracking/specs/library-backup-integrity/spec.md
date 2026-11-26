## ADDED Requirements

### Requirement: Backup v11 portable sin evidencia reconstruida
La exportación vigente MUST declarar v11 y MUST conservar el contrato de datos v10 y agregar grupos, unidades, referencias, descriptor mínimo, retiro y decisiones explícitas con fecha opcional y reloj. Los descriptores entrantes MUST NOT acreditar una guía por sí solos. El bloque granular MUST existir incluso vacío. El sistema MUST NOT exportar un formato histórico como formato vigente ni omitir unidades o decisiones persistidas; no se exportan binarios, credenciales ni caché extensa. Los parsers v1–v10 MUST preservar su interpretación histórica y MUST NOT dar autoridad a campos granulares añadidos artificialmente. Un v11 sin bloque granular obligatorio es un envoltorio inválido.

#### Scenario: Ausencia histórica
- **WHEN** se restaura v10 o anterior sobre una base con unidades y decisiones, con o sin campos granulares artificiales
- **THEN** no se crean ni borran unidades o decisiones y posición manual sigue su contrato histórico

#### Scenario: Bloque vacío obligatorio
- **WHEN** se exporta sin datos granulares o se intenta importar v11 sin el bloque obligatorio
- **THEN** se exporta el bloque vacío o se rechaza el archivo inválido antes de escribir, respectivamente

#### Scenario: Round trip
- **WHEN** se exporta v11 y se importa sobre bases TEST vacía y poblada
- **THEN** se preservan los datos portables, incluidos desmarcados, y los resultados de reimportación son semánticamente idempotentes

### Requirement: Restauración granular por mapas efectivos
El importador MUST resolver títulos, grupos, unidades y decisiones en ese orden, validando propietario, UUID, namespace y referencias. MUST reportar dependencias no resueltas y candidatos contradictorios por destino sin elegir por orden. MUST aislar fallos por registro dependiente y revertir todo ante fallo global sin invalidar antes del commit. MUST reevaluar la evidencia si una escritura cambia datos que la sustentan e invalidarla si deja de ser verificable. MUST conservar evidencia local aún válida ante importación equivalente.

#### Scenario: Remapeo y colisión
- **WHEN** un título cambia de ID local y otro candidato usa UUID o referencia contradictoria
- **THEN** solo se aplica al propietario resuelto y el conflicto de identidad se reporta y omite

#### Scenario: Fallo parcial o global
- **WHEN** falla una unidad y su decisión dependiente o falla el commit global
- **THEN** se informa la omisión dependiente o se revierte toda la importación respectivamente

#### Scenario: Evidencia local y restauración equivalente
- **WHEN** se importan cambios relevantes para un alcance editorial o se reimportan datos equivalentes
- **THEN** se reevalúa el alcance afectado y se invalida si pierde sustento; los datos equivalentes conservan la evidencia local válida y los descriptores entrantes no acreditan completitud

### Requirement: Conflictos granulares conservadores y revisables
Sin decisión local MUST importar una válida. Igual estado y fecha normalizada MUST ser equivalentes sin cambiar reloj ni versión. Toda diferencia MUST preservar local por defecto y ofrecer revisión accesible, temporal y exportable completa en Ajustes, con omisiones y ambos candidatos. Aplicar entrante MUST revalidar identidad y versión y crear una nueva decisión local en transacción.

#### Scenario: Marca antigua frente a negativo
- **WHEN** el backup trae marca positiva para un desmarcado local
- **THEN** se conserva el negativo y se informa el conflicto cualquiera sea el timestamp

#### Scenario: Conflicto de fecha y candidato obsoleto
- **WHEN** difieren fechas o decisiones y se intenta aplicar después de otra edición
- **THEN** se informa la diferencia y se rechaza el candidato obsoleto

#### Scenario: Reimportación tras resolución
- **WHEN** se vuelve a importar después de aplicar el candidato
- **THEN** se reconoce equivalencia sin volver a escribir

## MODIFIED Requirements

### Requirement: rechazo seguro del archivo completo

El sistema MUST evitar toda modificación persistente cuando la estructura principal del backup sea inválida o su versión no sea un entero admitido entre 1 y 11. La invalidez aislada de Appearance dentro de un v4 cuya biblioteca y pins sean procesables MUST NOT convertir el archivo completo en inválido.

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

- **GIVEN** un backup cuya versión no es un entero admitido entre 1 y 11
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

### Requirement: el backup versión 2 representa títulos y pins deliberados

El contrato histórico v2 MUST representar JSON con los títulos guardados y todos sus pins contextuales, MUST mantener las preferencias de vista fuera del backup y MUST identificar en cada pin su título por `provider + externalId` en vez del identificador local.

#### Scenario: exportación con pins contextuales
- **WHEN** el usuario exporta una biblioteca que contiene pins de Biblioteca y etiquetas
- **THEN** obtiene un backup `version: 2` con colecciones `items` y `pins`
- **AND** cada pin contiene identidad lógica del título, tipo de contexto, clave de contexto y `pinnedAt`
- **AND** no se exportan preferencias de apariencia u orden

#### Scenario: ciclo completo v2
- **WHEN** se exporta una biblioteca con títulos y pins y se importa en una biblioteca vacía
- **THEN** se restauran los títulos elegibles
- **AND** se restauran sus pins válidos en los contextos correspondientes

### Requirement: el backup versión 3 transporta puntuaciones personales y pins
El contrato histórico v3 MUST representar JSON con `items` y `pins`, MUST incluir `personalRating` dentro de cada item, MUST identificar pins mediante `provider + externalId` y MUST mantener las preferencias locales fuera del backup.

#### Scenario: exportación v3
- **WHEN** el usuario exporta una biblioteca con títulos puntuados, sin calificar y pins contextuales
- **THEN** obtiene un backup `version: 3` con items que contienen `personalRating` numérico o `null`
- **AND** contiene todos los pins válidos bajo el contrato v2
- **AND** no contiene preferencias de vista

#### Scenario: ciclo completo v3
- **WHEN** un backup v3 se importa en una biblioteca vacía
- **THEN** se restauran títulos, puntuaciones personales y pins elegibles

### Requirement: el backup versión 4 transporta Appearance portable cuando es confiable

El contrato histórico v4 MUST representar JSON con `items`, `pins` y, cuando exista una intención local confiable, `appearance`. Appearance contiene únicamente la intención portable `scheme` + `palette`. Una row válida MUST aportar la última intención realmente confirmada como persistida; la ausencia válida de row MUST aportar el default contractual Dark + Original. Ante un error real de lectura sin `confirmedPersisted` confiable, el sistema MUST continuar exportando items/pins, MUST omitir Appearance y MUST NOT inventarla desde el fallback visual. El backup MUST NOT incluir effective scheme, scheme actual del sistema, colores resueltos ni la definición completa del theme, y MUST mantener fuera las preferencias Detalle/Mosaico y sorting.

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

### Requirement: el backup vigente representa MediaItems y referencias externas por separado
El sistema MUST conservar la interpretación histórica de backups versiones 1–7. El contrato histórico v8 MUST representar un backup donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes, incluyendo identidad manual portable separada, metadata básica enriquecida con referencias de imágenes y preferencias pertinentes, sin binarios ni credenciales. La metadata del proveedor MUST mantener procedencia y relojes independientes de los datos personales.

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

#### Scenario: el exporter v8 no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas, identidad manual portable ni `legacyIdentity`
- **WHEN** el exporter v8 intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

#### Scenario: referencias internas portables
- **GIVEN** un MediaItem con pins contextuales
- **WHEN** se exporta el backup
- **THEN** cada pin refiere la identidad del item dentro del backup
- **AND** no usa una referencia de proveedor como única foreign key hacia el item

#### Scenario: round-trip con ID TMDB compartido entre namespaces
- **GIVEN** MediaItems distintos para `tmdb/movie/77` y `tmdb/tv/77`, cada uno con datos personales propios y ambos pineados en el mismo contexto
- **WHEN** se importa un backup histórico v6/v7 o se exporta/importa el nuevo v8 en una base vacía
- **THEN** el backup contiene dos identidades de item distintas y conserva ambas referencias externas completas
- **AND** cada pin apunta al `itemId` de su MediaItem correspondiente
- **AND** rating, tags, notas, status y pins se restauran en el MediaItem correcto
- **AND** ninguna relación se decide usando únicamente `provider + externalId`

#### Scenario: el exporter v6 no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas ni `legacyIdentity`
- **WHEN** el exporter v6 intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

#### Scenario: el exporter v7 no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas, identidad manual portable ni `legacyIdentity`
- **WHEN** el exporter v7 intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

### Requirement: backup v6 transporta clasificación y estado local completo
El contrato histórico v6 MUST representar un backup con medium obligatorio y contentFamily/primaryFormat presentes y nullable, sin type como segunda autoridad, preservando snapshot, ID, referencias completas, identidad legacy cuando corresponda, estado, tags, notas, ratings, timestamps, pins y Appearance bajo contratos vigentes. MUST validar clasificación y referencias sin coerción, rechazar combinaciones inválidas y exigir personalRating válido. TMDB MUST tener referencia movie/TV canónica y medio audiovisual, sin exigir igualdad namespace/primaryFormat. MUST conservar el rechazo de exportar local-only sin identidad portable y la prohibición de fabricar ProviderReference manual.

#### Scenario: round-trip de distintos medios
- **WHEN** se exportan y restauran anime, manga, manhwa, manhua, cómic y literatura con referencias válidas
- **THEN** clasificación y datos personales se conservan por item y sus pins remapean correctamente

#### Scenario: clasificación o referencia inválida
- **WHEN** un item v6 omite medium, omite un campo nullable de clasificación, tiene vocabulario incompatible, referencia duplicada, identidad TMDB inválida o medio no audiovisual con referencia TMDB
- **THEN** se reporta inválido sin escribir parcialmente el item ni restaurar sus pins

#### Scenario: formato local independiente de TMDB
- **WHEN** se restaura audiovisual/anime/ova o audiovisual/null/null con una referencia tmdb/movie canónica
- **THEN** se conserva la clasificación sin conflicto ni conversión automática a movie

### Requirement: backup v7 representa identidad manual portable separada
El contrato histórico v7 MUST representar un backup con clasificación/snapshot/datos personales vigentes, cero o varias referencias completas, identidad manual portable cuando exista y legacyIdentity histórica cuando exista. MUST conservar IDs de item internos al backup y pins por itemId, sin imágenes binarias. MUST rechazar identidades manuales inválidas o duplicadas entre items y MUST NOT convertirlas en referencias externas. MUST conservar la interpretación de v1–v6 y validar cada formato histórico antes de convertirlo, sin aceptar campos nuevos como autoridad en archivos antiguos.

#### Scenario: round-trip manual sin proveedor
- **WHEN** se exporta un manual nuevo y se importa v7 en una biblioteca vacía
- **THEN** conserva ID local si está libre, identidad portable, clasificación, snapshots, campos personales, timestamps y pins

#### Scenario: identidad duplicada o inválida
- **WHEN** un backup v7 contiene una identidad portable inválida o compartida por dos items
- **THEN** los items afectados se reportan según la política vigente de validación parcial sin que uno reclame la identidad del otro

#### Scenario: historia no reinterpretada
- **WHEN** se importa un backup v1–v6 con campos de identidad v7 añadidos
- **THEN** se aplican únicamente las reglas de su versión declarada, sin usar esos campos para resolver identidades

### Requirement: Backup v9 exporta organización desde su primera persistencia
El contrato histórico v9 MUST incluir colecciones, membresías y recomendaciones, aun vacías, descartadas o con contenido filtrado. MUST conservar IDs estables, datos opcionales, captura original, estados, vínculos y timestamps; los títulos y todos los datos portables v8 MUST conservar sus contratos independientes. El formato histórico v10 conserva la organización y agrega progreso manual. La exportación vigente v11 MUST conservar ambos y agregar los datos granulares. MUST obtener una instantánea coherente sin credenciales, binarios, estados de red ni preferencias locales de browsing. La sección de recomendaciones MUST ser opcional para aceptar archivos v9 anteriores que no incluían Inbox; ausencia y lista vacía MUST significar ninguna aportación, nunca borrado. MUST permitir exportar e importar todos esos datos persistidos; una versión de la aplicación que todavía no soporte una sección de recomendaciones no vacía MUST rechazarla antes de escribir, sin descartarla silenciosamente.

#### Scenario: Exportar cada entrega
- **WHEN** se exportan una colección vacía, otra poblada y recomendaciones en los tres estados desde la versión con progreso
- **THEN** el archivo declara v11 y contiene toda la organización, progreso manual, bloque granular obligatorio y datos portables previos, sin omitir datos persistidos

#### Scenario: Filtrado o captura sin vínculo
- **WHEN** se exporta con contenido sensible oculto y recomendaciones Pendientes
- **THEN** se incluyen registros y membresías ocultos y contexto de las recomendaciones sin fabricar títulos ni arte descargado

### Requirement: Backup v10 transporta progreso completo y mantiene historia
El formato histórico v10 y la exportación vigente v11 MUST incluir la sección de progreso aun vacía, con referencia al item del archivo, variante, posición validada o restablecimiento explícito y timestamp propio. MUST incluir títulos filtrados y no perder decimales textuales, resets ni posiciones incompatibles conservadas. MUST conservar todos los datos portables v9. MUST aceptar v1–v9 bajo sus parsers/reglas históricas sin dar autoridad a campos de progreso añadidos a esas versiones; ausencia o lista vacía MUST NOT borrar progreso local. MUST rechazar JSON, versión o envoltorio inválido antes de escribir; registros inválidos MUST reportarse y aislarse sin afectar otros válidos.

#### Scenario: Bloque vacío obligatorio
- **WHEN** se exporta sin datos granulares o se intenta importar v11 sin el bloque obligatorio
- **THEN** se exporta el bloque vacío o se rechaza el archivo inválido antes de escribir, respectivamente

#### Scenario: Round trip offline completo
- **WHEN** se exportan manuales, títulos multirreferenciados, decimales y resets y se restaura sin conexión
- **THEN** se conservan identidades, progreso y relojes, organización, metadata, pins, actividad y preferencias portables

#### Scenario: Historia sin autoridad nueva
- **WHEN** se importa v1–v9 con o sin campos de progreso añadidos
- **THEN** se procesa solo su contrato histórico y no se modifica ni borra progreso local
