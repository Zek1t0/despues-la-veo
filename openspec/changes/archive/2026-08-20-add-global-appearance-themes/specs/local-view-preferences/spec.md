## MODIFIED Requirements

### Requirement: las preferencias permanecen fuera del dominio y del backup

El sistema MUST tratar las preferencias de browsing —apariencias Detalle/Mosaico y criterios de orden de Biblioteca, Buscar y Etiquetas— como configuración local del dispositivo separada de `SavedTitle` y MUST mantenerlas fuera de todos los backups. La Appearance global scheme + palette constituye un dominio independiente y su portabilidad MUST NOT incorporar, reemplazar ni restablecer esas preferencias de browsing.

#### Scenario: exportación con preferencias de browsing
- **WHEN** el usuario exporta su biblioteca después de cambiar Detalle/Mosaico u orden
- **THEN** el backup no incluye esas preferencias de browsing
- **AND** sólo puede incluir la Appearance global portable bajo el contrato de la versión que la soporte

#### Scenario: importación de Appearance global
- **WHEN** un backup compatible aplica una Appearance global
- **THEN** las apariencias Detalle/Mosaico y los órdenes locales no se reemplazan ni se restablecen

#### Scenario: importación de un backup anterior
- **WHEN** el usuario importa un backup JSON v1, v2 o v3
- **THEN** se conserva el comportamiento de importación compatible
- **AND** ninguna preference local, incluida Appearance global, se reemplaza ni se restablece

#### Scenario: compatibilidad con biblioteca existente
- **WHEN** una instalación con títulos y preferencias de browsing existentes incorpora Appearance global
- **THEN** conserva las filas, campos e identidad de todos los títulos
- **AND** conserva sus preferencias de browsing
- **AND** puede usar la nueva Appearance sin volver a importar datos

