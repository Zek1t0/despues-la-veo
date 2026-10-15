## Purpose

Permitir organizar obras audiovisuales, cómics y literatura con clasificación local honesta, portable e independiente de las identidades externas y de los datos personales.

## ADDED Requirements

### Requirement: clasificación local en dimensiones independientes
El sistema MUST representar cada item mediante medium obligatorio audiovisual, comic o literature; contentFamily anime, manga, manhwa, manhua o null; y primaryFormat movie, tv, ova, ona, special, music, webtoon, one-shot, novel, light-novel o null. MUST persistir las tres dimensiones sin usar type como autoridad paralela. MUST aceptar familia/formato null sin interpretar ausencia como occidental, live action o ausencia de animación.

#### Scenario: película de anime y manga genérico
- **WHEN** se guarda una película identificada explícitamente como anime y una obra identificada solamente como manga
- **THEN** la primera conserva audiovisual/anime/movie y la segunda comic/manga/null
- **AND** sus referencias externas permanecen independientes de esa clasificación

#### Scenario: cómic occidental y novela local
- **WHEN** se representa un cómic sin familia clasificada y una novela ordinaria
- **THEN** se aceptan comic/null/null y literature/null/novel sin requerir proveedor o familia

### Requirement: clasificación compatible sin precisión fabricada
El sistema MUST aceptar anime solo en audiovisual, manga/manhwa/manhua solo en comic y familia null para literature. MUST aceptar formatos audiovisuales solo en audiovisual, webtoon/one-shot solo en comic y novel/light-novel solo en literature. MUST rechazar clasificación local o backup incompatible sin escritura parcial. MUST normalizar formato remoto ambiguo a null cuando el medio sea conocido, y MUST excluir del guardado recursos cuyo medio no pueda establecerse. MUST NOT inferir clasificación por título, géneros, estado de publicación, conteos o namespace sin garantía expresa del contrato del proveedor.

#### Scenario: manhwa sin garantía de webtoon
- **WHEN** la metadata solo identifica manhwa
- **THEN** se conserva comic/manhwa/null sin inferir webtoon

#### Scenario: formato remoto desconocido
- **WHEN** una fuente identifica anime pero tiene un subtipo desconocido
- **THEN** el snapshot puede ser audiovisual/anime/null sin inventar tv

#### Scenario: medio y formato contradictorios
- **WHEN** se intenta guardar literature/anime/tv o comic/manga/novel
- **THEN** se rechaza la operación y no se modifica el item existente

### Requirement: clasificación refinable y monotónica en refresh de proveedor
Al crear un item el sistema MUST exigir medium y persistir contentFamily/primaryFormat mapeados, incluidos null. Al refrescar MUST rechazar medium diferente antes de escribir; para cada campo nullable MUST refinar null existente con no-null entrante válido y MUST conservar no-null existente ante null entrante o un no-null distinto. MUST permitir que el resto de un refresh válido continúe sin cambiar clasificación conocida; MUST NOT inventar prioridad o fusión. Estas reglas MUST NOT aplicarse a restauración de backup v6, donde null explícito elegible representa estado local restaurable.

#### Scenario: TMDB no borra familia anime
- **WHEN** audiovisual/anime/movie recibe refresh TMDB audiovisual/null/movie
- **THEN** conserva anime/movie y el resto de metadata suministrada puede refrescarse

#### Scenario: formato desconocido se refina
- **WHEN** comic/manga/null recibe refresh aprobado comic/manga/one-shot
- **THEN** primaryFormat pasa a one-shot sin cambiar identidad ni datos personales

#### Scenario: formato webtoon no se degrada
- **WHEN** comic/manhwa/webtoon recibe refresh comic/manhwa/null
- **THEN** conserva webtoon

#### Scenario: clasificación conocida diferente
- **WHEN** comic/manhwa/webtoon recibe snapshot válido comic/manga/one-shot con título nuevo
- **THEN** conserva manhwa/webtoon y puede actualizar el título según refresh vigente

### Requirement: namespace externo no es autoridad de formato local
El sistema MUST conservar namespaces como identidad de recursos externos y MUST NOT exigir igualdad permanente con primaryFormat. Una referencia TMDB MUST ser movie/TV canónica y pertenecer a un item de medium audiovisual; MUST NOT imponer familia ni formato local. Mapeos iniciales movie/TV MUST permanecer propuestas de clasificación del adaptador, sujetas al refresh monotónico en items existentes.

#### Scenario: OVA con referencia movie
- **WHEN** un item audiovisual/anime/ova tiene referencia TMDB movie válida
- **THEN** runtime y backup v6 aceptan esa clasificación y el link usa namespace movie sin convertir ova a movie

#### Scenario: medium incompatible con TMDB
- **WHEN** se intenta persistir o restaurar un item comic con referencia TMDB movie
- **THEN** se rechaza por incompatibilidad de medio, sin inferir el formato desde el namespace

### Requirement: evolución SQLite v5 preserva datos existentes
El sistema MUST evolucionar SQLite v4 a v5 sin red ni reset, reemplazando type por las tres dimensiones persistidas. MUST mapear movie a audiovisual/null/movie y tv a audiovisual/null/tv sin heurísticas de anime. MUST preservar IDs opacos, datos personales, snapshots restantes, createdAt/updatedAt exactos, referencias, identidades legacy, pins/pinnedAt y preferencias. MUST publicar versión nueva solo después de verificar integridad y MUST revertir toda migración fallida.

#### Scenario: migración de película y TV con metadata completa
- **WHEN** se migra una biblioteca v4 con referencias TMDB movie/TV de igual ID y datos personales distintos
- **THEN** ambas obras conservan IDs locales, identidad completa y relaciones independientes con la clasificación convertida
- **AND** títulos, géneros, rating TMDB, rating personal, notas, tags, estados y timestamps no cambian

#### Scenario: fallo y reapertura
- **WHEN** falla una fase de copia o verificación antes de publicar v5
- **THEN** la base conserva el estado anterior completo
- **AND** una reapertura tras migración exitosa no duplica ni remigra filas

#### Scenario: instalación histórica o nueva
- **WHEN** se abre una instalación válida anterior a v4 o una instalación vacía
- **THEN** la primera conserva su conversión histórica antes de llegar a v5 y la segunda crea directamente v5
- **AND** una versión futura o type histórico inválido se rechaza sin borrar datos

### Requirement: estado personal se presenta según medio
El sistema MUST conservar planned/watching/done/dropped y sus semánticas personales. MUST presentar watching como Viendo para audiovisual, Leyendo para comic/literature y En curso en filtros mixtos. MUST NOT reemplazar estado personal con estado de publicación ni introducir progreso por guardar metadata.

#### Scenario: lectura de manga en publicación
- **WHEN** un manga en publicación está marcado watching por el usuario
- **THEN** el detalle local muestra Leyendo y la publicación externa no modifica ese estado

#### Scenario: filtro global
- **WHEN** se filtran items watching de distintos medios
- **THEN** el filtro se presenta como En curso y incluye obras vistas y leídas

### Requirement: detalle local útil sin red
El sistema MUST mostrar por ID local la clasificación, título, año útil nullable, resumen textual, géneros, tags, notas, estado y rating personal sin consultar proveedores. MUST mostrar placeholder si la portada no está disponible y MUST NOT garantizar portada offline solamente por persistir URL. MUST presentar inicio/publicación para el año de obras comic/literature y MUST omitir atribuciones o ratings TMDB inaplicables.

#### Scenario: manga sin portada ni fecha
- **WHEN** se abre sin red un manga guardado con posterUrl/year/overview null
- **THEN** la obra sigue identificable y editable en sus campos personales con placeholder y sin fechas fabricadas

#### Scenario: varias referencias
- **WHEN** se abre un item con cero o varias referencias
- **THEN** el detalle local funciona sin elegir una fuente arbitraria ni exigir una referencia singular

