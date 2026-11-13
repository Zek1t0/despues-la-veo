## ADDED Requirements

### Requirement: identidad manual portable independiente
El sistema MUST asignar a cada entrada manual nueva una identidad portable estable, distinta del ID local opaco, de las referencias externas y de legacyIdentity. MUST conservarla al editar, exportar, importar y remapear IDs locales. MUST NOT fabricar un proveedor manual ni derivarla de título, año o clasificación. Una identidad portable MUST pertenecer a un único MediaItem y un MediaItem MUST tener como máximo una identidad manual portable; su eliminación MUST eliminar esa asociación.

#### Scenario: creación y edición sin proveedor
- **WHEN** se crea y luego edita una entrada manual
- **THEN** mantiene su identidad portable, ID local y createdAt, con cero referencias externas

#### Scenario: colisión del generador
- **WHEN** el generador entrega un ID local o identidad portable ya ocupado
- **THEN** se genera un candidato libre mediante reintentos acotados o se informa fallo sin sobrescribir ni escribir parcialmente

#### Scenario: propiedad contradictoria
- **WHEN** una identidad portable ya pertenece a otro MediaItem
- **THEN** se rechaza su reasignación sin mover datos personales ni referencias

### Requirement: evolución propuesta preserva toda identidad existente
Si se aprueba la migración propuesta SQLite v5 a v6, el sistema MUST preservar IDs locales opacos, referencias completas, identidades legacy exactas, snapshots, clasificación, campos personales, createdAt/updatedAt, pins/pinnedAt y preferencias sin red. MUST asignar identidad portable a los local-only existentes sin identidad legacy y MUST mantener a los manuales históricos resolubles por su identidad histórica sin sustituirla. MUST verificar integridad antes de publicar la versión y MUST revertir completamente cualquier fallo. Crear la propuesta MUST NOT ejecutar ni autorizar la migración.

#### Scenario: migración mixta y reapertura
- **WHEN** migra una base con TMDB movie/tv de igual ID externo, MangaUpdates, manual histórico y local-only defensivo y luego se reabre
- **THEN** conserva todos los IDs/datos/relaciones y la identidad nueva asignada, sin duplicación ni regeneración

#### Scenario: fallo antes de publicar versión
- **WHEN** falla la creación, asignación, verificación o publicación transaccional
- **THEN** permanecen la versión anterior y todos sus datos sin estructuras o asociaciones parciales

#### Scenario: versión futura
- **WHEN** una aplicación encuentra un esquema más nuevo que el que soporta
- **THEN** lo rechaza sin reset, downgrade ni borrado
