# S3 — Backup v10 y revisión de progreso

Fecha: 2026-11-21, America/Buenos_Aires. Checkpoint de desarrollo pendiente de revisión externa y aceptación completa. S4 no iniciada.

## Preflight y alcance

- Rama inicial/final: feat/personal-episodic-progress-foundation.
- HEAD inicial/final: 9bf0eb294b2d8a16ef09422e0f54e5633f5a818c, checkpoint S2. S1 62e6c0f es su ancestro inmediato.
- Árbol e índice inicialmente limpios. git ls-remote --heads origin feat/personal-episodic-progress-foundation confirmó 9bf0eb2 publicado; el primer intento aislado falló por resolución de red, el reintento de solo lectura fuera de ese aislamiento pasó. Sin fetch ni Git de escritura.
- Se consultaron status/instructions de OpenSpec y los artefactos proposal, design, tasks y los tres deltas. Spec-driven ready, 13/29 iniciales. Se implementaron 3.1–3.8; 3.9 permanece pendiente. Las marcas históricas pendientes 1.9/2.6 no se alteran.
- SQLite sigue v9. No cambios en migración, dominio/repositorio S1, parsers v1–v9, proveedores, gates, dependencias o historial de actividad. No se abrió ni migró la biblioteca personal.

## Contrato y arquitectura

libraryBackupV10 compone el creador/parser v9, conserva sus secciones y agrega progress obligatorio, aun vacío. Cada registro contiene itemId del título en el archivo, version:1, position de S1 o null y updatedAt propio. itemId es una referencia interna portable del archivo: se resuelve mediante identidades y mapa, no se interpreta como el ID efectivo del destino.

El parser reutiliza el dominio estricto para capítulos textuales canónicos, enteros, especiales Unicode y resets fechados. Campos desconocidos del envoltorio de registro no adquieren autoridad; campos incompatibles de posición siguen rechazados. JSON/envoltorio/versiones futuras se rechazan antes de escribir. Una fila inválida se informa y aísla. Duplicados exactos se deduplican; contradicciones de un origen excluyen sus candidatos completos. Export rechaza progreso huérfano o duplicado en lugar de omitirlo.

El snapshot público usa la cola y una transacción única e incorpora progreso por lotes de todos los títulos, sin filtros de presentación. Conserva referencias, manuales/legacy, personales, metadata, pins, preferencias, apariencia disponible, actividad, Colecciones e Inbox. No contiene credenciales ni binarios. Las bases inyectadas históricas que carecen de la tabla siguen exportando sus datos históricos; el bootstrap público verifica SQLite v9 antes del snapshot.

El merge v10 reutiliza primero títulos y su mapa efectivo; después procesa pins, actividad/preferencias, organización y progreso. La referencia de progreso nunca cae sobre un ID ocupado por casualidad ni se resuelve por nombre. Agrupa candidatos por destino antes de escribir y excluye contradicciones incluso cuando dos IDs de origen resuelven una sola obra. Cada unidad de progreso usa savepoint dentro de la transacción global. Posiciones incompatibles siguen siendo datos válidos: se conservan y el informe las advierte sin coerción.

La escritura importada valida el shape y reutiliza la tabla S1, sin tocar saved_titles.updated_at ni estado/rating/notas/tags/metadata/organización. No genera actividad. La invalidación pública existente recibe también IDs modificados por progreso, solo después de commit. No se añadieron tablas, índices, eventos o versiones SQLite.

## Matriz de conflictos y remapeo

| Caso | Resultado comprobado |
| --- | --- |
| Local ausente, candidato activo o reset | Inserta payload y reloj entrantes |
| Payload/reset igual, reloj anterior/igual/posterior | Conserva exactamente local; sin write de progreso |
| Discrepancia, número mayor/menor o reset | Conserva local, informa candidato completo |
| Backup histórico o progress vacío | No borra ni modifica progreso local |
| progress ausente en v10 | Error global de envoltorio; no equivale a vacío |
| Mismo ID ocupado por otra obra | Usa identidad y remap; no asigna progreso al ocupante |
| Manual portable, manual legacy y múltiples proveedores | Resuelve el propietario correcto; mantiene relaciones |
| Título preservado por frescura | Su mapa sigue habilitando progreso independiente |
| Origen no restaurable o fallo de identidad/título | Omite su progreso y reporta; sin fallback por ID |
| Varios orígenes al mismo destino | Exactos se unifican; contradictorios se excluyen sin elegir por orden |
| Aplicación tras cambio de progreso/clasificación/identidad o borrado | Rechaza base obsoleta sin recreación ni sobrescritura |
| Reloj entrante agotado | Rechaza la decisión sin modificar datos |

La aplicación explícita es una nueva operación serializada/transaccional, no repite el import global. Relee progreso y una firma de clasificación y todas las identidades locales, incluida legacy. Exige la misma versión base aun si otro proceso ya alcanzó el destino solicitado. Su nuevo reloj es mayor que ambos relojes y no prueba fecha de consumo. Reimportar después reconoce igualdad semántica sin volver a aplicar el cambio.

## Ajustes e informe temporal

Exportación pública v10; importación v1–v10. Las condiciones modernas de apariencia diferida/preferencias y organización incluyen v10 sin editar parsers históricos. Los contadores de progreso son independientes y un conflicto pendiente impide presentar el resultado como completamente exitoso.

ProgressImportReview presenta título, local, candidato de Backup importado y sus relojes, con conservación local por defecto. Permite conservar, solicitar aplicación y confirmar/cancelar; el foco inicial de confirmación está en Cancelar. El bloqueo por ref impide dos escrituras antes del rerender. Errores conservan el candidato para revisión o retry y una base obsoleta requiere reimportación actualizada o conservar local.

El informe pagina diez conflictos y exporta la lista completa, issues, avisos y decisiones en JSON sin truncar a cinco. La descarga Web y el compartir Android usan transportes locales existentes; el archivo temporal Android del informe se elimina tras compartir o fallar. No hay segundo almacén de progreso. Cerrar pide confirmar descarte y nunca aplica pendientes. Al abandonar Ajustes se limpia el informe; una importación que termina con la pantalla desenfocada no vuelve a retener candidatos. El siguiente import advierte antes de reemplazar el informe anterior. Los cambios ya confirmados siguen persistidos.

## Pruebas automatizadas

Todas las bases son SQLite TEST aisladas; initDb personal y fetch están prohibidos en las suites nuevas. s3-verification usa reloj TEST determinista para no confundir retención de actividad con portabilidad. Compara snapshots y valores completos, no solo conteos.

| Comando | Resultado |
| --- | --- |
| node docs/testing/personal-episodic-progress/s3-verification.cjs | PASS: diez grupos SQLite/parser/matriz |
| node docs/testing/personal-episodic-progress/s3-ui.cjs | PASS: revisión con doce conflictos y transportes Web/Android simulados |
| node docs/testing/personal-episodic-progress/s3-settings.cjs | PASS: pantalla real de Ajustes en hook-host con SQLite TEST |
| node docs/testing/personal-episodic-progress/s3-regressions.cjs | PASS del runner: quince recorridos con exit 0 y dos fallos históricos esperados |
| npx tsc --noEmit | PASS |
| npx expo export --platform web --output-dir dist/s3-web-final | PASS, salida local ignorada sin publicación |
| openspec validate add-personal-episodic-progress-foundation --strict | PASS |
| git diff --check y diff --no-index --check contra /dev/null por cada texto nuevo | Sin errores de whitespace |

Round trip: A con TV T3/E07, anime continuo, manga 128.5, especial Unicode, reset y ausencia; manual portable/legacy y obra multirreferenciada; notas, rating, estados, pins, metadata, preferencias, apariencia, actividad, colección vacía/poblada y recomendaciones pending/incorporated/discarded. Exporta v10, importa en B vacía, compara export semántico completo, reimporta tres veces sin diferencias SQLite, reabre archivo TEST y vuelve a comparar. La matriz de remap verifica también la obra con dos referencias y episodio cero. Posición incompatible importada vuelve a exportarse exacta con aviso.

Fallos inyectados: lectura de export, JSON/payload inválido, resolución de referencias, insert de título, write de progreso por fila, commit global después de writes mixtos, commit de resolución explícita y listener de invalidación que lanza. Se verifican rollback/aislamiento, ausencia de asociaciones incidentales, ausencia de señal prematura, retry e igualdad. Ajustes real verifica que apariencia solo se activa después del commit y se descarta su reserva ante fallo. También comprueba cancelación antes de importar, resultado parcial con conflicto, export v10 y limpieza por foco.

Los dos fallos heredados permanecen reproducidos y clasificados, sin eliminar assertions:

1. Metadata con reloj real: evento de 100 ms podado por retención, 0 !== 1; el mismo test pasa con Date.now=1000 en proceso TEST.
2. Assertion estática de rating espera personalRatingPresentation?.accessibilityLabel antiguo. Se reproduce leyendo la tarjeta de HEAD con git show, sin checkout. El layout de rating no se modifica para satisfacerla.

Incidencias durante desarrollo: se corrigieron fixtures que usaban un ID no existente y un alias con metadata incoherente, sin relajar assertions. Se corrigió codificación/terminadores de Ajustes y se revisó su diff para conservar textos originales. Una repetición de export sobre dist/s3-web falló al persistir assets; se verificó correctamente una exportación completa a dist/s3-web-final, sin tocar dependencias ni borrar directorios. Advertencias existentes: Browserslist antiguo, SQLite experimental de Node y sugerencias de versiones Expo; no se actualizaron paquetes.

Los resultados previos S1/S2 publicados no se sobrescribieron: runner redirige evidencia heredada a s3-storage-results.json y s3-inherited-s2-results.json.

## Revisión Web real y recorrido mínimo TEST

Se ejecutó EXPO_PUBLIC_MEDIA_REVIEW=1 en localhost:9085. ReviewRoot selecciona exclusivamente media-review-primary.db y media-review-restore.db antes de montar persistencia productiva. El servidor quedó detenido al finalizar.

1. Preparar importación v10 TEST crea un manual por el repositorio real, registra T3/E10 en A, exporta/importa v10 a B, corrige B a T3/E07 e importa de nuevo.
2. El panel real muestra E07 local y E10 entrante, sin aplicar el candidato. Se verificó cancelar y volver a solicitar aplicación; foco inicial Cancelar.
3. Confirmar aplicación produce cero pendientes y una decisión aplicada. Se descargó el informe completo y se reexportó v10 desde B usando los controles TEST. Una ejecución se hizo con fuente sintética desconectada.
4. Capturas reales: s3-web-conflict.jpg y s3-web-applied.jpg. No son mockups ni capturas de biblioteca personal.

Para repetir: iniciar únicamente modo TEST, preparar importación, conservar local o confirmar candidato, exportar informe y reexportar progreso; consultar Biblioteca restaurada después de cerrar informe. No usar el botón histórico Exportar TEST v7 como respaldo de progreso: se conserva para regresiones históricas y los controles S3 indican v10.

Límites de aceptación: se revisó el panel compartido real en Web con bindings TEST. La integración de Ajustes completa se verificó en hook-host con SQLite real, sin navegar a Ajustes productivos ni usar la biblioteca personal. No se realizó aceptación Android físico/emulador, TalkBack/lector físico, diálogos nativos de compartir ni inspección visual al 200 %. El transporte Android se probó con dobles de File/Sharing. Estos límites y la revisión externa mantienen 3.9 pendiente. No se cierra el change ni se inicia S4.

## Inventario del diff S3

El inventario final se añade a continuación desde Git; todas las modificaciones permanecen sin staging. Sin commit, push, merge, sync ni archive.
- app/(tabs)/ajustes.tsx
- openspec/changes/add-personal-episodic-progress-foundation/tasks.md
- src/core/libraryBackup.ts
- src/dev/mediaReview/MediaReview.tsx
- src/dev/mediaReview/session.ts
- src/storage/libraryBackupExport.ts
- src/storage/libraryBackupMerge.ts
- docs/testing/personal-episodic-progress/s3-inherited-s2-results.json
- docs/testing/personal-episodic-progress/s3-regression-results.json
- docs/testing/personal-episodic-progress/s3-regressions.cjs
- docs/testing/personal-episodic-progress/s3-results.json
- docs/testing/personal-episodic-progress/s3-settings-results.json
- docs/testing/personal-episodic-progress/s3-settings.cjs
- docs/testing/personal-episodic-progress/s3-storage-results.json
- docs/testing/personal-episodic-progress/s3-ui-results.json
- docs/testing/personal-episodic-progress/s3-ui.cjs
- docs/testing/personal-episodic-progress/s3-validation.md
- docs/testing/personal-episodic-progress/s3-verification.cjs
- docs/testing/personal-episodic-progress/s3-web-applied.jpg
- docs/testing/personal-episodic-progress/s3-web-conflict.jpg
- src/components/progress/ProgressImportReview.tsx
- src/components/progress/exportProgressReport.ts
- src/core/libraryBackupV10.ts
- src/storage/personalProgressBackupImport.ts
