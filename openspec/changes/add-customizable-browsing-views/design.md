## Context

Ver `proposal.md` para la motivación y `specs/` para el contrato observable.

Las pantallas actuales implementan sus tarjetas y controles de forma local. `app/(tabs)/libreria.tsx` filtra en memoria y usa una única `FlatList` detallada; `app/(tabs)/buscar.tsx` conserva el orden de `searchMulti()` y tiene una única tarjeta; `app/(tabs)/etiquetas.tsx` deriva un `Map<string, SavedTitle[]>`, ordena por cantidad y muestra etiquetas y resultados dentro de `ScrollView`. Los textos visibles mezclan español con valores internos en inglés.

`SavedTitle` ya contiene `posterUrl`, `voteAverage`, `year`, `updatedAt`, `type`, `status` y `tags`, suficientes para ordenar y formar collages. `src/storage/db.ts` abre `despues-la-veo.db`, crea `saved_titles` y el índice único `idx_saved_titles_provider_external`, pero no registra una versión explícita ni tiene almacenamiento de configuración. `package.json` ya incluye `expo-sqlite` y `@expo/vector-icons`; no hace falta una dependencia nueva.

## Goals / Non-Goals

**Goals:**

- Mantener una única fuente de estado por filtro, búsqueda y preferencia dentro de cada pantalla.
- Compartir sólo primitivas visuales y lógica que realmente coincidan entre pantallas.
- Conservar la identidad y las operaciones existentes de títulos mientras las presentaciones cambian.
- Hacer explícita, aditiva, idempotente y verificable la evolución SQLite necesaria para preferencias, con rollback de código compatible pero sin una migración inversa automática.
- Evitar layouts inválidos al alternar una `FlatList` entre lista y cuadrícula.

**Non-Goals:**

- Crear un store global, una biblioteca de componentes completa o un sistema de internacionalización.
- Mover orden o filtros de Biblioteca a consultas SQL; el conjunto ya se carga con `listSavedTitles()` y se procesa en memoria.
- Cambiar el contrato de TMDB, `SavedTitle`, backups o la identidad del índice.
- Preparar estructuras de fijados, personalización de collages o filtros futuros antes de que tengan requisitos propios.

## Decisions

### 1. Tipos de preferencias acotados y separados de `SavedTitle`

Se agregará `src/core/viewPreferences.ts` con uniones literales y constantes de opciones válidas:

- `LibraryViewMode = "detail" | "grid"`;
- `SearchViewMode = "detail" | "grid"`;
- `TagsViewMode = "grid" | "list"`;
- `LibrarySort = "updated-desc" | "title-asc" | "title-desc" | "rating-desc" | "year-desc"`;
- `TagsSort = "count-desc" | "name-asc" | "name-desc"`;
- claves estables para cada preferencia y predeterminados tipados.

Las validaciones serán funciones explícitas por unión, no conversiones forzadas con `as`. En palabras sencillas: TypeScript impide que la interfaz escriba opciones no declaradas, pero como SQLite contiene texto, cada lectura debe comprobar el valor en tiempo de ejecución.

No se modificarán `src/core/savedTitle.ts` ni `src/core/libraryBackupV1.ts`. La alternativa de agregar campos a `SavedTitle` mezclaría configuración del dispositivo con identidad y contenido exportable, y queda descartada.

### 2. Tabla SQLite genérica y pequeña para preferencias

Se agregará `src/storage/viewPreferencesRepo.ts`, apoyado en `initDb()`, con operaciones tipadas para leer y escribir únicamente las claves conocidas. La tabla propuesta es:

```sql
CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Una tabla clave-valor evita una migración de columnas por cada preferencia futura y sigue siendo más acotada que introducir un sistema general de settings. `value` será texto validado por clave; no se serializarán objetos arbitrarios. La escritura usará `INSERT ... ON CONFLICT(key) DO UPDATE` y actualizará `updated_at`. La lectura de una clave ausente, inválida o desconocida devolverá su predeterminado; podrá sobrescribirse con el predeterminado en una escritura reparadora posterior, pero la pantalla no dependerá de esa reparación.

Alternativas descartadas:

- una dependencia de almacenamiento dedicada: viola la restricción y duplica SQLite;
- una fila con muchas columnas: obliga a migrar cada opción nueva;
- mezclar preferencias en `saved_titles`: altera el dominio y el backup;
- memoria solamente: no cumple persistencia entre aperturas.

### 3. Evolución SQLite aditiva e idempotente de versión 0 → 1

La versión anterior se considera `0`, porque `src/storage/db.ts` no establece `PRAGMA user_version`. La versión nueva será `1`.

Esta evolución no se considera una migración de esquema reversible. La inicialización conservará primero las sentencias idempotentes actuales de `saved_titles`, su índice y los defaults de filas viejas. Luego leerá `PRAGMA user_version`:

1. Si es menor que `1`, inicia una transacción.
2. Ejecuta `CREATE TABLE IF NOT EXISTS app_preferences (...)`.
3. Verifica con `sqlite_master` que la tabla existe y, mediante `PRAGMA table_info(app_preferences)`, que contiene `key`, `value` y `updated_at` con la forma esperada.
4. Sólo después fija `PRAGMA user_version = 1` y confirma.
5. Ante cualquier error revierte la transacción en curso; no toca `saved_titles` ni declara completada la evolución.
6. Si la versión ya es `1`, puede ejecutar `CREATE TABLE IF NOT EXISTS` como defensa idempotente y verificar la estructura antes de exponer el repositorio.
7. Si aparece una versión mayor que `1`, no se intentará degradar ni reconstruir tablas: se devolverá un error explícito de versión no soportada.

En SQL sencillo: la tabla nueva se agrega al costado de la biblioteca; no se renombra, copia, borra ni actualiza ninguna fila de `saved_titles`, y no se elimina ni recrea `idx_saved_titles_provider_external`.

Compatibilidad con rollback de código: una versión anterior ignorará `app_preferences`. No existe una operación inversa automática, no se reduce `PRAGMA user_version` y no se ejecuta `DROP TABLE`. Si más adelante se necesita retirar la tabla, será otro cambio explícito que compruebe nombre y contenido antes de actuar.

### 4. Carga, actualización optimista y errores

Cada pantalla cargará sus preferencias al obtener foco o durante su montaje, con un estado `preferencesReady` que evita grabar predeterminados antes de terminar la lectura. Un cambio iniciado por el usuario actualizará la UI y luego persistirá la clave correspondiente. Si la escritura falla, se restaurará el último valor confirmado y se mostrará un mensaje en español apropiado a la plataforma; nunca se escribirán títulos.

Una lectura fallida usa los predeterminados y registra el error. Las cargas concurrentes ignorarán resultados obsoletos mediante una bandera de cancelación o patrón equivalente ya usado en Buscar. No se crea un context global: las preferencias son pocas, independientes y sólo Biblioteca debe ser consultada por Etiquetas para sus resultados.

Para esa herencia, Etiquetas leerá `library.viewMode` al abrir una etiqueta o al recibir foco. No tendrá una clave propia para los resultados. La alternativa de duplicar el estado facilita divergencias y se descarta.

### 5. Componentes compartidos mínimos

Se prevé crear `src/components/browsing/` con piezas pequeñas, sin imponer una abstracción única a modelos distintos:

- `PosterPlaceholder`: superficie neutra, no interactiva por sí misma y sin `+`;
- `TitleGridCard`: contrato visual compartido por los Mosaicos de Biblioteca y Buscar; recibe datos visuales ya normalizados para servir a `SavedTitle` y `TmdbSearchItem` sin unir sus tipos;
- `ViewOptionsPanel`: estructura accesible de secciones y opciones; selecciona presentación de modal/panel en móvil y popover/panel compacto en web mediante `Platform` y dimensiones disponibles;
- `LayoutOption`: opción visual de apariencia con icono o miniatura;
- `TagCollage`: composición fija de cuatro celdas visuales;
- utilidades de etiquetas visibles (`Película`, `Serie` y estados) en `src/core/presentationLabels.ts` o junto a los componentes, sin sistema i18n.

La tarjeta detallada de Biblioteca conserva acciones y datos que no existen en Buscar, por lo que se extraerá sólo si dos usos reales terminan compartiendo el mismo contrato. `Chip` puede compartirse entre controles de Biblioteca si conserva accesibilidad, pero no se generalizará toda la UI actual. `TagCard` y la fila de etiqueta serán específicas de Etiquetas.

`TitleGridCard` queda cerrado con esta estructura, sin variantes por pantalla:

- el póster es el elemento predominante y ocupa visualmente casi toda la tarjeta con proporción aproximada `2:3`;
- el indicador pequeño `Película` o `Serie` se superpone en la esquina superior izquierda;
- el título se superpone sobre la parte inferior del póster con una capa oscura, degradado o tratamiento equivalente que garantice contraste;
- el título admite como máximo dos líneas y usa truncado final comprensible cuando no cabe;
- no se renderizan año, puntuación, estado, descripción, etiquetas ni otros metadatos;
- no se renderizan acciones, botones ni áreas táctiles secundarias;
- el `Pressable` exterior de la tarjeta completa es la única acción y navega al detalle correspondiente;
- si falta el póster o falla su carga, `PosterPlaceholder` ocupa exactamente la misma región `2:3` y conserva indicador, título, contraste y navegación exterior.

La alternativa de colocar texto debajo del póster se descarta porque reduce el predominio visual solicitado y permite alturas variables. La alternativa de añadir metadatos “útiles” se descarta para mantener el mosaico escaneable y sin acciones implícitas.

### 6. Estado único y sincronización de controles

Biblioteca mantendrá una sola variable para `statusFilter` y otra para `typeFilter`. Los chips web, la barra móvil y `ViewOptionsPanel` recibirán esos valores y callbacks; no mantendrán copias locales. Así, elegir `Viendo` en la barra hace que el panel refleje `Viendo`, y elegir `Películas` en el panel actualiza los chips web cuando correspondan.

Apariencia, orden, estado y tipo se aplican en el mismo callback de selección, inmediatamente. El panel es una vista controlada de la fuente de estado de la pantalla: no conserva borradores ni una copia provisional de filtros. En esta versión no incluye botones `Aplicar` o `Restablecer`; cerrar el panel sólo lo oculta y no confirma, cancela ni revierte selecciones. Las preferencias persistentes de apariencia y orden se escriben después de actualizar esa fuente única según la estrategia de errores de la sección 4.

La búsqueda interna conserva una sola variable `q`. En web el campo permanece visible. En móvil `isSearchActive` decide si el encabezado muestra título o campo, pero no duplica la consulta. Cerrar la búsqueda podrá limpiar `q` de forma explícita para que el usuario vea inmediatamente la lista completa; esta acción tendrá etiqueta accesible.

El panel recibe descriptores de secciones aplicables. Biblioteca pasa Apariencia, Ordenar y Filtrar; Buscar sólo Apariencia; Etiquetas pasa Apariencia y Ordenar. Esto impide secciones vacías sin codificar pantallas futuras.

### 7. Orden y empates deterministas

El filtrado y orden de Biblioteca seguirán en un `useMemo`: primero filtros y consulta; luego una copia ordenada. Las comparaciones serán:

- actualización: `updatedAt` descendente;
- títulos: `localeCompare` en español con sensibilidad base, ascendente o descendente;
- puntuación: valores numéricos presentes descendentes, ausentes al final;
- año: valores numéricos presentes descendentes, ausentes al final.

Todo criterio termina con título normalizado y luego `id` como desempates estables. Esto evita saltos cuando dos elementos carecen de año o puntuación. No se cambia `listSavedTitles()` ni su SQL porque el mismo conjunto debe poder reordenarse instantáneamente y el volumen actual no justifica consultas separadas.

Etiquetas deriva `{ tag, items, count }` exclusivamente de los arrays `tags` de `SavedTitle`. Se ordena por cantidad descendente y nombre como desempate predeterminado, o por nombre según la selección. No se inventa fecha de etiqueta ni se persisten entidades separadas: si ningún título contiene etiquetas, la colección derivada está vacía. Una etiqueta seleccionada sólo puede quedar sin títulos si los datos cambian mientras está abierta; la pantalla mostrará entonces un estado comprensible o volverá de forma segura al listado.

Buscar no ordena: conserva exactamente la secuencia filtrada que devuelve `searchMulti()`.

### 8. Cálculo responsive de columnas y tarjetas

Cada pantalla medirá el ancho disponible con `useWindowDimensions()` y descontará padding y separaciones. Para títulos en mosaico se usará un ancho objetivo aproximado de 150–180 px, con mínimo de 2 columnas en anchos móviles que lo permitan y un máximo razonable de 6 en web. La fórmula será equivalente a:

`columnas = clamp(mínimo, floor((anchoDisponible + separación) / (anchoObjetivo + separación)), máximo)`

`anchoTarjeta = floor((anchoDisponible - separación * (columnas - 1)) / columnas)`

En anchos demasiado estrechos para dos tarjetas accesibles, se permitirá una columna. `TitleGridCard` conserva siempre la proporción visual aproximada `2:3`, el título superpuesto de hasta dos líneas y el indicador superior izquierdo; ninguno depende de hover.

Etiquetas intentará dos columnas también en móviles comunes de aproximadamente 360–390 px. Con 32 px de padding horizontal total y 12 px de separación, usará dos columnas cuando cada tarjeta pueda conservar al menos 150 px; sólo caerá a una columna por debajo de ese mínimo. Mantendrá dos columnas en tablet/web compacto y pasará a tres cuando las tres tarjetas puedan conservar aproximadamente 290 px cada una. `TagCollage` seguirá siendo una grilla 2×2 dentro de cada tarjeta; el degradado o capa sólida semitransparente se resolverá con capacidades ya disponibles. Si un degradado real requiriera una dependencia nueva, se usará una capa de contraste existente en React Native y no se agregará el paquete.

Los puntos exactos se basarán en ancho disponible, no sólo en `Platform.OS`, para soportar ventanas web pequeñas y rotación móvil.

### 9. Cambio seguro de layout en `FlatList`

React Native no debe reutilizar una instancia de `FlatList` configurada con distinto `numColumns`. Biblioteca y Buscar asignarán una `key` de layout, por ejemplo `detail-1` o `grid-${columnCount}`. Al cambiar apariencia o número de columnas, la key fuerza un remontaje con layout válido. Además:

- `numColumns` será `1` en Detalle y el cálculo responsive en Mosaico;
- `columnWrapperStyle` sólo se pasará cuando `numColumns > 1`;
- `getItemLayout` no se agregará porque las alturas de Detalle son variables;
- `keyExtractor` conservará la identidad existente de cada resultado;
- el contenido y el estado de filtros viven fuera de la lista, así que el remontaje no los pierde.

Puede aplicarse una transición breve de opacidad o layout disponible en React Native, pero el cambio correcto no dependerá de la animación.

Etiquetas migrará su colección principal de `ScrollView` con mapeo a `FlatList` para cuadrícula/lista. Los resultados de una etiqueta reutilizarán la presentación de títulos de Biblioteca con la misma regla de key.

### 10. Formación del collage y pósters ausentes

Para cada etiqueta se copiarán sus títulos y se ordenarán por `updatedAt` descendente, luego título y `id`; se tomarán los primeros cuatro. Las cuatro posiciones del collage siempre existirán:

- una entrada con `posterUrl` muestra su imagen;
- una entrada sin URL muestra `PosterPlaceholder`;
- una posición sin título también muestra el placeholder;
- ninguna celda recibe `onPress`, signo `+` ni semántica de botón; sólo la tarjeta exterior navega.

El título y la cantidad se dibujan sobre una zona de contraste constante. Un error de carga de imagen puede cambiar esa celda a placeholder mediante estado local, sin alterar el título guardado ni reordenar el collage.

### 11. Archivos y capas afectados

- `app/(tabs)/libreria.tsx`: estado, carga de preferencia, orden, filtros, encabezado responsive, opciones y ambos layouts.
- `app/(tabs)/buscar.tsx`: carga de apariencia, opciones aplicables y ambos layouts conservando orden TMDB.
- `app/(tabs)/etiquetas.tsx`: derivación de etiquetas, orden, mosaico/lista, collage y resultados heredados de Biblioteca.
- `app/title/[id].tsx`: normalización de textos visibles afectados (`Película`, `Serie`, `Etiquetas`, estados y fecha de actualización); sin cambios de persistencia.
- `src/core/viewPreferences.ts` (nuevo): tipos, claves, predeterminados y validadores.
- `src/core/presentationLabels.ts` (nuevo, si la implementación confirma dos o más consumidores): traducciones de presentación.
- `src/storage/db.ts`: evolución aditiva a versión 1 y verificación de `app_preferences`.
- `src/storage/viewPreferencesRepo.ts` (nuevo): lectura/escritura tipada y aislada.
- `src/components/browsing/*` (nuevos): sólo las primitivas compartidas enumeradas.
- `src/theme/colors.ts`: únicamente nuevos tokens neutrales o de superposición que necesiten dos o más componentes.

No se prevén cambios en `src/storage/savedTitlesRepo.ts`, `src/storage/libraryBackupMerge.ts`, `src/core/libraryBackupV1.ts`, `src/providers/tmdb/` ni `package.json`. Si durante la implementación hiciera falta tocar uno, deberá justificarse contra este diseño antes de continuar.

### 12. Backup JSON v1 permanece sin preferencias

El backup representa contenido de biblioteca portable: títulos, estado, etiquetas y notas. Apariencia y orden describen cómo este dispositivo presenta ese contenido y pueden diferir legítimamente en teléfono y web. Por eso `app_preferences` no participa en `getAllSavedTitles()`, la serialización ni el merge de importación. No habrá campo nuevo en el payload ni incremento de `LIBRARY_BACKUP_VERSION`.

## Risks / Trade-offs

- [El cambio de `FlatList` pierde la posición de scroll] → remontar sólo cuando cambia apariencia o columnas; aceptar el reinicio de posición como costo de evitar un layout inválido y no prometer preservación de scroll en esta versión.
- [Muchas columnas producen tarjetas demasiado pequeñas] → calcular desde ancho real con objetivos y límites, y comprobar móvil estrecho, rotación y web ancho.
- [La capa de contraste no equivale a un degradado real] → priorizar legibilidad con APIs existentes; no agregar dependencia visual sin aprobación.
- [Una escritura optimista falla] → restaurar el último valor confirmado, informar el error y nunca tocar datos de títulos.
- [Preferencias corruptas] → validar por clave y usar predeterminados independientes.
- [Evolución SQLite interrumpida] → transacción, verificación antes de `user_version = 1` e idempotencia al reintentar.
- [Dos pantallas duplican lógica visual] → compartir `TitleGridCard` y placeholder, pero mantener tarjetas detalladas específicas para evitar una abstracción con demasiadas variantes.
- [La normalización al español alcanza textos preexistentes] → limitarla a las cuatro pantallas declaradas y verificar que sólo cambie presentación, no valores internos.

## Plan de evolución y rollback de código

1. Registrar la versión anterior `0` y añadir la evolución aditiva transaccional `0 → 1` con verificación estructural.
2. Probar la evolución sobre una base con títulos, una base vacía y una base ya en versión `1`; comparar cantidad, IDs e índice antes y después.
3. Incorporar el repositorio de preferencias y verificar defaults, valores válidos, valores inválidos y errores simulados antes de conectar UI.
4. Conectar pantallas por secciones, ejecutando `npx tsc --noEmit` y revisión correspondiente después de cada una.
5. Verificar exportación e importación JSON v1 contra una copia de prueba y confirmar que `app_preferences` no aparece ni cambia.

El rollback consiste únicamente en volver al código anterior, que ignora la tabla adicional. No se ejecutará `DROP TABLE`, no se reducirá `PRAGMA user_version` automáticamente y no se transformará `saved_titles`; por eso no se describe como una migración de esquema reversible. Si la evolución falla antes de confirmar, la transacción en curso se revierte y el siguiente inicio puede reintentarla.
