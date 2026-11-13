## MODIFIED Requirements

### Requirement: el backup vigente representa MediaItems y referencias externas por separado
El sistema MUST conservar la interpretación histórica de backups versiones 1–6 y, una vez aprobada e implementada la evolución propuesta, MUST exportar un backup versión 7 donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes.

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

#### Scenario: el exporter v7 no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas, identidad manual portable ni `legacyIdentity`
- **WHEN** el exporter v7 intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

#### Scenario: referencias internas portables
- **GIVEN** un MediaItem con pins contextuales
- **WHEN** se exporta el backup
- **THEN** cada pin refiere la identidad del item dentro del backup
- **AND** no usa una referencia de proveedor como única foreign key hacia el item

#### Scenario: round-trip con ID TMDB compartido entre namespaces
- **GIVEN** MediaItems distintos para `tmdb/movie/77` y `tmdb/tv/77`, cada uno con datos personales propios y ambos pineados en el mismo contexto
- **WHEN** se importa un backup histórico v6 o se exporta/importa el nuevo v7 en una base vacía
- **THEN** el backup contiene dos identidades de item distintas y conserva ambas referencias externas completas
- **AND** cada pin apunta al `itemId` de su MediaItem correspondiente
- **AND** rating, tags, notas, status y pins se restauran en el MediaItem correcto
- **AND** ninguna relación se decide usando únicamente `provider + externalId`

## ADDED Requirements

### Requirement: backup v7 representa identidad manual portable separada
Una vez aprobada la evolución propuesta, el sistema MUST exportar v7 con clasificación/snapshot/datos personales vigentes, cero o varias referencias completas, identidad manual portable cuando exista y legacyIdentity histórica cuando exista. MUST conservar IDs de item internos al backup y pins por itemId, sin imágenes binarias. MUST rechazar identidades manuales inválidas o duplicadas entre items y MUST NOT convertirlas en referencias externas. MUST conservar la interpretación de v1–v6 y validar cada formato histórico antes de convertirlo, sin aceptar campos nuevos como autoridad en archivos antiguos.

#### Scenario: round-trip manual sin proveedor
- **WHEN** se exporta un manual nuevo y se importa v7 en una biblioteca vacía
- **THEN** conserva ID local si está libre, identidad portable, clasificación, snapshots, campos personales, timestamps y pins

#### Scenario: identidad duplicada o inválida
- **WHEN** un backup v7 contiene una identidad portable inválida o compartida por dos items
- **THEN** los items afectados se reportan según la política vigente de validación parcial sin que uno reclame la identidad del otro

#### Scenario: historia no reinterpretada
- **WHEN** se importa un backup v1–v6 con campos de identidad v7 añadidos
- **THEN** se aplican únicamente las reglas de su versión declarada, sin usar esos campos para resolver identidades

### Requirement: merge v7 resuelve identidades antes de frescura y pins
El sistema MUST resolver por todas las identidades portables suministradas (manual, referencias completas e histórica), exigir que las ya resueltas apunten al mismo MediaItem y rechazar conflictos sin fusionar ni reasignar. MUST preservar el ID local existente del item resuelto y remapear un ID entrante ocupado solo si hay identidad portable suficiente. MUST conservar merge por updatedAt y presencia de campos, semántica de null explícito v6, referencias aditivas, savepoints por item, informe parcial, pins contextuales aditivos y Appearance después de commit. Una identidad manual distinta ya asociada al destino MUST producir conflicto. MUST NOT usar título/año como identidad.

#### Scenario: colisión local y reimportación
- **GIVEN** un manual v7 con identidad portable nueva cuyo ID está ocupado por otro item
- **WHEN** se importa y luego se reimporta el mismo backup
- **THEN** el primer import asigna un ID libre y remapea todos sus pins y el segundo resuelve ese mismo item sin duplicarlo ni tocar al ocupante

#### Scenario: identidades contradictorias
- **WHEN** identidad manual y referencia externa o legacy entrantes resuelven items diferentes
- **THEN** se informa conflicto sin writes parciales, merge o traslado de identidades/pins

#### Scenario: identidad resuelta con contenido más viejo
- **WHEN** una identidad resuelve un item cuyo updatedAt es igual o posterior al entrante
- **THEN** no se reemplaza su contenido y se conservan las reglas vigentes para identidades adicionales compatibles y pins

#### Scenario: fallo y continuación íntegra
- **WHEN** falla la escritura de un item o de su identidad
- **THEN** se revierte ese item/asociación y sus pins no se reasocian a otro item, se informa el fallo y los otros items elegibles siguen la política parcial vigente

### Requirement: compatibilidad histórica sin identidad manual fabricada
El sistema MUST conservar la resolución exacta y singular de legacyIdentity en imports v1–v6 y MUST NOT asignar retrospectivamente identidad v7 al archivo histórico. Si un local-only sin identidad de un archivo v5/v6 tiene ID libre, MUST conservar la aceptación defensiva histórica y asignar identidad portable al item insertado para futuras exportaciones v7; si está ocupado MUST conservar el conflicto histórico sin equivalencia por ID. MUST NOT deducir igualdad entre dos copias históricas sin identidad portable.

#### Scenario: reimport histórico sin identidad
- **WHEN** se importa dos veces un local-only v6 sin referencias ni legacyIdentity con el mismo ID
- **THEN** el primero puede insertarse con nueva identidad local portable y el segundo conserva el conflicto histórico por ID ocupado
- **AND** la reimportación determinista queda garantizada para su posterior export v7, no retroactivamente para el archivo v6

#### Scenario: manual legacy restaurado varias veces
- **WHEN** se restaura repetidamente el mismo manual histórico con su legacyIdentity exacta
- **THEN** resuelve el mismo item y conserva esa identidad y sus reglas de frescura sin fabricar provider manual


