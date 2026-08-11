# rating-aware-library-sorting Specification

## Purpose

Permite ordenar Biblioteca por la fuente de puntuación elegida sin ambigüedad, con resultados deterministas y preservando la prioridad contractual de los pins contextuales.

## Requirements

### Requirement: Biblioteca distingue sorts TMDB y personales
El sistema MUST mantener el modo persistido `rating-desc` para puntuación TMDB con un label inequívoco y MUST ofrecer `personal-rating-desc` y `personal-rating-asc` para la puntuación personal.

#### Scenario: preferencia TMDB existente
- **GIVEN** una instalación cuya preferencia guardada es `rating-desc`
- **WHEN** se actualiza la aplicación
- **THEN** la preferencia continúa siendo válida y ordena por `voteAverage` descendente
- **AND** su label visible identifica a TMDB

#### Scenario: mayor puntuación personal primero
- **WHEN** el usuario selecciona `personal-rating-desc`
- **THEN** los títulos puntuados se ordenan de mayor a menor `personalRating`

#### Scenario: menor puntuación personal primero
- **WHEN** el usuario selecciona `personal-rating-asc`
- **THEN** los títulos puntuados se ordenan de menor a mayor `personalRating`

### Requirement: sin calificar queda siempre al final
El sistema MUST colocar los títulos con `personalRating: null` después de todos los títulos puntuados tanto en orden ascendente como descendente.

#### Scenario: descendente con ausentes
- **GIVEN** títulos con `10.0`, `8.7`, `7.2`, `null` y `null`
- **WHEN** el sort es `personal-rating-desc`
- **THEN** el orden de grupos es `10.0`, `8.7`, `7.2`, `null`, `null`

#### Scenario: ascendente con ausentes
- **GIVEN** títulos con `10.0`, `8.7`, `7.2`, `null` y `null`
- **WHEN** el sort es `personal-rating-asc`
- **THEN** el orden de grupos es `7.2`, `8.7`, `10.0`, `null`, `null`

### Requirement: los empates son deterministas
El sistema MUST desempatar puntuaciones iguales y títulos sin calificar mediante el comparator estable de título y luego por identificador local.

#### Scenario: misma puntuación
- **WHEN** dos títulos tienen el mismo `personalRating`
- **THEN** se ordenan por título
- **AND** si el título también empata se ordenan por `id`

### Requirement: los pins conservan prioridad absoluta
El sistema MUST aplicar search, filtros y pertenencia antes de separar pinned y unpinned; MUST ordenar los pinned por `pinnedAt DESC` usando el comparator activo sólo cuando el timestamp empata; y MUST ordenar los unpinned normalmente por el comparator activo.

#### Scenario: rating no supera un pin
- **GIVEN** Batman pinned en `300` con `5.0`, Interstellar pinned en `200` con `10.0`, Dune unpinned con `10.0` y Arrival unpinned con `9.0`
- **WHEN** el sort es `personal-rating-desc`
- **THEN** el orden es Batman, Interstellar, Dune, Arrival

#### Scenario: empate de pinnedAt
- **WHEN** dos títulos pinned tienen el mismo `pinnedAt`
- **THEN** el sort personal activo desempata entre ellos

#### Scenario: independencia de pins
- **WHEN** cambia una puntuación personal o el sort activo
- **THEN** no cambia `pinnedAt`, no se crea o elimina ningún pin y no se transfiere contexto
- **AND** no se alteran collages
