## MODIFIED Requirements

### Requirement: rechazo seguro del archivo completo

El sistema MUST evitar toda modificación persistente cuando la estructura principal del backup sea inválida o su versión no sea 1, 2, 3 ni 4. La invalidez aislada de Appearance dentro de un v4 cuya biblioteca y pins sean procesables MUST NOT convertir el archivo completo en inválido.

#### Scenario: exportedAt ausente

- **GIVEN** un backup versión 1, 2, 3 o 4 que omite `exportedAt`
- **WHEN** se valida el archivo
- **THEN** la envoltura sigue siendo válida

#### Scenario: exportedAt presente con tipo inválido

- **GIVEN** un backup versión 1, 2, 3 o 4 cuyo `exportedAt` presente no es un `string`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo
- **AND** no se modifica la biblioteca, pins ni Appearance

#### Scenario: JSON inválido

- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca, pins ni Appearance
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada

- **GIVEN** un backup cuya versión no es 1, 2, 3 ni 4
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca, pins ni Appearance
- **AND** se informan las versiones compatibles

#### Scenario: corrupción estructural v3 o v4

- **GIVEN** una envoltura v3 o v4 sin arrays `items` o `pins`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo antes de escribir
- **AND** no se modifica la biblioteca, pins ni Appearance

#### Scenario: Appearance v4 incompatible no invalida biblioteca

- **GIVEN** un backup v4 con arrays procesables y una Appearance inválida o desconocida
- **WHEN** se valida el archivo
- **THEN** items y pins continúan elegibles para restauración
- **AND** Appearance se marca como no aplicable

## ADDED Requirements

### Requirement: el backup versión 4 transporta Appearance portable cuando es confiable

El sistema MUST exportar JSON versión 4 con `items`, `pins` y, cuando exista una intención local confiable, `appearance`. Appearance contiene únicamente la intención portable `scheme` + `palette`. Una row válida MUST aportar la última intención realmente confirmada como persistida; la ausencia válida de row MUST aportar el default contractual Dark + Original. Ante un error real de lectura sin `confirmedPersisted` confiable, el sistema MUST continuar exportando items/pins, MUST omitir Appearance y MUST NOT inventarla desde el fallback visual. El backup MUST NOT incluir effective scheme, scheme actual del sistema, colores resueltos ni la definición completa del theme, y MUST mantener fuera las preferencias Detalle/Mosaico y sorting.

#### Scenario: exportación v4
- **WHEN** el usuario exporta con scheme System y palette Lavanda
- **THEN** obtiene `version: 4` con `appearance: { scheme: "system", palette: "lavender" }`
- **AND** no exporta si el sistema está actualmente light o dark
- **AND** no exporta tokens ni preferencias de browsing

#### Scenario: ausencia válida usa default exportable
- **GIVEN** la lectura de `app_preferences` termina correctamente y no existe row de Appearance
- **WHEN** el usuario exporta
- **THEN** el backup v4 incluye Dark + Original como intención default contractual

#### Scenario: error real de lectura omite Appearance
- **GIVEN** la lectura de Appearance falla y no existe `confirmedPersisted` confiable en runtime
- **WHEN** el usuario exporta
- **THEN** el backup v4 sigue incluyendo items y pins
- **AND** omite `appearance`
- **AND** no serializa Dark + Original sólo porque sea el fallback visual
- **AND** puede informar que Appearance no fue incluida

#### Scenario: row inválida no se presenta como intención confirmada
- **GIVEN** la lectura termina pero la row de Appearance es inválida y no existe otro `confirmedPersisted` confiable
- **WHEN** el usuario exporta
- **THEN** el backup v4 continúa incluyendo items y pins
- **AND** puede omitir `appearance` en vez de exportar el fallback visual como una elección persistida

#### Scenario: round-trip v4 válido
- **WHEN** un backup v4 válido se importa exitosamente
- **THEN** restaura items y pins elegibles bajo sus contratos vigentes
- **AND** aplica y persiste la Appearance portable del backup

#### Scenario: v4 sin Appearance preserva intención local
- **GIVEN** un backup v4 procesable que omite `appearance`
- **WHEN** se importa exitosamente
- **THEN** restaura items y pins elegibles
- **AND** conserva Appearance local
- **AND** la ausencia no vuelve inválido al backup completo

### Requirement: backups anteriores conservan Appearance local

El sistema MUST continuar importando versiones 1, 2 y 3 bajo sus contratos existentes y MUST interpretar la ausencia histórica de Appearance como “no modificar Appearance local”.

#### Scenario: importación v1, v2 o v3
- **GIVEN** una Appearance local Manzana verde + Claro
- **WHEN** se importa exitosamente un backup v1, v2 o v3
- **THEN** la Appearance local permanece Manzana verde + Claro
- **AND** items, ratings y pins se procesan según la versión importada

### Requirement: Appearance se aplica después de confirmar la restauración

El sistema MUST aplicar y persistir Appearance de un v4 válido únicamente después de confirmar que la restauración correspondiente alcanzó un resultado exitoso según el contrato de importación. La selección visual MUST cambiar inmediatamente después de esa confirmación y MUST NOT adelantarse durante preview, confirmación o validación.

#### Scenario: usuario cancela importación
- **WHEN** el usuario selecciona un backup v4 pero cancela antes de restaurarlo
- **THEN** Appearance local no cambia

#### Scenario: archivo principal rechazado
- **WHEN** un backup v4 se rechaza por estructura principal inválida
- **THEN** Appearance local no cambia
- **AND** no se escriben items ni pins

#### Scenario: restauración confirmada
- **WHEN** la importación v4 válida termina con un resultado exitoso
- **THEN** se persiste su Appearance válida
- **AND** la UI adopta esa combinación inmediatamente

#### Scenario: selección posterior prevalece sobre merge tardío
- **GIVEN** el usuario confirma un v4 cuya Appearance es Lavanda
- **WHEN** el merge principal queda pendiente, el usuario selecciona Marea y después el merge termina exitosamente
- **THEN** items y pins elegibles se restauran normalmente
- **AND** Lavanda no se aplica ni se persiste por haber terminado tarde el merge
- **AND** displayed, `confirmedPersisted`, storage y reinicio permanecen en Marea

### Requirement: Appearance incompatible degrada de forma parcial y segura

Si items y pins de un backup v4 son restaurables pero el scheme o palette de Appearance es inválido, desconocido o incompatible con esta versión, el sistema MUST restaurar los datos elegibles, MUST conservar Appearance local y MUST informar por separado que la Appearance del backup no pudo aplicarse.

#### Scenario: palette de una versión futura
- **GIVEN** un backup v4 con items y pins válidos y una palette desconocida
- **WHEN** el usuario confirma la importación
- **THEN** se restauran items y pins elegibles
- **AND** se conserva Appearance local
- **AND** el resultado informa la incompatibilidad de Appearance

#### Scenario: scheme inválido
- **GIVEN** un backup v4 procesable cuyo scheme no es system, light ni dark
- **WHEN** se importa
- **THEN** la restauración prioritaria de biblioteca/pins puede completarse
- **AND** Appearance local permanece intacta
- **AND** el problema se reporta sin presentarlo como fallo de los títulos
