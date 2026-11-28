## Context

La referencia aprobada es `despues-la-veo-prototipo-ui-v2.html`, concepto 02. El documento `openspec-propose-redesign-core-experience.md` prevalece. V2 muestra portada y backdrop, acento lavanda, Retomar horizontal, tres secciones de ficha, paneles inferiores y cuadrícula de unidades. El diseño usa arte real con los componentes vigentes y fallbacks de producción. Los datos, imágenes embebidas y CSS/JS de la demo quedan fuera del repositorio.

## Goals / Non-Goals

**Goals:** Reutilizar el árbol Expo Router, el tema efectivo y las lecturas agrupadas. Aislar la presentación de mutaciones, restauración y elegibilidad. Cada checkpoint debe poder revisarse con capturas y revertirse por separado.

**Non-Goals:** Rediseño completo de pantallas adyacentes, nuevos proveedores, catálogos, cambios en SQLite o formato de backup, y modificación de las reglas de cobertura o identidad.

## Decisions

### S1 · Tema y componentes

Conservar `original`, que hoy se llama Original en el catálogo y corresponde al estilo al que el brief llama Clásico. Mantener el default portable `dark + original`. Mostrar ese ID una sola vez como «Original». Base V2 es el nombre técnico de sus tokens. `lavender` sigue siendo una paleta personalizada independiente. Un backup histórico con `original` restaura Base V2 en el esquema guardado. Los demás IDs, el orden de catálogo y las reglas de hidratación, recuperación y exportación se conservan. Un backup sin Appearance sigue las reglas históricas de merge. Reutilizar el ID conserva la selección portable y permite volver al código anterior sin transformar preferencias.

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | #14151B | #F4F3F8 |
| Superficie | #22242E | #FFFFFF |
| Elevada | #30333E | #E7E5EE |
| Texto | #F3F2F8 | #20212B |
| Secundario | #B0B2C2 | #616375 |
| Acento / sobre acento | #C4AFFF / #251746 | #6442B4 / #FFFFFF |
| Borde decorativo | #414451 | #D2CDDF |
| Selección | #40345B | #E8DFFD |

En `src/theme/{bases,palettes,resolver,presentation}` verificar cómo los overrides heredan la base antes de aplicar V2. Acotar los nuevos valores a `original` y preservar la identidad de las otras seis paletas. Derivar foreground y borde de selección, `borderStrong`, inputs y overlays según contraste real. Registrar desviaciones de V2 con motivo y medición. Conservar semántica de peligro, ratings, disabled y branding. El bootstrap de `ProductionRootLayout` usa la base resuelta sin esperar red. Compartir pasos 4/8/12/16/24/32 y bloques de 24–32 dp, niveles de título/cuerpo/metadatos con wrapping, radios y objetivos de 48 dp donde sea viable.

En `src/components` consolidar contenedor, superficie, acciones, campo, selector, menú, modal y estados reutilizando los patrones de `OrganizationUI` y browsing donde cubran el contrato. El encabezado del navegador absorbe inset superior cuando está presente. En un encabezado propio lo absorbe el contenedor. La barra inferior absorbe inset inferior en tabs. En el stack lo absorbe el cuerpo desplazable o el pie fijo, y el cuerpo reserva la altura de ese pie. El overlay se ajusta en su propia capa. Verificar insets laterales, teclado, gesto Atrás, Escape Web, foco inicial y retorno, nombre y estado accesibles. Usar las APIs de cada plataforma con guards y conservar el aislamiento TEST.

### S2 · Rutas y Biblioteca

| Antes | Después |
|---|---|
| `/` → Biblioteca | Mismo destino. Sin Inicio independiente. |
| Biblioteca / Buscar / Etiquetas / Actualizaciones / Ajustes | Biblioteca / Buscar / Actividad. Conservar `/etiquetas`, `/ajustes` y `/actualizaciones` para entradas y retornos. |
| Biblioteca → Organizar → Colecciones o recomendaciones | Biblioteca → Colecciones / Etiquetas / Inbox. Conservar `/organize` como entrada compatible. |
| Biblioteca → alta manual / selector local | Mismas rutas y semántica de retorno. |
| Buscar o Inbox → ficha remota → ficha local o Inbox | Mismas rutas y resolución. Conservar parámetros de recomendación. |
| Ficha local → granular o selector de membresías | Mismas rutas, con ID local, contexto de pin y alcance granular. |

En `app/(tabs)/_layout.tsx` y `ProductionRootLayout` retirar de la barra las entradas de Ajustes y Etiquetas y conservar su resolución en Expo Router. Probar Atrás, enlaces Web y retorno desde picker, ficha, etiqueta e Inbox. Mantener query, vista y foco del origen al regresar cuando sea posible. Ajustes se abre desde el icono nombrado en Biblioteca. Actividad usa el mismo nombre en pestaña y encabezado, manteniendo el feed actual.

En `libreria.tsx`, Retomar usa el snapshot local visible. Filtrar por `watching` con la misma protección sensible del inventario, y ordenar en descendente por una clave por título. Usar el máximo disponible entre `PersonalProgress.updatedAt` y el máximo de `granular_decisions.updated_at` por `owner_id`. Un restablecimiento persistido y un desmarcado explícito cuentan como actividad confirmada. Las descargas, cambios de inventario y simples relecturas no aportan actividad personal. Usar `item.updatedAt` solo cuando ambos relojes de progreso estén ausentes o no disponibles. Desempatar por ID local ascendente con comparación estable. Un reloj válido igual a cero se conserva. El reloj ordena y carece de significado como fecha de consumo o próximo episodio. Los títulos sin progreso siguen siendo elegibles.

`libraryScreenSnapshot.ts` ya obtiene `listPersonalProgressWithDb` y `listGranularCountsWithDb` por lotes. El cursor ya incluye el reloj de su fila. El segundo helper de `granularPresentationRepo.ts` agrupa solo filas con `marked=1` y expone conteos, por lo que el futuro APPLY debe añadir al snapshot una agregación local por propietario que obtenga también el máximo sobre todas las decisiones, contando positivamente solo `marked=1`. Preservar lectura consistente, invalidación tras commit y estados recuperables ante errores de lectura. La consulta no cambia relojes, persistencia ni migraciones y evita red y consultas por tarjeta.

Mostrar hasta cuatro tarjetas iniciales y Ver todos cuando haya más, con el mismo orden y sin cambiar los filtros del inventario. Permitir gesto y snap cuando resulte útil, con indicio de continuación y sin scrollbar horizontal. Biblioteca y Colecciones presentan cursor y marcas como datos independientes. La ausencia o el restablecimiento del cursor no ocultan marcas. Ante incompatibilidad se explica la posición histórica conservada y se siguen mostrando las marcas según las reglas vigentes.

```text
Biblioteca                               [Ajustes]
Retomar       [portada · título · En curso · posición confirmada] → [Ver todos]
[Colecciones] [Etiquetas]                 [Inbox]
Todos mis títulos
[Buscar en Biblioteca]   [Recientes ▾]   [Filtros]   [Vista]
[Categorías]  [Filtros activos · Limpiar]
[Inventario]     [Alta manual] [¿Qué veo hoy?]
```

La etiqueta de orden refleja el orden activo. Filtros incluye solo criterios de contenido, con chips que actualizan el mismo estado, filtros activos y acción para limpiar. La vista actúa sobre la preferencia de presentación independiente. Usar alternancia cuando existan exactamente dos vistas y selector si hay más. Conservar opciones reales, pins por contexto, orden, persistencia local, error y vacío diferenciados. Tomar la composición de V2 y reemplazar su panel combinado por estos tres controles.

### S3 · Ficha compartida

En `app/title/[id].tsx`, las tres rutas remotas y `src/providers/kitsu/AnimeDetail.tsx`, compartir encabezado mediante `MediaPoster`, `MediaBanner`, `DetailPoster`, `PosterPlaceholder` y presentación de título vigente. Mantener claves propias por bloque e ID del título. Resolver sensibilidad antes de montar arte y aplicarla al backdrop. Agrupar procedencia solo cuando sea inequívoca. Conservar atribución, disponibilidad, reparto, fecha y metadata mixta aplicables. En producción, el estado se obtiene de la identidad local efectiva y cada editor tiene un solo controlador para ambos puntos de entrada. Mantener borrador al alternar secciones según contrato vigente y reportar fallos sin publicar cambios no confirmados.

```text
Guardada · [Backdrop opcional] [Portada] Título · tipo · año
[Estado ▾] [Puntuar] [Colecciones] [⋯]
[Resumen] [Mi registro] [Información]
Resumen       · posición manual | unidades marcadas → seguimiento · sinopsis
Mi registro   · puntuación | notas | etiquetas | colecciones → editor compartido
Información   · ficha editorial | fuentes y atribución
Remota        · arte permitido | título | Guardar o Abrir en Biblioteca | editorial
Restringida   · explicación contextual | reintento si corresponde | Atrás
```

Película y one-shot muestran sinopsis después de las acciones. Serie y anime serializado muestran el resumen de episodios. OVA, ONA, especiales y formatos desconocidos siguen sus activaciones vigentes. Manga, manhwa, manhua y cómic elegibles muestran capítulos decimales y volumen si existe. Literatura serializada admite unidades manuales sin cursor. Literatura no serializada muestra identidad y organización. Un título elegible sin inventario presenta una sola acción útil. Un progreso histórico incompatible se conserva como lectura explicada. Sin arte, el fallback deja el título legible y sin espacio de backdrop desperdiciado.

Cambios respecto de V2: cursor con esquemas y validación reales, membresías mediante selector existente, menús condicionados por capacidades, sin renderizar procedencia ficticia ni mostrar un registro vacío para una ficha remota.

### S4 · Seguimiento

En `GranularPreview`, `GranularScreen`, `GranularCoveragePanel` y la ruta units, mantener consultas paginadas, UUID, revisión, validación y contratos de storage. Conservar lista virtualizada y cuadrícula virtualizada cuando sea compatible. Priorizar cuadrícula para episodios numerados y lista para capítulos, especiales y fuente ampliada que impida una celda accesible. Respetar la preferencia explícita compatible durante el recorrido sin introducir almacenamiento portable. No materializar huecos. La lista revela sinopsis e imagen a pedido.

```text
[‹] Título · Episodios/Capítulos                           [⋯]
[Temporada / volumen / grupo ▾]  [Filtrar]  [Vista]
4 de 12 estrenados · T2    |    4 marcas · guía parcial
[Seleccionar]                  [E1 ✓] [E5] … o filas editoriales
Modo selección · 3 elegidos    [Cancelar] [Marcar / Desmarcar]
```

Pulsar una unidad elegible en modo normal usa la mutación individual existente con feedback tras commit, conservando fechas existentes cuando aplique y sin asignar Hoy. Acciones de fecha, detalle, edición, retiro y reactivación quedan bajo demanda en un menú accesible sin depender de pulsación larga. Futuros conservan confirmación identificable. El modo Seleccionar mantiene IDs exactos y revisión, con preset de estrenados ordinarios conocidos, exclusiones explícitas, fecha opcional y confirmación antes de aplicar. Revalidar propietario, elegibilidad, revisión y alcance en transacción. Mantener lotes de 500 IDs por confirmación y particiones independientes. Conservar rango de hasta 200, vista previa, coincidencias y recuperación.

Actualizar índice/temporada es explícito desde el contexto pertinente. Mostrar cobertura solo por denominador acreditado o lista manual rotulada. Parcial, obsoleta, contradicción o vacío muestran conteos sin porcentaje editorial. Distinguir futuras, especiales, retiradas y marcas externas. Conservar vencimiento a siete días, reevaluación incluso si vence durante la jornada y al volver a primer plano con la separación Web/AppState del hotfix. La acreditación real TMDB queda pendiente.

### S5 · Evidencia y trazabilidad

Cada checkpoint entrega recorrido, comparación con V2 y brief, capturas TEST identificadas o físicas, desviaciones justificadas, revisión externa y aprobación de sección. Comparar 320 y 390, claro/oscuro, teclado abierto/cerrado donde aplique y vistas representativas en escritorio. Probar Android físico con fuente real ampliada, TalkBack, gestos y tres botones. Verificar arranque offline con bundle instalado y datos TEST. Registrar evidencia Web por separado.

## Risks / Trade-offs

- Contraste heredado o bootstrap discontinuo → verificar 14 combinaciones, estados y preview con resolución real, incluyendo restauración.
- Retomar altera navegación o insinúa consumo → origen y criterios independientes, relojes de progreso confirmados, recencia de edición como respaldo y agregados por propietario.
- Operación de unidad duplicada o revisión obsoleta → mantener idempotencia, rechazar escrituras obsoletas diferentes y conservar borrador revisable.
- Altura variable con fuente ampliada → evitar metas fijas de columnas, probar lista y encabezado desplazable y restaurar foco.
- La demo simplifica datos y acciones → cubrir vacíos, error, gates, parciales, duplicados, fechas, vínculos y restaurados con fixtures aislados.

## Migration Plan

Entregar en orden S1–S5 y revertir por superficie si falla un checkpoint. Conservar SQLite v10 y Backup v11 con migraciones previas intactas. La reversión de tema vuelve a resolver los IDs con el catálogo anterior. No requiere migrar SQLite ni reescribir backups. La reversión de navegación se apoya en las rutas conservadas. Ninguna prueba usa biblioteca personal.
