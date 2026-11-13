## Purpose

Incorporar un catálogo dedicado de anime mediante Kitsu, con uso vivo local de desarrollo autorizado y distribución pública sujeta a gates explícitos, reutilizando identidad y clasificación existentes.

## ADDED Requirements

### Requirement: activación condicionada de metadata y arte
El sistema MUST mantener Kitsu inactivo en builds de producción/distribución pública hasta documentar términos/políticas oficiales suficientemente compatibles o autorización externa expresa para tracker independiente, búsqueda/detalle, snapshots locales, retención y export/import/backups del uso previsto. MUST distinguir activación local de desarrollo, funcionalidad técnica verificada y elegibilidad de release. Por decisión explícita del usuario, builds locales __DEV__ Web/Android MUST permitir búsqueda/detalle vivos en https://kitsu.io/api/edge y guardado individual del snapshot mínimo vigente, sin requerir MediaReview TEST. Esta decisión MUST NOT presentarse como permiso externo de distribución o retención irrestricta. Release MUST requerir además prueba real de Android o Web/CORS correspondiente; desarrollo no validado MUST registrarse como tal. Arte MUST permanecer omitido, score Kitsu ausente, sin OAuth, scraping, descargas masivas, proxy ni fallback de host. TEST MUST conservar fixtures/transporte deterministas sin red real, incluso con desarrollo habilitado.

#### Scenario: desarrollo local autorizado
- **WHEN** se abre Buscar en un build local __DEV__ Web o Android
- **THEN** se ofrece Anime con búsqueda/detalle vivos, guardado explícito y consulta offline del snapshot guardado, conservando identidad y personales
- **AND** producción, iOS y plataformas desconocidas permanecen cerradas antes de fetch/guardado remoto, sin declarar M/T completados

#### Scenario: metadata no resuelta
- **WHEN** no hay evidencia suficiente sobre retención o backups
- **THEN** no se expone búsqueda/detalle/guardado Kitsu productivo ni se realizan solicitudes productivas por rutas directas

#### Scenario: metadata aprobada y arte pendiente
- **WHEN** metadata y una plataforma cumplen sus gates pero arte no
- **THEN** esa plataforma puede usar metadata con posterUrl null y placeholder sin solicitudes nuevas de imágenes Kitsu

#### Scenario: plataforma no validada
- **WHEN** Web funciona en HTTP de escritorio pero no fue validada en navegador real
- **THEN** no se declara Web/CORS aceptado ni se habilita release público por ese resultado, aunque desarrollo local esté autorizado

### Requirement: una categoría Anime y referencias explícitas
En desarrollo local autorizado, y en release solo al superar sus gates, el sistema MUST ofrecer una categoría Anime que incluya todos los formatos admitidos y use búsqueda/detalle Kitsu específicos. MUST guardar referencia provider kitsu, namespace anime e ID decimal positivo canónico como string sin conversión numérica insegura; MUST comprobar correspondencia entre ID pedido y recibido. MUST NOT adjuntar mappings externos recibidos ni asociar obras a manuales, TMDB u otros proveedores automáticamente.

#### Scenario: misma obra en dos proveedores
- **WHEN** se guarda un resultado Kitsu cuyo título coincide con uno TMDB
- **THEN** se resuelve únicamente por kitsu/anime/ID y no se reutiliza el otro item por similitud

#### Scenario: re-save y navegación
- **WHEN** se guarda nuevamente la misma referencia y se abre desde Biblioteca
- **THEN** conserva el mismo ID local/datos personales y abre su detalle local independiente del acceso remoto

#### Scenario: ID inconsistente
- **WHEN** el detalle devuelve otro ID o un ID inválido
- **THEN** se rechaza sin guardar ni navegar a un recurso fabricado

### Requirement: mapping anime explícito y conservador
El sistema MUST mapear anime a audiovisual/anime y TV→tv, movie→movie, OVA→ova, ONA→ona, special→special y music→music. Subtipo ausente/desconocido MUST producir primaryFormat null sin heurísticas por episodios, duración, título o géneros. MUST conservar title válido, year nullable, resumen textual seguro y géneros narrativos aprobados; MUST usar initialTags vacío y MUST omitir totalmente voteAverage. MUST mantener clasificación TMDB existente y refresh monotónico actual.

#### Scenario: ONA y subtipo desconocido
- **WHEN** se normalizan un ONA explícito y otro anime de subtipo nuevo
- **THEN** se obtienen audiovisual/anime/ona y audiovisual/anime/null respectivamente

#### Scenario: score remoto y refresh
- **WHEN** Kitsu devuelve score y metadata nueva de un item guardado
- **THEN** no suministra voteAverage ni altera rating personal/tags/notas/pins y conserva clasificación conocida según refresh vigente

### Requirement: errores y solicitudes anime aislados
El sistema MUST tratar errores Kitsu de red, timeout, 404, 429, servidor y payload inválido con mensajes/reintento propios, sin pedir credenciales TMDB ni borrar la biblioteca. MUST espaciar solicitudes, limitar concurrencia/reintentos y respetar Retry-After válido. MUST descartar respuestas obsoletas por query/categoría/fuente/secuencia y mantener detalle local utilizable offline. MUST NOT incorporar OAuth personal, SDK, proxy o backend para eludir gates.

#### Scenario: throttling y respuesta obsoleta
- **WHEN** una solicitud recibe 429 o llega después de cambiar de fuente
- **THEN** respeta Retry-After válido sin reintentar antes, informa esperas excesivas o inválidas de forma segura y no muestra resultados de una búsqueda anterior ni inicia un bucle de reintentos

#### Scenario: pérdida de conexión
- **WHEN** falla el catálogo y se abre un anime ya guardado
- **THEN** su snapshot y campos personales continúan disponibles con placeholder cuando la imagen no está disponible

