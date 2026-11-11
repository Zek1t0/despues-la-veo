# second-provider-discovery Specification

## Purpose

Separar búsqueda por categoría y entregar Manga/Manhwa/Manhua con MangaUpdates en plataformas elegibles, conservando TMDB y una biblioteca local portable. Anime y literatura remota no son entregables de este change.

## Requirements

### Requirement: una categoría y fuente por búsqueda activa
El sistema MUST organizar Buscar por categorías de medios, con proveedor como atribución secundaria: Películas y Series → TMDB; Manga, Manhwa y Manhua → MangaUpdates. Cada request MUST tener una categoría y una fuente seleccionadas. MUST NOT combinar rankings, buscar fuentes en paralelo, hacer matching/fusión/deduplicación ni usar la marca del proveedor como navegación principal. MUST exponer únicamente categorías elegibles cuyo adaptador y transporte real sean utilizables/validados en la plataforma activa; antes de esa entrega las categorías MangaUpdates MUST permanecer invisibles, sin opciones deshabilitadas. Anime MUST quedar fuera de discovery de este milestone. Fixtures/stubs solo son revisión dev aislada, nunca catálogo productivo.

#### Scenario: categoría nativa disponible
- **WHEN** el usuario busca en Manhwa en una plataforma elegible validada
- **THEN** se consulta únicamente MangaUpdates con filtro type Manhwa y se valida también el tipo de los records recibidos
- **AND** Manga/Manhua usan sus filtros específicos sin ranking combinado

#### Scenario: preparación sin adaptador disponible
- **WHEN** se usa Buscar antes de la entrega elegible MangaUpdates
- **THEN** se conserva TMDB y no se muestran categorías nuevas ni se consultan fixtures/candidatos desde producción

### Requirement: respuestas obsoletas incluyen categoría y fuente
El sistema MUST incluir query, categoría, source/provider, sequence/retry y generación de configuración relevante solo donde aplica en la identidad de solicitud y visibilidad de resultados/loading/errores. MUST descartar respuestas anteriores aun con query idéntica y conservar debounce/retry y estados propios de TMDB sin imponer su credencial a MangaUpdates.

#### Scenario: cambio con query idéntica
- **WHEN** una respuesta/error anterior llega tras cambiar de Manga a Manhwa con el mismo texto
- **THEN** no reemplaza resultados ni loading/error de la categoría vigente

#### Scenario: TMDB no configurado
- **WHEN** MangaUpdates está disponible en la plataforma activa y TMDB no tiene token
- **THEN** Manga/Manhwa/Manhua pueden buscar sin configurar TMDB
- **AND** Películas/Series conserva mensajes y acciones TMDB específicos

### Requirement: elegibilidad mediante políticas oficiales o autorización
La elegibilidad de la fuente MUST revisarse contra su uso documentado y sustentarse en términos/políticas API oficiales publicados suficientemente compatibles o autorización explícita del proveedor. MUST NOT requerir email/permiso humano individual en todos los casos, interpretar silencio/falta de respuesta como autorización ni tratar ausencia de prohibición como clearance completo. MUST documentar términos, tracker independiente, snapshots/retención, export/import/backups, imágenes/atribución, uso previsto, upstream pertinente, auth, límites y plataformas. Restricciones materiales incompatibles MUST bloquear el uso afectado; licencia de código, BYO-auth, fixtures y otros trackers MUST NOT sustituir esa evaluación.

#### Scenario: términos oficiales suficientes
- **WHEN** los términos publicados son suficientemente compatibles con el uso personal/open-source/no comercial acotado y la evaluación documenta condiciones e incertidumbres
- **THEN** puede proceder implementación conservadora sin exigir autorización individual por email
- **AND** no se afirma que MangaUpdates aprobó expresamente DespuésLaVeo ni que todos los derechos están resueltos

#### Scenario: silencio o restricción material
- **WHEN** falta respuesta del proveedor o existe una restricción material incompatible
- **THEN** el silencio no autoriza y el uso incompatible no se habilita

### Requirement: desarrollo conservador y release amplia son evaluaciones distintas
Este milestone MUST limitar MangaUpdates a search/detail iniciados por usuario, snapshots pequeños por obra seleccionada y backups locales v6, con atribución, caché y requests razonablemente espaciados. MUST NOT introducir bulk mirroring, scraping fuera de API, descarga permanente de portadas ni rating MangaUpdates en voteAverage. MUST registrar evidencia oficial observada (API pública/search-detail sin credenciales, atribución/caché/espaciado requeridos y prohibiciones de fraude/ilegalidad/spam/daño a DB) y áreas no expresamente resueltas de retención/backups/comercial/portadas. Antes de release materialmente más amplia/comercial MUST revisarse nuevamente términos y derechos pendientes; esta es política de ingeniería/elegibilidad, no certeza legal.

#### Scenario: guardado personal acotado
- **WHEN** el usuario selecciona una obra admitida y la guarda bajo la evaluación de desarrollo conservador
- **THEN** se persiste un snapshot pequeño y referencia completa, sin copiar el catálogo ni atribuir aprobación expresa al proveedor

#### Scenario: distribución materialmente más amplia
- **WHEN** se propone ampliar distribución o uso comercial
- **THEN** se exige nueva revisión de términos/derechos pendientes antes de esa release sin presentarla como entregable de este change

### Requirement: identidad MangaUpdates y clasificación local independientes
El sistema MUST usar provider mangaupdates, resourceNamespace series y externalId como series_id decimal canónico string, validado sin conversión numérica insegura ni restricción de 32 bits. MUST usar /mangaupdates/series/[id] para detalle remoto específico y mantener ID local opaco/provider-independent. MUST comprobar consistencia del ID recibido y MUST NOT sustituirlo por slug/título/ID legacy ni interpretar series como formato/medio local. Tipos admitidos MUST mapear Manga → comic/manga/null, Manhwa → comic/manhwa/null y Manhua → comic/manhua/null.

#### Scenario: ID grande y guardado repetido
- **WHEN** se guarda dos veces mangaupdates/series/15180124327
- **THEN** se resuelve el mismo item local por referencia completa sin truncar el ID ni reemplazar el ID local

#### Scenario: precisión no demostrada
- **WHEN** Manhwa contiene Webtoon/Webcomic o Manga contiene Based on a Webcomic/Webtoon, o search usa un filtro oneshots
- **THEN** el mapping inicial conserva primaryFormat null
- **AND** no infiere webtoon/one-shot/light-novel por país, categorías, título o conocimiento cultural

#### Scenario: tipo fuera de alcance
- **WHEN** search/detail devuelve Novel, Doujinshi, OEL, Artbook, Drama CD, Filipino, Indonesian, Thai, Vietnamese, Malaysian, Nordic, French, Spanish, German, Russian o tipo desconocido/no soportado
- **THEN** no se ofrece guardado mediante este vertical ni se amplía la taxonomía
- **AND** Novel compatible con literature/null/novel permanece diferido, sin fusionarse con un cómic relacionado

### Requirement: snapshot MangaUpdates conserva invariantes locales
El snapshot MUST contener título canónico válido, año inequívoco válido o null, posterUrl HTTPS absoluta permitida o null, descripción segura/legible o null, solo géneros narrativos aprobados y comic/familia admitida/primaryFormat null. MUST NOT importar demografía/categories indiscriminadamente. La creación MUST usar initialTags []; voteAverage MUST estar totalmente ausente, incluidos null/undefined propios, sin mapear bayesian_rating/rating_votes. MUST NOT añadir autores/artistas/publicación/capítulos/relaciones ni modelos de ratings persistidos. Guardado/refresh MUST reutilizar identidad completa y monotonicidad locales: medio diferente rechaza antes de escribir, null local puede refinarse, conocidos se conservan ante null/conflicto y otra metadata válida puede refrescar; datos personales/referencias/pins se preservan, genres puede refrescarse e initialTags solo aplica en creación.

#### Scenario: géneros mezclados y rating remoto
- **WHEN** una respuesta incluye Action, Shounen/Seinen, categorías y bayesian_rating
- **THEN** solo se admiten géneros narrativos aprobados, sin demografía/categorías como géneros o tags iniciales
- **AND** el snapshot no posee voteAverage y un item nuevo obtiene null por materialización local

#### Scenario: refresh de clasificación conocida
- **WHEN** un item comic/manhwa/webtoon recibe snapshot MangaUpdates comic/manhwa/null con título/géneros nuevos
- **THEN** conserva webtoon y campos personales mientras metadata externa válida puede actualizarse
- **AND** un voteAverage histórico TMDB permanece conservado si existía

### Requirement: disponibilidad real por plataforma y CORS honesto
La capacidad neutral del dominio MUST separarse de disponibilidad remota. Mientras MangaUpdates rechace Origin externo/preflight con 403, categorías y navegación remota MangaUpdates MUST permanecer ocultas/no disponibles en Web y MUST NOT emitir requests desde producción Web. Web MUST conservar TMDB y Biblioteca/detalle locales, incluido snapshot MangaUpdates importado, y permitir review neutral dev aislado. MUST NOT introducir proxy/backend, spoof de Origin/headers ni afirmar soporte Web MangaUpdates. Habilitación Web futura MUST requerir origen permitido o transporte legítimo de un change de infraestructura separado, sin cambiar identidad/taxonomía.

#### Scenario: browser transport bloqueado
- **WHEN** se abre Buscar en Web con CORS MangaUpdates bloqueado
- **THEN** solo se muestran categorías productivas utilizables, sin MangaUpdates ni opciones muertas
- **AND** TMDB/local siguen funcionando y el harness neutral no se presenta como API MangaUpdates

#### Scenario: plataforma sin validación nativa
- **WHEN** una plataforma nativa no ha pasado la validación real requerida para MangaUpdates
- **THEN** MangaUpdates permanece no habilitado en esa plataforma aunque la foundation técnica exista
- **AND** requests directos de diagnóstico, fixtures o pruebas HTTP de escritorio no sustituyen esa aceptación

#### Scenario: snapshot en plataforma sin adaptador usable
- **WHEN** se importa o abre localmente una obra MangaUpdates en Web sin transporte remoto
- **THEN** conserva identidad, clasificación, metadata y edición local sin consultar el proveedor ni ofrecer navegación remota inutilizable

### Requirement: configuración errores y uso de red específicos
MangaUpdates MUST exigir solo auth necesaria para las operaciones reales; search/detail públicos observados MUST NOT inducir cuenta/OAuth/settings/secret innecesarios. MUST aplicar caché y espaciado razonable compartidos, manejo limitado de 429/reintentos y errores propios de red/timeout/cancelación/HTTP/no encontrado/acceso rechazado/respuesta inválida. MUST NOT convertirlos en errores de credencial TMDB, añadir orquestación universal o consultar red para detalle local.

#### Scenario: fallo MangaUpdates
- **WHEN** search/detail falla o devuelve un DTO incompatible
- **THEN** se informa un error MangaUpdates y no se solicita credencial TMDB ni se guarda metadata parcial

### Requirement: atribución y portadas conservadoras
Detalle remoto MUST mostrar Datos: MangaUpdates y enlace/referencia de fuente apropiada; detalle local MUST reconocer provenance por ProviderReference donde expone fuentes; About MUST incluir atribución/enlace MangaUpdates. Atribución MUST NOT formar parte de identidad local. Permiso API MUST NOT presentarse como copyright de las portadas; display/hotlink/caché de arte MUST evaluarse por separado. Solo URL remota HTTPS permitida o null; MUST NOT añadir descarga permanente o binarios a backups.

Este milestone MUST entregar preparación técnica inactiva: búsqueda, detalle remoto y materialización productivos MangaUpdates MUST mantener política omit y posterUrl null. MUST NOT activar portadas reales ni presentar derechos o aceptación física de imágenes como obtenidos. Completar y archivar la preparación MUST depender de su verificación técnica, no de permiso de terceros ni de una respuesta del proveedor. Metadatos Android MUST seguir disponibles y Web/iOS MangaUpdates API MUST seguir deshabilitados.

Una futura activación independiente MUST verificar fundamentos suficientes para derechos/hotlink, caché transitoria del renderer, retención/export de URL y restricciones aplicables, además de aceptación física Android con arte real. URL pública, GET200, atribución u open-source MUST NOT considerarse por sí solos permiso. Estas condiciones futuras MUST NOT convertirse en tareas pendientes de cierre del presente milestone.

#### Scenario: portada restringida incierta o fallida
- **WHEN** no se puede permitir/mostrar una portada bajo condiciones y runtime documentados
- **THEN** se usa posterUrl null cuando corresponde y placeholder sin eludir restricciones
- **AND** el snapshot textual y el vertical sin portada siguen siendo útiles

#### Scenario: preparación completa con derechos pendientes
- **WHEN** la capacidad inactiva y sus pruebas técnicas/sintéticas pasan pero derechos y aceptación real siguen pendientes
- **THEN** la preparación puede completarse y archivarse después del flujo de revisión habitual
- **AND** producto permanece omit sin afirmar que activación fue entregada

#### Scenario: comportamiento productivo preservado
- **WHEN** se busca, abre y guarda una obra MangaUpdates en Android productivo
- **THEN** se mantiene metadata funcional con portada omitida, sin activar solicitudes de imagen del proveedor
- **AND** Web/iOS no obtienen nuevas categorías o rutas API operativas

### Requirement: validación nativa y cierre del milestone
Cada plataforma nativa que se habilite MUST validarse en runtime real para search/detail, cover/fallback, save/local detail, re-save/refresh, offline/persistencia, backup v6, atribución y errores propios, registrando plataforma/dispositivo/entorno realmente probado. Plataforma sin prueba MUST permanecer no habilitada/pending; MUST NOT afirmar iOS validado en Windows ni sustituir runtime por fixtures/browser estrecho. Cierre MUST incluir dominio expandido, persistencia/backup neutral, categorías finitas, review sintético, TMDB preservado y vertical real Manga/Manhwa/Manhua en plataformas nativas elegibles validadas. MUST NOT exigir anime ni MangaUpdates Web bloqueado, ni afirmar registry, ratings universales, libros o manual local entregados. La comprobación móvil separada 3.4 sigue requerida, sin alteración por este cambio de alcance.

#### Scenario: validación de plataforma concreta
- **WHEN** el vertical pasa pruebas reales en Android pero no se dispone de runtime iOS
- **THEN** se registra Android validado e iOS pendiente/no habilitado, sin extrapolar resultados
- **AND** no se considera completado ningún check requerido mediante actualización de texto

#### Scenario: ningún runtime nativo validado
- **WHEN** solo existen pruebas HTTP de escritorio, fixtures o navegador estrecho
- **THEN** el vertical real permanece pendiente y no se habilita en producción
- **AND** se exige al menos una plataforma nativa elegible con validación real y prueba propia de cada plataforma habilitada

#### Scenario: cierre sin anime ni transporte Web
- **WHEN** pasan todas las comprobaciones del alcance y MangaUpdates real funciona en plataformas nativas elegibles validadas, con Web preservado y honesto
- **THEN** anime diferido y MangaUpdates Web bloqueado no impiden cerrar el milestone
- **AND** roadmap anime/Open Library/manual/ExternalRating/protocolos/lectura no se convierte en tareas de esta entrega

### Requirement: selección inicial segura de portada preparada
La capacidad técnica preparada MUST seleccionar original inicialmente válido, luego thumbnail inicialmente válido del mismo registro, luego null. MUST aceptar exclusivamente HTTPS absoluto del host inicial exacto cdn.mangaupdates.com, sin credenciales, puertos inesperados ni formas inseguras; MUST NOT ampliar hosts para tests, buscar imágenes de otros registros/proveedores ni hacer sondeos de imagen. Esta capacidad MUST ser comprobable sin activar uso productivo.

La validación inicial MUST NOT presentarse como enforcement del destino final tras redirects del renderer/nativo. Esa limitación MUST documentarse y la futura aceptación real MUST evaluar redirects y condiciones; si no pueden satisfacerse, la futura activación MUST permanecer bloqueada. MUST NOT añadir proxy, descargador propio ni infraestructura de red en esta preparación.

#### Scenario: selección mediante entradas controladas
- **WHEN** tests de URL reciben strings controlados del host aprobado para original y thumbnail
- **THEN** eligen original válido, thumbnail si original falta/es inválido, o null si ambos son inválidos
- **AND** no solicitan arte real y el producto sigue omit

#### Scenario: candidato inseguro y redirects no verificados
- **WHEN** un candidato inicial usa otro host, esquema inseguro, credenciales, puerto inesperado o forma insegura
- **THEN** ese candidato se rechaza sin solicitarlo
- **AND** aceptar otro candidato inicial válido no se reporta como prueba del destino final del renderer

### Requirement: rendering y fallback comprobables sin arte de terceros
Las superficies existentes con poster —búsqueda Detalle/Mosaico, detalle remoto, Biblioteca Detalle/Mosaico, detalle local y collages pertinentes— MUST estar preparadas para imagen/fallback usando assets propios por composición test-only, separada de pruebas de URL-policy. MUST NOT introducir bypass, toggle productivo o ampliación de allowlist para esos assets. Ausencia, fallo HTTP/red/decode MUST mostrar placeholder preservando layout, navegación, accesibilidad y guardado; error visual MUST NOT mutar datos. Cambio de ID/URL MUST permitir cargar la nueva imagen sin arrastrar error anterior.

#### Scenario: fallo y reciclado con asset propio
- **WHEN** una imagen propia de prueba falla y la misma vista recibe otra URL o identidad
- **THEN** muestra placeholder ante el fallo y puede cargar la nueva imagen normalmente
- **AND** no altera posterUrl persistido ni bloquea navegación/save

#### Scenario: offline sintético
- **WHEN** se abre detalle local de prueba sin red ni imagen disponible en caché
- **THEN** datos locales siguen legibles/editables con placeholder sin consulta API MangaUpdates requerida
- **AND** no se promete disponibilidad offline de portadas

### Requirement: compatibilidad de posterUrl verificada en preparación
La preparación MUST verificar mediante datos sintéticos/strings controlados y pipeline real que posterUrl URL/null conserva SQLite v5 y backup v6/import histórico v1–v6, sin binarios, sentinels, campos o versiones nuevas. Re-save MUST mantener título por referencia completa, ID opaco, createdAt, clasificación y datos personales/pins según contratos existentes. MangaUpdates MUST NOT poseer voteAverage; initialTags MUST seguir [] creación-only. Refresh MUST conservar semántica actual incluida sustitución por null, sin backfill ni preservación monotónica de covers. La capacidad URL en tests MUST NOT activar materialización productiva con portada.

#### Scenario: round-trip y re-save técnicos
- **WHEN** pruebas aisladas guardan/re-guardan y exportan/importan registros URL/null con referencias de IDs grandes
- **THEN** verifican identidad, clasificación y datos personales/pins según merge existente sin duplicación
- **AND** refresh con null puede limpiar URL mientras producción sigue omit y otros títulos no reciben backfill

#### Scenario: datos anteriores y plataformas preservadas
- **WHEN** Web/iOS leen o editan títulos guardados/importados con referencias MangaUpdates
- **THEN** conservan compatibilidad local sin requerir API MangaUpdates ni activar nuevas funciones remotas
- **AND** no se modifica contrato genérico histórico de URLs ni se afirma que URLs existentes no puedan generar GET del renderer
