## MODIFIED Requirements

### Requirement: Contrato compartido de búsqueda mínimo
El sistema SHALL ofrecer resultados `ProviderSearchResult` mediante una única capability compartida de búsqueda con query y resultados readonly, sin paginación universal, descriptor, registry ni orquestación multiproveedor; la selección explícita de categoría y fuente pertenece a Buscar, fuera de la capability. TMDB SHALL normalizar sus DTOs antes de entregarlos a Buscar; Buscar SHALL consumir los valores normalizados sin interpretar `media_type`, `poster_path`, `title/name` ni `release_date/first_air_date`.

#### Scenario: Búsqueda mediante la frontera normalizada
- **WHEN** Buscar solicita resultados para una consulta
- **THEN** recibe resultados normalizados sin page, cursor, hasMore ni metadata de paginación en el contrato compartido

### Requirement: Buscar conserva su comportamiento con la frontera normalizada
El sistema SHALL mantener películas y series de Buscar respaldadas por TMDB y permitir categorías explícitas adicionales únicamente cuando su fuente sea aprobada y SHALL preservar debounce, consulta vacía, estado de credencial, estados de carga y error, rechazo de respuestas obsoletas, etiquetas visibles y navegación actuales al consumir resultados normalizados.

#### Scenario: Navegación desde resultado normalizado
- **WHEN** el usuario abre un resultado normalizado con referencia `tmdb/movie/42`
- **THEN** la aplicación navega a `/tmdb/movie/42`

#### Scenario: Respuesta de una búsqueda anterior
- **WHEN** una respuesta remota llega después de que la consulta o generación de credencial vigente cambió
- **THEN** esa respuesta no reemplaza los resultados visibles de la búsqueda vigente

#### Scenario: TMDB no configurado
- **WHEN** el usuario escribe una consulta en películas y series y la credencial TMDB no está configurada
- **THEN** Buscar conserva el mensaje y las acciones actuales sin ejecutar la consulta remota

### Requirement: Metadata portable de detalle normalizada
El sistema SHALL convertir un detalle compatible de un proveedor en `ProviderMediaDetails` compuesto por su `ProviderReference` y un `ProviderLocalSnapshot` compatible con el modelo `SavedTitle` actual: medium, contentFamily y primaryFormat compatibles, título, año útil nullable, URL absoluta de póster, resumen textual, `genres` como array readonly de strings normalizados y suministro opcional del campo legacy TMDB `voteAverage`. El sistema SHALL NOT afirmar que estos campos definen una taxonomía universal, IDs de género, procedencia, reglas de normalización entre proveedores ni una ontología universal de puntuaciones. `ProviderMediaDetails` SHALL NOT contener `initialTags`. Un recurso que no pueda mapearse honestamente al modelo local actual SHALL quedar fuera de la frontera de guardado y materialización.

#### Scenario: Géneros normalizados desde un detalle TMDB
- **WHEN** se normaliza un detalle TMDB ya obtenido con nombres de géneros
- **THEN** el mapper puro incluye esos nombres en `snapshot.genres`, y la política TMDB puede suministrarlos por separado como `initialTags` desde la misma respuesta sin un segundo request

#### Scenario: Detalle TMDB sin géneros
- **WHEN** se normaliza un detalle TMDB sin géneros
- **THEN** `snapshot.genres` contiene un array vacío

#### Scenario: Detalle de película TMDB
- **WHEN** se normaliza un detalle TMDB de película válido
- **THEN** la salida contiene referencia canónica `tmdb/movie/<id>`, clasificación audiovisual/null/movie y los campos portables equivalentes

#### Scenario: Detalle de TV TMDB
- **WHEN** se normaliza un detalle TMDB de TV válido
- **THEN** la salida contiene referencia canónica `tmdb/tv/<id>`, clasificación audiovisual/null/tv y los campos portables equivalentes

#### Scenario: Fecha ausente o inválida
- **WHEN** el detalle remoto no contiene una fecha de la que pueda obtenerse un año válido
- **THEN** la metadata normalizada contiene año nulo

#### Scenario: Resumen vacío
- **WHEN** el detalle remoto contiene un resumen ausente o compuesto solamente por espacios
- **THEN** la metadata normalizada contiene resumen nulo

### Requirement: Materialización local independiente del proveedor
El sistema SHALL tener una implementación autoritativa de materialización independiente del proveedor para crear o refrescar un MediaItem desde metadata normalizada y política explícita de tags iniciales, sin interpretar DTOs TMDB, credenciales, rutas, React ni DTOs de backup. El guardado SHALL resolver el item mediante la referencia completa `provider`, `resourceNamespace` y `externalId`, conforme a `universal-media-identity`, y SHALL aplicar sus invariantes vigentes de preservación personal y composición transaccional.

#### Scenario: Creación de un MediaItem
- **WHEN** se guarda una referencia que todavía no pertenece a un MediaItem
- **THEN** el sistema crea un MediaItem con un ID local opaco y los defaults personales vigentes, persiste el snapshot normalizado incluyendo `snapshot.genres` como `SavedTitle.genres`, inicializa `SavedTitle.tags` con los `initialTags` explícitos y adjunta exactamente esa referencia

#### Scenario: Guardado repetido de la misma referencia
- **WHEN** se vuelve a guardar la misma `ProviderReference` completa (provider, resourceNamespace, externalId)
- **THEN** el sistema actualiza el MediaItem ya asociado y no crea un duplicado

#### Scenario: Refresh preserva estado personal
- **WHEN** metadata normalizada refresca un MediaItem existente
- **THEN** el sistema preserva ID local, `createdAt`, status, tags, notas, puntuación personal y todas las ProviderReferences existentes, exige medium igual y solo refina familia/formato desconocidos, conserva clasificación no-null ante null o discrepancia no-null, actualiza los demás campos remotos válidos incluyendo genres y calcula `updatedAt` con la semántica vigente
- **AND** preserva `voteAverage` cuando no es suministrado y acepta suministro explícito únicamente desde TMDB

### Requirement: Límites de la frontera provider-neutral
La frontera compartida SHALL excluir credenciales, generación y lifecycle de credenciales, presentación de errores TMDB, rutas TMDB, créditos, watch providers, configuración y atribución. Esas funciones SHALL permanecer en la integración explícita de cada fuente, con TMDB conforme a `tmdb-user-credential`. La frontera SHALL consumir el modelo local y sus referencias sin redefinir los contratos de persistencia y backup de `universal-media-identity` y `library-backup-integrity`; el snapshot normalizado SHALL usar la clasificación expandida persistida en SQLite v5 y backup v6, conservando migraciones e importaciones históricas mediante sus contratos originales.

#### Scenario: Uso de funciones específicas TMDB
- **WHEN** Buscar o el detalle TMDB requiere configuración, manejo de errores, navegación o enriquecimientos
- **THEN** utiliza la integración específica TMDB sin imponer esos conceptos a los contratos portables

#### Scenario: Biblioteca y backups existentes
- **WHEN** se guarda o refresca metadata normalizada sobre una biblioteca existente
- **THEN** el snapshot usa la clasificación nueva, las referencias mantienen su forma genérica y los datos anteriores se conservan mediante conversión compatible según las capacidades canónicas existentes

## ADDED Requirements

### Requirement: refresh portable conserva clasificación local conocida
La materialización MUST persistir valores mapeados en creación con medium obligatorio. En refresh MUST rechazar medium diferente antes de escribir; MUST refinar cada familia/formato null existente con un valor no-null válido y MUST conservar cada no-null existente ante null o no-null distinto. Una discrepancia no-null entre clasificaciones válidas MUST NOT impedir otros cambios remotos válidos ni introducir prioridad/fusión. Namespace MUST NOT ser segunda autoridad de primaryFormat: referencias TMDB canónicas requieren medium audiovisual, sin igualdad con formato local. Backup restaura estado local y MUST conservar su propia semántica de null/frescura.

#### Scenario: TMDB con menos conocimiento
- **GIVEN** un item multirreferenciado audiovisual/anime/movie
- **WHEN** TMDB suministra audiovisual/null/movie
- **THEN** conserva familia anime y permite actualizar el resto del snapshot válido

#### Scenario: formato desconocido refinado
- **WHEN** comic/manga/null recibe comic/manga/one-shot de una fuente aprobada
- **THEN** conserva manga y refina formato a one-shot

#### Scenario: null no borra formato
- **WHEN** comic/manhwa/webtoon recibe comic/manhwa/null
- **THEN** conserva webtoon

#### Scenario: discrepancia conocida no reemplaza
- **WHEN** comic/manhwa/webtoon recibe comic/manga/one-shot válido
- **THEN** conserva manhwa/webtoon mientras metadata remota no clasificatoria elegible sí se actualiza

#### Scenario: OVA y namespace movie
- **WHEN** un item audiovisual/anime/ova con referencia tmdb/movie válida recibe snapshot TMDB audiovisual/null/movie
- **THEN** conserva anime/ova y la referencia movie sin rechazo por desigualdad de formato

#### Scenario: medio diferente
- **WHEN** el snapshot de refresh propone otro medium que el item resuelto
- **THEN** se rechaza antes de escribir cualquier campo

### Requirement: suministro y propiedad de voteAverage legacy
El snapshot MUST distinguir voteAverage no suministrado de null explícito. La materialización MUST conservar el valor existente si el campo está ausente y usar null al crear un item sin suministro. MUST aceptar suministro explícito finito o null solo desde TMDB y MUST rechazar suministro desde otra fuente, incluido null o undefined presente, antes de modificar datos. MUST NOT convertir ratings externos a TMDB ni cambiar la escala personal 10..100 o null.

#### Scenario: refresh no-TMDB sobre item multirreferenciado
- **GIVEN** un item con referencia TMDB, otra referencia y voteAverage 7.9
- **WHEN** se refresca mediante la otra referencia sin suministrar voteAverage
- **THEN** se conserva 7.9, ID, referencias y metadata personal

#### Scenario: nuevo item no-TMDB
- **WHEN** se guarda una obra nueva sin suministro del rating legacy
- **THEN** se persiste voteAverage null sin afirmar una puntuación externa equivalente

#### Scenario: null explícito TMDB
- **WHEN** TMDB suministra explícitamente voteAverage null al refrescar
- **THEN** su puntuación anterior puede borrarse sin cambiar personalRating

#### Scenario: suministro sin propiedad
- **WHEN** una fuente distinta de TMDB suministra voteAverage con número o null, o cualquier fuente lo suministra como undefined
- **THEN** se rechaza el input sin escritura parcial ni borrado de la puntuación existente

### Requirement: texto portable y categorías externas honestas
El sistema MUST almacenar overview como texto seguro, normalizando markup específico sin ejecutar contenido o recuperar enlaces. MUST conservar year nullable como inicio/estreno útil. MUST persistir únicamente géneros reconocibles y MUST omitir temas, demografía o spoilers ambiguos. El segundo proveedor MUST suministrar initialTags vacío salvo decisión de producto revisada, sin modificar tags en refresh.

#### Scenario: descripción con markup y categorías mixtas
- **WHEN** se normaliza una descripción con HTML/Markdown y categorías que mezclan géneros y temas
- **THEN** el snapshot contiene texto legible sin contenido ejecutable y solo géneros clasificados con certeza
- **AND** initialTags queda separado de genres

