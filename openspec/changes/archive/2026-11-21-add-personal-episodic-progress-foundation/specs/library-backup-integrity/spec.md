## MODIFIED Requirements

### Requirement: Backup v9 exporta organización desde su primera persistencia
El contrato histórico v9 MUST incluir colecciones, membresías y recomendaciones, aun vacías, descartadas o con contenido filtrado. MUST conservar IDs estables, datos opcionales, captura original, estados, vínculos y timestamps; los títulos y todos los datos portables v8 MUST conservar sus contratos independientes. La exportación vigente v10 MUST conservar íntegramente esa organización y agregar progreso bajo su contrato propio; MUST NOT declarar v9 omitiendo progreso ya persistido. MUST obtener una instantánea coherente sin credenciales, binarios, estados de red ni preferencias locales de browsing. La sección de recomendaciones MUST ser opcional para aceptar archivos v9 anteriores que no incluían Inbox; ausencia y lista vacía MUST significar ninguna aportación, nunca borrado. MUST permitir exportar e importar todos esos datos persistidos; una versión de la aplicación que todavía no soporte una sección de recomendaciones no vacía MUST rechazarla antes de escribir, sin descartarla silenciosamente.

#### Scenario: Exportar cada entrega
- **WHEN** se exportan una colección vacía, otra poblada y recomendaciones en los tres estados desde la versión con progreso
- **THEN** el archivo declara v10 y contiene toda la organización, progreso y datos portables previos, sin omitir datos persistidos

#### Scenario: Filtrado o captura sin vínculo
- **WHEN** se exporta con contenido sensible oculto y recomendaciones Pendientes
- **THEN** se incluyen registros y membresías ocultos y contexto de las recomendaciones sin fabricar títulos ni arte descargado

## ADDED Requirements

### Requirement: Backup v10 transporta progreso completo y mantiene historia
La exportación vigente MUST declarar v10 e incluir la sección de progreso aun vacía, con referencia al item del archivo, variante, posición validada o restablecimiento explícito y timestamp propio. MUST incluir títulos filtrados y no perder decimales textuales, resets ni posiciones incompatibles conservadas. MUST conservar todos los datos portables v9. MUST aceptar v1–v9 bajo sus parsers/reglas históricas sin dar autoridad a campos de progreso añadidos a esas versiones; ausencia o lista vacía MUST NOT borrar progreso local. MUST rechazar JSON, versión o envoltorio inválido antes de escribir; registros inválidos MUST reportarse y aislarse sin afectar otros válidos.

#### Scenario: Round trip offline completo
- **WHEN** se exportan manuales, títulos multirreferenciados, decimales y resets y se restaura sin conexión
- **THEN** se conservan identidades, progreso y relojes, organización, metadata, pins, actividad y preferencias portables

#### Scenario: Historia sin autoridad nueva
- **WHEN** se importa v1–v9 con o sin campos de progreso añadidos
- **THEN** se procesa solo su contrato histórico y no se modifica ni borra progreso local

### Requirement: Progreso se restaura mediante identidad resuelta
El sistema MUST resolver títulos antes de progreso y usar el mapa de IDs del mismo archivo incluso si el título coincidente se preservó por frescura. MUST NOT asociar progreso por nombre, número mayor o ID ocupado accidentalmente. MUST reportar y omitir progreso cuyo título no se restaure o cuyas identidades sean contradictorias. Duplicados exactos MUST ser idempotentes; duplicados contradictorios por item de origen o destino resuelto MUST reportarse y omitirse para ese destino sin elegir uno por orden o timestamp.

#### Scenario: Remap y título preservado
- **WHEN** un título entrante resuelve otro ID local y sus personales se conservan por ser más recientes
- **THEN** el progreso elegible se procesa contra ese destino por su contrato independiente

#### Scenario: Colisión sin resolución
- **WHEN** un título no restaurable usa un ID ocupado por otra obra
- **THEN** su progreso no se asigna al ocupante y el resultado informa el problema

### Requirement: Conflictos de progreso conservadores y revisables
Sin registro local, el sistema MUST importar progreso válido incluido un reset. Ante igualdad de variante/posición/reset MUST conservar el registro local sin duplicar escrituras, cualquiera sea el reloj entrante. Ante discrepancia MUST conservar local y registrar un conflicto revisable con título, ambas posiciones/restablecimientos y timestamps, indicando que el reloj no prueba consumo ni precedencia de una corrección. MUST hacerlo incluso si el entrante es más reciente, menor o mayor. La revisión MUST permitir mantener local o aplicar explícitamente el entrante solo después de comprobar que título y progreso base no cambiaron; esa aplicación MUST ser una nueva decisión local fechada. MUST informar que el informe no persiste tras cerrar y permitir copiarlo/exportarlo completo sin truncamiento silencioso. Reimportar MUST NOT duplicar progreso, títulos ni eventos; un conflicto no resuelto puede volver a informarse.

#### Scenario: Corrección local frente a número y fecha mayores
- **WHEN** el local indica episodio 8 y el backup episodio 20 con timestamp posterior
- **THEN** se conserva 8 y ambas versiones aparecen en el informe para elección explícita

#### Scenario: Reset frente a ausencia o posición
- **WHEN** existe un reset local y se importa un backup histórico ausente de progreso o uno v10 con posición
- **THEN** el histórico no lo altera y el v10 genera conflicto sin resucitar automáticamente la posición

#### Scenario: Revisión obsoleta
- **WHEN** se solicita aplicar el entrante después de que cambió el progreso local o se eliminó el título
- **THEN** se rechaza la aplicación y se permite revisar nuevamente sin recrear el título ni sobrescribir cambios

### Requirement: Restauración íntegra con resultados reales
El sistema MUST aislar cada unidad de progreso inválida o fallida, mantener la transacción global y conservar las garantías previas de títulos, metadata, organización y preferencias. MUST informar insertados, iguales preservados, conflictos, inválidos y fallidos de progreso por separado del resultado de títulos; MUST mostrar todos los conflictos mediante revisión accesible, no solo los primeros cinco detalles históricos. Fallo global o de commit MUST revertir todos los writes y MUST NOT publicar invalidación, preferencias ni informe de éxito antes del commit. Una aplicación explícita posterior de conflicto MUST ser otra transacción validada y no repetir el import general.

#### Scenario: Fallo parcial y rollback global
- **WHEN** falla un registro de progreso o el commit final de una importación mixta
- **THEN** el registro aislado se informa sin escritura parcial y el fallo final revierte todos los datos de esa importación

#### Scenario: Segundo import y conflicto aplicado
- **WHEN** se reimporta el mismo archivo después de aplicar explícitamente una posición entrante
- **THEN** se reconoce igualdad semántica sin duplicar datos ni aplicar otra vez una modificación personal
