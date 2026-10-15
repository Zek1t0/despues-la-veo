## MODIFIED Requirements

### Requirement: Biblioteca permite ordenar y filtrar de forma determinista

El sistema MUST permitir ordenar Biblioteca por `Actualizados recientemente`, `Título A–Z`, `Título Z–A`, `Puntuación TMDB` y `Año más reciente`, usando el primero como valor predeterminado, y MUST conservar filtros de estado y sustituir el filtro de tipo por predicados explícitos de medio, familia o formato, conservando Películas y Series. MUST mantener la preferencia rating-desc para orden descendente por voteAverage TMDB finito, ausentes al final y empates deterministas por título/ID dentro del orden contextual de pins. MUST conservar órdenes de personalRating separados y MUST NOT reinterpretar rating-desc como puntuación personal o externa universal ni fabricar scores no-TMDB.

#### Scenario: orden predeterminado
- **WHEN** el usuario abre Biblioteca sin un orden guardado
- **THEN** los títulos aparecen por actualización más reciente
- **AND** los empates se resuelven de forma estable

#### Scenario: título sin puntuación
- **WHEN** el usuario elige Puntuación TMDB y uno o más títulos no tienen voteAverage
- **THEN** los títulos sin voteAverage se ubican después de los que sí tienen valor TMDB dentro de su grupo contextual de pins
- **AND** el resultado es determinista y no produce errores

#### Scenario: rating personal no reemplaza orden TMDB
- **WHEN** dos items sin voteAverage tienen ratings personales distintos y se selecciona rating-desc
- **THEN** se desempata por título/ID, no por personalRating ni una política futura de rating preferido
- **AND** no se asigna un score externo inventado

#### Scenario: título sin año
- **WHEN** el usuario ordena por año más reciente y uno o más títulos no tienen año
- **THEN** los títulos sin año se ubican después de los que sí tienen
- **AND** el resultado es determinista y no produce errores

#### Scenario: combinación de búsqueda y filtros
- **WHEN** el usuario escribe una búsqueda y selecciona estado o clasificación
- **THEN** la lista muestra sólo los títulos que cumplen simultáneamente la búsqueda y los filtros
- **AND** aplica el orden seleccionado al resultado

#### Scenario: filtros sin coincidencias
- **WHEN** la combinación de búsqueda y filtros no produce resultados
- **THEN** se muestra un estado vacío que permite comprender que puede cambiarse la búsqueda o los filtros

### Requirement: las pantallas afectadas presentan textos en español

El sistema MUST mostrar en español todos los textos nuevos y todos los textos visibles de Biblioteca, Buscar, Etiquetas y las partes afectadas del detalle guardado, sin migrar los valores internos del dominio.

#### Scenario: tipos y estados visibles
- **WHEN** una pantalla afectada presenta tipos, estados o etiquetas de interfaz
- **THEN** usa términos como `Película`, `Serie`, `Planeado`, `Viendo` para audiovisual, `Leyendo` para comic/literature, `En curso` en filtros mixtos, `Terminado`, `Abandonado`, `Estado` y `Etiquetas` según el contexto
- **AND** los valores internos pueden continuar en inglés

#### Scenario: alcance de idioma
- **WHEN** se aplica el cambio
- **THEN** no se agrega un selector de idioma ni un sistema completo de internacionalización

## ADDED Requirements

### Requirement: filtros taxonómicos no mutuamente excluyentes
Biblioteca MUST permitir filtrar por predicados de clasificación sin declarar tipos mutuamente excluyentes. Películas MUST incluir audiovisual/movie independientemente de familia y Anime MUST incluir familia anime independientemente de formato. MUST conservar búsqueda por título/tags, ordenamientos deterministas, prioridad de pins dentro de coincidencias y una sola fuente de estado compartida por panel/chips.

#### Scenario: película anime coincide con dos opciones
- **WHEN** una película de anime está guardada y se selecciona Películas o Anime por separado
- **THEN** aparece en ambos resultados sin duplicarse dentro de la biblioteca

#### Scenario: pin fuera del filtro
- **WHEN** un item fijado no satisface el filtro activo
- **THEN** no aparece por estar fijado y los pins que sí coinciden conservan su orden contextual

### Requirement: cards y accesibilidad soportan lectura y clasificación nullable
Las vistas Detalle y Mosaico de Biblioteca y etiqueta abierta MUST presentar labels coherentes con medio/familia/formato, conservar navegación única por ID local y anunciar clasificación/estado/rating personal una sola vez. MUST conservar placeholders, pills personales y pins; collages y búsqueda MUST NOT incorporar puntuación personal por este cambio.

#### Scenario: cómic sin familia ni formato
- **WHEN** se presenta comic/null/null en Biblioteca o etiqueta abierta
- **THEN** se identifica como Cómic sin inventar familia y conserva sus datos personales y navegación

#### Scenario: light novel en lectura
- **WHEN** se presenta literature/null/light-novel con estado watching
- **THEN** se muestra una etiqueta española de novela ligera y Leyendo sin modificar el token guardado
