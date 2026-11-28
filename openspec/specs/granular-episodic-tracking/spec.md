# granular-episodic-tracking Specification

## Purpose

Registra decisiones personales por unidad serializada y presenta cobertura verificable dentro de un alcance explícito.

## Requirements

### Requirement: Identidad durable de unidades y grupos
El sistema MUST identificar cada unidad y grupo por UUID portable y propietario. Las referencias externas MUST estar acotadas por proveedor, namespace y título externo; las coordenadas editoriales son atributos. El sistema MUST rechazar asociaciones contradictorias entre UUID, referencia y propietario sin fusionar ni reasignar registros. MUST ordenar capítulos por valor decimal exacto y desempatar de forma estable.

#### Scenario: Renumeración
- **WHEN** una referencia fiable conserva identidad pero pasa de E10 a E11 o cambia de grupo
- **THEN** se conserva la unidad y su decisión

#### Scenario: Identidades incompatibles
- **WHEN** UUID y referencia identifican unidades distintas o pertenecen a otros títulos
- **THEN** se omite la asociación y se informa la colisión sin modificar identidades

#### Scenario: Capítulos con huecos
- **WHEN** existen capítulos 15, 12.5 y 12 y los tres están marcados
- **THEN** se leen como 12, 12.5 y 15 y se cuentan exactamente tres unidades sin convertir a flotantes ni crear capítulos intermedios

### Requirement: Decisiones personales explícitas y atómicas
El sistema MUST distinguir ausencia, marcado con fecha civil de consumo opcional y desmarcado explícito sin fecha de consumo. MUST admitir fecha elegida o acción Hoy explícita y mantener reloj y revisión independientes. MUST revalidar propietario, elegibilidad y versiones en transacción; una repetición con resultado idéntico MUST ser idempotente, una edición obsoleta diferente MUST rechazarse y las invalidaciones MUST publicarse tras commit. MUST conservar decisiones al retirar unidades y aplicar cascada al borrar su título.

#### Scenario: Fecha opcional
- **WHEN** se marca sin fecha, se elige Hoy o se corrige una fecha pasada
- **THEN** se registra respectivamente ausencia, día civil local o fecha elegida sin derivarla del timestamp de edición

#### Scenario: Doble pulsación y concurrencia
- **WHEN** se repite una escritura o se intenta guardar un estado diferente con versión anterior
- **THEN** la repetición idéntica no duplica ni cambia reloj y la escritura obsoleta diferente se rechaza

#### Scenario: Offline y reapertura
- **WHEN** se marca o desmarca una unidad local sin conexión y se reabre SQLite
- **THEN** se conserva la decisión y se puede consultar el descriptor sin peticiones remotas

#### Scenario: Migración y cascada
- **WHEN** se migra una base histórica o se elimina un título
- **THEN** la migración conserva filas sin inventar consumo y la eliminación quita únicamente los datos dependientes del título

### Requirement: Selección múltiple cerrada
Las marcas y desmarcas masivas MUST confirmar el conjunto exacto de IDs, revisión aplicable y exclusiones. El preset de temporada MUST limitarse a estrenados ordinarios conocidos, etiquetados como selección parcial cuando corresponda. La selección explícita puede incluir especiales y, para marcar futuros, MUST exigir confirmación identificable por unidad. MUST revalidar conjunto, alcance, elegibilidad y versiones y aplicar todo en una transacción por confirmación de hasta 500 IDs. Para conjuntos mayores MUST mostrar particiones explícitas y confirmar cada una de forma independiente, informando que los commits previos no se revierten si falla una partición posterior.

#### Scenario: Selección cambiada
- **WHEN** cambia el inventario o una versión desde la confirmación
- **THEN** se exige revisar el conjunto de nuevo y no se aplica un subconjunto

#### Scenario: Más de 500 IDs
- **WHEN** se seleccionan 501 IDs y falla la segunda confirmación
- **THEN** la interfaz identifica ambas particiones independientes y conserva el resultado confirmado de la primera sin atribuir atomicidad a toda la selección

#### Scenario: Fallo intermedio
- **WHEN** falla una escritura en un lote de desmarcados
- **THEN** se revierte todo el lote y no se invalidan snapshots

#### Scenario: Desmarcado múltiple
- **WHEN** se aplica un lote válido de desmarcados
- **THEN** las selecciones marcadas se convierten en decisiones negativas durables

### Requirement: Cobertura delimitada por evidencia
El numerador MUST contar decisiones positivas distintas dentro del denominador acreditado. El denominador MUST contar unidades ordinarias estrenadas de una sola revisión y alcance, o unidades de una lista manual explícita con rótulo de lista. MUST excluir futuros, separar especiales y mostrar las marcas externas al alcance por separado. Alcance vacío, parcial, contradictorio o con pertenencia incierta MUST omitir el porcentaje editorial. La cobertura global MUST exigir evidencia del conjunto completo de alcances requeridos.

#### Scenario: Temporada acreditada
- **WHEN** cuatro de doce unidades elegibles están marcadas
- **THEN** se muestra 4 de 12 y 33 % de esa temporada con su alcance

#### Scenario: Parcial vacío y lista manual
- **WHEN** se consulta una guía incompleta, un alcance vacío o una lista manual
- **THEN** se muestran conteos parciales, ningún porcentaje para el vacío y cobertura rotulada de la lista manual respectivamente

#### Scenario: Nuevos estrenos y marcas externas
- **WHEN** una revisión válida amplía el conjunto estrenado o hay marcas retiradas, especiales o de otra fuente
- **THEN** se recalcula la cobertura sin modificar marcas y las externas se muestran separadas

### Requirement: Interfaz accesible y lecturas acotadas
La ficha MUST ofrecer vista previa y ruta dedicada virtualizada, agrupación opcional, filtros y estados de carga, vacío, error y desactualización. Si se ofrece cuadrícula compacta para episodios numerados, MUST virtualizarla y reutilizar identidades y selección de la lista. MUST NOT crear celdas de unidades inexistentes desde máximos o totales. MUST ocultar sinopsis e imágenes de unidades hasta acción expresa. Biblioteca y Colecciones MUST compartir agregados por lote y no iniciar peticiones editoriales desde tarjetas. Las acciones MUST identificar la unidad y su estado mediante etiquetas accesibles y operar con teclado, lector, temas y fuente ampliada.

#### Scenario: Escala y accesibilidad
- **WHEN** se navega por listas de 12, 100, 1000 o 5000 unidades en Web o Android
- **THEN** se pagina en orden estable, se monta solo una ventana y se puede operar sin perder foco ni significado

#### Scenario: Cuadrícula opcional con huecos
- **WHEN** se alterna a una cuadrícula disponible con E1 y E5 y una selección activa
- **THEN** aparecen únicamente unidades reales y se conserva la selección por identidad sin montar todas las celdas de una guía extensa

#### Scenario: Snapshots coherentes
- **WHEN** se confirma una marca y se consultan ficha, Biblioteca y Colecciones
- **THEN** las vistas muestran datos confirmados con lecturas agrupadas y sin peticiones editoriales
