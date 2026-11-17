## ADDED Requirements

### Requirement: Metadata y preferencias portables con merge independiente
El sistema MUST exportar JSON vigente con toda la ficha básica enriquecida guardada, puntuación pública original/escala/fuente, URLs de variantes, procedencia y preferencias de idioma, actualización y filtro sensible. MUST importar versiones 1–7 con sus parsers y reglas históricas sin dar autoridad a campos modernos introducidos en archivos antiguos. MUST resolver primero todas las identidades y remapear relaciones; aplicar metadata por su reloj por referencia y datos personales por sus reglas históricas vigentes, preservando ausencia/null y sin inferir frescura personal desde una consulta remota. MUST preservar baseline histórico separado, documentos por fuente y selección con reloj propio; al terminar el merge MUST resolver nuevamente la proyección coherente, evitando que campos planos antiguos desplacen metadata activa autoritativa. En v8 los campos planos derivados MUST concordar con sus datos autoritativos y no competir como otra fuente de metadata; un item contradictorio MUST reportarse sin escritura parcial. Imports históricos MUST NOT cambiar la selección de fuente. MUST informar errores parciales y no exportar credenciales ni imágenes binarias.

#### Scenario: Round trip enriquecido
- **WHEN** se exporta una biblioteca mixta con metadata Kitsu y se restaura sin red
- **THEN** sobreviven ficha básica, puntuación pública, identidades, datos personales, timestamps y preferencias válidas sin requerir imágenes descargadas

#### Scenario: Colisión y reimportación
- **WHEN** un ID local está ocupado pero las identidades portables permiten resolver otro item y se importa dos veces
- **THEN** se remapean relaciones al destino correcto sin duplicar obras ni eventos, y propietarios contradictorios se reportan como conflicto sin escrituras parciales

#### Scenario: Metadata nueva y nota antigua
- **WHEN** el backup tiene una consulta de metadata reciente pero una modificación personal anterior a la local
- **THEN** puede incorporar metadata elegible sin sobrescribir la nota local más nueva

#### Scenario: Import histórico o campo inválido
- **WHEN** se importa un backup v1–v7 sin enriquecimiento o un item moderno con metadata malformada
- **THEN** el histórico conserva interpretación y datos enriquecidos locales ausentes del archivo, y el item moderno inválido se reporta sin reemplazar silenciosamente su metadata por vacíos

#### Scenario: Preferencias y fallo de commit
- **WHEN** falla el commit de restauración o una preferencia importada es inválida
- **THEN** no se publican preferencias antes del commit y las inválidas conservan la configuración local con resultado parcial explícito

#### Scenario: Refresh seguido de import histórico elegible para personales
- **WHEN** tras un refresh reciente se importa v7 con metadata plana antigua y una nota cuyo updatedAt sí resulta elegible según las reglas históricas
- **THEN** se aplica la nota con esas reglas y se conserva visible/exportable la metadata declarada por el documento activo reciente
- **AND** no se convierte la nota ni el snapshot importado en modificación de metadata del proveedor

#### Scenario: Documentos modernos de distinta antigüedad
- **WHEN** un backup v8 aporta documento antiguo de la fuente activa y documento nuevo de otra referencia del mismo item
- **THEN** se conserva el documento activo local más reciente, se procesa el otro por su propio reloj y no cambia la fuente visible salvo selección válida más reciente

#### Scenario: Round trip de selección y baseline
- **WHEN** se cambia de fuente A a B, se exporta v8 y se restaura sin red
- **THEN** se conserva la selección B, ambos documentos y baseline separado y se reconstruye la misma proyección sin rellenar B con campos exclusivos de A

#### Scenario: Proyección moderna contradictoria
- **WHEN** un item v8 contiene campos planos que contradicen sus documentos y selección autoritativos
- **THEN** se informa el item inválido sin guardar una ficha con texto, score o procedencia incoherentes ni perder otros items restaurables

### Requirement: Actividad portable sin inventar revisiones locales
El sistema MUST permitir restaurar los eventos retenidos incluidos en el backup vigente mediante IDs de evento estables y referencias remapeadas a sus items, sin duplicarlos al reimportar. MUST conservar historial local si la sección falta y reportar eventos inválidos sin afectar títulos válidos. MUST NOT exportar intentos, backoff o errores de red ni convertir resúmenes operativos de otro dispositivo en una revisión local completada.

#### Scenario: Eventos reimportados tras remap
- **WHEN** se importa dos veces un backup con eventos válidos y remapeo de itemId
- **THEN** cada evento aparece una sola vez sobre el item correcto y no se generan altas nuevas por cada importación

#### Scenario: Evento huérfano
- **WHEN** un evento señala un item inexistente o no restaurable
- **THEN** se reporta y omite sin crear una obra ni impedir restaurar los otros items

## MODIFIED Requirements

### Requirement: el backup vigente representa MediaItems y referencias externas por separado
El sistema MUST conservar la interpretación histórica de backups versiones 1–7 y, una vez aprobada e implementada la evolución propuesta, MUST exportar un backup versión 8 donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes, incluyendo identidad manual portable separada, metadata básica enriquecida con referencias de imágenes y preferencias pertinentes, sin binarios ni credenciales. La metadata del proveedor MUST mantener procedencia y relojes independientes de los datos personales.

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
