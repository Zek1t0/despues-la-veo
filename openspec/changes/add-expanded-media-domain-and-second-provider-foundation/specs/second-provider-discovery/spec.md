## Purpose

Separar la intención de búsqueda por categoría y habilitar una segunda fuente real únicamente después de verificar su elegibilidad, conservando la biblioteca local y los flujos TMDB.

## ADDED Requirements

### Requirement: una categoría y fuente por búsqueda activa
El sistema MUST permitir categorías explícitas con una única fuente responsable por solicitud, conservando películas/series TMDB. MUST NOT buscar simultáneamente fuentes diferentes, combinar rankings, deduplicar obras ni inferir equivalencia. Producción MUST mostrar únicamente categorías con fuente productiva aprobada y realmente disponible. Antes del gate MUST conservar la experiencia TMDB actual y MUST NOT mostrar categorías futuras Anime/Manga ni siquiera deshabilitadas, ejecutar red nueva o abrir fixtures. Tests pueden usar stubs y la revisión dev aislada puede mostrar categorías sintéticas; no son catálogo productivo.

#### Scenario: preparación sin proveedor elegido
- **WHEN** se usa Buscar antes del gate de elegibilidad
- **THEN** se conserva la experiencia TMDB según su configuración sin categorías futuras visibles

#### Scenario: fuente activa aprobada
- **WHEN** el usuario busca anime en una categoría habilitada
- **THEN** se consulta solo la fuente aprobada para esa categoría y se identifica su procedencia
- **AND** su categoría se hace visible/habilitada como parte de la entrega real posterior al gate

### Requirement: respuestas obsoletas incluyen categoría y fuente
El sistema MUST impedir que una respuesta, error o loading de una categoría/fuente anterior reemplace la categoría vigente, aun con query idéntica. MUST mantener debounce, retry y lifecycle de credencial TMDB en su categoría sin imponerlos a una fuente que no los necesita.

#### Scenario: cambio con query idéntica
- **WHEN** una búsqueda anterior responde después de cambiar de categoría sin cambiar el texto
- **THEN** su resultado o error se ignora y no sobrescribe los de la nueva categoría

#### Scenario: TMDB no configurado
- **WHEN** una fuente aprobada sin credencial está activa y TMDB no tiene token
- **THEN** esa categoría puede buscar sin configurar TMDB
- **AND** películas/series conserva el estado y acciones específicas TMDB

### Requirement: gate de elegibilidad precede integración real
El sistema MUST NOT activar una fuente nueva sin decisión explícita sustentada en evidencia primaria de API, permiso para tracker independiente, snapshots offline/retención, export/import, imágenes, atribución, autenticación, límites, web/móvil y licencias/procedencia upstream relevantes. AniList MUST permanecer indisponible sin permiso expreso; Kitsu, MAL y MangaBaka MUST permanecer candidatos no aprobados mientras sus condiciones pendientes no estén resueltas. Fixtures MUST NOT sustituir esa evidencia.

#### Scenario: API técnicamente accesible sin permiso de almacenamiento
- **WHEN** una fuente permite discovery pero no están resueltas condiciones de snapshots y backups
- **THEN** sus verticales reales continúan bloqueados y el trabajo neutral puede revisarse por separado

#### Scenario: requisito incompatible con alcance
- **WHEN** el candidato requiere backend, secretos inseguros, cuentas/sync o cambios de infraestructura no aprobados
- **THEN** no se activa y se revisan los artefactos antes de continuar el trabajo dependiente

### Requirement: vertical real aprobado utiliza identidad y snapshot portables
Después del gate, el sistema MUST permitir descubrir, abrir detalle remoto específico y guardar/refresh anime y manga/familias adyacentes que el mismo proveedor aprobado soporte legalmente. MUST canonicalizar IDs y namespaces según su contrato, persistir mediante referencia completa y preservar datos personales. MUST usar rutas específicas sin ruta remota universal y MUST mantener detalles enriquecidos propios de la fuente fuera del snapshot local.

#### Scenario: anime aprobado y guardado repetido
- **WHEN** se guarda y vuelve a guardar una obra anime de la fuente aprobada
- **THEN** se actualiza el mismo item local y el detalle local queda utilizable sin red

#### Scenario: manga con formato ambiguo
- **WHEN** la fuente aprobada identifica manga sin formato estructural inequívoco
- **THEN** se guarda como comic/manga/null sin inferir formato por conteos o publicación

#### Scenario: cobertura limitada de candidato
- **WHEN** una fuente elegible solo cubre manga
- **THEN** no se afirma entregado el vertical anime ni se agrega automáticamente un tercer proveedor

### Requirement: integración conserva configuración e imágenes específicas
El sistema MUST exigir solo autenticación realmente necesaria para metadata y MUST NOT distribuir secretos de cliente ni introducir cuentas/sync para discovery. MUST cumplir atribución específica y entregar posterUrl absoluto o null conforme a condiciones de imágenes. MUST aplicar límites y reintentos de la fuente sin consultar red para el detalle local.

#### Scenario: metadata pública sin auth
- **WHEN** la fuente aprobada permite discovery público sin credencial
- **THEN** no se solicita cuenta, OAuth o settings de credencial innecesarios

#### Scenario: imagen restringida o fallida
- **WHEN** una portada no puede mostrarse bajo las condiciones aprobadas
- **THEN** se presenta placeholder sin eludir restricciones ni inventar garantía offline

