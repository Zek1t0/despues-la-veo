## Context

Ver motivación en proposal.md. Baseline inspeccionado: main/d724f1a, sin cambios previos; `DATABASE_SCHEMA_VERSION=8`, export v9 y parsers v1–v9. El dominio separa identidad local, clasificación y referencias; metadata enriquecida tiene documentos y relojes propios. Las mutaciones usan `runSerializedStorageMutation`, helpers WithDb y una transacción pública; la presentación se invalida después del commit. Colecciones observa invalidación de Biblioteca además de organización.

`saved_titles.updated_at` gobierna merge histórico de varios personales. Alterarlo por progreso daría autoridad incidental a notas/estado antiguos. El feed está acotado a 90 días/2000 eventos y su parser portable tiene allowlist histórica: no se reutiliza como historial de consumo ni se amplía en A.

La integración TMDB no normaliza totales/listados de episodios; MangaUpdates tampoco conserva capítulos/volúmenes. Kitsu normaliza episodeCount pero no acredita correspondencia de numeración con el cursor manual; está cerrado en producción. Los gates, clientes y contratos de proveedores quedan intactos.

## Goals / Non-Goals

**Goals:** independencia transaccional y temporal, posición manual tipada, lectura compacta sin N+1, edición sin pérdida concurrente y portabilidad completa antes de entregar. La extensión a B conserva incertidumbre en lugar de generar consumo supuesto.

**Non-Goals:** motor de eventos, catálogo o identidad de unidades, porcentajes de cobertura, cronología durable, volúmenes, ciclos, cambios de estado automáticos y permisos editoriales nuevos. Ninguna dependencia nueva. Los checkpoints no son releases parciales.

## Decisions

### D1. Registro propio y unión discriminada

Nuevo dominio `PersonalProgress` versionado internamente como shape 1, con `itemId`, `updatedAt` y `position`. `position=null` significa restablecido; no hay fila para nunca registrado. Una posición activa es una de:

| mode | Payload exclusivo | Presentación |
| --- | --- | --- |
| episode | episode entero | Episodio 127 |
| season-episode | season y episode enteros | Temporada 2 · Episodio 8 |
| chapter | chapter string decimal canónico | Capítulo 42.5 |
| special | label textual | Especial: Prólogo |

La procedencia es manual por definición del registro A; no se fabrica ProviderReference. La versión del shape no es la versión de SQLite ni la del backup. No se guarda total, porcentaje, cobertura, fecha de consumo ni lista de vistos. El modo expresa numeración, no identidad editorial. Reset elimina la posición activa completa, incluido modo, y deja reloj; al registrar de nuevo se elige esquema explícitamente.

Límites: episodio 0–999999; temporada 0–9999; capítulo 0–999999.999999 con hasta seis decimales. Canonizar mediante cadenas (trim, coma→punto, retirar ceros sobrantes), sin parseFloat/aritmética decimal binaria; rechazar exponentes, signos, agrupadores, espacios internos y precisión original superior a seis decimales incluso si termina en cero. El formulario acepta ceros iniciales pero no los persiste. Decimal portable exige forma canónica (`0`, `42`, `42.5`), nunca número JSON. Especial: 1–120 puntos de código Unicode tras trim, sin controles U+0000–001F/U+007F–009F ni saltos U+2028/U+2029. Límite textual pequeño evita convertir progreso en notas arbitrarias. Magnitud seis dígitos ofrece margen sin precisión numérica problemática; seis decimales cubren subdivisiones sin cadenas ilimitadas. No se afirma que todo catálogo use estos límites: numeración fuera del dominio puede registrarse como especial textual, sin incremento.

Alternativas rechazadas: campos extra en SavedTitle por mezcla de variantes/relojes; JSON libre por validación débil; eventos como fuente de verdad por reconstrucción innecesaria. Una tabla actual deja B libre de diseñar unidades reales sin columnas anticipatorias.

### D2. Tabla y validación SQLite

Nueva `personal_title_progress`, una fila por `saved_title_id TEXT PRIMARY KEY NOT NULL`, FK a `saved_titles(id) ON DELETE CASCADE`. Columnas: `shape_version INTEGER NOT NULL CHECK=1`, `mode TEXT NULL`, `season INTEGER NULL`, `episode INTEGER NULL`, `chapter TEXT NULL`, `label TEXT NULL`, `updated_at INTEGER NOT NULL` seguro entre 0 y 9007199254740991. Sin índice secundario redundante: lecturas por PK o lote.

CHECK de exclusión completo: reset tiene todas las columnas de posición NULL; episode solo episode; season-episode solo season/episode; chapter solo chapter; special solo label. Usar pruebas explícitas IS NULL/IS NOT NULL para no aceptar UNKNOWN por semántica de CHECK. Tipos/rangos enteros comprobados con typeof; capítulo typeof text con longitud/rango sintáctico y canonización validada por parser compartido; especial con longitud y controles comprobables. Verificación de esquema valida columnas, PK, CHECK, FK cascade y recorre filas con el parser estricto para asegurar canonicidad completa y Unicode sin depender de regex SQLite. Todas las escrituras, incluidas importaciones, pasan por ese parser y SQL parametrizado. No relajar la tabla para conservar posiciones incompatibles: incompatibilidad es clasificación del título, no invalidez del payload.

No trigger hacia saved_titles ni columna en metadata. El trigger existente de borrado que reabre Inbox y los cascades de membresías permanecen intactos.

### D3. Operaciones y concurrencia

Un repositorio nuevo ofrece lectura individual/lote, asignación y reset con token esperado (ausencia o payload+updatedAt). La capa pública inicializa, entra en la cola una vez y abre una transacción; helpers WithDb no reinician, no reingresan ni anidan transacciones. Dentro se comprueba existencia del título y clasificación actual, igualdad/no-op, token esperado y escritura. Reloj local = max(Date.now(), previous.updatedAt+1); para decisión explícita desde conflicto incluir también incoming.updatedAt+1 para no retroceder frente al candidato. Validar entero seguro y fallar sin writes si no puede avanzar. No inferir orden causal entre dispositivos a partir de ese reloj.

El incremento recibe base y destino calculado (episode+1) como intención, nunca un comando ciego reproducible. Doble envío pendiente se bloquea en UI; reintento del mismo destino ya confirmado es no-op semántico. Si el actual difiere del esperado y del destino, conflicto recuperable; nunca sobrescribir. Para operaciones con título/clasificación, verificar además clasificación base: una reclasificación concurrente obliga a revisar. Reset sin fila crea reset fechado; reset ya confirmado no mueve reloj. Los writes que no cambian semántica no invalidan ni producen actividad.

Solo después de COMMIT se publica `publishLibraryInvalidation([itemId])`; Colecciones ya lo observa. No usar `publishOrganization` para un cambio que no modifica organización. Borrado serializado y FK eliminan progreso sin recrear título desde una intención tardía. Lectura fallida no se degrada a null.

### D4. Proyección y superficies

Mantener `SavedTitle` y sus mutadores históricos sin propiedad mutable nueva. Agregar `progressById` a snapshots de Biblioteca y organización, y `progress`/error independiente al snapshot de ficha; obtener todo en la misma transacción de lectura/cola, consultando progreso en lote, sin consulta por tarjeta. Helper puro común produce texto compacto, nombre accesible, elegibilidad y disponibilidad de +1. Presentación no escribe.

Ficha: bloque «Mi progreso» después del estado personal, antes de organización/editorial. Posición destacada y esquema, texto breve «Última posición registrada; no acredita todos los anteriores». Sin fila: «Sin progreso registrado» y Registrar; reset: «Progreso restablecido» y Registrar; lectura fallida: conservar dato previo, mensaje/reintento, bloquear edición hasta conocer base. Formulario inline expandible con selección de modo, inputs etiquetados, ejemplo y Guardar/Cancelar; no nueva pestaña/ruta. Cambio de modo requiere confirmar nueva posición. Reset usa confirmación inline accesible con Cancelar como foco inicial y devuelve foco al disparador. Guardando bloquea envío; éxito anuncia posición confirmada; error conserva borrador. Invalidaciones refrescan confirmado sin pisar borrador y advierten si cambió base.

Botón «+1 episodio» muestra/annuncia destino, suma uno sin salir de temporada, no aparece en capítulos/especiales/ausencia/límite. No se llama «Siguiente episodio». No agregar sugerencias de estado en A: la independencia queda inequívoca y esas sugerencias son opcionales para otro ajuste.

Biblioteca Detalle: línea debajo de identidad/estado, separada de rating y sin acciones nuevas. Mosaico: línea breve debajo del título, fuera del arte; truncamiento visual permitido con etiqueta accesible completa. Colección abierta: mismo componente al lado del título/estado; portada y orden de colección no cambian. Sin posición: omitir resumen en listados. Posición incompatible conservada: texto con aviso, sin +1; ficha permite restablecer o reemplazar por modo compatible. No se añade seguimiento a búsquedas remotas, Inbox o películas. No cambiar orden updated-desc: usa el reloj histórico del título.

Elegibilidad: audiovisual/tv y comic excepto one-shot ofrecen Registrar; anime ova/ona/special y formatos null de audiovisual/comic requieren «Activar seguimiento manual» y elegir esquema; película/music/literature/one-shot no presentan controles nuevos. La reactivación no deduce modo desde proveedor. Un reset conservado siempre puede consultarse, aunque la clasificación haya cambiado.

Reutilizar theme.global/semantic, espaciado y patrones de OrganizationUI; no colores inline nuevos. Controles ≥44 px, foco visible, etiquetas sin depender de icono/color, teclado Web, orden de foco, anuncios de éxito/error sin repetir toda la ficha. Verificar 320 px y fuente 200 %, scroll y temas claro/oscuro; filtros sensibles siguen antes de revelar contenido.

### D5. Barra condicional sin promesa editorial falsa

Componente compartido admite escala efímera con total entero positivo, referencia/procedencia y evidencia explícita de numeración continua equivalente al recurso entero. Es una entrada validada a la presentación, no un dato personal ni tabla futura. Ningún adaptador existente aporta hoy esa evidencia: en datos reales del baseline A muestra posición textual y NO barra. No agregar checkbox para que el usuario convierta una suposición editorial en dato confiable, ni solicitudes nuevas, ni usar simplemente episodeCount.

La rama compatible se verifica con fixtures de presentación: solo episode continuo 0≤X≤total, nunca season-episode, chapter o special. Texto «Posición X de Y», explicación de que no es cantidad vista, sin `%`; semántica accesible no anuncia un porcentaje de consumo. Si no puede evitarse esa confusión con un progressbar nativo, usar indicador decorativo oculto al lector y texto accesible completo. Cambio de fuente/total invalida evidencia derivada y oculta la escala, sin cambiar posición. Fuera de rango se conserva texto sin clamp, barra o bloqueo. B decidirá cómo proveer equivalencias editoriales verificadas.

### D6. Backup v10 y compatibilidad

Nuevo `libraryBackupV10` compone representación v9 sin modificar parsers históricos. Raíz v10 exige `progress: []` aun vacía. Registro portable `{ itemId, version: 1, position, updatedAt }`; position usa la unión D1 o null reset. Sección ausente/no array es error de envoltorio; campos/payload inválidos son issues por registro. Copiar shape validado, no conservar claves extra desconocidas. Duplicados exactos se deduplican; cualquier contradicción de un mismo itemId excluye todos sus candidatos y reporta conflicto. Export valida targets y posiciones sin omisiones, incluso ocultos/incompatibles/reset. Snapshot único incluye títulos, metadata, pins, preferencias, actividad, organización y progreso.

No ampliar allowlists históricas de actividad; v10 reutiliza los eventos existentes. `parseLibraryBackup` despacha v10 explícitamente; v1–v9 ignoran los nuevos campos sin autoridad. Las condiciones de versión en merge, Ajustes, Appearance diferida y preferencias deben incluir v10 preservando flujos existentes, no solo ampliar el union TypeScript. Los tests de export vigente pasan a v10; fixtures y parsers v9 continúan verificando el contrato histórico. Al sincronizar specs en una etapa futura, actualizar también la nota introductoria de library-backup-integrity de formato vigente v9 a v10; en PROPOSE no se modifica main spec.

### D7. Merge conservador e informe de revisión

Tras títulos y su mapa portable, agrupar todos los candidatos válidos por destino resuelto antes de escribir progreso, para detectar también dos IDs origen que terminan en un destino. Si hay payloads/relojes contradictorios, excluir ese destino completo, no elegir por orden. Un item no resoluble no usa fallback por ID ocupado. Mapeo válido se usa aunque no cambie el título por frescura. La incompatibilidad con clasificación final se conserva y advierte, sin coerción ni fallo de identidad.

| Local | Entrante | Resultado |
| --- | --- | --- |
| Sin fila | Activo o reset válido | Insertar con reloj entrante |
| Misma posición/reset | Cualquier reloj | Preservar exactamente local, contar igual |
| Distinta posición/modo/reset | Más nuevo, viejo o igual | Preservar local y devolver conflicto |
| Cualquiera | Ausente/histórico | Sin aportación |
| Cualquiera | Inválido/huérfano/contradictorio | Reportar, sin escritura de esa unidad |

Comparación semántica usa payload canónico, excluye timestamp; no compara magnitud para escoger ganador. Reset es valor explícito, no borrado por ausencia. Restauración automática de progreso no registra actividad nueva. Imports repetidos no multiplican registros; discrepancias no resueltas pueden volver a aparecer como informe del nuevo import (no acumulación durable).

Helper de merge usa savepoint por unidad dentro de la transacción pública existente. Resultados separados: inserted, preservedEqual, conflicts, invalid, failed, changedIds. Fallo final revierte también títulos, metadata, organización y progreso; invalidación, publicación de preferencias e informe exitoso solo poscommit. Apariencia conserva mecanismo diferido vigente. No mutar resultado visible durante una transacción sin confirmar.

Ajustes mantiene resultado de esta importación en memoria con lista revisable completa, expandible/paginada, sin el límite de cinco detalles del resumen histórico. Cada conflicto incluye item local, título, base local con reloj, candidato con reloj y procedencia «Backup importado». Acciones «Conservar local» y «Aplicar posición del backup» (confirmación explícita); reset se presenta como «Restablecido», no vacío ambiguo. Aplicar usa repositorio con CAS D3 y destino resuelto original, comprueba título, identidad y clasificación base, genera decisión local fechada y actualiza la fila del informe. No vuelve a ejecutar mergeLibraryBackup. Una identidad ahora contradictoria, borrado o modificación vuelve la elección obsoleta; se informa y recarga sin recrear ni reasignar.

El informe no se guarda en SQLite y no se considera dato personal durable ni historial de B. Mostrar antes de salir que se pierde al cerrar y ofrecer exportar informe completo JSON como archivo por flujos existentes Web/Android; contenido de reporte es privado del usuario, sin envío de red. Conservar candidato en memoria hasta elección/cierre; pedir confirmación antes de reemplazar un informe con pendientes por otro import. Contadores reflejan resultado original y resoluciones explícitas por separado, sin presentar todo como restaurado automáticamente. No persistir otro historial/conflict table en A. Reexport v10 incluye la decisión vigente, no el reporte.

### D8. Edición manual e invariantes históricas

`saveManualContent` incorpora una intención explícita de incompatibilidad (cancelar, conservar, restablecer) y token de progreso base, fuera de los campos snapshot editables. Solo se exige cuando una posición activa deja de ser compatible con la clasificación propuesta. Sin decisión no guarda; conservar deja payload y reloj intactos; restablecer invoca helper WithDb en la misma transacción. Edición manual sigue avanzando updatedAt del título por su regla previa; ese avance se debe a editar ficha, no a progreso. Refresh o import histórico no interactivo que cambie clasificación conserva posición marcada incompatible, nunca decide reset por el usuario.

### D9. Extensión hacia B sin tablas anticipadas

| Necesidad futura | Frontera que conserva A | Trabajo reservado a B |
| --- | --- | --- |
| Episodios y capítulos individuales | Título local estable y cursor manual separado | Identidad local de unidad + referencias externas, no número como PK |
| Temporadas y partes | season es coordenada manual, no entidad editorial | Agrupación explícita y correspondencias versionadas |
| Huecos y cobertura | Ningún número equivale a cantidad | Marcas por unidad y denominadores completos confiables |
| Fechas de consumo | updatedAt es edición, no fecha vista/leída | Eventos o registros de consumo propios |
| Rewatch/relectura | Reset reemplaza cursor sin historial supuesto | Sesiones/ciclos e historial durable |
| Renumeración editorial | Refresh no cambia payload | Identidad estable, aliases y reconciliación sin mover decisiones |
| Listados de proveedores | Referencias del título no identifican unidades | Validar endpoints/gates, cobertura, caché y procedencia |

B puede añadir tablas relacionadas sin reescribir saved_titles ni transformar los resets de A. Mantendrá inicialmente el cursor manual como tal y pedirá al usuario resolver equivalencias antes de vincularlo a unidades. No generará vistos 1..N ni fechas desde updatedAt. B también deberá decidir qué gobierna «continuar» si cursor y marcas discrepan; A no predefine esa política. Esta decisión queda fuera de APPLY A y no impide sus tareas.

### D10. Mapa de archivos y revisión

Nuevos propuestos (solo durante APPLY):
- `src/core/personalProgress.ts`, `personalProgressPresentation.ts`: unión, parser, canonización, comparación, elegibilidad y textos/escala.
- `src/storage/personalProgressSchema.ts`, `personalProgressRepo.ts`, `personalProgressBackupImport.ts`: schema/verificación, reads/batch/CAS y merge.
- `src/components/progress/PersonalProgressSection.tsx`, `PersonalProgressSummary.tsx`: editor y resumen/barra compartidos.
- `src/core/libraryBackupV10.ts`, `src/components/progress/ProgressImportReview.tsx`: contrato portable y revisión en Ajustes.

Existentes a modificar:
- `src/storage/databaseSchema.ts`: versión, evolución v8→v9, hooks/verificación; `src/storage/db.ts` solo si sus tipos/bootstrap lo requieren.
- `src/storage/libraryScreenSnapshot.ts`, `titleDetailPinSnapshot.ts`, `organizationSnapshot.ts`: lectura coherente en lote. `src/storage/libraryInvalidation.ts` se reutiliza sin cambiar su semántica; `src/components/organization/useOrganization.ts` ya escucha esa señal.
- `app/title/[id].tsx`, `app/(tabs)/libreria.tsx`, `app/organize/collections/[id].tsx`, `src/components/browsing/TitleGridCard.tsx`, `savedTitleAccessibility.ts`: montaje/resumen/accesibilidad sin cambiar rutas remotas.
- `src/storage/manualContentEntries.ts`, `src/components/ManualEntryForm.tsx`, `app/manual-entry.tsx`: decisión compatible y transacción conjunta, sin ampliar entrada de snapshot arbitrariamente.
- `src/core/libraryBackup.ts`, `src/storage/libraryBackupExport.ts`, `libraryBackupMerge.ts`, `savedTitlesRepo.ts`, `app/(tabs)/ajustes.tsx`: v10, resultados, remap, invalidación y revisión.
- `README.md` y nuevos `docs/testing/personal-episodic-progress/` durante APPLY: ejecución/evidencia y aceptación; fixtures/suites históricas afectadas solo para expectativa de export vigente.

No modificar taxonomía, parsers v1–v9, proveedores, gates o esquema de Colecciones/Inbox; adaptar consumidores modernos alrededor de ellos. No mover controles a rutas remotas.

## Risks / Trade-offs

- [Barra ausente con datos actuales] → decisión deliberada: el baseline no acredita numeración compatible; fixture demuestra capacidad condicional sin presentar progreso ficticio. La integración visual útil de A es posición destacada y resúmenes, no cobertura.
- [Conflictos repetidos al reimportar] → conservar local por defecto; revisión completa y aplicación explícita, sin deduplicar por número ni descartar candidato por reloj.
- [Informe temporal] → aviso y export completo antes de cerrar/reemplazar; persistir informe requeriría ampliar contrato y no se oculta esa limitación.
- [Timestamp futuro o agotado] → validar y fallar de forma recuperable si no puede generarse siguiente reloj; nunca resetear reloj para forzar escritura.
- [Manual reclasificado o backup histórico] → conservar payload y avisar; reset solo explícito.
- [Stale UI/N+1] → snapshots atómicos en lote, invalidación poscommit y CAS con borrador separado.
- [Entrega S1/S2 sin backup] → checkpoints de desarrollo aislados, sin publicación ni cierre hasta S3/S4; cada evidencia señala portabilidad pendiente.
- [Lectores viejos] → backup v10 y SQLite v9 rechazan downgrade; copiar datos antes de migrar, no prometer reversión automática.

## Migration Plan

1. En APPLY, volver a comprobar baseline/schema para detectar cambios intervenidos. Mantener fixtures de versiones anteriores y copia de prueba v8; no ejecutar migración desde PROPOSE.
2. Dentro de la evolución existente, para currentVersion<9, completar migraciones históricas hasta v8 y verificar sus estructuras. Para una v8 válida capturar y comparar títulos, identidades, metadata, pins, actividad, preferencias, colecciones/membresías/recomendaciones antes/después.
3. Crear solamente personal_title_progress vacía. No backfill de done/watching, notas ni totales. Verificar tabla, FK, payloads e integridad antes de publicar user_version=9. Incorporar hooks de fallo tras creación, antes/después de publicación; todo en la misma transacción. Base nueva llega directamente al esquema actual siguiendo el pipeline; reapertura v9 verifica sin recrear/borrar. Rechazar esquema futuro sin writes de datos.
4. Completar S1 y S2 como desarrollo revisable; S3 activa export público v10 y restauración completa antes de distribuir. Verificar round trip sin red desde base vacía y desde colisiones reales de fixtures.
5. S4 valida aceptación manual Web/Android y regresión de contratos previos. Actualizar documentación de versiones y límites; no archive automático.
6. Ante error de migración/import rollback completo, sin publicar versión/éxito. Si se decide volver a app v8 después de usar v9, conservar SQLite v9+backup v10 y restaurar copia v8 en entorno separado; no ejecutar downgrade destructivo ni pretender que backup v9 conserva progreso.

## Review Before APPLY

No quedan decisiones estructurales delegadas a implementación. Revisar y aprobar los límites numéricos, elegibilidad, ausencia deliberada de barras con fuentes actuales, exclusión de actividad en A, informe temporal exportable y política de incompatibilidad manual. Son decisiones propuestas concretas, no autorizaciones para implementar. Ajustes de copy/espaciado pueden resolverse en S2 si mantienen los escenarios accesibles. B requiere su propio Explore/Propose antes de diseñar identidades/cobertura/sesiones.
