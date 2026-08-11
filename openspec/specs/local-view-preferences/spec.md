# local-view-preferences Specification

## Purpose
Conservar de manera local, independiente y resiliente las elecciones visuales y de orden de cada pantalla sin mezclarlas con los títulos guardados ni con sus copias de seguridad.
## Requirements
### Requirement: cada pantalla conserva preferencias independientes

El sistema MUST persistir por separado la apariencia de Biblioteca, Buscar y Etiquetas, y los criterios de orden de Biblioteca y Etiquetas.

#### Scenario: recuperación de preferencias persistidas
- **WHEN** el usuario cierra y vuelve a abrir la aplicación después de cambiar preferencias
- **THEN** Biblioteca, Buscar y Etiquetas recuperan sus elecciones guardadas

#### Scenario: cambio independiente de Biblioteca
- **WHEN** el usuario cambia apariencia u orden de Biblioteca
- **THEN** las preferencias de Buscar y Etiquetas permanecen sin cambios

#### Scenario: cambio independiente de Buscar
- **WHEN** el usuario cambia la apariencia de Buscar
- **THEN** las preferencias de Biblioteca y Etiquetas permanecen sin cambios

#### Scenario: cambio independiente de Etiquetas
- **WHEN** el usuario cambia apariencia u orden de Etiquetas
- **THEN** las preferencias de Biblioteca y Buscar permanecen sin cambios

### Requirement: valores ausentes o inválidos usan predeterminados seguros

El sistema MUST usar `Detalle` para Biblioteca, `Detalle` para Buscar, `Mosaico` para Etiquetas, `Actualizados recientemente` para el orden de Biblioteca y `Mayor cantidad de títulos` para el orden de Etiquetas cuando no exista un valor válido.

#### Scenario: primera apertura sin preferencias
- **WHEN** el usuario abre una instalación que no tiene preferencias guardadas
- **THEN** cada pantalla usa sus valores predeterminados

#### Scenario: preferencia desconocida
- **WHEN** una preferencia guardada contiene un valor inválido o desconocido
- **THEN** la pantalla afectada usa su valor predeterminado
- **AND** las demás preferencias válidas se recuperan normalmente
- **AND** los títulos guardados no se modifican

### Requirement: los errores de preferencias no bloquean la aplicación

El sistema MUST mantener utilizables las pantallas y proteger los datos de biblioteca cuando falle la lectura o escritura de preferencias.

#### Scenario: error al leer preferencias
- **WHEN** no se pueden leer las preferencias locales
- **THEN** la pantalla usa valores predeterminados
- **AND** la biblioteca existente permanece intacta
- **AND** el error se registra o comunica de forma apropiada sin bloquear la navegación

#### Scenario: error al guardar preferencias
- **WHEN** no se puede persistir una elección
- **THEN** la aplicación no modifica títulos ni otras preferencias
- **AND** informa el problema de forma comprensible o conserva una experiencia utilizable
- **AND** no presenta el guardado como exitoso de forma engañosa

### Requirement: las preferencias permanecen fuera del dominio y del backup

El sistema MUST tratar las preferencias como configuración local del dispositivo, separada de `SavedTitle`, y MUST mantener sin cambios el formato y comportamiento de exportación/importación JSON v1.

#### Scenario: exportación JSON v1
- **WHEN** el usuario exporta su biblioteca después de cambiar preferencias
- **THEN** el backup mantiene `version: 1`
- **AND** no incluye preferencias visuales ni de orden

#### Scenario: importación JSON v1
- **WHEN** el usuario importa un backup JSON v1
- **THEN** se conserva el comportamiento de importación existente
- **AND** las preferencias locales no se reemplazan ni se restablecen

#### Scenario: compatibilidad con biblioteca existente
- **WHEN** una instalación con títulos existentes incorpora esta capacidad
- **THEN** conserva las filas, campos e identidad de todos los títulos
- **AND** puede usar las nuevas preferencias sin volver a importar datos

### Requirement: la persistencia de preferencias es aditiva y compatible

El sistema MUST incorporar el almacenamiento local de preferencias mediante una evolución aditiva e idempotente, compatible con rollback de código, sin alterar destructivamente la tabla de títulos ni su índice de identidad. Esta evolución MUST NOT presentarse ni ejecutarse como una migración de esquema reversible.

#### Scenario: actualización de una base existente
- **WHEN** se abre una base creada por la versión anterior
- **THEN** se habilita el almacenamiento de preferencias de forma idempotente
- **AND** `saved_titles` y su índice existente permanecen intactos

#### Scenario: reapertura después de la actualización
- **WHEN** la inicialización se ejecuta nuevamente sobre una base ya actualizada
- **THEN** no duplica estructuras, no pierde preferencias y no modifica títulos

#### Scenario: rollback de código de la aplicación
- **WHEN** se vuelve al código de una versión que no usa preferencias
- **THEN** la biblioteca continúa disponible con su esquema e identidad previos
- **AND** la estructura adicional puede quedar sin uso sin afectar el backup JSON v1
- **AND** no se ejecuta `DROP TABLE` ni se reduce `PRAGMA user_version` automáticamente
