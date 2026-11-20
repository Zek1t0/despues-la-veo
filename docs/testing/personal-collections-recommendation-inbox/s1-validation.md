# S1 — Colecciones personales y persistencia

Fecha: 2026-11-20. Change: `add-personal-collections-and-recommendation-inbox`.

## Estado y preflight

Rama `feat/personal-collections-recommendation-inbox`; HEAD y main locales `fbfed7bdf45ad065c7ff3de4ae12c3ccea02db89`. El índice estaba vacío y había únicamente siete archivos nuevos del PROPOSE, en estado intent-to-add, sin contenido staged. No se modificaron cambios ajenos. Se conservaron esos archivos y el mismo change; no hubo staging, commit, push, merge ni archive. La referencia main comprobada es local, sin fetch.

Fase A completada: proposal, design, tasks, delta de backup y spec de Inbox actualizados; spec personal-collections y .openspec.yaml originales conservados. Recuperación v9 funcional desde S1 y extensión bidireccional Inbox desde S2; S3 profundiza cobertura. Referencias externas compartidas entre recomendaciones son válidas; idempotencia por ID de recomendación/intención y unicidad del título según identidad universal. Ningún UNIQUE global de referencia en Inbox.

Tareas técnicas 1.1–1.4 completadas. Tarea 1.5 (aceptación manual completa Android/Web) abierta. S2 y S3 no iniciadas. Esto no declara completado el checkpoint manual ni autoriza avanzar a S2: falta revisión humana del diff real y checkpoint Git manual.

## Resultado de implementación

- SQLite v7→v8 aditivo, tres tablas nuevas: personal_collections, collection_memberships y recommendation_inbox. Verificación de FKs activas, esquema, índices y triggers. Reapertura verifica sin recrear; versiones futuras se rechazan sin reset. La evolución y publicación de versión están en una transacción con hooks de fallo.
- Colecciones: ID estable, nombre requerido, descripción opcional, vacías o con títulos, nombres repetidos sin fusión. CRUD y add/remove idempotentes, serializados, con helpers WithDb y una sola transacción pública; invalidación después del commit. No se escriben campos ni timestamps del título por organizarlo.
- Membresías con PK compuesta colección/título, addedAt y updatedAt propios. Cascades al borrar colección o título; borrar colección conserva todos los títulos. El trigger de borrado de título devuelve todas las recomendaciones vinculadas a Pendiente/null, preservando cada contexto; trigger separado protege original_capture_json. Inbox permanece sin interfaz ni flujos.
- Acceso Biblioteca → Organizar, sin sexta pestaña. Colecciones: creación, edición, confirmación de baja, listado, selección de títulos locales, retiro, incorporación descendente y A–Z. Ficha local → Añadir a colecciones. Bandeja es un texto de no disponibilidad hasta S2, sin acción simulada.
- Portadas derivadas de miembros visibles, política de arte/proyección vigente, fallback de imagen fallida y placeholder. Sin URL duplicada persistida, nuevas búsquedas o alteraciones de proveedores. Pantallas con tokens existentes, controles de al menos 44, textos ampliables y scroll; la aceptación visual real aún está pendiente.
- Backups v9 export/import de títulos, datos portables previos, colecciones y membresías. Export usa snapshot serializado sin filtro de visibilidad, sin credenciales/binarios ni browsing. Parser histórico v1–v8 preservado. Import primero resuelve títulos por identidades portables, después reconstruye relaciones con el mapa del mismo archivo; nunca usa al ocupante casual de ID. Merge por ID/pareja resuelta, updatedAt mayor e igualdad local. Ausencia no borra. Savepoints aíslan errores y fallo global revierte todo.
- S1 acepta recomendaciones ausentes o array vacío; rechaza globalmente un v9 con recomendaciones no vacías antes de writes, con mensaje de conservar archivo para S2, sin descartar datos silenciosamente. S2 deberá ampliar export e import conjuntamente.

## Pruebas ejecutadas

Todas las siguientes finalizaron con código 0:

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | Sin errores TypeScript, repetido después de los cambios finales de aplicación |
| `openspec validate --all --strict` | 26 elementos válidos: change y las 25 specs principales; 0 fallos |
| `git diff --check` | Sin errores; avisos de conversión LF/CRLF en archivos iniciales de OpenSpec |
| Comprobación directa de whitespace de todos los archivos acumulados, incluidos untracked | Sin espacios finales |
| `node docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs` | SQLite real en archivos temporales TEST: migración mixta v7→v8, conservación exacta de tablas v7, tres puntos de rollback de migración, versión futura, reapertura; CRUD, idempotencia, membresías múltiples, FKs/cascades, originales Inbox inmutables y dos recomendaciones con referencia compartida; round trip v9 vacío/conflictivo, remap, relojes, igualdad, ausencia, repetición, fallo por registro/commit e invalidación poscommit; import focal v1–v8, backup sensible completo |
| `node docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs` | Harness de componentes sin DB personal: navegación Organizar, Inbox sin acción, formulario/conservación de borrador, membresías desde ambas rutas, confirmación/cancelación, orden, texto largo, exclusión de sensibles y placeholder |
| `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | Identidades, remap, pins, import histórico, legacy exacto y conflictos preservados |
| `node docs/testing/enriched-media-metadata/section-2-backups.cjs` | Round trip v8/v7, relojes por fuente, empate, remap, savepoints, preferencias y rollback |
| `node docs/testing/enriched-media-metadata/section-3-backups.cjs` | Metadata/score original, datos personales, política de imagen y rechazo parcial preservados |
| `node docs/testing/enriched-media-metadata/section-4-ui.cjs` | Harness de Biblioteca/ficha/selector sin regresiones de filtros, navegación y respuestas obsoletas |
| `node docs/testing/library-picker.cjs` | Elegibilidad, fechas, duraciones, visibilidad, muestra y sorpresa sin mutaciones |
| `npx expo export --platform web --output-dir .expo/collections-s1-web` | Build Web final correcto, módulos y assets exportados; no se añadieron ni actualizaron dependencias |

SQLite Node informa que su módulo es experimental. Expo informa Browserslist antiguo y NO_COLOR/FORCE_COLOR; no se actualizaron paquetes por esos avisos.

El round trip probado usa el serializer/parser/merge reales sobre SQLite real, no mocks de storage. La aceptación visual no se infiere del build o del harness. Ninguna prueba abrió la biblioteca personal: archivos SQLite temporales, fixtures TEST y harness que bloquea expo-sqlite/DB personal.

## Revisión del diff real

Revisados cambios acumulados y archivos nuevos, no solo los archivos conocidos por git diff. Se corrigió la clasificación del resultado de importación para contar colecciones/membresías aun sin títulos nuevos y mostrar sus errores. Se preservó la exportación desde DBs históricas inyectadas por los tests. Se separaron controles UI del hook de SQLite y se excluyeron entradas Organizar/Añadir a colecciones de bindings sintéticos para evitar navegación desde revisión a datos personales. No se modificaron dependencias, gates, proveedores, layout de pestañas, TitleGridCard ni library-picker.

## Limitaciones y riesgos pendientes

- Web real: el origen TEST local exclusivo no pudo abrirse desde el navegador integrado (`ERR_CONNECTION_TIMED_OUT`). Computer Use de Windows se detuvo porque no pudo determinar la URL activa con confianza suficiente para aplicar su política. No se realizaron más acciones de navegador ni se inventó evidencia visual. El servidor local de prueba fue detenido.
- Android: ADB no se encontró en la ruta estándar local comprobada; no se verificó un dispositivo físico ni se ejecutó aceptación nativa. No se realizó build Android.
- Siguen pendientes pruebas visuales y de interacción de 1.5: 320 px, fuente 200%, lector de pantalla, foco/teclado Web, safe areas/teclado Android y todas las paletas/schemes. El harness cubre propiedades e interacciones de componentes, no esas garantías de plataforma.
- Sin tombstones, importar un backup antiguo puede recuperar colecciones o membresías eliminadas. El aviso de merge lo explica. Relojes de dispositivos desajustados siguen sujetos al contrato updatedAt estricto.
- No usar un binario anterior para forzar downgrade v8. Si falla una mutación/migración hay rollback; para reversión posterior conservar DB v8 y export v9 y usar un build compatible.
- La tabla de Inbox está preparada y verificada con fixtures de esquema; no hay captura, resolución, estados editables, búsqueda ni incorporación funcional de Inbox en esta entrega.

## Recorrido manual pendiente (Android y Web)

Usar un perfil/origen o instalación TEST separada, nunca la biblioteca personal.

1. Crear al menos dos títulos manuales TEST con notas, rating y tags; registrar los valores iniciales. Biblioteca → Organizar → Colecciones: crear una colección vacía y dos pobladas, incluyendo nombre/descripcion largos.
2. Agregar un mismo título a ambas colecciones desde una colección y desde ficha local → Añadir a colecciones. Repetir un agregado, retirar un miembro y comprobar que no se duplica ni se elimina el título.
3. Renombrar/editar descripción, alternar incorporación/A–Z y comprobar placeholder sin arte, filtro sensible con fixture apropiada, estados vacíos y regreso. Confirmar que siguen las cinco pestañas y las vistas/picker existentes.
4. Cancelar y después confirmar eliminar una colección. Verificar que Biblioteca y la otra colección conservan el título/personales. Cerrar/reabrir offline y verificar persistencia.
5. Ajustes → Exportar JSON v9. Importarlo en otra DB TEST vacía, verificar colecciones/membresías/personales y reimportar sin duplicados. Probar destino con ID ocupado y confirmar relación con el título resuelto por identidad portable, no con el ocupante.
6. Cambiar datos locales e importar backup viejo/igual, y luego uno sin una colección/membresía: debe conservar locales. Probar JSON inválido y verificar error recuperable sin writes. Eliminar título TEST y verificar sus membresías retiradas y colecciones aún existentes.
7. Repetir a 320 px y fuentes 200%, con teclado/lector de pantalla y temas/paletas: ningún control debe quedar inaccesible. Registrar dispositivo/navegador, pasos, resultado y evidencia antes de cerrar 1.5.
8. Revisar todo el diff listado debajo y realizar el checkpoint Git manual por parte del usuario antes de autorizar S2. Esta sesión no hace staging/commit.

## Corrección visual posterior de S1 — referencia de cuatro vistas

La interfaz inicial no estaba aprobada. Esta corrección sigue la imagen proporcionada como referencia de composición, con cuatro pantallas independientes y los colores/tipografía/tokens vigentes. No copia obras, portadas, nombres, cantidades ni descripciones de la imagen; no genera assets ni datos de muestra en la aplicación.

### Alcance y preservación comprobada

Preflight de esta corrección: rama `feat/personal-collections-recommendation-inbox`, HEAD y main local `fbfed7bdf45ad065c7ff3de4ae12c3ccea02db89`, índice vacío, 33 archivos acumulados de S1 (25 nuevos y 8 modificados). Ningún archivo se eliminó ni recreó. Se tomó un baseline SHA-256 de esos 33 archivos en .expo/ (ignorado). La comparación confirma intactos todos los archivos de storage/core, los siete artefactos OpenSpec, Ajustes, el código de la ficha y el hook de organización. También siguen intactos gates, proveedores, dependencias, layout de pestañas y selector local. No hubo staging, commit, push, merge ni archive.

### Archivos modificados en esta corrección

| Archivo | Cambio |
| --- | --- |
| `app/(tabs)/libreria.tsx` | Organizar pasa del botón de fila completa al headerRight de navegación: carpeta + texto en escritorio e icono accesible en móvil; controles previos conservan su ubicación y orden relativos |
| `app/organize/index.tsx` | Tarjeta Colecciones completa presionable con icono, texto y chevron; tarjeta de Bandeja informativa con icono y Próximamente, sin navegación |
| `app/organize/collections/index.tsx` | Nueva colección en encabezado; tarjetas horizontales completas, portada izquierda 2:3, descripción de dos líneas, contador visible y chevron; dos columnas amplias/una en móvil o tipografía grande |
| `app/organize/collections/[id].tsx` | Cabecera agrupada, acciones primaria/secundaria/tres puntos, confirmación de baja, controles de orden compactos, miembros con miniatura/medio/estado y Quitar separado de abrir; selector con búsqueda, miniaturas y Ya pertenece |
| `app/organize/collections/title.tsx` | Membresías múltiples como filas de selección con checkbox, nombre/descripción y estado; conserva exactamente las operaciones existentes |
| `src/components/organization/OrganizationUI.tsx` | Extiende componentes existentes: botones compactos con variantes/iconos y foco, headerRight, jerarquía tipográfica, superficies y campos legibles |
| `src/components/organization/CollectionForm.tsx` | Acciones agrupadas con wrap, Guardar/Crear primaria y Cancelar secundaria; sin alterar validaciones, intención estable, escrituras o cancelación |
| `src/components/organization/CollectionCover.tsx` | Ancho configurable y proporción 2:3 constante, manteniendo filtros de arte, fallback y selección existentes |
| `docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs` | Amplía pruebas de composición, interacción, aislamiento de eventos, responsive, foco, temas/paletas y estados |
| `docs/testing/personal-collections-recommendation-inbox/s1-validation.md` | Registra esta corrección, evidencia y límites; conserva el inventario completo acumulado |

Son 10 archivos de los 33 existentes; no se agregó ningún archivo de aplicación o test fuera de ese inventario. SQLite v8, JSON v9, relaciones, índices, triggers, merge, repositorios y reglas de identidad/restauración están idénticos al preflight. El cambio de etiquetas/clasificación en filas usa los helpers vigentes; no modifica el dominio ni datos personales. Inbox sigue sin interfaz o flujos funcionales.

### Diferencias deliberadas respecto de la imagen

- El tema y la paleta reales determinan los colores, incluida la acción primaria; no se impone el blanco/negro de la referencia.
- Se conserva la navegación nativa de Expo Router. En pantallas estrechas o fuentes grandes Nueva colección puede mostrarse como + con nombre accesible completo; Organizar usa carpeta en móvil. La etiqueta Biblioteca puede elidirse en el encabezado nativo más estrecho para conservar las cinco zonas táctiles y su nombre accesible completo.
- La grilla baja a una columna según ancho y escala de texto. La cabecera del detalle y las acciones de fila se apilan solo cuando necesitan espacio. Nombres largos crecen; la descripción del listado se limita a dos líneas y la completa sigue en el detalle.
- Más acciones despliega la opción contextual en el flujo existente; la confirmación sigue dentro de una tarjeta. No se añadieron modales ni una nueva infraestructura de menús.
- Las portadas son exclusivamente las permitidas de los datos locales visibles o el placeholder existente. No se agregan imágenes ni nombres ficticios de la referencia.

### Validación de esta corrección

- `npx tsc --noEmit`: PASS.
- `openspec validate --all --strict`: PASS, 26/26 (change y 25 specs principales), sin modificar specs para acomodar el diseño.
- `git diff --check` y comprobación directa de whitespace de todos los nuevos/untracked: PASS.
- `node docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs`: PASS. Comprueba tarjeta completa sin botón Abrir redundante; cabecera Nueva colección; grilla una/dos columnas; descripción a dos líneas; acción primaria y menú contextual; confirmación/cancelación; selector y Ya pertenece; Quitar separado de navegación; selección múltiple; borrador retenido en error y botones deshabilitados durante guardado; falta de portada 2:3; contenido sensible excluido; propiedades responsive a 320/1280 px y fontScale 1/2 en todas las paletas claras/oscuras; estado de carga/error/reintento. Harness sin DB personal, no aceptación visual real.
- `node docs/testing/enriched-media-metadata/section-4-ui.cjs`: PASS, integración Biblioteca/ficha/selector, filtros y respuestas obsoletas.
- `node docs/testing/library-picker.cjs`: PASS, motor local sin mutaciones.
- `npx expo export --platform web --output-dir .expo/collections-s1-visual-web`: PASS. Artefactos de build ignorados, sin actualizar paquetes.
- No se repitió la batería de backups/migraciones: los módulos y sus contratos están protegidos por comparación byte a byte y no hubo indicios de regresión en esas capas.

### Aceptación manual y tarea 1.5

Se intentó revisión en el navegador de Windows usando una pestaña/origen TEST local separados. La selección del navegador pudo leerse, pero Computer Use detuvo la siguiente interacción porque no pudo determinar con confianza suficiente la URL activa para aplicar su política. No se continuó la automatización; no se abrió la biblioteca personal ni se declaró revisión visual del resultado. El servidor TEST se detuvo. Android físico tampoco fue probado en esta corrección.

**1.5 sigue abierta y el progreso OpenSpec sigue 4/15.** Falta aprobación visual del usuario y aceptación real Android/Web, especialmente foco/teclado, lector de pantalla, 320 px/fuentes ampliadas y menú contextual. Las propiedades probadas por el harness no garantizan por sí solas el layout renderizado por cada plataforma. Revisar las cuatro pantallas y los formularios siguiendo el recorrido manual anterior antes de cerrar el checkpoint. Esta corrección termina en S1 y no autoriza S2.

## Ajustes finales de usabilidad de S1

La revisión del usuario fue favorable a la última composición. Esta ejecución se limita a los tres ajustes pedidos, sin otro rediseño. Rama `feat/personal-collections-recommendation-inbox`, HEAD `fbfed7b`, índice vacío al inicio y al cierre. Los 33 archivos previos permanecen presentes. OpenSpec, incluida la casilla 1.5, se conserva byte a byte: progreso 4/15 y checkpoint manual pendiente de aceptación del usuario.

### Cambios y archivos

- `app/organize/collections/index.tsx`: retira Nueva colección de headerRight y la coloca en el contenido centrado, inmediatamente antes de la grilla. Siempre muestra + y texto, sin iconOnly ni ancho completo, usando el mismo botón y formulario vigentes. No cambia las tarjetas.
- `app/organize/collections/[id].tsx`: traslada el control contextual al extremo derecho de los datos de cabecera, separado de Agregar títulos/Editar. Conserva ordenamiento, selector, filas y confirmación de eliminación. Al solicitar eliminación, enfoca Cancelar en la confirmación; cancelar devuelve foco al control contextual.
- `src/components/organization/CollectionOptionsMenu.tsx` (nuevo): menú específico anclado al botón, con Modal transparente y backdrop como el patrón de ViewOptionsPanel. No desplaza contenido. Superficie neutra y acción destructiva indicada mediante texto/icono. Cierre por Cancelar, Escape, clic fuera, petición nativa de cierre/Back y gesto accesible cuando corresponda. Foco inicial, recorrido con Tab/Shift+Tab, flechas/Home/End y retorno al disparador. Reubica el popover dentro de la ventana y por encima del botón si no cabe debajo. No escribe datos: onDelete únicamente solicita la confirmación del padre.
- `src/components/organization/OrganizationUI.tsx`: añade solo la prop opcional buttonRef al botón existente para manejar el foco de la confirmación; no cambia estilos ni comportamiento visual de los otros controles.
- `docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs`: adapta los tests al activador dentro del contenido y añade pruebas del popover, teclado, foco, límites de ventana, cancelación y confirmación. Mantiene las regresiones de la composición aprobada.
- `docs/testing/personal-collections-recommendation-inbox/s1-validation.md`: registra resultados y actualiza el inventario acumulado.

Se reutilizan las primitivas Modal/Pressable/ScrollView y los tokens existentes, sin dependencias nuevas. El panel ViewOptionsPanel completo no se usa porque su layout centrado/inferior y secciones de opciones no resuelven un popover anclado; se conserva su patrón de overlay y cierre en un componente exclusivo de la colección. No se modifican Biblioteca/Organizar, portadas, filtros sensibles, formularios, selector ni las operaciones de repositorio. SQLite v8, backup v9, migraciones, identidad, triggers, restauración, proveedores, gates e Inbox permanecen idénticos al baseline de esta ejecución.

### Resultados

- TypeScript: PASS (`npx tsc --noEmit`).
- OpenSpec estricto global: PASS, 26/26 (`openspec validate --all --strict`).
- Diff/whitespace: PASS (`git diff --check` más comprobación directa de archivos nuevos/untracked).
- Harness S1: PASS (`node docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs`): texto de Nueva colección visible en escritorio/320–400 px, activador sin duplicación de encabezado, ubicación separada de los puntos, Modal fuera del flujo, límites laterales y superior/inferior, foco inicial/retorno, cancelación/clic fuera/Escape/Back, Tab y flechas, Home/End, disparador deshabilitado, ninguna eliminación antes de confirmar, foco en Cancelar al confirmar y llamada de eliminación solo tras aceptación. Incluye tipografía 100/200%, temas claros/oscuros y regresiones anteriores de tarjetas, sensibles, borrador y filas.
- Regresión Biblioteca/ficha/selector: PASS (`node docs/testing/enriched-media-metadata/section-4-ui.cjs`).
- Build Web: PASS (`npx expo export --platform web --output-dir .expo/collections-s1-usability-web`). Avisos previos de Browserslist y NO_COLOR no llevaron a cambios de dependencias.
- Preservación mediante SHA-256 de todos los archivos acumulados: solo se alteraron los cinco archivos previos enumerados arriba y se añadió el componente de menú. El resto permanece idéntico, incluidos los artefactos OpenSpec y datos.

Las comprobaciones de escritorio, 320/360/400 px, ampliación y tema se realizaron en el harness de componentes; no se presenta eso como aceptación visual real de navegador o de Android físico. En esta ejecución no se realizó una sesión nueva de aceptación manual. 1.5 sigue abierta y no se avanzó a S2. No hubo staging, commit, push, merge ni archive.

## Inventario completo del diff acumulado

34 archivos: 26 nuevos (incluidos los 7 del PROPOSE inicial y el nuevo menú), 8 modificados. El índice permanece vacío; los estados son del worktree.

| Estado | Archivo |
| --- | --- |
| Modificado | `app/(tabs)/ajustes.tsx` |
| Modificado | `app/(tabs)/libreria.tsx` |
| Modificado | `app/title/[id].tsx` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/.openspec.yaml` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/design.md` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/proposal.md` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/specs/library-backup-integrity/spec.md` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/specs/personal-collections/spec.md` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/specs/recommendation-inbox/spec.md` |
| Nuevo PROPOSE inicial | `openspec/changes/add-personal-collections-and-recommendation-inbox/tasks.md` |
| Modificado | `src/core/libraryBackup.ts` |
| Modificado | `src/storage/databaseSchema.ts` |
| Modificado | `src/storage/libraryBackupExport.ts` |
| Modificado | `src/storage/libraryBackupMerge.ts` |
| Modificado | `src/storage/savedTitlesRepo.ts` |
| Nuevo | `app/organize/collections/[id].tsx` |
| Nuevo | `app/organize/collections/index.tsx` |
| Nuevo | `app/organize/collections/title.tsx` |
| Nuevo | `app/organize/index.tsx` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s1-validation.md` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs` |
| Nuevo | `src/components/organization/CollectionCover.tsx` |
| Nuevo | `src/components/organization/CollectionForm.tsx` |
| Nuevo | `src/components/organization/CollectionOptionsMenu.tsx` |
| Nuevo | `src/components/organization/OrganizationUI.tsx` |
| Nuevo | `src/components/organization/useOrganization.ts` |
| Nuevo | `src/core/libraryBackupV9.ts` |
| Nuevo | `src/core/personalCollection.ts` |
| Nuevo | `src/storage/collectionsRepo.ts` |
| Nuevo | `src/storage/organizationBackupImport.ts` |
| Nuevo | `src/storage/organizationInvalidation.ts` |
| Nuevo | `src/storage/organizationSchema.ts` |
| Nuevo | `src/storage/organizationSnapshot.ts` |

Los artefactos generados de build y el servidor temporal quedaron bajo .expo/ (ignorado), fuera del diff. No se incluyen datos personales ni credenciales en este informe.
