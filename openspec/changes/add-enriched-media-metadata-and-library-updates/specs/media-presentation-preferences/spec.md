## Purpose

Permitir elegir el idioma de presentación de títulos disponibles y buscar sus variantes sin alterar la identidad de las obras ni las modificaciones personales.

## ADDED Requirements

### Requirement: Idiomas priorizados con fallback estable
El sistema MUST permitir ordenar preferencias de idioma, incluyendo español, inglés, japonés romanizado y otros disponibles, y resolver el título desde los datos existentes: prioridad configurada, título canónico, otra variante válida estable y título local previo. MUST indicar el fallback cuando sea relevante, no traducir automáticamente y conservar alias sin idioma como tales.

#### Scenario: Español no disponible
- **WHEN** se prioriza español y después inglés pero Kitsu solo ofrece inglés y japonés
- **THEN** se muestra inglés sin afirmar que se obtuvo una traducción española

#### Scenario: Romanizado e idioma desconocido
- **WHEN** se elige japonés romanizado y existe una variante en_jp, u otros alias no identifican idioma
- **THEN** se usa la variante romanizada disponible y los alias sin idioma siguen siendo consultables sin etiquetarlos arbitrariamente

### Requirement: Presentación sin mutación de identidad
El sistema MUST aplicar preferencias a búsqueda, detalle y biblioteca como presentación. MUST conservar título y modificaciones personales, ID local, referencias externas e identidades portables al cambiar idioma. MUST mantener títulos alternativos para búsqueda local y detalle sin exigir red ni duplicar obras.

#### Scenario: Cambio offline
- **WHEN** se cambia la preferencia de idioma sin conexión en una ficha guardada
- **THEN** cambia el título visible si existe una variante y permanece el mismo item con notas, estado, puntuación personal y timestamps personales intactos

#### Scenario: Búsqueda por alias
- **WHEN** el usuario busca localmente un título alternativo guardado distinto del visible
- **THEN** encuentra la misma obra sin crear otra ficha ni consultar al proveedor

#### Scenario: Preferencia inválida restaurada
- **WHEN** un backup contiene una preferencia malformada o repetida
- **THEN** se informa el problema y se conserva una configuración local válida sin invalidar los títulos restaurables

#### Scenario: Selección de otra fuente disponible
- **WHEN** se cambia de fuente activa A a B con documentos locales de ambas
- **THEN** se recalculan título, score y demás campos desde B con su procedencia y preferencias, sin reutilizar campos exclusivos de A ni consultar HTTP por el cambio
- **AND** se conservan ambos documentos, identidad y modificaciones/timestamps personales, incluidos overrides explícitos
