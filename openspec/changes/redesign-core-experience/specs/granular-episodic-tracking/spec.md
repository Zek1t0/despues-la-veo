## MODIFIED Requirements

### Requirement: Interfaz accesible y lecturas acotadas
La ficha MUST ofrecer vista previa y ruta dedicada virtualizada, agrupación opcional, filtros y estados de carga, vacío, error y desactualización. Si se ofrece cuadrícula compacta para episodios numerados, MUST virtualizarla y reutilizar identidades y selección de la lista. MUST NOT crear celdas de unidades inexistentes desde máximos o totales. MUST ocultar sinopsis e imágenes de unidades hasta acción expresa. Biblioteca y Colecciones MUST compartir agregados por lote y no iniciar peticiones editoriales desde tarjetas. Las acciones MUST identificar la unidad y su estado mediante etiquetas accesibles y operar con teclado, lector, temas y fuente ampliada.

La ruta MUST iniciar en cuadrícula para episodios numerados compatibles y en lista para capítulos u otros formatos que requieran más espacio, respetando la vista explícita compatible. MUST mostrar un selector compacto de alcance y ofrecer filtros y acciones de gestión pertinentes. El toque sobre una unidad en modo normal MUST marcar o desmarcar si la acción es elegible y no exige confirmación. MUST comunicar el resultado tras commit, conservar la fecha existente cuando corresponda y reservar la elección de fecha para una acción expresa. El modo Seleccionar MUST ser explícito, mostrar contador y permitir cancelar sin escribir. MUST conservar confirmaciones obligatorias, disponibilidad, cobertura y vencimiento conforme a los contratos de inventario y selección.

#### Scenario: Escala y accesibilidad
- **WHEN** se navega por listas de 12, 100, 1000 o 5000 unidades en Web o Android
- **THEN** se pagina en orden estable, se monta solo una ventana y se puede operar sin perder foco ni significado

#### Scenario: Cuadrícula opcional con huecos
- **WHEN** se alterna a una cuadrícula disponible con E1 y E5 y una selección activa
- **THEN** aparecen únicamente unidades reales y se conserva la selección por identidad sin montar todas las celdas de una guía extensa

#### Scenario: Snapshots coherentes
- **WHEN** se confirma una marca y se consultan ficha, Biblioteca y Colecciones
- **THEN** las vistas muestran datos confirmados con lecturas agrupadas y sin peticiones editoriales

#### Scenario: Presentación y alcance inicial
- **WHEN** se abre un título con episodios numerados compatibles o con capítulos
- **THEN** se muestra respectivamente cuadrícula o lista por defecto, respetando la vista explícita compatible y ofreciendo un selector compacto de temporada, volumen, grupo o fuente

#### Scenario: Acción individual y modo de selección
- **WHEN** se pulsa una unidad elegible en modo normal o se activa Seleccionar
- **THEN** la pulsación normal marca o desmarca una unidad si no requiere confirmación ni una decisión de fecha. La selección solo cambia el conjunto provisional hasta confirmar. Una unidad anunciada conserva su confirmación obligatoria y las fechas existentes se preservan por defecto cuando corresponda

#### Scenario: Acciones contextuales y cobertura
- **WHEN** se consulta una guía parcial, obsoleta o el inventario manual
- **THEN** se muestran conteos con su alcance y solo se ofrece barra con denominador acreditado o lista manual explícita. Actualizar guía o gestionar unidades, rangos y grupos aparece según la capacidad del alcance
