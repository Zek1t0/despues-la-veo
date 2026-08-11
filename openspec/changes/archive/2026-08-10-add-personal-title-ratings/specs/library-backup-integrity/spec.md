## ADDED Requirements

### Requirement: el backup versión 3 transporta puntuaciones personales y pins
El sistema MUST exportar JSON versión 3 con `items` y `pins`, MUST incluir `personalRating` dentro de cada item, MUST identificar pins mediante `provider + externalId` y MUST mantener las preferencias locales fuera del backup.

#### Scenario: exportación v3
- **WHEN** el usuario exporta una biblioteca con títulos puntuados, sin calificar y pins contextuales
- **THEN** obtiene un backup `version: 3` con items que contienen `personalRating` numérico o `null`
- **AND** contiene todos los pins válidos bajo el contrato v2
- **AND** no contiene preferencias de vista

#### Scenario: ciclo completo v3
- **WHEN** un backup v3 se importa en una biblioteca vacía
- **THEN** se restauran títulos, puntuaciones personales y pins elegibles

### Requirement: v3 exige y valida la puntuación personal sin coerción
Cada item del backup v3 MUST contener la propiedad `personalRating`; el sistema MUST aceptar únicamente `null` o un entero entre `10` y `100` inclusive, y MUST rechazar y reportar el item si la propiedad está ausente o no cumple ese dominio.

#### Scenario: propiedad ausente en v3
- **WHEN** un item v3 omite la propiedad `personalRating`
- **THEN** el item se contabiliza como inválido y se reporta
- **AND** la ausencia no se normaliza silenciosamente como preservación del valor local

#### Scenario: valores válidos
- **WHEN** un item v3 contiene `personalRating: null`, `10`, `57`, `87` o `100`
- **THEN** el campo es válido

#### Scenario: valores inválidos
- **WHEN** un item v3 contiene `0`, `9`, `101`, `87.5`, un valor no finito, string, objeto o array
- **THEN** el item se contabiliza como inválido
- **AND** el valor no se clampa, redondea ni convierte

### Requirement: presencia y merge de personalRating preservan datos modernos
El sistema MUST normalizar `personalRating` como ausente únicamente para formatos anteriores que legítimamente no poseen el campo, principalmente v1/v2; MUST normalizar todo item v3 válido como presente con `null` o presente con número; y MUST aplicar el valor sólo cuando el item entrante es elegible por el contrato vigente de `updatedAt`.

#### Scenario: insert desde v1 o v2
- **WHEN** un título nuevo se importa desde v1 o v2, donde `personalRating` está ausente
- **THEN** se inserta con `personalRating: null`

#### Scenario: insert desde v3
- **WHEN** un título nuevo v3 contiene número o `null`
- **THEN** se inserta exactamente con ese valor

#### Scenario: incoming anterior o igual
- **WHEN** un item coincide localmente y su `updatedAt` es anterior o igual al local
- **THEN** se preserva el título local completo, incluida su puntuación personal

#### Scenario: incoming posterior con número presente
- **WHEN** un item coincidente y posterior contiene `personalRating` numérico
- **THEN** reemplaza la puntuación personal local

#### Scenario: incoming posterior con null presente
- **WHEN** un item coincidente y posterior contiene `personalRating: null`
- **THEN** borra la puntuación personal local

#### Scenario: incoming v1 o v2 posterior con campo ausente
- **WHEN** un item coincidente y posterior de v1 o v2 se normaliza con `personalRating` ausente
- **THEN** conserva la puntuación personal local

#### Scenario: reimportación idempotente
- **WHEN** el mismo backup se importa nuevamente y su `updatedAt` ya es igual al local
- **THEN** no vuelve a modificar la puntuación ni los demás campos

### Requirement: v3 conserva el merge aditivo de pins
El sistema MUST procesar primero los items y después los pins v3, y MUST aplicar sin cambios la validación contextual, identidad portable, merge aditivo e informes de pins definidos para v2.

#### Scenario: pin nuevo y pin existente en v3
- **WHEN** un backup v3 contiene un pin válido ausente y otro ya presente localmente
- **THEN** inserta el ausente y conserva el existente con su `pinnedAt` local

#### Scenario: pin semánticamente inválido en v3
- **WHEN** un pin v3 refiere un título inexistente, contexto inválido o tag no perteneciente
- **THEN** se omite y reporta sin impedir otros elementos elegibles

## MODIFIED Requirements

### Requirement: rechazo seguro del archivo completo
El sistema MUST evitar toda modificación de SQLite cuando la estructura principal del backup sea inválida o su versión no sea 1, 2 ni 3.

#### Scenario: exportedAt ausente
- **GIVEN** un backup versión 1, 2 o 3 que omite `exportedAt`
- **WHEN** se valida el archivo
- **THEN** la envoltura sigue siendo válida

#### Scenario: exportedAt presente con tipo inválido
- **GIVEN** un backup versión 1, 2 o 3 cuyo `exportedAt` presente no es un `string`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo
- **AND** no se modifica la biblioteca

#### Scenario: JSON inválido
- **GIVEN** un archivo que no contiene JSON válido
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se muestra un error comprensible

#### Scenario: versión no soportada
- **GIVEN** un backup cuya versión no es 1, 2 ni 3
- **WHEN** el usuario intenta importarlo
- **THEN** no se modifica la biblioteca
- **AND** se informan las versiones compatibles

#### Scenario: corrupción estructural v3
- **GIVEN** una envoltura v3 sin arrays `items` o `pins`
- **WHEN** se valida el archivo
- **THEN** se rechaza el archivo completo antes de escribir
- **AND** no se modifica la biblioteca
