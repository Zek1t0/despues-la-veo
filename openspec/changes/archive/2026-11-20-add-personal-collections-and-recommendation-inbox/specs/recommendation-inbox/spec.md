## Purpose

Conservar sugerencias locales con su contexto original y resolver su incorporación deliberada a Biblioteca sin convertir pendientes en títulos ni duplicar sus datos personales.

## ADDED Requirements

### Requirement: Captura offline independiente de Biblioteca
El sistema MUST registrar recomendaciones con ID estable, createdAt/updatedAt, captura original por nombre, enlace HTTP(S) o referencia completa y persona, origen y comentario opcionales. MUST admitir captura sin conexión ni credenciales y sin descargar metadata, seguir enlaces o consultar previews automáticamente. MUST conservar el contexto original al resolver o editar, con campos editables separados de la captura original. MUST exigir al menos un identificador no vacío válido; nombres libres MUST tratarse como texto, enlaces MUST ser HTTP(S) absolutos válidos y referencias MUST respetar su identidad completa. MUST rechazar entradas inválidas sin escritura parcial y mostrar mensajes recuperables. Inbox MUST NOT almacenar estado de visionado, rating, tags, notas personales del título ni un catálogo editorial paralelo.

#### Scenario: Sugerencia por nombre sin red
- **WHEN** se registra un nombre con persona y comentario offline
- **THEN** aparece Pendiente con contexto conservado y no aparece ningún título nuevo en Biblioteca

#### Scenario: Enlace inválido o sin proveedor reconocido
- **WHEN** se introduce un enlace con esquema no HTTP(S), o un enlace HTTP(S) válido que no identifica un proveedor soportado
- **THEN** el primero se rechaza y el segundo se conserva como contexto sin fetch ni identidad externa inventada

#### Scenario: Editar conservando origen
- **WHEN** se corrige el nombre o comentario después de registrar la sugerencia
- **THEN** cambia la versión editable y su updatedAt, pero sigue recuperable la captura original

### Requirement: Estados y transiciones explícitos
El sistema MUST ofrecer Pendiente, Incorporada y Descartada. Incorporada MUST requerir un vínculo a un título existente; Pendiente y Descartada MUST carecer de vínculo activo. MUST permitir editar, descartar y reabrir registros sin borrar su contexto original. Descartar una Incorporada MUST retirar solo el vínculo; reabrir MUST pasar a Pendiente y retirar cualquier vínculo, sin modificar el título. Editar MUST NOT incorporar automáticamente ni cambiar identidad del título vinculado. La lista MUST distinguir los estados y permitir consultar los tres sin presentar Inbox como Biblioteca.

#### Scenario: Descartar y reabrir
- **WHEN** se descarta una recomendación incorporada y luego se reabre
- **THEN** queda Pendiente sin vínculo, conserva contexto original y el título continúa intacto en Biblioteca

#### Scenario: Estado incoherente
- **WHEN** se intenta declarar Incorporada sin título válido
- **THEN** se rechaza sin publicar una transición parcial

### Requirement: Resolver localmente antes de buscar proveedores
El sistema MUST resolver primero referencias externas fuertes contra identidades locales completas y ofrecer candidatos locales por nombre sin tratar similitud como identidad. MUST exigir confirmación manual para cualquier coincidencia por nombre, incluidas ambiguas, mostrando datos suficientes para distinguirlas. MUST buscar proveedores solo por acción explícita, respetando credenciales, gates, plataformas, errores y políticas vigentes; MUST NOT buscar al escribir, pegar o abrir una recomendación ni hacer fallback remoto automático ante cero coincidencias. MUST descartar resultados obsoletos al editar la consulta o abandonar el flujo.

#### Scenario: Nombres ambiguos
- **WHEN** hay varios títulos locales de nombre similar
- **THEN** muestra candidatos, no vincula ninguno sin elección explícita y permite mantener Pendiente

#### Scenario: Identidad fuerte local con proveedor cerrado
- **WHEN** una referencia completa ya pertenece a un título local y el proveedor no está habilitado
- **THEN** permite confirmar el vínculo local sin consultar ni habilitar el proveedor

#### Scenario: Búsqueda explícita bloqueada o fallida
- **WHEN** el usuario solicita buscar en un proveedor cuyo gate está cerrado o falla la red
- **THEN** informa la restricción o error, conserva la recomendación y permite continuar con acciones locales sin llamadas que eludan el gate

### Requirement: Vinculación conservadora e incorporación idempotente
El sistema MUST permitir vincular un título existente sin sobrescribir estado, notas, tags, rating, metadata, identidades, pins ni timestamps del título. MUST permitir incorporar un título nuevo solo tras selección remota válida o creación manual explícita con los campos requeridos por el dominio; el nombre de una sugerencia no basta para fabricar clasificación. MUST verificar de nuevo identidad externa fuerte antes de crear y usar el título existente si ya apareció, sin refrescarlo por vincularlo. MUST impedir duplicar títulos por referencia fuerte y repetir la misma intención de recomendación por ID estable. MUST permitir recomendaciones distintas con la misma referencia y varias Incorporadas sobre el mismo título. Coincidencia de nombre o URL genérica MUST NOT deduplicar. Si una sugerencia comparte referencia MUST ofrecer revisar las existentes y permitir otra recomendación independiente, sin fusionar ni borrar contextos.

#### Scenario: Vincular un título con datos personales
- **WHEN** se incorpora una recomendación vinculándola a un título existente
- **THEN** queda Incorporada y el título conserva exactamente sus campos y timestamps

#### Scenario: Doble incorporación o alta concurrente
- **WHEN** se repite incorporar la misma referencia o el título fue guardado mientras se elegía
- **THEN** se obtiene un solo título y un vínculo confirmado sin refresh incidental ni duplicados

#### Scenario: Misma referencia sugerida otra vez
- **WHEN** se captura una identidad externa fuerte ya registrada en cualquiera de los estados
- **THEN** se ofrecen las recomendaciones existentes para revisión y se permite registrar otra con ID distinto, persona/comentario/captura propios y el mismo título sin duplicarlo

#### Scenario: Crear manualmente
- **WHEN** una sugerencia no tiene coincidencias y el usuario elige crear una entrada manual con clasificación válida
- **THEN** se crea bajo el contrato manual vigente y se vincula sin fabricar proveedor o equivalencias por nombre

### Requirement: Eliminación vinculada y fallos recuperables
Al eliminar un título de Biblioteca el sistema MUST devolver todas sus recomendaciones vinculadas a Pendiente, conservar captura/contexto y desvincularlas en la misma operación íntegra que elimina el título y sus relaciones. La incorporación de un título nuevo y su vínculo MUST confirmarse juntos; si falla cualquier paso MUST revertirse y conservarse la recomendación previa. MUST comunicar el último estado confirmado y permitir reintentar tras cierre, cancelación o fallo sin duplicados. MUST NOT eliminar títulos al descartar, reabrir o editar recomendaciones.

#### Scenario: Título eliminado
- **WHEN** se elimina de Biblioteca un título con recomendaciones incorporadas
- **THEN** quedan Pendientes sin vínculos huérfanos y mantienen nombres/enlaces/referencias y contexto original

#### Scenario: Fallo entre crear y vincular
- **WHEN** falla la incorporación tras preparar un título nuevo pero antes del commit
- **THEN** no persiste el título parcial ni la transición y se puede repetir desde la recomendación intacta

#### Scenario: Usabilidad y compatibilidad
- **WHEN** se abre Inbox tras actualizar una instalación anterior o se opera con fuente ampliada en Android/Web
- **THEN** los datos anteriores permanecen intactos, Inbox inicia vacío cuando corresponde y el formulario, estados y acciones son accesibles bajo los mismos criterios de Organizar
