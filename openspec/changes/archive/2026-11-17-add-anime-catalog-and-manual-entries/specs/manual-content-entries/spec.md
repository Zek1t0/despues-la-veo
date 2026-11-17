## Purpose

Permitir crear y corregir entradas manuales sin red ni proveedor, conservando identidad portable y todos los comportamientos existentes de la biblioteca personal.

## ADDED Requirements

### Requirement: creación manual mínima y offline
El sistema MUST ofrecer «Agregar manualmente» en Biblioteca y un único flujo reutilizable sin credenciales ni acceso de red. MUST exigir título no vacío tras trim y selección explícita de medio; MUST permitir familia/formato compatibles, año y resumen opcionales según el dominio existente. MUST crear planned, cero referencias externas, rating personal null, tags vacíos y notas null, con identidad local y portable nuevas. MUST mostrar placeholder sin portada ni introducir almacenamiento de imágenes. Una entrada equivalente en Buscar, si se incorpora, MUST reutilizar el mismo flujo.

#### Scenario: creación mínima sin conexión
- **WHEN** el usuario proporciona título y medio válidos sin red y guarda
- **THEN** se crea una sola entrada con los defaults indicados y se abre su detalle local

#### Scenario: datos inválidos o cancelación
- **WHEN** falta título/medio, el año es inválido, la clasificación es incompatible o se cancela
- **THEN** no se persiste una entrada parcial y se indica el error pertinente cuando corresponde

#### Scenario: envío repetido
- **WHEN** se pulsa guardar repetidamente mientras la misma creación está pendiente
- **THEN** se confirma como máximo una entrada para ese envío

### Requirement: edición manual conserva identidad y datos personales
El sistema MUST permitir editar título, medio, familia, formato, año y resumen de entradas local-only desde su detalle local usando el mismo formulario. MUST preservar ID local, identidad portable o histórica, createdAt, status, tags, notas, rating personal y pins; MUST avanzar updatedAt según el contrato vigente. MUST validar combinaciones y MUST exigir revisar campos incompatibles al cambiar medio, sin borrar selecciones silenciosamente. Este flujo MUST NOT editar snapshots de entradas con referencias externas ni aplicar reglas de refresh remoto a correcciones manuales explícitas.

#### Scenario: corrección de formato conocido
- **WHEN** el usuario corrige explícitamente un manual de tv a ova y guarda
- **THEN** cambia el formato conservando identidades, createdAt y campos personales

#### Scenario: cambio incompatible de medio
- **WHEN** un manual anime cambia a comic conservando familia anime
- **THEN** no se guarda hasta que el usuario confirme una clasificación compatible

#### Scenario: entrada importada histórica
- **WHEN** se edita una entrada manual histórica sin referencias externas
- **THEN** conserva su legacyIdentity exacta y sigue reimportándose por la identidad histórica

### Requirement: advertencia de duplicados sin vinculación
El sistema MUST advertir sin bloquear cuando encuentra candidatos locales con título normalizado igual y año compatible (igual o ausente en alguno), excluyendo la entrada editada. MUST permitir inspeccionar los candidatos o crear una entrada separada, preservando el borrador al volver. MUST NOT vincular, fusionar ni inferir identidad por esa coincidencia; la advertencia MUST consultar únicamente datos locales.

#### Scenario: coincidencia deliberada
- **WHEN** existe un título candidato y el usuario elige crear por separado
- **THEN** se crea otro MediaItem con identidades propias sin modificar el existente

### Requirement: integración manual con biblioteca existente
El sistema MUST mostrar manuales en cards, vistas, ordenamientos, búsqueda local por título/tags y filtros de clasificación existentes; MUST reutilizar detalle, tags, notas, rating, estado, pins y eliminación actuales. MUST mantener accesible la metadata local offline sin requerir proveedor y MUST NOT añadir filtros específicos OVA/ONA/especial.

#### Scenario: manual anime y borrado
- **WHEN** se guarda un manual audiovisual/anime/movie y luego se elimina desde detalle
- **THEN** aparece antes del borrado en Anime y Películas y después desaparece junto con sus pins e identidad asociada
