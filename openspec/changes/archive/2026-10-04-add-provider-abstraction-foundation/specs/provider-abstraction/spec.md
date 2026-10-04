## Purpose

Define una frontera remota estrecha y estable para que la búsqueda, el detalle portable y el guardado local consuman datos normalizados sin depender de DTOs crudos de TMDB ni alterar la identidad local.

## ADDED Requirements

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
El sistema SHALL mantener la construcción y validación de identidades numéricas TMDB dentro de la integración TMDB y SHALL conservar como referencias distintas `tmdb/movie/N` y `tmdb/tv/N`.

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
El sistema SHALL materializar metadata remota normalizada usando la `ProviderReference` como puente hacia un MediaItem y sin requerir que la lógica de preservación compruebe que el proveedor sea TMDB.

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

### Requirement: Compatibilidad persistente sin migraciones
El sistema SHALL conservar SQLite schema v4, backup v5, importación histórica v1–v4 y las reglas canónicas existentes de `ProviderReference` sin migrar datos ni cambiar formatos.

#### Scenario: Biblioteca existente
- **WHEN** la aplicación actualizada abre una base SQLite v4 existente
- **THEN** los MediaItems y sus referencias continúan resolviendo sin una migración de esquema

#### Scenario: Backup vigente
- **WHEN** el usuario exporta o importa una biblioteca después del cambio
- **THEN** el formato continúa siendo v5 y mantiene la compatibilidad histórica existente

### Requirement: Configuración y atribución permanecen específicas de TMDB
El sistema SHALL conservar sin generalizar el almacenamiento, validación, UI, errores y generación de credenciales TMDB, así como la atribución vigente de TMDB y JustWatch.

#### Scenario: Credencial TMDB
- **WHEN** el usuario configura, cambia o elimina su token TMDB
- **THEN** se mantienen SecureStore o localStorage, validación, mensajes y semántica de generación actuales, sin persistir la credencial en SQLite ni incluirla en backups

#### Scenario: Acerca de y créditos
- **WHEN** el usuario abre la pantalla de créditos
- **THEN** continúa viendo la atribución TMDB y JustWatch vigente
