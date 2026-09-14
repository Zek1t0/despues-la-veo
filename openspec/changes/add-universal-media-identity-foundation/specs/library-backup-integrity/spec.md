## ADDED Requirements

### Requirement: el backup versión 5 representa MediaItems y referencias externas por separado
El sistema MUST exportar un backup versión 5 donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes.

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

#### Scenario: referencia externa incompleta
- **WHEN** una referencia omite proveedor, namespace o ID externo válido
- **THEN** se reporta como inválida y no se persiste

#### Scenario: referencia repetida entre items
- **WHEN** dos items entrantes declaran la misma referencia externa completa
- **THEN** la colisión se reporta
- **AND** la referencia no transfiere metadata ni datos personales entre ellos

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
