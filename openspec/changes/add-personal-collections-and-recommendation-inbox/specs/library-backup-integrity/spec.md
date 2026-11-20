## ADDED Requirements

### Requirement: Backup v9 exporta organización desde su primera persistencia
El sistema MUST exportar v9 desde S1 incluyendo colecciones y membresías, y MUST incluir recomendaciones desde S2, aun vacías, descartadas o con contenido filtrado. MUST conservar IDs estables, datos opcionales, captura original, estados, vínculos y timestamps; los títulos y todos los datos portables v8 MUST conservar sus contratos independientes. MUST obtener una instantánea coherente sin credenciales, binarios, estados de red ni preferencias locales de browsing. La sección de recomendaciones MUST ser opcional para aceptar los v9 emitidos en S1; ausencia y lista vacía MUST significar ninguna aportación, nunca borrado. Desde S1 MUST exportar e importar colecciones/membresías v9 con round trip real; un build S1 MUST rechazar antes de escribir una sección recomendaciones no vacía todavía no soportada, sin descartarla silenciosamente; desde S2 MUST ampliar ambas operaciones para Inbox. S3 MUST profundizar cobertura sin postergar recuperación básica.

#### Scenario: Exportar cada entrega
- **WHEN** se exporta en S1 una colección vacía y otra poblada, o en S2 recomendaciones en los tres estados
- **THEN** el archivo declara v9 y contiene todos los nuevos datos ya persistidos, junto con los datos portables previos, sin exigir esperar a S3

#### Scenario: Filtrado o captura sin vínculo
- **WHEN** se exporta con contenido sensible oculto y recomendaciones Pendientes
- **THEN** se incluyen registros y membresías ocultos y contexto de las recomendaciones sin fabricar títulos ni arte descargado

### Requirement: Restauración v9 resuelve títulos antes de organización
Desde S1 el sistema MUST validar v9 para colecciones/membresías y desde S2 para recomendaciones, y MUST restaurar primero títulos bajo sus reglas de identidad, personales y metadata; después colecciones y finalmente membresías/vínculos usando el mapa de IDs del mismo archivo. MUST NOT usar nombres o IDs de títulos ocupados como equivalencia ni asociar una relación al ocupante cuando el título de origen no se restauró. Membresías sin colección o título resoluble MUST reportarse y omitirse. Una recomendación Incorporada cuyo título no se resuelve MUST conservarse Pendiente sin vínculo y con contexto original, reportando la degradación; otros estados con vínculo MUST rechazarse como registro incoherente. MUST preservar colección vacía y recomendaciones sin título.

#### Scenario: Remap de título
- **WHEN** un título portable se restaura con otro ID local y una colección y recomendación lo referencian
- **THEN** ambas relaciones apuntan al destino resuelto, conservando los IDs estables de colección y recomendación

#### Scenario: Destino no restaurable
- **WHEN** un item falla o contradice identidades y su ID entrante coincide con un ocupante local
- **THEN** no se vincula al ocupante, se omite su membresía con informe y se conserva la recomendación elegible como Pendiente con contexto

### Requirement: Merge estable y aditivo de organización
El sistema MUST combinar colecciones y recomendaciones por sus IDs estables, aplicar contenido entrante solo si updatedAt es estrictamente posterior y conservar el dato local ante igualdad, incluida createdAt local. MUST usar la pareja colección/título resuelto para la unicidad de membresías y su updatedAt propio para resolver su addedAt; MUST NOT cambiar el reloj de contenido de una colección por agregar o retirar miembros. MUST validar identidad y coherencia antes de frescura: un mismo ID de recomendación con captura original contradictoria MUST reportarse como conflicto; IDs distintos con referencia compartida MUST conservarse independientemente sin fusionar contextos, reasignar identidad ni escribir parcialmente. Ausencia de secciones, registros o membresías MUST NOT borrar datos locales. Imports repetidos MUST NOT duplicar títulos, colecciones, membresías, recomendaciones ni eventos. Sin tombstones MUST NOT prometer propagar eliminaciones.

#### Scenario: Nuevo viejo e igual
- **WHEN** se importan registros del mismo ID más nuevos, más viejos y con igual timestamp que los locales
- **THEN** solo los más nuevos reemplazan su contenido mutable, y los iguales conservan exactamente el contenido local

#### Scenario: Reimportación y ausencia
- **WHEN** se importa dos veces un archivo y luego otro sin recomendaciones ni una membresía local existente
- **THEN** no aparecen duplicados ni se elimina la recomendación o membresía ausente

#### Scenario: Referencia compartida entre recomendaciones
- **WHEN** una recomendación entrante con ID distinto comparte la referencia completa de una local
- **THEN** se conservan ambas recomendaciones y sus contextos independientes sin duplicar el título de Biblioteca

### Requirement: Compatibilidad v1 a v8 y errores íntegros
El sistema MUST conservar parsers, validaciones, presencia/null, resolución portable y reglas de frescura históricas v1–v8, incluidos conflictos defensivos de archivos antiguos sin identidad portable. MUST NOT otorgar autoridad a campos v9 añadidos a versiones anteriores. MUST validar tipos, IDs no vacíos, timestamps finitos seguros no negativos, campos opcionales, estados, referencias, relaciones duplicadas y enlaces antes de aplicarlos. MUST rechazar archivos JSON/envoltorios/versiones no soportadas sin escrituras; errores de registro MUST seguir la política parcial existente con aislamiento por registro/unidad relacional, resultados reales y rollback de esa unidad. Fallo global/commit MUST revertir toda la transacción y no publicar preferencias ni invalidación de éxito antes del commit. MUST preservar datos personales, metadata por sus relojes, pins, actividad y preferencias portables vigentes sin red.

#### Scenario: Historia no reinterpreta campos modernos
- **WHEN** se importa v1–v8 con campos de colecciones o recomendaciones añadidos
- **THEN** solo se usa su contrato histórico y la organización local se conserva

#### Scenario: Registro inválido y fallo global
- **WHEN** hay un registro nuevo malformado o falla el commit final
- **THEN** el primero se informa y aísla sin writes parciales, mientras que el fallo global revierte todos los writes de esa importación y no anuncia éxito

#### Scenario: Round trip mixto sin red
- **WHEN** se exporta v9 y se restaura en otra biblioteca con títulos manuales y multirreferenciados, colecciones vacías/pobladas y recomendaciones en los tres estados
- **THEN** conserva datos e identidades resolubles, contexto, fechas y personales sin consultas remotas y una segunda importación no genera duplicados
