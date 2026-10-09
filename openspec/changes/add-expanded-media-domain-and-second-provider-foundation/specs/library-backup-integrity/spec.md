## RENAMED Requirements

- FROM: `### Requirement: el backup versión 5 representa MediaItems y referencias externas por separado`
- TO: `### Requirement: el backup vigente representa MediaItems y referencias externas por separado`

## MODIFIED Requirements

### Requirement: el backup vigente representa MediaItems y referencias externas por separado
El sistema MUST conservar la interpretación histórica de un backup versión 5 y MUST exportar actualmente un backup versión 6 donde cada item tenga una identidad local al backup, contenga su snapshot y datos personales, y declare por separado cero o más referencias externas completamente calificadas. El sistema MUST incluir ratings, tags, notas, estados, timestamps, pins y Appearance bajo sus contratos vigentes.

#### Scenario: exportación de recursos TMDB con ID numérico compartido
- **GIVEN** una biblioteca que contiene `tmdb/movie/123` y `tmdb/tv/123` en MediaItems distintos
- **WHEN** el usuario exporta un backup
- **THEN** ambos items aparecen de forma independiente con sus referencias completas
- **AND** sus datos personales permanecen asociados al item correcto

#### Scenario: exportación de item local-only
- **GIVEN** un MediaItem sin referencias externas que se originó en la representación histórica `manual`
- **WHEN** se exporta el backup
- **THEN** el item se representa sin fabricar un proveedor externo
- **AND** incluye obligatoriamente su `legacyIdentity` estable

#### Scenario: el exporter actual no emite un local-only sin identidad
- **GIVEN** un MediaItem que no tiene referencias externas ni `legacyIdentity`
- **WHEN** la versión actual intenta exportarlo
- **THEN** rechaza o reporta el estado inválido
- **AND** no emite un item local-only sin una vía determinista de reimportación

#### Scenario: referencias internas portables
- **GIVEN** un MediaItem con pins contextuales
- **WHEN** se exporta el backup
- **THEN** cada pin refiere la identidad del item dentro del backup
- **AND** no usa una referencia de proveedor como única foreign key hacia el item

#### Scenario: round-trip con ID TMDB compartido entre namespaces
- **GIVEN** MediaItems distintos para `tmdb/movie/77` y `tmdb/tv/77`, cada uno con datos personales propios y ambos pineados en el mismo contexto
- **WHEN** se exporta backup v6 y se importa en una base vacía
- **THEN** el backup contiene dos identidades de item distintas y conserva ambas referencias externas completas
- **AND** cada pin apunta al `itemId` de su MediaItem correspondiente
- **AND** rating, tags, notas, status y pins se restauran en el MediaItem correcto
- **AND** ninguna relación se decide usando únicamente `provider + externalId`

## ADDED Requirements

### Requirement: backup v6 transporta clasificación y estado local completo
El sistema MUST exportar version 6 con medium obligatorio y contentFamily/primaryFormat presentes y nullable, sin type como segunda autoridad, preservando snapshot, ID, referencias completas, identidad legacy cuando corresponda, estado, tags, notas, ratings, timestamps, pins y Appearance bajo contratos vigentes. MUST validar clasificación y referencias sin coerción, rechazar combinaciones inválidas y exigir personalRating válido. TMDB MUST tener referencia movie/TV canónica y medio audiovisual, sin exigir igualdad namespace/primaryFormat. MUST conservar el rechazo de exportar local-only sin identidad portable y la prohibición de fabricar ProviderReference manual.

#### Scenario: round-trip de distintos medios
- **WHEN** se exportan y restauran anime, manga, manhwa, manhua, cómic y literatura con referencias válidas
- **THEN** clasificación y datos personales se conservan por item y sus pins remapean correctamente

#### Scenario: clasificación o referencia inválida
- **WHEN** un item v6 omite medium, omite un campo nullable de clasificación, tiene vocabulario incompatible, referencia duplicada, identidad TMDB inválida o medio no audiovisual con referencia TMDB
- **THEN** se reporta inválido sin escribir parcialmente el item ni restaurar sus pins

#### Scenario: formato local independiente de TMDB
- **WHEN** se restaura audiovisual/anime/ova o audiovisual/null/null con una referencia tmdb/movie canónica
- **THEN** se conserva la clasificación sin conflicto ni conversión automática a movie

### Requirement: importación v1 a v5 valida historia antes de convertir
El sistema MUST continuar importando v1–v5 con los validadores históricos y después convertir movie/TV a audiovisual con formato equivalente. MUST NOT ampliar los valores admitidos por versiones antiguas. MUST mantener presencia/ausencia de campos, identidad completa o legacy según versión, defaults históricos, reglas de personalRating y Appearance. En actualización histórica MUST tratar la familia no clasificada como no suministrada, sin borrar una familia local refinada; en inserción MUST usar familia null.

#### Scenario: backup histórico movie con familia local conocida
- **GIVEN** un item local audiovisual/anime/movie resuelto por la referencia TMDB del backup
- **WHEN** se importa un v5 más reciente con type movie
- **THEN** se conserva familia anime y se aplican campos históricos elegibles sin inferir familia de metadata

#### Scenario: backup histórico inválido
- **WHEN** un archivo v1–v5 contiene type manga o una estructura nueva en lugar de campos históricos obligatorios
- **THEN** conserva el rechazo histórico y no lo interpreta como v6

### Requirement: merge v6 preserva identidad frescura y relaciones
El sistema MUST resolver items por referencias completas o identidad legacy exacta, conservar ID/createdAt de items resueltos, aplicar campos según presencia y updatedAt, restaurar referencias aditivamente sin fusión y procesar pins mediante mapa del ID final después de items. MUST conservar savepoints y reporte parcial. Diferencias de medium o identidad TMDB inválida/medio incompatible MUST reportarse como conflicto sin cambios; namespace TMDB distinto de primaryFormat MUST NOT ser conflicto. Familia/formato requeridos nullable en v6 MUST representar estado local: valores explícitos elegibles por frescura pueden reemplazar no-null o borrar con null, sin aplicar reglas monotónicas de provider refresh. Familia histórica no suministrada MUST permanecer ausente en actualización. Referencia desconocida MUST NOT convertirse en equivalencia o taxonomía inferida.

#### Scenario: null y ausencia de campo opcional
- **WHEN** un item v6 más reciente omite overview pero suministra notes null
- **THEN** conserva overview local y aplica notes null bajo las reglas de merge vigentes

#### Scenario: clasificación nullable explícita
- **GIVEN** un item local audiovisual/anime/ova con referencia tmdb/movie válida
- **WHEN** un item v6 más reciente suministra contentFamily null y primaryFormat null con medium audiovisual
- **THEN** borra ambos valores locales conocidos sin confundir null con ausencia ni exigir formato movie
- **AND** el mismo null en provider refresh habría conservado anime/ova

#### Scenario: reemplazo explícito de clasificación local restaurada
- **WHEN** un item v6 más reciente y válido restaura comic/manga/one-shot sobre comic/manhwa/webtoon resuelto
- **THEN** puede reemplazar familia/formato como estado local según frescura
- **AND** un refresh remoto con ese snapshot conservaría manhwa/webtoon

#### Scenario: medio incompatible
- **WHEN** un backup resuelve un item audiovisual pero intenta convertirlo en comic
- **THEN** se reporta conflicto sin trasladar sus datos, referencias o pins

#### Scenario: referencias divergentes o item antiguo
- **WHEN** las referencias entrantes resuelven distintos items locales
- **THEN** se reporta conflicto sin fusionarlos
- **WHEN** un item anterior resuelve un único item y aporta una referencia compatible libre
- **THEN** puede restaurarse esa referencia sin sobrescribir metadata más reciente

#### Scenario: colisión de ID y pins
- **WHEN** un item entrante nuevo con referencia portable libre tiene ID ocupado
- **THEN** se asigna ID libre y sus pins usan el mapa final
- **AND** un local-only sin referencia ni legacy con ID ocupado sigue reportándose como conflicto

#### Scenario: Appearance y errores parciales
- **WHEN** la importación v6 tiene items o pins inválidos y Appearance confiable
- **THEN** reporta resultados reales, preserva operaciones válidas bajo el contrato parcial y aplica Appearance únicamente después de confirmar restauración

