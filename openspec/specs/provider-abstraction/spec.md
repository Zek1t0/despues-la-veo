# provider-abstraction Specification

## Purpose

Define una frontera remota estrecha y estable para que la búsqueda, el detalle portable y el guardado local consuman datos normalizados sin depender de DTOs crudos de TMDB ni alterar la identidad local.

## Requirements

### Requirement: Contrato compartido de búsqueda mínimo
El sistema SHALL ofrecer resultados `ProviderSearchResult` mediante una única capability compartida de búsqueda con query y resultados readonly, sin paginación, descriptor, registry, selector de proveedor ni orquestación multiproveedor. TMDB SHALL normalizar sus DTOs antes de entregarlos a Buscar; Buscar SHALL consumir los valores normalizados sin interpretar `media_type`, `poster_path`, `title/name` ni `release_date/first_air_date`.

#### Scenario: Búsqueda mediante la frontera normalizada
- **WHEN** Buscar solicita resultados para una consulta
- **THEN** recibe resultados normalizados sin page, cursor, hasMore ni metadata de paginación en el contrato compartido

### Requirement: Resultados remotos de búsqueda normalizados
El sistema SHALL representar cada resultado remoto consumido por Buscar con una `ProviderReference` completa, título para mostrar, valor de año o estreno para mostrar, URL absoluta de póster o imagen cuando exista, descripción breve y etiqueta de tipo para mostrar, sin exponer al consumidor nombres de campos del DTO de TMDB.

#### Scenario: Película TMDB con metadata completa
- **WHEN** TMDB devuelve una película con título, fecha de estreno, póster y descripción
- **THEN** Buscar recibe un resultado normalizado con referencia `tmdb/movie/<id>`, los valores visibles equivalentes y una URL absoluta de póster

#### Scenario: Serie TMDB con metadata completa
- **WHEN** TMDB devuelve una serie con nombre, primera fecha de emisión, póster y descripción
- **THEN** Buscar recibe un resultado normalizado con referencia `tmdb/tv/<id>`, los valores visibles equivalentes y la etiqueta actual de serie

#### Scenario: Resultado sin póster
- **WHEN** un resultado TMDB compatible no tiene ruta de póster
- **THEN** el resultado normalizado contiene póster nulo y Buscar conserva su presentación actual de póster ausente

#### Scenario: Recurso no compatible de búsqueda múltiple
- **WHEN** `/search/multi` devuelve un recurso que no es película ni TV
- **THEN** el adaptador lo excluye de los resultados entregados a Buscar como ocurre actualmente

### Requirement: Buscar conserva su comportamiento con la frontera normalizada
El sistema SHALL mantener Buscar respaldado únicamente por TMDB y SHALL preservar debounce, consulta vacía, estado de credencial, estados de carga y error, rechazo de respuestas obsoletas, etiquetas visibles y navegación actuales al consumir resultados normalizados.

#### Scenario: Navegación desde resultado normalizado
- **WHEN** el usuario abre un resultado normalizado con referencia `tmdb/movie/42`
- **THEN** la aplicación navega a `/tmdb/movie/42`

#### Scenario: Respuesta de una búsqueda anterior
- **WHEN** una respuesta remota llega después de que la consulta o generación de credencial vigente cambió
- **THEN** esa respuesta no reemplaza los resultados visibles de la búsqueda vigente

#### Scenario: TMDB no configurado
- **WHEN** el usuario escribe una consulta y la credencial TMDB no está configurada
- **THEN** Buscar conserva el mensaje y las acciones actuales sin ejecutar la consulta remota

### Requirement: Metadata portable de detalle normalizada
El sistema SHALL convertir un detalle compatible de un proveedor en `ProviderMediaDetails` compuesto por su `ProviderReference` y un `ProviderLocalSnapshot` compatible con el modelo `SavedTitle` actual: `TitleType`, título, año, URL absoluta de póster, resumen, `genres` como array readonly de strings normalizados y el campo snapshot `voteAverage`. El sistema SHALL NOT afirmar que estos campos definen una taxonomía universal, IDs de género, procedencia, reglas de normalización entre proveedores ni una ontología universal de puntuaciones. `ProviderMediaDetails` SHALL NOT contener `initialTags`. Un recurso que no pueda mapearse honestamente al modelo local actual SHALL quedar fuera de la frontera de guardado y materialización.

#### Scenario: Géneros normalizados desde un detalle TMDB
- **WHEN** se normaliza un detalle TMDB ya obtenido con nombres de géneros
- **THEN** el mapper puro incluye esos nombres en `snapshot.genres`, y la política TMDB puede suministrarlos por separado como `initialTags` desde la misma respuesta sin un segundo request

#### Scenario: Detalle TMDB sin géneros
- **WHEN** se normaliza un detalle TMDB sin géneros
- **THEN** `snapshot.genres` contiene un array vacío

#### Scenario: Detalle de película TMDB
- **WHEN** se normaliza un detalle TMDB de película válido
- **THEN** la salida contiene referencia canónica `tmdb/movie/<id>`, tipo local `movie` y los campos portables equivalentes

#### Scenario: Detalle de TV TMDB
- **WHEN** se normaliza un detalle TMDB de TV válido
- **THEN** la salida contiene referencia canónica `tmdb/tv/<id>`, tipo local `tv` y los campos portables equivalentes

#### Scenario: Fecha ausente o inválida
- **WHEN** el detalle remoto no contiene una fecha de la que pueda obtenerse un año válido
- **THEN** la metadata normalizada contiene año nulo

#### Scenario: Resumen vacío
- **WHEN** el detalle remoto contiene un resumen ausente o compuesto solamente por espacios
- **THEN** la metadata normalizada contiene resumen nulo

### Requirement: Identidad TMDB canónica en el adaptador
El adaptador TMDB SHALL producir referencias movie/TV conforme a la canonicalización y a la identidad completa definidas en `universal-media-identity`, sin trasladar la interpretación de IDs TMDB a la materialización genérica.

#### Scenario: ID numérico canónico
- **WHEN** el adaptador normaliza un recurso TMDB con un ID entero positivo
- **THEN** produce una `ProviderReference` con provider `tmdb`, namespace `movie` o `tv` y externalId decimal canónico

#### Scenario: Mismo ID en movie y TV
- **WHEN** TMDB tiene una película y una serie con el mismo ID numérico
- **THEN** ambas referencias permanecen distintas y pueden resolver MediaItems distintos

#### Scenario: ID TMDB inválido
- **WHEN** se intenta normalizar un ID TMDB que no representa un entero seguro y positivo
- **THEN** la integración rechaza el recurso antes de materializarlo o persistirlo

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
- **THEN** el sistema preserva ID local, `createdAt`, status, tags, notas, puntuación personal y todas las ProviderReferences existentes, actualiza los campos del snapshot remoto incluyendo `SavedTitle.genres` desde `snapshot.genres` y calcula `updatedAt` con la semántica vigente

### Requirement: Inicialización de tags definida por el proveedor
La materialización SHALL aceptar `initialTags` como input explícito de política local de creación, separado de `snapshot.genres`, y SHALL usarlos solamente para inicializar `SavedTitle.tags` de un MediaItem nuevo. Los tags existentes SHALL permanecer bajo propiedad del usuario después de la creación. La materialización SHALL NOT asumir que todo proveedor posee géneros ni que los géneros se convierten universalmente en tags.

#### Scenario: Primer guardado desde TMDB
- **WHEN** se guarda por primera vez un detalle TMDB con nombres de géneros
- **THEN** la política TMDB entrega esos nombres como tags iniciales y se conserva el comportamiento actual

#### Scenario: Refresh de un item con tags personalizados
- **WHEN** se refresca desde TMDB un MediaItem que ya contiene tags
- **THEN** sus tags existentes permanecen sin cambios e ignoran los `initialTags` entrantes, mientras `SavedTitle.genres` se actualiza desde `snapshot.genres`

#### Scenario: Géneros y tags iniciales distintos
- **WHEN** se crea un MediaItem con `snapshot.genres` e `initialTags` diferentes
- **THEN** `SavedTitle.genres` conserva la metadata del snapshot y `SavedTitle.tags` recibe exclusivamente los tags iniciales suministrados

### Requirement: Enriquecimientos TMDB permanecen específicos
El sistema SHALL mantener fuera del contrato portable los datos TMDB de runtime, runtime de episodios, cantidad de temporadas, reparto, equipo, director, rutas de perfiles, disponibilidad regional, logos y enlaces de plataformas.

#### Scenario: Detalle remoto completo
- **WHEN** `/tmdb/[type]/[id]` carga detalles, créditos y proveedores de visualización
- **THEN** la ruta conserva la presentación actual de esos enriquecimientos mediante la integración explícita de TMDB

#### Scenario: Falla de un enriquecimiento
- **WHEN** falla cualquiera de las consultas que actualmente forman el detalle remoto conjunto
- **THEN** la ruta conserva la semántica actual de fallo integral y no introduce renderizado parcial accidental

#### Scenario: Disponibilidad regional TMDB
- **WHEN** el detalle TMDB presenta proveedores de visualización
- **THEN** utiliza la disponibilidad de AR y, si no existe, la de US, manteniendo logos, imágenes de perfiles y enlaces dentro de la integración específica TMDB

### Requirement: Detalle portable desde una única respuesta TMDB
El sistema SHALL reutilizar una única respuesta tipada de detalle TMDB tanto para su presentación específica como para obtener metadata portable mediante mapeo puro. El adaptador SHALL interpretar title/name, release/first-air, poster-path, nombres de género y vote_average. `ProviderMediaDetails` más `initialTags` separados SHALL formar el input normalizado para el guardado y la materialización local, sin una capability remota de detalle neutral ni un request adicional.

#### Scenario: Guardado desde un detalle ya obtenido
- **WHEN** el usuario guarda o actualiza un detalle TMDB completo
- **THEN** la misma respuesta de detalle alimenta la presentación, el snapshot portable y la política separada de tags iniciales sin volver a solicitar el detalle

### Requirement: Límites de la frontera provider-neutral
La frontera compartida SHALL excluir credenciales, generación y lifecycle de credenciales, presentación de errores TMDB, rutas TMDB, créditos, watch providers, configuración y atribución. Esas funciones SHALL permanecer en la integración explícita TMDB conforme a `tmdb-user-credential`. La frontera SHALL consumir el modelo local y sus referencias sin redefinir los contratos de persistencia y backup de `universal-media-identity` y `library-backup-integrity`; el snapshot normalizado SHALL conservar compatibilidad con SQLite v4 y backup v5 sin introducir una migración o formato nuevo.

#### Scenario: Uso de funciones específicas TMDB
- **WHEN** Buscar o el detalle TMDB requiere configuración, manejo de errores, navegación o enriquecimientos
- **THEN** utiliza la integración específica TMDB sin imponer esos conceptos a los contratos portables

#### Scenario: Biblioteca y backups existentes
- **WHEN** se guarda o refresca metadata normalizada sobre una biblioteca existente
- **THEN** el snapshot y las referencias mantienen su forma persistida y su compatibilidad histórica según las capacidades canónicas existentes
