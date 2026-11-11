## MODIFIED Requirements

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

## ADDED Requirements

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
