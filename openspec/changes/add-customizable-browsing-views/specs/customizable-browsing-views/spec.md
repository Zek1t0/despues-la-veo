## Purpose

Permitir que cada persona adapte la presentación y navegación de Biblioteca, Buscar y Etiquetas a su contexto, con controles coherentes en web y móvil y sin alterar el contenido guardado.

## ADDED Requirements

### Requirement: Biblioteca ofrece apariencias Detalle y Mosaico

El sistema MUST mostrar Biblioteca en `Detalle` de forma predeterminada y MUST permitir cambiar a `Mosaico`; la selección MUST aplicarse también a la búsqueda interna y a los títulos abiertos desde Etiquetas.

#### Scenario: primera vista de Biblioteca
- **WHEN** el usuario abre Biblioteca sin una preferencia guardada
- **THEN** ve la apariencia `Detalle` con la información y acciones disponibles actualmente

#### Scenario: cambio a Mosaico
- **WHEN** el usuario selecciona `Mosaico` en Biblioteca
- **THEN** cada título se presenta mediante la tarjeta de mosaico definida para Biblioteca y Buscar
- **AND** toda la tarjeta abre el detalle del título
- **AND** la tarjeta no contiene acciones para borrar, cambiar estado u otras acciones

#### Scenario: búsqueda interna con apariencia elegida
- **WHEN** el usuario busca dentro de Biblioteca
- **THEN** los resultados conservan la apariencia elegida para Biblioteca
- **AND** no se ofrece una preferencia separada para esos resultados

#### Scenario: resultados de una etiqueta
- **WHEN** el usuario abre una etiqueta y visualiza sus títulos
- **THEN** esos títulos usan la apariencia elegida para Biblioteca
- **AND** no se ofrece una cuarta preferencia de apariencia

#### Scenario: Biblioteca vacía
- **WHEN** la biblioteca no contiene títulos
- **THEN** se muestra un estado vacío comprensible en la apariencia seleccionada
- **AND** no se muestran tarjetas ficticias ni acciones inválidas

### Requirement: Biblioteca permite ordenar y filtrar de forma determinista

El sistema MUST permitir ordenar Biblioteca por `Actualizados recientemente`, `Título A–Z`, `Título Z–A`, `Mayor puntuación` y `Año más reciente`, usando el primero como valor predeterminado, y MUST conservar los filtros existentes de estado y tipo.

#### Scenario: orden predeterminado
- **WHEN** el usuario abre Biblioteca sin un orden guardado
- **THEN** los títulos aparecen por actualización más reciente
- **AND** los empates se resuelven de forma estable

#### Scenario: título sin puntuación
- **WHEN** el usuario ordena por mayor puntuación y uno o más títulos no tienen puntuación
- **THEN** los títulos sin puntuación se ubican después de los que sí tienen
- **AND** el resultado es determinista y no produce errores

#### Scenario: título sin año
- **WHEN** el usuario ordena por año más reciente y uno o más títulos no tienen año
- **THEN** los títulos sin año se ubican después de los que sí tienen
- **AND** el resultado es determinista y no produce errores

#### Scenario: combinación de búsqueda y filtros
- **WHEN** el usuario escribe una búsqueda y selecciona estado o tipo
- **THEN** la lista muestra sólo los títulos que cumplen simultáneamente la búsqueda y los filtros
- **AND** aplica el orden seleccionado al resultado

#### Scenario: filtros sin coincidencias
- **WHEN** la combinación de búsqueda y filtros no produce resultados
- **THEN** se muestra un estado vacío que permite comprender que puede cambiarse la búsqueda o los filtros

### Requirement: los controles de Biblioteca se adaptan a web y móvil

El sistema MUST ofrecer controles adecuados al espacio disponible y MUST mantener sincronizados todos los controles que representen la misma búsqueda o filtro.

#### Scenario: Biblioteca en web
- **WHEN** el usuario abre Biblioteca en web
- **THEN** el campo de búsqueda interna y los chips frecuentes de estado y tipo permanecen visibles
- **AND** existe un control de opciones para apariencia, orden y filtros
- **AND** los chips y el panel muestran y modifican el mismo estado

#### Scenario: Biblioteca en móvil
- **WHEN** el usuario abre Biblioteca en una pantalla móvil
- **THEN** el encabezado muestra `Biblioteca`, un botón de búsqueda y un botón de opciones con icono de ajustes o deslizadores
- **AND** no muestra un menú de tres puntos

#### Scenario: búsqueda móvil activada
- **WHEN** el usuario toca el botón de búsqueda en Biblioteca móvil
- **THEN** el título del encabezado se reemplaza por un campo para buscar dentro de la biblioteca
- **AND** los resultados mantienen la apariencia de Biblioteca

#### Scenario: estados en móvil
- **WHEN** el usuario usa Biblioteca en móvil
- **THEN** puede elegir `Todos`, `Planeados`, `Viendo`, `Terminados` o `Abandonados` en una barra horizontal desplazable de una sola línea
- **AND** el tipo se elige dentro del panel de opciones
- **AND** la barra y el panel permanecen sincronizados

### Requirement: Buscar ofrece una apariencia independiente

El sistema MUST mostrar los resultados de Buscar en `Detalle` de forma predeterminada y MUST permitir elegir `Mosaico` sin alterar la preferencia de Biblioteca ni el orden natural provisto por la búsqueda actual.

#### Scenario: primera vista de Buscar
- **WHEN** el usuario abre Buscar sin una preferencia guardada
- **THEN** los resultados se muestran en `Detalle`

#### Scenario: Buscar en Mosaico
- **WHEN** el usuario selecciona `Mosaico` en Buscar y obtiene resultados
- **THEN** cada resultado se presenta mediante la misma estructura visual de tarjeta de mosaico usada por Biblioteca
- **AND** toda la tarjeta abre el detalle remoto correspondiente
- **AND** no contiene acciones adicionales

#### Scenario: independencia respecto de Biblioteca
- **WHEN** el usuario cambia la apariencia de Buscar
- **THEN** la apariencia de Biblioteca no cambia

#### Scenario: orden natural de TMDB
- **WHEN** Buscar recibe resultados de la búsqueda actual
- **THEN** conserva el orden recibido
- **AND** no ofrece orden remoto, género, año ni parámetros avanzados nuevos

#### Scenario: panel aplicable de Buscar
- **WHEN** el usuario abre las opciones de Buscar
- **THEN** ve únicamente las secciones que tienen opciones disponibles en esta versión
- **AND** no ve secciones vacías de ordenar o filtrar

#### Scenario: Buscar sin resultados
- **WHEN** una consulta válida no devuelve resultados
- **THEN** se muestra un estado vacío comprensible sin importar la apariencia elegida

### Requirement: las tarjetas de títulos en Mosaico priorizan el póster y una navegación única

El sistema MUST usar en los Mosaicos de Biblioteca y Buscar una tarjeta donde el póster sea el elemento predominante, ocupe visualmente casi toda la superficie y conserve una proporción aproximada `2:3`.

#### Scenario: composición visual de una tarjeta con póster
- **WHEN** un título con póster se muestra en el Mosaico de Biblioteca o Buscar
- **THEN** el indicador pequeño `Película` o `Serie` aparece en la esquina superior izquierda del póster
- **AND** el título aparece sobre la parte inferior del póster con una capa oscura o tratamiento de contraste equivalente
- **AND** el título ocupa como máximo dos líneas y se trunca de forma comprensible cuando no cabe
- **AND** no se muestran puntuación, año, estado, descripción, etiquetas ni otros metadatos

#### Scenario: interacción de la tarjeta de mosaico
- **WHEN** el usuario interactúa con una tarjeta del Mosaico de Biblioteca o Buscar
- **THEN** la tarjeta completa es la única acción de navegación
- **AND** no contiene acciones, botones ni zonas táctiles secundarias

#### Scenario: tarjeta con póster ausente
- **WHEN** un título sin póster se muestra en el Mosaico de Biblioteca o Buscar
- **THEN** un placeholder neutro ocupa la misma estructura predominante y proporción aproximada `2:3`
- **AND** conserva el indicador de tipo y el título inferior con el mismo tratamiento de contraste y límite de dos líneas
- **AND** la tarjeta completa continúa siendo la única acción de navegación

### Requirement: Etiquetas ofrece Mosaico y Lista

El sistema MUST mostrar Etiquetas en `Mosaico` de forma predeterminada, MUST permitir elegir `Lista` y MUST permitir ordenar por `Mayor cantidad de títulos`, `Nombre A–Z` o `Nombre Z–A`, usando el primero como valor predeterminado.

#### Scenario: primera vista de Etiquetas
- **WHEN** el usuario abre Etiquetas sin preferencias guardadas
- **THEN** ve un mosaico ordenado por mayor cantidad de títulos
- **AND** los empates se resuelven de forma estable por nombre

#### Scenario: columnas del Mosaico de Etiquetas
- **WHEN** el usuario abre el Mosaico de Etiquetas en un móvil de ancho común
- **THEN** ve dos columnas calculadas desde el ancho disponible
- **AND** el sistema cae a una columna únicamente cuando dos tarjetas quedarían con un ancho insuficiente
- **AND** puede mostrar hasta tres columnas en web ancho

#### Scenario: cambio a Lista
- **WHEN** el usuario selecciona `Lista`
- **THEN** ve las mismas etiquetas y cantidades en una presentación de lista navegable

#### Scenario: apertura de etiqueta
- **WHEN** el usuario toca cualquier parte de una tarjeta o fila de etiqueta
- **THEN** se abren los títulos pertenecientes a esa etiqueta

#### Scenario: ningún título contiene etiquetas
- **WHEN** ningún `SavedTitle` contiene etiquetas
- **THEN** se muestra un estado vacío comprensible que explica que todavía no hay etiquetas derivadas de la biblioteca
- **AND** no se crean entidades ni almacenamiento para etiquetas sin títulos

#### Scenario: búsqueda de etiquetas sin coincidencias
- **WHEN** existen etiquetas derivadas de `SavedTitle` pero la búsqueda no coincide con ninguna
- **THEN** se muestra un estado vacío comprensible para esa búsqueda

#### Scenario: una etiqueta abierta pierde todos sus títulos
- **WHEN** los datos cambian mientras una etiqueta está abierta y ya no queda ningún `SavedTitle` que la contenga
- **THEN** se muestra un estado comprensible o se vuelve de forma segura al listado de etiquetas
- **AND** no se conserva ni crea una entidad de etiqueta vacía

### Requirement: los collages de Etiquetas son estables y legibles

El sistema MUST formar cada collage con hasta cuatro títulos de la etiqueta priorizados por actualización reciente, MUST mantener un orden visual estable y MUST usar placeholders neutros para lugares o imágenes ausentes.

#### Scenario: etiqueta con cuatro o más títulos
- **WHEN** una etiqueta contiene cuatro o más títulos
- **THEN** el collage usa los cuatro títulos actualizados más recientemente
- **AND** un desempate produce siempre el mismo orden visual

#### Scenario: etiqueta con un título
- **WHEN** una etiqueta contiene un título
- **THEN** el collage muestra su póster o placeholder y completa los lugares restantes con placeholders neutros

#### Scenario: etiqueta con dos títulos
- **WHEN** una etiqueta contiene dos títulos
- **THEN** el collage conserva su orden estable y completa dos lugares con placeholders neutros

#### Scenario: etiqueta con tres títulos
- **WHEN** una etiqueta contiene tres títulos
- **THEN** el collage conserva su orden estable y completa un lugar con placeholder neutro

#### Scenario: etiqueta con cuatro títulos
- **WHEN** una etiqueta contiene exactamente cuatro títulos
- **THEN** cada uno ocupa un lugar estable del collage

#### Scenario: póster ausente en collage
- **WHEN** un título elegido para el collage no tiene póster
- **THEN** su lugar muestra un placeholder neutro sin signo `+`
- **AND** el placeholder no es interactivo por separado

#### Scenario: legibilidad de tarjeta
- **WHEN** el collage contiene imágenes claras, oscuras o placeholders
- **THEN** el nombre de la etiqueta y la cantidad permanecen legibles mediante un degradado o tratamiento visual equivalente

### Requirement: el panel de opciones es extensible, accesible y responsive

El sistema MUST usar un único control de opciones con icono de ajustes o deslizadores, MUST mostrar sólo `Apariencia`, `Ordenar` y `Filtrar` cuando correspondan a la pantalla y MUST aplicar cada selección inmediatamente sobre la única fuente de estado de la pantalla.

#### Scenario: opciones en móvil
- **WHEN** el usuario abre opciones en móvil
- **THEN** aparece un panel inferior o modal apropiado para interacción táctil
- **AND** las áreas táctiles son adecuadas y los botones de sólo icono tienen etiquetas accesibles

#### Scenario: opciones en web
- **WHEN** el usuario abre opciones en web
- **THEN** aparece un popover, menú o panel compacto adecuado al espacio disponible
- **AND** toda función se puede usar sin depender de hover

#### Scenario: opciones de apariencia distinguibles
- **WHEN** el usuario revisa la sección `Apariencia`
- **THEN** puede distinguir visualmente `Detalle` y `Mosaico`, o `Mosaico` y `Lista` según la pantalla

#### Scenario: selección inmediata sin confirmación
- **WHEN** el usuario selecciona apariencia, orden, estado o tipo en un control donde esa opción corresponde
- **THEN** la selección se aplica inmediatamente al contenido
- **AND** chips web, barra móvil y panel que representan ese valor se actualizan juntos
- **AND** el panel no mantiene una copia provisional de filtros
- **AND** no se muestran botones `Aplicar` ni `Restablecer`

#### Scenario: transición de apariencia
- **WHEN** el usuario cambia la apariencia
- **THEN** el contenido adopta el nuevo layout sin conservar posiciones o dimensiones inválidas
- **AND** cualquier transición es breve y discreta

### Requirement: las pantallas afectadas presentan textos en español

El sistema MUST mostrar en español todos los textos nuevos y todos los textos visibles de Biblioteca, Buscar, Etiquetas y las partes afectadas del detalle guardado, sin migrar los valores internos del dominio.

#### Scenario: tipos y estados visibles
- **WHEN** una pantalla afectada presenta tipos, estados o etiquetas de interfaz
- **THEN** usa términos como `Película`, `Serie`, `Planeado`, `Viendo`, `Terminado`, `Abandonado`, `Estado` y `Etiquetas` según el contexto
- **AND** los valores internos pueden continuar en inglés

#### Scenario: alcance de idioma
- **WHEN** se aplica el cambio
- **THEN** no se agrega un selector de idioma ni un sistema completo de internacionalización
