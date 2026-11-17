## Purpose

Ofrecer una vista local de revisiones de biblioteca y actividad relevante, agrupada por fechas y coherente con los patrones visuales y de navegación existentes.

## ADDED Requirements

### Requirement: Pestaña Actualizaciones integrada
El sistema MUST incluir una pestaña inferior Actualizaciones junto a las existentes, con última revisión de biblioteca, acción global, progreso, resultados/errores y actividad reciente. MUST agrupar actividad por fecha local y permitir Todos, Metadata y Mi actividad; respetar temas, safe areas, accesibilidad y pantallas estrechas.

#### Scenario: Sin actividad y offline
- **WHEN** se abre Actualizaciones sin eventos y sin conexión
- **THEN** muestra estado vacío comprensible, última revisión si existe y acceso al contenido local sin cargar indefinidamente

#### Scenario: Filtros y cambio de día
- **WHEN** existen eventos de metadata y personales en distintas fechas
- **THEN** Todos muestra ambos, Metadata solo cambios remotos y Mi actividad solo acciones personales, con agrupación por fecha local y orden estable

### Requirement: Eventos relevantes confirmados
El sistema MUST registrar títulos añadidos, cambios reales de metadata y modificaciones personales confirmadas. MUST agrupar en un evento los campos de una misma mutación y no guardar notas completas ni valores personales sensibles en el evento. MUST NOT registrar aperturas, intentos fallidos como cambios ni cientos de eventos Sin cambios; estos últimos resultados pertenecen al resumen de revisión. MUST NOT registrar historial de lectura/reproducción.

#### Scenario: Revisión sin cambios
- **WHEN** se consultan 500 fichas y ninguna cambia
- **THEN** queda un resumen de revisión sin 500 entradas de actividad

#### Scenario: Mutación fallida o repetida
- **WHEN** falla una escritura o se reintenta una operación ya confirmada
- **THEN** no aparece un evento falso ni duplicado de la misma operación

#### Scenario: Cambios personales
- **WHEN** se confirma alta, edición manual, cambio de estado, tags, nota, rating personal o pin
- **THEN** aparece una actividad resumida con tipo de modificación y fecha, sin copiar la nota ni atribuirla al proveedor

### Requirement: Historial acotado y eliminación segura
El sistema MUST almacenar historial y resúmenes localmente y no impedir usar la biblioteca al podarlos. La política inicial aprobada MUST conservar eventos hasta 90 días o 2000 registros y revisiones hasta 30 días o 20 registros, aplicando en cada caso el primer límite alcanzado. MUST conservar hasta 100 detalles de error por revisión con contadores agregados completos e indicar truncamiento cuando corresponda. Los límites MUST presentarse como defaults del producto y no condiciones de proveedores. Al eliminar una obra MUST eliminar sus eventos identificables, conservar solo resúmenes agregados sin su referencia, impedir enlaces colgantes y no recrear obras desde eventos. Una revisión interrumpida por cierre MUST mostrarse como interrumpida, nunca completada por inferencia; la poda MUST NOT eliminar una revisión en curso.

#### Scenario: Retención y borrado
- **WHEN** se alcanza el límite acordado o se borra una obra
- **THEN** se aplica la política documentada, el feed conserva consistencia y no aparecen fichas inexistentes navegables

#### Scenario: Cierre durante revisión
- **WHEN** se reinicia la app tras una revisión incompleta
- **THEN** se muestra su resultado parcial como interrumpido y no se reanuda una revisión global automáticamente

#### Scenario: Límites iniciales y errores agregados
- **WHEN** se superan 2000 eventos o hay eventos con más de 90 días, o se superan 20 revisiones terminadas o 30 días de antigüedad
- **THEN** se podan los registros más antiguos que exceden los límites conservando revisiones en curso
- **AND** una revisión con 150 errores conserva hasta 100 detalles, indica truncamiento y mantiene el total agregado de 150
