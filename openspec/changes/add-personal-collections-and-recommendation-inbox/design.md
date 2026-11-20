## Context

Ver motivación y alcance en proposal.md. Preflight del 2026-11-20: rama `feat/personal-collections-recommendation-inbox`, árbol inicialmente limpio, HEAD = main = referencia local origin/main = `fbfed7bdf45ad065c7ff3de4ae12c3ccea02db89`. El último change está en `openspec/changes/archive/2026-11-20-refine-media-experience-and-add-library-picker`; no había changes activos. La igualdad de referencias locales no prueba novedades remotas posteriores; no se hizo fetch ni se requiere para crear estos artefactos.

Base real: SQLite v7 (`databaseSchema.ts`), JSON v8 (`libraryBackup.ts`), IDs locales opacos y referencias completas, identidad manual portable, cola `storageMutationQueue`, helpers WithDb, savepoints de importación, proyección de metadata y gates por proveedor. La configuración OpenSpec conserva texto introductorio histórico de TMDB: los contratos principales actuales son la autoridad para el dominio ampliado.

El pedido contiene las decisiones aprobadas del Explore. No se encontró un artefacto Explore específico de estas funcionalidades en el repositorio; no se atribuyen decisiones adicionales a una fuente no disponible. Las precisiones técnicas siguientes son decisiones de esta propuesta para revisión antes de S1.

## Goals / Non-Goals

**Goals:** una sola base, identidad relacional sin copias, mutaciones compuestas atómicas, exportación desde el primer dato nuevo y restauración aditiva con relojes independientes. Tres entregas amplias y verificables, implementadas secuencialmente.

**Non-Goals:** nueva capa de proveedores, migraciones destructivas, semántica de sincronización/borrados, pins de colección o snapshots editoriales en Inbox. No modificar la semántica histórica de refresh, personales, Appearance, actividad o importación parcial.

## Decisions

### 1. Modelo y migración SQLite v7→v8 en S1

Crear en S1 todas las tablas de v8, incluidas las de Inbox aún vacías; S2 habilita comportamiento sin otra versión de esquema. Evita que dos instalaciones anuncien v8 con estructuras distintas. No tocar ni reconstruir `saved_titles` ni tablas v7. Añadir `organizationSchema.ts` invocado desde `databaseSchema.ts` para crear/verificar las estructuras siguientes dentro de la evolución transaccional vigente:

| Tabla | Campos y restricciones propuestas |
| --- | --- |
| `personal_collections` | `id TEXT PRIMARY KEY NOT NULL`, `name TEXT NOT NULL` no vacío tras trim, `description TEXT NULL`, `created_at`, `updated_at` enteros seguros no negativos |
| `collection_memberships` | `collection_id`, `saved_title_id`, `added_at`, `updated_at`; PK compuesta por ambos IDs, FKs a colección y título con ON DELETE CASCADE |
| `recommendation_inbox` | `id TEXT PRIMARY KEY NOT NULL`, `original_capture_json TEXT NOT NULL` inmutable validado, `capture_kind` name/url/reference, campos editables `name`, `url`, referencia nullable completa `provider/resource_namespace/external_id`, `person`, `origin`, `comment`, `status`, `linked_saved_title_id`, `created_at`, `updated_at` |

Campos opcionales vacíos se normalizan a null; texto visible no se interpreta como HTML. Enlaces se validan sin visitar destino; una URL desconocida solo es contexto. Referencias de adaptadores conocidos usan sus canonicalizadores sin fetch; las desconocidas conservan strings opacos canónicos bajo identidad universal y no adquieren transporte. `original_capture_json` es un documento acotado a kind/valor inicial/persona/origen/comentario originales, no un snapshot del proveedor. No cambia al editar campos actuales. El registro tiene como máximo una referencia fuerte elegida; otras pistas quedan como texto original, no se adjuntan al título automáticamente.

CHECKs para status `pending|incorporated|discarded`, referencia toda presente o toda null y vínculo presente si y solo si incorporated. FK de vínculo a `saved_titles(id)` con ON DELETE RESTRICT. Índice no único por referencia completa: distintas recomendaciones pueden compartir obra y apuntar al mismo título. La idempotencia es por ID estable/intención, nunca por referencia compartida. Índices por miembros del título, colección/addedAt, estado/createdAt y vínculo. Validación de dominio y verificación SQL complementarias, sin confiar en JSON arbitrario. IDs de colecciones y recomendaciones son opacos estables globalmente generados con el mecanismo existente, con reintentos acotados ante colisión; no derivarlos de nombre ni regenerarlos al importar.

Un trigger BEFORE DELETE de `saved_titles` cambia todas sus recomendaciones vinculadas a pending y deja vínculo null antes del chequeo FK. Avanza su updatedAt a un entero seguro estrictamente posterior al anterior y no inferior al reloj actual; si no puede, falla íntegramente el borrado. Así incluso las rutas de borrado compartidas cumplen el invariante estado/vínculo; SET NULL solo no bastaría porque dejaría Incorporated sin destino. Verificar trigger, CHECKs, índices y FKs al abrir v8. No añadir triggers que modifiquen relojes personales del título. ON DELETE CASCADE limpia membresías sin eliminar colecciones vacías.

Alternativas descartadas: copiar títulos por colección, reutilizar tags como colecciones, crear tablas Inbox en S2 bajo el mismo user_version o dejar estado incoherente hasta la siguiente apertura. Separar membership.updatedAt de collection.updatedAt permite merge aditivo de miembros sin perder ediciones del nombre.

### 2. Límites de repositorios y operaciones recuperables

`collectionsRepo.ts` cubre CRUD/listado y add/remove membership. `recommendationInboxRepo.ts` cubre captura/edición/transiciones y lecturas; `recommendationIncorporation.ts` compone resolución y guardado. Cada mutación pública entra una vez a `runSerializedStorageMutation`, inicializa una vez y usa una transacción; helpers WithDb no reentran a cola ni inicialización. Reutilizar la invalidación de Biblioteca después del commit y añadir invalidación de organización si la actual no cubre esas lecturas.

Crear un ID de intención estable antes de enviar el formulario y reutilizarlo al reintentar. Crear con el mismo ID y payload ya confirmado devuelve el registro; contenido distinto requiere editar, no sobrescribir. Agregar membresía usa insert-if-absent y conserva addedAt si ya existe; retirar y eliminar ausentes son no-ops. No avanzar updatedAt por no-op. Releer al confirmar y publicar el último snapshot confirmado, con formulario conservado al fallar. Consultas fallidas nunca equivalen a vacío confirmado. Las operaciones de un título no alteran sus timestamps por organización.

### 3. Resolución y máquina de estados de Inbox

Pendiente es el estado inicial. Vincular/incorporar → Incorporada con destino; descartar desde cualquier estado → Descartada sin destino; reabrir desde Descartada o Incorporada → Pendiente sin destino. Editar conserva el estado y vínculo: cambiar pistas de resolución no cambia el título; para elegir otro destino se reabre y confirma una vinculación nueva. Las pistas editables no son autoridad para cambiar identidades del MediaItem. No se ofrece borrado definitivo de recomendaciones en este alcance; descarte conserva contexto.

Primero consultar referencia fuerte completa local. Para nombres, normalizar solo para obtener candidatos, nunca como clave de identidad; incluso un único candidato requiere selección/confirmación. Sin coincidencia, queda Pendiente salvo acción del usuario. La acción «Buscar en proveedores» abre selección de fuente/categoría existentes y consulta solo después de confirmación explícita. No fetch, unfurl o búsqueda al capturar/editar/montar; no navegar automáticamente a una URL. Un enlace de proveedor reconocido puede producir referencia canónica por parsing local aprobado, sin heurísticas de otro host; todo lo demás es referencia textual.

Para vincular: resolver y releer destino dentro de transacción y actualizar solo recomendación. Para crear: obtener previamente detalle remoto bajo gate vigente o completar entrada manual; al confirmar, comprobar otra vez referencia fuerte. Si existe, vincular sin llamar al upsert de refresh. Si no existe, materializar nuevo con los helpers del dominio, generar identidad manual portable cuando corresponda y enlazar en la misma transacción. Red fuera de la transacción; revalidar elegibilidad y selección al guardar. Si hay recomendaciones con la misma referencia, ofrecer revisarlas y permitir crear otra con ID distinto, preservando cada contexto sin fusionar ni borrar. Varias recomendaciones incorporadas pueden apuntar al mismo título; la identidad fuerte evita duplicar el título, no la recomendación.

El ID estable de recomendación/intención protege contra doble pulsación y reintentos después de perder la respuesta de commit. Incorporación repetida al mismo destino ya confirmado es no-op; a otro destino exige reapertura. Cancelación o respuesta remota obsoleta no escribe nada. Alternativa descartada: usar el guardado remoto genérico sobre existentes, porque podría refrescar metadata que el vínculo debe preservar exactamente.

### 4. UI y navegación sin rediseño

Rutas nuevas propuestas fuera de `(tabs)`: `app/organize/index.tsx`, `collections/index.tsx`, `collections/[id].tsx`, `recommendations/index.tsx`, `recommendations/[id].tsx` bajo `app/organize/`. Formularios crear/editar en componentes compartidos y panel/modal accesible de membresías desde `app/title/[id].tsx`; este es el único agregado a la ficha, dentro de organización personal. Una ficha remota sin guardar no admite membresías: primero debe existir el título local.

En `app/(tabs)/libreria.tsx` añadir acceso Organizar sin tocar lógica/card Detalle o Mosaico ni library-picker. `app/(tabs)/_layout.tsx` conserva sus cinco Tabs.Screen. S1 muestra Bandeja como próxima entrega, sin botón que pierda datos; S2 la habilita. La navegación desde colección abre `/title/[id]` por ID local; no inventa contexto de pin de colección y conserva fallback Biblioteca vigente.

Lista de colecciones por nombre/ID; colección abierta con incorporación descendente por defecto, A–Z opcional usando comparator existente y ID como desempate. Incorporación desempata por ID. La elección de orden vive en estado local de la pantalla, no cambia browsing global ni viaja en backup. Portada: recorrer miembros visibles por addedAt descendente/ID estable y elegir primera imagen permitida por proyección y validación actuales; si falla avanzar al siguiente candidato y terminar en placeholder. No persistir URL duplicada ni renderizar candidatos ocultos. Conteos de superficie reflejan visibles y avisan filtrado sin revelar nombre/arte oculto; las membresías completas siguen disponibles para exportación.

Reutilizar `useAppTheme`, tokens y `MediaPoster`/placeholder, proyección y selectores sensibles actuales, sin dependencias nuevas. Formularios con scroll, teclado sin cubrir acciones, safe areas Android, targets táctiles consistentes con controles actuales, labels explícitos, foco Web visible y restaurado al cerrar modal, lector de pantalla anunciando errores/estado sin duplicados. Acciones visibles sin hover ni controles táctiles anidados. Confirmación explícita al borrar colección. Probar 320 px y fontScale 2, texto largo, ausencia de imagen y todos los schemes/paletas. No añadir controles en tarjetas existentes.

### 5. Contrato JSON v9 y secuencia de restauración

`libraryBackupV9.ts` extiende el payload v8: conserva items/pins/metadata/preferencias/actividad y Appearance con sus reglas; añade `collections[]` con id/name/description/createdAt/updatedAt, `collectionMemberships[]` con collectionId/itemId/addedAt/updatedAt y `recommendations?[]` con IDs, captura original, campos editables, referencia completa nullable, status, linkedItemId nullable y fechas. Export S1 emite colecciones/membresías y omite recommendations; S2 siempre la incluye, incluso vacía. El vínculo usa itemId interno del mismo backup; no exporta filas SQL ni imágenes. El snapshot de exportación usa la cola/transacción actual y no el listado filtrado.

En S1 se entrega export/import v9 de colecciones y membresías con round trip real en DBs TEST, conservando import v1–v8. La sección recommendations puede faltar. En S2 se extienden export/import para Inbox y se remapean vínculos; archivos S1 continúan válidos. S1 rechaza explícitamente una sección recommendations no vacía por no soportarla aún, antes de cualquier escritura, sin descartar datos silenciosamente. S3 amplía regresiones históricas, matrices de conflictos, fallos y aceptación profunda.

Secuencia de restauración (colecciones en S1, recomendaciones en S2):

1. Validar envoltorio/versión antes de escribir. Mantener parsers históricos; no dar autoridad a campos v9 en v1–v8. Validar nuevos registros por tipos, timestamps seguros, referencias completas, estados/vínculos, JSON original y duplicados. Duplicados contradictorios de ID o pareja relacional invalidan las unidades afectadas, sin orden de arrays como ganador. Registros idénticos repetidos se procesan una sola vez.
2. Confirmación previa con cantidades advertencias y alcance parcial vigente, sin prometer dry-run. Iniciar la transacción pública serializada y restaurar títulos con savepoints/identidades/relojes existentes. Construir mapa solo de items del archivo resueltos correctamente, incluidos omitidos por contenido local más reciente; item fallido no entra al mapa.
3. Merge de colecciones por ID estable; nombre repetido nunca identifica colección. ID igual identifica el mismo registro y solo contenido estrictamente más reciente cambia name/description/updatedAt; conservar createdAt local al actualizar. Para nuevos, conservar ambas fechas. No regenerar IDs de organización por estar ya presentes.
4. Restaurar membresías solo si la colección entrante es válida/resuelta y el item tiene mapa correcto. Unicidad por pareja después del remap; elegir addedAt/updatedAt entrantes solo si updatedAt es mayor; igualdad conserva local. No deducir retiros de un array incompleto. No avanzar el reloj de colección por membresías. Ninguna relación busca por nombre ni por ocupante casual de ID local.
5. Merge de recomendaciones por ID estable con validación de captura original inmutable antes de comparar reloj. Captura original contradictoria para el mismo ID produce conflicto; distintos IDs con referencia compartida no son conflicto y conservan sus contextos. Aplicar solo contenido más reciente, conservar local si igual/viejo. Si el entrante elegible era Incorporated y el item no tiene mapa válido, degradar a Pendiente/null manteniendo todo el contexto; conservar su updatedAt entrante para reimportar sin cambios repetidos y reportar reparación. Reimportar el mismo archivo no autoriza revincular una recomendación local igual de reciente. El usuario puede resolverla explícitamente.
6. Relaciones/registros nuevos usan savepoints propios; fallos locales se informan y revierten esa unidad. Fallo de transacción o commit revierte todo. Publicar invalidación y preferencias solo tras commit, conservando la política parcial existente para items/pins/actividad. Resultado separado para colecciones, membresías y recomendaciones: insertados, actualizados, conservados, inválidos, conflictos, degradados y fallidos; sin contadores inflados por writes revertidos.

La frescura de colecciones/recomendaciones/membresías no sustituye los relojes de título, metadata o preferencias. Imports históricos mantienen sus excepciones de identidad: reimportar un local-only v5/v6 sin identidad puede reportar conflicto, nunca duplicarlo ni inventar equivalencia. Sin tombstones, una baja local puede reaparecer desde backup; advertir en confirmación del merge aditivo, no realizar borrados por ausencia.

### 6. Inventario de implementación previsto

Todos estos archivos se crearán/editarán al implementar, no durante la propuesta:

| Capa | Archivos |
| --- | --- |
| Dominio nuevo | `src/core/personalCollection.ts`, `recommendationInbox.ts`, `recommendationResolution.ts`, `libraryBackupV9.ts` |
| Persistencia nueva | `src/storage/organizationSchema.ts`, `collectionsRepo.ts`, `recommendationInboxRepo.ts`, `recommendationIncorporation.ts`, `organizationBackupImport.ts` |
| Persistencia existente | `src/storage/databaseSchema.ts`, `db.ts`, `savedTitlesRepo.ts`, `savedTitleStorage.ts`, `savedTitleIntegrity.ts`, `manualContentEntries.ts`, `libraryBackupExport.ts`, `libraryBackupMerge.ts`, `libraryInvalidation.ts` (solo extensiones necesarias para composición/invalidación; conservar API pública) |
| Backup/core existente | `src/core/libraryBackup.ts` (dispatch v9), `src/core/libraryBackupV8.ts` (reutilizar contratos puros sin alterar parser histórico) |
| Rutas existentes | `app/(tabs)/libreria.tsx`, `app/title/[id].tsx`, `app/(tabs)/ajustes.tsx`, `app/_layout.tsx` si requiere registro de rutas |
| Rutas nuevas | `app/organize/index.tsx`, `app/organize/collections/index.tsx`, `app/organize/collections/[id].tsx`, `app/organize/recommendations/index.tsx`, `app/organize/recommendations/[id].tsx` |
| Componentes nuevos | `src/components/organization/CollectionForm.tsx`, `CollectionMembershipPicker.tsx`, `CollectionCover.tsx`, `RecommendationForm.tsx`, `RecommendationResolutionPanel.tsx` |
| Reutilización sin rediseño | `src/theme/*`, `src/components/browsing/MediaPoster.tsx`, `PosterPlaceholder.tsx`, `src/core/mediaViewProjection.ts`, `sensitiveContent.ts`, adaptadores y búsqueda existentes |
| Verificación | `docs/testing/personal-collections-recommendation-inbox/` con scripts, fixtures TEST y evidencia manual por S1/S2/S3 |

Implementación S1: los controles comunes y el hook de lectura se separaron en `OrganizationUI.tsx` y `useOrganization.ts`; el picker de membresías usa la ruta `app/organize/collections/title.tsx` en lugar de un modal. Añadidos `organizationSnapshot.ts` y `organizationInvalidation.ts` para snapshots coherentes e invalidación poscommit. No fue necesario modificar db.ts, WithDb de títulos, providers, parsers históricos ni el layout de pestañas. Las nuevas entradas no se ofrecen cuando Biblioteca/ficha usan bindings de revisión sintética, impidiendo navegar desde ese harness a la DB personal. La portada usa los mismos selectores y política de imágenes vigentes, con fallback entre miembros visibles y placeholder.

Implementación S2: `recommendationSnapshot.ts` y `useRecommendationInbox.ts` leen un snapshot transaccional y se invalidan después del commit; el formulario conserva un ID de intención. La captura original serializa name/url/reference/person/origin/comment normalizados y queda protegida por el trigger v8 existente. El panel de coincidencias locales vive en el detalle de recomendación; no se añadió una abstracción de resolución ni dependencias. La ruta `recommendations/catalog.tsx` reutiliza Buscar con envío explícito por consulta/categoría, sin su debounce automático habitual al escribir. Las rutas TMDB/Kitsu/MangaUpdates y la entrada manual reciben `recommendationId`, incorporan con los helpers WithDb dentro de una sola transacción y regresan al registro. La referencia fuerte se relee antes del alta; un existente evita el helper de refresh. El formulario manual también permite confirmar explícitamente un candidato existente sin guardar otra copia.

El reconocimiento de URL es una allowlist local: themoviedb.org (con o sin www), rutas movie/tv con ID decimal canónico y slug opcional; kitsu.io/kitsu.app (con o sin www), ruta anime con ID decimal. Otros enlaces HTTP(S) se conservan sin visita. En particular, los IDs públicos legacy de MangaUpdates no se reinterpretan como IDs API series; la referencia completa puede capturarse explícitamente y las búsquedas mantienen los gates existentes. No se infiere identidad desde nombres o redirecciones. No hay borrado definitivo de recomendaciones.

El export S2 incluye siempre `recommendations`, incluso vacío, y el import admite su ausencia en v9 de S1. Primero restaura títulos; solo el mapa portable resultante puede resolver vínculos. Cada recomendación tiene savepoint, merge por ID/updatedAt y comparación previa de originalCapture; IDs diferentes con la misma referencia se conservan. Un vínculo irresoluble se recupera Pendiente con su contexto y reloj entrante, informando la reparación. SQLite sigue en v8 sin cambios de esquema; los parsers v1–v8 no fueron modificados. Evidencia técnica y límites de aceptación en `docs/testing/personal-collections-recommendation-inbox/s2-validation.md`; 1.5 conserva su estado y 2.5 requiere checkpoint manual.

No tocar gates, proveedores, dependencias, branding, `TitleGridCard`, disposición de Detalle ni `app/library-picker.tsx`. Extraer helpers WithDb mínimos donde sea necesario evita duplicar reglas; no refactorizar otras capas.

### 7. Matriz de coherencia de las 25 specs principales

Las dos capacidades nuevas amplían producto; la única spec existente con delta es library-backup-integrity y sus ADDED no sustituyen requisitos históricos.

| Spec principal | Contrato conservado / comprobación prevista |
| --- | --- |
| anime-catalog | Kitsu solo según gates actuales; resolución local no habilita release ni iOS |
| app-branding | Sin cambios de identidad instalable ni assets |
| contextual-title-pinning | Sin pins de colección, sin herencia de contextos ni controles nuevos en cards |
| customizable-browsing-views | Organizar es navegación adicional; Detalle/Mosaico, filtros y comparators vigentes se conservan |
| enriched-media-metadata | Una misma proyección, arte permitido, sin documentos editoriales Inbox ni URLs inventadas |
| expanded-media-domain | Clasificación válida solo al crear título; namespace no se vuelve formato |
| global-appearance-themes | Reutilizar scheme/palette y tokens sin nueva Appearance |
| library-backup-integrity | Delta v9 aditivo, savepoints y política parcial histórica preservados |
| library-metadata-refresh | Vincular existente no ejecuta refresh ni altera relojes o fuente |
| library-updates-feed | No convertir captura/vínculo en actualización remota o revisión; eventos conservan contrato |
| local-library-picker | Candidatos siguen siendo solo Biblioteca guardada; Inbox/colecciones no cambian selección |
| local-view-preferences | No exportar browsing ni modificar preferencias de otras pantallas |
| maintenance-review-workflow | Sin dependencias ni herramientas nuevas; evidencia TEST aislada y sin staging/commit en propuesta |
| manual-content-entries | Alta manual explícita con campos y validación vigentes, nunca desde nombre solamente |
| media-detail-experience | Acción de colección en organización personal, preservando jerarquía, avisos y acciones |
| media-presentation-preferences | No cambiar selección de fuente/idioma al vincular; proyección vigente en portada |
| personal-title-rating | Sin rating en Inbox y sin escrituras sobre el rating existente |
| pin-persistence | Pins siguen por título/contexto; cascade y backup históricos intactos |
| provider-abstraction | Reusar fronteras existentes, no nuevo registry, categorías ni proveedor |
| provider-neutral-media-review | Solo fixtures TEST y DB separada; no acceder a datos personales desde harness |
| rating-aware-library-sorting | No sustituir sorts ni comparators de Biblioteca por los de colección |
| second-provider-discovery | MangaUpdates conserva transporte/gates/arte por plataforma, sin buscar al pegar URL |
| sensitive-content-preference | Filtro aplicado a miembros y portada sin borrar datos; exportación completa |
| tmdb-user-credential | Credencial requerida solo para petición explícita TMDB; nunca en exportación |
| universal-media-identity | IDs locales existentes y referencias canónicas completas; sin equivalencia por título ni traslados |

## Risks / Trade-offs

- [Recuperación incompleta] → S1 y S2 incluyen export/import y round trip real de sus datos nuevos; S3 amplía matrices, no estrena recuperación.
- [Bajas reaparecen al importar] → merge aditivo documentado; sin tombstones no se promete replicar retiros ni descartes más allá del reloj del registro presente.
- [Nombre ambiguo o URL genérica] → selección manual; ningún fetch implícito ni deduplicación textual.
- [Trigger/cola con diferente runtime Android/Web] → comprobar SQL real, cascades, restricciones y rollback en ambas plataformas; test Node solo no acredita aceptación móvil.
- [ID estable repetido con captura incompatible] → conflicto y conservación local; no fusionar contexto original. Compartir referencia entre IDs distintos es válido.
- [Relojes de dispositivos desajustados] → contrato updatedAt estricto con igualdad local; no prometer causalidad distribuida ni resolver relojes automáticamente.
- [Texto largo/arte oculto/escala alta] → pruebas manuales de cada entrega, placeholders y layout con scroll; no considerar terminado un checkpoint con Android/Web no probados.

## Migration Plan

S1: copia de seguridad previa verificada de DB v7 en entorno de prueba; abrir v7 con referencias, manuales, metadata, pins, actividad y preferencias, crear tablas/índices/trigger v8 dentro de transacción, verificar FKs/constraints y comparación exacta de datos v7, publicar user_version=8 al final. Inyectar fallos antes/después de creación y publicación; rollback debe conservar v7 íntegro. Reabrir v8 verifica estructuras sin recrear datos; versiones futuras se rechazan sin reset. Mantener evoluciones históricas hasta v7 antes del paso aditivo v8. Activar colecciones y export/import v9 con round trip real.

S2: sin migración adicional, habilitar Inbox sobre tablas v8, ampliar export/import v9 y verificar composición atómica y eliminación de vínculos. S3: profundizar parser/merge v9 y aceptación completa con import v1–v8, conflictos, fallos e idempotencia en bases TEST separadas. Cada sección concluye con checkpoint manual independiente y evidencia real por plataforma; si una plataforma no se puede probar, registrar pendiente y no marcar aceptación completa.

Reversión de operación fallida mediante rollback; reversión funcional mediante build compatible conservando tablas/datos. El binario anterior puede rechazar v8 por versión futura: no presentarlo como rollback transparente. Nunca bajar user_version ni borrar tablas para hacer arrancar un build viejo. Recuperación con copia v7 previa se hace en destino separado, conservando DB v8 y export v9 para no perder nuevas colecciones/recomendaciones.

## Verificación S3 y corrección de integridad

La matriz S3 detectó que dos items del archivo con referencias disjuntas pueden resolver al mismo título local multirreferenciado. Las membresías ahora se agrupan después del remapeo por colección/ID local efectivo antes de escribir: una sola unidad y contador por pareja, fecha más reciente y omisión reportada de datos contradictorios empatados. La corrección no cambia SQLite v8, formato v9 ni identidades. Las versiones históricas conservan sus contratos (rating desde v3, documentos editoriales desde v8, manual local-only v5/v6 sin equivalencia inventada). Las pruebas comparan semánticamente todo el payload v9, incluida metadata y actividad, con remapeo portable de IDs, no igualdad textual de exports.

Resultados y excepciones de plataforma en `docs/testing/personal-collections-recommendation-inbox/s3-validation.md`: pruebas SQLite TEST, matrices de conflictos, fallos por registro/commit, handlers reales de Ajustes y regresiones. La validación automatizada no sustituye aceptación Android/Web; 1.5, 2.5, el extremo por plataforma de 3.4 y 3.5 permanecen pendientes. No se sincronizaron specs ni se archivó el change.
