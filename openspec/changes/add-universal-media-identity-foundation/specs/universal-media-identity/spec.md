## Purpose

Establecer una identidad local estable para cada contenido guardado y separar de ella las referencias calificadas a recursos externos, sin ampliar todavía la taxonomía ni los proveedores disponibles.

## ADDED Requirements

### Requirement: cada MediaItem conserva una identidad local estable
El sistema MUST identificar cada MediaItem guardado mediante un ID local opaco, independiente de cualquier proveedor, MUST preservar ese ID durante actualizaciones de metadata y MUST mantener asociados a él el estado, tags, notas, puntuación personal, timestamps y pins.

#### Scenario: actualización desde TMDB
- **GIVEN** un MediaItem existente con datos personales y una referencia TMDB
- **WHEN** se vuelve a guardar metadata del mismo recurso TMDB
- **THEN** conserva su ID local, `createdAt` y todos sus datos personales según los contratos vigentes
- **AND** avanza o conserva `updatedAt` exactamente según la semántica vigente de refresh de metadata, sin congelarlo ni reinterpretarlo como un timestamp exclusivamente personal

#### Scenario: detalle local sin red
- **GIVEN** un MediaItem previamente guardado
- **WHEN** TMDB o la red no están disponibles
- **THEN** el detalle `/title/[id]` continúa resolviendo el snapshot y los datos personales por su ID local

#### Scenario: formato del ID histórico
- **GIVEN** un MediaItem existente cuyo ID es un string opaco que no tiene formato UUID
- **WHEN** se migra o actualiza el MediaItem
- **THEN** el sistema acepta y preserva ese ID sin reinterpretarlo ni reemplazarlo por su formato

### Requirement: las referencias externas califican completamente el recurso del proveedor
El sistema MUST representar una referencia externa mediante proveedor, namespace de recurso propio de ese proveedor e ID externo, MUST tratar esa combinación completa como identidad del recurso externo y MUST mantenerla separada del tipo de contenido usado por el dominio o la presentación.

#### Scenario: IDs TMDB iguales en namespaces distintos
- **WHEN** se guardan `tmdb/movie/123` y `tmdb/tv/123`
- **THEN** ambos recursos pueden coexistir como referencias distintas
- **AND** cada uno resuelve exclusivamente su MediaItem correspondiente

#### Scenario: referencia duplicada
- **GIVEN** una referencia externa concreta ya asociada a un MediaItem
- **WHEN** se intenta asociar la misma combinación de proveedor, namespace e ID externo a otro MediaItem
- **THEN** la operación se rechaza sin trasladar datos personales ni metadata entre los MediaItems

#### Scenario: namespace y tipo de contenido difieren conceptualmente
- **WHEN** el sistema usa `movie` o `tv` para seleccionar un recurso TMDB
- **THEN** ese valor se conserva como namespace de TMDB sin establecerlo como taxonomía universal de todos los proveedores

### Requirement: la igualdad de ProviderReference usa valores canónicos almacenados
El sistema MUST almacenar `provider` y `resourceNamespace` como tokens canónicos no vacíos y sin whitespace inicial o final, MUST comparar referencias por los valores canónicos almacenados de `provider + resourceNamespace + externalId`, y MUST mantener `externalId` opaco en la capa universal. Cada adaptador MUST producir la representación canónica del ID externo para su propio proveedor.

#### Scenario: token con whitespace exterior
- **WHEN** se intenta persistir un provider o resourceNamespace con whitespace inicial, final o como único contenido
- **THEN** la referencia se rechaza o se canonicaliza antes de alcanzar storage
- **AND** nunca se almacena como una identidad distinta del token canónico

#### Scenario: igualdad por clave canónica
- **GIVEN** dos referencias con los mismos valores canónicos almacenados de provider, namespace e ID externo
- **WHEN** se comparan o persisten
- **THEN** representan la misma referencia lógica y no pueden identificar MediaItems distintos

#### Scenario: ID externo de proveedor futuro
- **WHEN** la capa universal recibe un ID externo canónico de un adaptador
- **THEN** lo conserva como string opaco sin aplicar reglas inventadas para otros proveedores

#### Scenario: canonicalización TMDB
- **WHEN** una ruta o DTO representa el mismo ID numérico TMDB con formato textual diferente
- **THEN** el adaptador produce exactamente `provider=tmdb`, namespace `movie` o `tv` y una única representación decimal de ese ID
- **AND** las variantes no crean referencias lógicas duplicadas

### Requirement: un MediaItem admite cero o varias referencias externas
El sistema MUST permitir que un MediaItem no tenga referencias externas o tenga varias, y MUST garantizar que borrar un MediaItem elimine sus referencias sin dejar referencias huérfanas.

#### Scenario: item local sin proveedor
- **WHEN** existe un MediaItem manual o local-only
- **THEN** puede conservarse y utilizarse sin fabricar una referencia a un proveedor llamado `manual`

#### Scenario: varias referencias estructuralmente válidas
- **WHEN** un MediaItem contiene más de una referencia externa válida
- **THEN** el modelo puede conservarlas sin duplicar el MediaItem ni sus datos personales

#### Scenario: eliminación del item
- **GIVEN** un MediaItem con una o más referencias externas
- **WHEN** el usuario elimina el MediaItem
- **THEN** se eliminan sus referencias y pins relacionados dentro de la misma mutación íntegra

### Requirement: los consumidores locales usan MediaItem y sus referencias sin proyección singular
El sistema MUST listar y cargar MediaItems mediante su ID local y su colección completa de ProviderReferences, MUST mantener Biblioteca y `/title/[id]` utilizables con cero o varias referencias, y MUST NOT elegir una ProviderReference arbitraria para satisfacer el contrato singular histórico. Rating, tags, notas, status, pins, filtros, ordenamientos y detalle offline MUST depender del MediaItem y su snapshot local, no de la presencia de provider.

#### Scenario: item con múltiples referencias en Biblioteca y detalle local
- **GIVEN** un MediaItem con varias ProviderReferences válidas
- **WHEN** se lista mediante las APIs de lectura usadas por Biblioteca y se abre `/title/[id]`
- **THEN** el item y todos sus datos personales permanecen utilizables
- **AND** los consumidores no requieren campos singulares `provider` o `externalId`

#### Scenario: link remoto desde una referencia TMDB reconocida
- **GIVEN** un MediaItem local con una referencia TMDB reconocida entre cero o varias referencias
- **WHEN** se presenta su detalle local
- **THEN** puede ofrecer el link remoto TMDB derivado de esa referencia completa
- **AND** no trata una referencia genérica distinta como sustituto de TMDB

#### Scenario: item local-only sin identidad portable histórica
- **GIVEN** un item v5 defensivo sin ProviderReferences ni identidad legacy que fue importado con un ID libre
- **WHEN** Biblioteca lo lista o `/title/[id]` lo carga sin red ni credencial TMDB
- **THEN** el snapshot, rating, tags, notas, status y pins siguen disponibles
- **AND** el detalle simplemente omite el link remoto TMDB

### Requirement: instalaciones existentes migran sin perder datos locales
El sistema MUST migrar instalaciones válidas sin reset ni acceso de red, MUST preservar los IDs locales y snapshots existentes, y MUST conservar ratings, tags, notas, estados, timestamps, pins, fechas de pin y preferencias no relacionadas.

#### Scenario: título TMDB existente
- **GIVEN** un título existente con `provider=tmdb`, `externalId=N` y tipo `movie` o `tv`
- **WHEN** la base se actualiza al nuevo esquema
- **THEN** conserva su ID local y todos sus datos
- **AND** obtiene exactamente una referencia `tmdb/<tipo>/N`

#### Scenario: título manual existente
- **GIVEN** un título existente con la representación histórica `provider=manual`
- **WHEN** la base se actualiza
- **THEN** conserva su ID, snapshot y datos personales como MediaItem sin referencia externa
- **AND** conserva sólo la información de compatibilidad necesaria para reconocer imports históricos repetidos

#### Scenario: fallo de migración
- **WHEN** falla la creación, copia o verificación de cualquier estructura nueva
- **THEN** la evolución se revierte
- **AND** no publica la nueva versión de esquema ni deja datos parcialmente migrados

#### Scenario: reapertura después de migrar
- **GIVEN** una base migrada y verificada correctamente
- **WHEN** vuelve a inicializarse
- **THEN** no repite ni duplica MediaItems, referencias, pins o preferencias

#### Scenario: normalización JSON histórica antes de v4
- **GIVEN** una fila de un schema histórico válido donde `genres_json` es SQL NULL
- **WHEN** la inicialización histórica evoluciona esa base a v4
- **THEN** conserva el comportamiento del bootstrap anterior y almacena `genres_json = '[]'` antes de copiar la fila
- **AND** no aplica esa normalización como regla nueva sobre filas v4

#### Scenario: tags JSON en el schema histórico válido
- **GIVEN** el schema histórico válido donde `tags_json` es `NOT NULL`
- **WHEN** se prepara una migración a v4
- **THEN** el sistema mantiene esa restricción histórica
- **AND** no inventa una reparación de `tags_json` inválido ni relaja el contrato v4

### Requirement: las mutaciones de identidad mantienen composición transaccional
El sistema MUST serializar cada mutación pública de identidad con las demás mutaciones SQLite, MUST ejecutarla dentro de una única transacción pública y MUST evitar que sus helpers internos reinicialicen la base, reingresen a la cola o creen transacciones anidadas.

#### Scenario: guardado TMDB exitoso
- **WHEN** se guarda o actualiza un recurso TMDB
- **THEN** la resolución de referencia, el MediaItem y la limpieza relacional aplicable se confirman como una mutación serializada y transaccional

#### Scenario: fallo durante una mutación
- **WHEN** una escritura de identidad falla antes de confirmar la transacción
- **THEN** no queda una referencia sin MediaItem ni un MediaItem parcialmente reasociado

#### Scenario: runtime después de migrar una instalación real
- **GIVEN** que `initDb()` migra una base v3 realista a v4
- **WHEN** el runtime lista y carga títulos, resuelve y guarda recursos TMDB, actualiza una puntuación, opera pins y elimina un item
- **THEN** todas las operaciones usan el schema v4 sin consultar las columnas eliminadas de `saved_titles`
- **AND** los borrados eliminan por cascade referencias e identidades relacionadas sin dejar pins huérfanos
- **AND** `tmdb/movie/N` y `tmdb/tv/N` permanecen independientes

#### Scenario: límite transitorio del backup v4 durante el checkpoint de persistencia
- **GIVEN** que storage v4 contiene `tmdb/movie/N` y `tmdb/tv/N` como MediaItems distintos
- **AND** al menos uno tiene un pin contextual
- **WHEN** el adaptador transitorio intenta proyectar ese estado al formato backup v4
- **THEN** el sistema reconoce que el pin v4 omite `resourceNamespace` y no puede garantizar un round-trip fiel
- **AND** no prohíbe la coexistencia ni los pins, no fusiona los MediaItems y no elige un namespace arbitrariamente
- **AND** el cierre del checkpoint queda sujeto a backup v5, donde los pins internos referencian la identidad local del item dentro del backup
- **AND** no se amplía ni reinterpreta la semántica histórica del formato v4

### Requirement: TMDB conserva su comportamiento vigente sobre la nueva identidad
El sistema MUST continuar ofreciendo búsqueda, detalle remoto, guardado, detección de guardado, snapshots locales, credenciales, imágenes, proveedores de visualización y atribución TMDB bajo sus contratos actuales, usando la referencia TMDB completa para resolver identidad.

#### Scenario: detección independiente de guardado
- **GIVEN** que sólo `tmdb/movie/77` está guardado
- **WHEN** se abre `tmdb/tv/77`
- **THEN** el sistema no lo presenta como el MediaItem ya guardado ni reutiliza sus datos personales

#### Scenario: re-guardado del mismo recurso
- **GIVEN** un MediaItem asociado a `tmdb/tv/77`
- **WHEN** se vuelve a guardar ese mismo recurso
- **THEN** actualiza el snapshot del mismo MediaItem y preserva sus datos personales
