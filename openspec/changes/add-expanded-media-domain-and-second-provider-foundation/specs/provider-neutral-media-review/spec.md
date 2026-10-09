## Purpose

Ofrecer un recorrido de revisión seguro con obras originales sintéticas que pruebe los contratos y el guardado local antes de autorizar una fuente real adicional.

## ADDED Requirements

### Requirement: revisión sintética aislada de datos personales
El sistema MUST permitir una revisión manual opt-in exclusivamente de desarrollo en una biblioteca de prueba físicamente separada. MUST identificar claramente los datos como sintéticos y MUST NOT abrir, leer o escribir la biblioteca personal durante la sesión. Fixtures MUST NOT constituir una fuente productiva, requerir credenciales reales ni persistir referencias mock en datos reales. Release y desarrollo sin opt-in MUST NOT habilitar el catálogo sintético.

#### Scenario: revisión explícita
- **WHEN** un desarrollador entra deliberadamente al recorrido de revisión
- **THEN** ve un aviso de aislamiento y las acciones de guardado/importación afectan exclusivamente la biblioteca de prueba

#### Scenario: build release o ausencia de opt-in
- **WHEN** se intenta acceder al recorrido fuera de desarrollo opt-in
- **THEN** no se muestran fixtures ni se abre almacenamiento de revisión

### Requirement: recorrido sintético consume el comportamiento real
La revisión MUST ofrecer resultado de búsqueda, detalle, guardado, Biblioteca y detalle local por ID, edición personal, pins, refresh y export/import usando las mismas reglas de identidad, materialización, persistencia y presentación que producción. MUST NOT simular éxito sustituyendo reglas de guardado o renderizar copias independientes de las superficies locales. El harness MUST crear referencias fixture-review solo en datos de sesión y archivos TEST, sin registrarlas como fuente productiva.

#### Scenario: recorrido completo y refresh
- **WHEN** se guarda una fixture, se editan estado/tags/notas/rating y pins, y luego se refresca metadata de la misma referencia
- **THEN** se mantiene el ID local, createdAt, referencias y datos personales
- **AND** se actualizan solo campos remotos suministrados conforme a propiedad y compatibilidad

#### Scenario: identidad completa
- **WHEN** dos fixtures tienen igual externalId en namespaces distintos
- **THEN** pueden guardarse como items independientes y volver a resolverse sin cruzar datos

### Requirement: revisión cubre formatos y metadata incompleta
Las fixtures MUST ser originales y cubrir anime TV/movie/OVA/ONA/special/music, manga general/one-shot, manhwa webtoon explícito, manhua, cómic occidental, novela/light novel, clasificación nullable, portada/año/resumen ausentes, géneros vacíos, texto largo y markup. MUST cubrir clasificación inválida y presencia/propiedad del rating legacy, sin utilizar obras copiadas de un catálogo.

#### Scenario: metadata incompleta y lectura
- **WHEN** se revisa una obra de lectura sin imagen, año ni resumen
- **THEN** cards y detalle mantienen labels coherentes y estados personales editables sin inventar metadata

### Requirement: revisión portable sin falsear identidad
La revisión MUST exportar backup v6 de los items sintéticos exportables, identificar archivos/artifacts como TEST y restaurarlos únicamente por su flujo aislado en la segunda DB de revisión, preservando clasificación, referencias y pins. El harness MUST NOT abrir/escribir/importar en la DB personal, incluidos preferencias, credenciales y bootstrap. MUST conservar el rechazo productivo de exportar un local-only sin identidad portable. MUST NOT añadir campos universales, rechazo especial de fixture-review en importer, adaptador productivo, registry entry ni fuente runtime. Esta garantía cubre el harness, no la selección manual externa de un archivo TEST estructuralmente válido: producción continúa aceptando ProviderReferences genéricas desconocidas bajo el contrato vigente.

#### Scenario: round-trip aislado
- **WHEN** se exporta y restaura la biblioteca sintética con referencias en la segunda base de prueba
- **THEN** se conservan los datos locales y pins con su identidad correcta
- **AND** completar esta revisión no habilita proveedores ni completa tareas reales bloqueadas

#### Scenario: archivo TEST fuera del harness
- **WHEN** un desarrollador selecciona manualmente fuera del harness un backup TEST válido con referencia fixture-review
- **THEN** el contrato genérico de importación no incorpora un rechazo por ese token ni lo convierte en fuente productiva
- **AND** la revisión no afirma impedir esa acción externa

#### Scenario: refresh y restauración tienen semánticas distintas
- **WHEN** fixtures ejercitan los cuatro casos monotónicos de clasificación y una OVA audiovisual con referencia TMDB movie válida
- **THEN** refresh conserva clasificación conocida, refina desconocida y acepta namespace distinto de formato
- **AND** restauración v6 posterior con null explícito puede borrar familia/formato conocidos en la segunda DB aislada

#### Scenario: local-only sin identidad portable
- **WHEN** se presenta un local-only sintético sin referencias ni identidad legacy y se intenta exportarlo
- **THEN** se puede revisar localmente pero la exportación reporta la restricción de identidad vigente

