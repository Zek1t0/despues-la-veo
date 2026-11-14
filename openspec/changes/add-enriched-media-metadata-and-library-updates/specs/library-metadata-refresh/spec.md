## Purpose

Actualizar metadata de títulos guardados de forma manual o automática controlada, preservando el contenido local y respetando las capacidades reales de cada proveedor.

## ADDED Requirements

### Requirement: Actualización individual preserva propiedad local
El sistema MUST ofrecer actualizar metadata desde el detalle guardado cuando una fuente compatible esté disponible. MUST modificar solamente campos propiedad de esa fuente, conservar identidad, notas, tags, estado, pins/favoritos existentes, rating personal y modificaciones personales. MUST mostrar el contenido local durante la consulta y mantenerlo ante fallo, 404 o respuesta inválida; no convertir manuales a remotos. Un cambio remoto confirmado MUST propagarse a biblioteca, tarjetas, detalles y selectores montados mediante invalidación poscommit de sus lecturas locales, sin avanzar updatedAt personal ni exigir salir y volver a la pantalla. MUST preservar borradores/ediciones concurrentes, descartar lecturas obsoletas y no publicar cambios revertidos.

#### Scenario: Edición simultánea
- **WHEN** el usuario modifica notas mientras se consulta metadata y luego la respuesta llega
- **THEN** se aplica la metadata validada sobre el estado local vigente y la nota nueva permanece intacta
- **AND** la UI muestra la metadata confirmada preservando borradores/intents, y su invalidación no altera updatedAt personal ni revierte la nota

#### Scenario: Cambio remoto visible sin navegar
- **WHEN** se confirma un cambio remoto mientras biblioteca o detalle están montados
- **THEN** las tarjetas, el detalle y los selectores afectados releen la proyección confirmada sin navegación ni nueva consulta HTTP
- **AND** las vistas no montadas obtienen el mismo estado al recuperar foco

#### Scenario: Consulta exitosa sin cambios
- **WHEN** la consulta confirma metadata idéntica a la guardada
- **THEN** se actualizan frescura y progreso observables sin evento de cambio, invalidación de presentación innecesaria ni modificación del timestamp personal

#### Scenario: Fallo de commit
- **WHEN** se revierte la transacción de actualización de metadata
- **THEN** no se notifica una nueva proyección a la UI ni se muestra un cambio no confirmado

#### Scenario: Borrado durante consulta
- **WHEN** se elimina el título antes de que termine la consulta
- **THEN** la respuesta se descarta sin recrear el título ni publicar un evento de cambio inexistente

#### Scenario: Manual o fuente bloqueada
- **WHEN** se consulta una ficha manual o un proveedor no disponible en la plataforma
- **THEN** la acción explica su indisponibilidad y no realiza HTTP ni cambia identidades

### Requirement: Revisión global explícita y parcial
El sistema MUST permitir iniciar desde Actualizaciones una revisión de toda la biblioteca, incluida la oculta por filtros visuales. MUST informar total, procesados, cambios, sin cambios, omitidos, fallidos y cancelados/pendientes; respetar disponibilidad, credenciales, concurrencia, throttling, Retry-After y políticas de cada fuente. MUST permitir cancelación del trabajo pendiente y descartar resultados no confirmados después de cancelar; los cambios ya confirmados permanecen.

#### Scenario: Biblioteca mixta
- **WHEN** se revisan TMDB, MangaUpdates, Kitsu y títulos manuales en Web
- **THEN** se actualizan solo capacidades habilitadas, se explican omisiones por plataforma/credencial/manual y cada fallo conserva la ficha anterior
- **AND** Kitsu producción/iOS y MangaUpdates Web/iOS no se habilitan por este flujo

#### Scenario: Rate limit y cancelación
- **WHEN** una fuente responde 429 y el usuario cancela la revisión
- **THEN** se respeta la espera indicada sin bucle de reintentos, se detiene lo pendiente y se muestra un resumen parcial coherente

### Requirement: Actualización automática configurable y local primero
El sistema MUST permitir habilitar/deshabilitar actualización automática y configurar su intervalo. El default aprobado para esta entrega MUST ser habilitada al abrir una ficha elegible con intervalo inicial de 7 días. Al abrir una ficha guardada desactualizada MUST evaluar elegibilidad y consultar en segundo plano solo si corresponde, manteniendo el contenido local. MUST evitar consultas duplicadas, repetición continua tras errores y revisiones globales automáticas al iniciar por defecto. Tras fallos MUST aplicar cooldown de ingeniería de 15 minutos a intentos automáticos sin acortar esperas mayores del proveedor. Estos defaults MUST identificarse como políticas propias del producto, no cuotas ni condiciones externas.

#### Scenario: Metadata reciente
- **WHEN** se abre repetidamente una ficha cuya consulta exitosa está dentro del intervalo
- **THEN** no se consulta de nuevo ni se registra cada apertura en actividad

#### Scenario: Metadata antigua o sin fecha
- **WHEN** se abre una ficha sin consulta exitosa conocida o con intervalo vencido y la actualización automática está habilitada
- **THEN** se conserva visible el snapshot local y se inicia como máximo una consulta elegible compartida por ficha/fuente

#### Scenario: Preferencia desactivada y reloj anómalo
- **WHEN** la actualización está desactivada o un reloj futuro hace inseguro inferir frescura
- **THEN** no se genera una tormenta de consultas y siguen disponibles el contenido local y la actualización manual

#### Scenario: Defaults y espera mayor
- **WHEN** no existe preferencia guardada, la última consulta exitosa ocurrió hace 7 días y el título es elegible
- **THEN** la apertura permite una consulta automática y el usuario puede cambiar intervalo o desactivarla
- **AND** si falla se esperan 15 minutos para otro intento automático, o más si el proveedor exige una espera mayor

### Requirement: Presencia null y fechas independientes
El sistema MUST distinguir campo omitido, desconocido explícito y eliminación confirmada por la semántica de la fuente. MUST preservar ante omisión o valor inválido; aplicar null/colección vacía solo cuando el campo se haya consultado y la fuente lo defina como valor autoritativo. MUST separar intento, consulta exitosa, cambio de metadata, fecha del proveedor y modificación personal. Una consulta sin cambios MUST actualizar frescura sin producir actividad de cambio.

#### Scenario: Respuesta parcial
- **WHEN** el proveedor omite un campo fuera de su proyección o una relación no está completa
- **THEN** se conserva el valor local y no se interpreta la omisión como borrado

#### Scenario: Null autoritativo
- **WHEN** una consulta completa entrega null válido para un campo que admite desconocido
- **THEN** la ficha pasa a desconocido para ese campo sin tocar datos personales

#### Scenario: Varias referencias
- **WHEN** una ficha posee varias referencias externas válidas
- **THEN** la revisión usa la fuente explícitamente asociada a su snapshot o solicita una selección si es ambigua, sin matching ni combinación automática de puntuaciones
