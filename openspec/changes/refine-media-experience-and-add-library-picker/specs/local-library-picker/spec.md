## Purpose

Ayudar a elegir qué consumir hoy entre los títulos guardados, con criterios comprensibles y operación local.

## ADDED Requirements

### Requirement: Selección local explicable

«¿Qué veo hoy?» MUST abrirse desde Biblioteca como pantalla secundaria. MUST consultar solo títulos locales visibles y combinar criterios activos de estado, medio, familia, formato, género, etiqueta y tiempo. MUST ofrecer hasta tres candidatos con razones comprobables y permitir abrir la ficha local de cada uno. Los criterios pertenecen a la sesión. El selector MUST operar sin red y sin modificar datos personales.

#### Scenario: elección inicial y criterios combinados
- **WHEN** el usuario abre el selector y ajusta criterios
- **THEN** puede cambiar el estado inicial Planeados y cada candidato satisface todos los criterios activos
- **AND** puede elegir «Más cortos primero» como preferencia opcional
- **AND** las explicaciones se basan en datos del candidato y no usan pins como señal de gusto o prioridad

#### Scenario: selección diaria reproducible
- **WHEN** la selección ordinaria se repite con el mismo día local, criterios efectivos, idioma y snapshot visible confirmados
- **THEN** devuelve la misma muestra de hasta tres títulos distintos en el mismo orden mediante una semilla derivada del día y los criterios, aplicada después del filtrado
- **AND** la fecha o semilla puede controlarse en pruebas sin persistencia adicional

#### Scenario: cambio de condiciones
- **WHEN** cambia el día local, un criterio, la visibilidad, el idioma o el snapshot
- **THEN** se recalculan las propuestas con las condiciones vigentes y se retiran los resultados anteriores mientras falten datos confirmados

#### Scenario: orden explícito por duración
- **WHEN** se elige «Más cortos primero»
- **THEN** devuelve hasta tres elegibles por duración ascendente, con desconocidos al final y desempate por título e identidad

#### Scenario: Sorprendeme
- **WHEN** hay candidatos y el usuario elige Sorprendeme
- **THEN** obtiene uno con probabilidad uniforme dentro del conjunto elegible completo con su explicación
- **AND** la elección aleatoria puede reproducirse en pruebas con la misma entrada aleatoria

### Requirement: Duración honesta y recuperación

El selector MUST usar la duración de la película o de un episodio según el formato y los valores válidos presentes en el snapshot local de la fuente activa, sin pedir una actualización ni depender de que esta aporte duración. MUST distinguir valores desconocidos de valores positivos válidos y permitir quitar el límite.

#### Scenario: límite activo
- **WHEN** se indica un máximo válido en minutos
- **THEN** solo entran títulos con una duración aplicable conocida que no supere el máximo
- **AND** no se infieren minutos de lectura ni duración de episodio a partir de la duración de la obra

#### Scenario: límite inválido o ausente
- **WHEN** el usuario introduce un máximo inválido o lo borra
- **THEN** informa el dato inválido sin aplicarlo y permite corregirlo
- **AND** con el campo vacío pueden incluirse títulos sin duración registrada

#### Scenario: conjunto vacío
- **WHEN** no hay candidatos elegibles
- **THEN** distingue biblioteca sin títulos visibles de criterios sin coincidencias, explica exclusiones por duración si corresponden y permite ajustar o limpiar criterios

#### Scenario: preferencias y lectura local
- **WHEN** el filtro sensible se activa o falla la lectura de datos o preferencias
- **THEN** nunca se presentan resultados calculados con una visibilidad obsoleta o sin confirmar
- **AND** los títulos ocultos no se revelan en motivos, opciones, resultados ni Sorprendeme
- **AND** ante fallo se ofrece reintento en lugar de mostrar un vacío definitivo
