## MODIFIED Requirements

### Requirement: Metadata portable de detalle normalizada
El sistema SHALL convertir un detalle compatible de un proveedor en `ProviderMediaDetails` compuesto por su `ProviderReference` y un `ProviderLocalSnapshot` compatible con el modelo `SavedTitle` actual: medium, contentFamily y primaryFormat compatibles, título, año útil nullable, URL absoluta de póster, resumen textual, `genres` como array readonly de strings normalizados y suministro opcional del campo legacy TMDB `voteAverage`. El sistema SHALL NOT afirmar que estos campos definen una taxonomía universal ni equivalencias de categorías o puntuaciones entre fuentes. SHALL admitir metadata enriquecida validada y acotada, con títulos/idiomas, imágenes por URL, puntuación pública con valor original/escala/proveedor, fechas, estado editorial, episodios, duraciones, edad/advertencias y procedencia. Los campos no suministrados SHALL permanecer desconocidos y voteAverage SHALL conservar exclusivamente su contrato legacy TMDB. `ProviderMediaDetails` SHALL NOT contener `initialTags`. Un recurso que no pueda mapearse honestamente al modelo local actual SHALL quedar fuera de la frontera de guardado y materialización.

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

#### Scenario: Enriquecimiento Kitsu separado
- **WHEN** Kitsu entrega puntuación e imágenes válidas
- **THEN** la frontera expone metadata enriquecida con su fuente y no suministra voteAverage para Kitsu


### Requirement: Límites de la frontera provider-neutral
La frontera compartida SHALL excluir credenciales, generación y lifecycle de credenciales, presentación de errores TMDB, rutas TMDB, créditos, watch providers, configuración y atribución. Esas funciones SHALL permanecer en la integración explícita de cada fuente, con TMDB conforme a `tmdb-user-credential`. La frontera SHALL consumir el modelo local y sus referencias sin redefinir los contratos de persistencia y backup de `universal-media-identity` y `library-backup-integrity`; el snapshot normalizado SHALL conservar la clasificación expandida y las identidades vigentes, con evolución compatible desde SQLite v6 y backup v7 a la persistencia enriquecida. SHALL admitir capacidades explícitas y opcionales de actualización, manteniendo disponibilidad, credenciales, cuotas y semántica HTTP dentro de cada integración, sin imponer un endpoint universal ni habilitar fuentes bloqueadas.

#### Scenario: Uso de funciones específicas TMDB
- **WHEN** Buscar o el detalle TMDB requiere configuración, manejo de errores, navegación o enriquecimientos
- **THEN** utiliza la integración específica TMDB sin imponer esos conceptos a los contratos portables

#### Scenario: Biblioteca y backups existentes
- **WHEN** se guarda o refresca metadata normalizada sobre una biblioteca existente
- **THEN** el snapshot usa la clasificación nueva, las referencias mantienen su forma genérica y los datos anteriores se conservan mediante conversión compatible según las capacidades canónicas existentes
