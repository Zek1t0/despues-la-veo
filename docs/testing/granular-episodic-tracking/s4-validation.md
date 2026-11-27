# S4 — Portabilidad granular

Checkpoint S3 publicado en origin y verificado antes de editar `67f2a7086c99e7bc74cc89a588bf3769c7184947`. Rama `feat/granular-episodic-tracking`, árbol e índice inicialmente limpios. Se registró la aprobación externa de S3 en 3.6.

## Reproducción

- `node docs/testing/granular-episodic-tracking/s4.cjs` ejecuta el contrato y la restauración con SQLite TEST.
- `node docs/testing/granular-episodic-tracking/s4-web.cjs` ejecuta el recorrido Chromium con Metro local, perfil nuevo y dos bases TEST. `S4_EVIDENCE_DIR` permite guardar los PNG en `.expo/s4-evidence`. Los archivos generados contienen fixtures. El recorrido utiliza la revisión granular de Ajustes y los servicios reales de exportación, importación y resolución. Los manejadores completos de Ajustes también se verifican en los harnesses históricos.
- Las suites `s1.cjs`, `s2.cjs` y `s3.cjs` del mismo directorio cubren los checkpoints previos. El runner histórico `docs/testing/personal-episodic-progress/s4-regressions.cjs` se ejecutó sin regenerar los JSON históricos. Se ejecutaron también las cinco suites de credenciales y transporte TMDB, TypeScript, el build Expo Web y la validación estricta OpenSpec.

Pasaron S1–S4, las 33 suites históricas, las cinco suites TMDB, TypeScript, el build Web y OpenSpec estricto. Los harnesses de Ajustes se actualizaron para verificar v11 y su bloque obligatorio. El harness de metadata aísla ahora la vista granular en el límite del componente, preservando su protección contra acceso a la base personal y las aserciones de metadata.

## Resultados SQLite TEST

| Área | Evidencia |
| --- | --- |
| Versiones | v1–v10 históricos válidos con campos granulares artificiales sin autoridad. v11 vacío y completo. Rechazo previo a escritura de envoltorio inválido, sección obligatoria ausente, JSON malformado y versión futura. Registros inválidos informados por separado. |
| Round trip | Exportación de A, importación en B vacía, reexportación semánticamente equivalente, tres reimportaciones y reapertura. Se comprobaron unidades activas y retiradas, T0, episodios discontinuos, capítulos exactos, especiales, grupos, referencias, fechas personales, habilitación, desmarcados, datos históricos y relaciones. |
| Base poblada | Remapeo por dueño efectivo y referencia única, conservación de UUID locales y atributos divergentes, omisiones de dependencias, colisiones de UUID y referencia y candidatos contradictorios. |
| Conflictos | Comparación por estado y fecha. Una equivalencia conserva reloj y revisión locales. Fechas históricas estructuralmente válidas sobreviven al cambio de reloj. La aplicación explícita vuelve a validar identidad y revisión. |
| Evidencia editorial | Un import equivalente conserva la evidencia vigente. Una nueva pertenencia relevante degrada el alcance afectado en español e inglés. T0 independiente conserva su estado. Las unidades restauradas se ven como parciales sin reconstruir snapshots. |
| Fallos inyectados | Aislamiento al restaurar grupos, unidades, referencias, decisiones y evidencia. Rollback de fallo global y de resolución explícita. Sin eventos anteriores al commit. |

## Chrome TEST

El recorrido descargó y parseó el v11, restauró en una segunda base, comprobó la guía parcial, conservó una decisión local, aplicó explícitamente otra, rechazó un candidato obsoleto y descargó el informe. Capturas reales en `.expo/s4-evidence/s4-restauracion-parcial.png`, `.expo/s4-evidence/s4-conflictos.png` y `.expo/s4-evidence/s4-obsoleto.png`.

La corrida final aprobó con directorio absoluto de descarga y conflictos del fixture ordenados por episodio. Estos ajustes corrigieron dos fallos del harness al repetir la descarga y elegir el candidato obsoleto.

## Límites

SQLite permanece en v10. El descriptor durable actual carece de fecha editorial y procedencia de emisión propia. Las fechas que solo existen en caché quedan fuera del backup junto con la evidencia y la membresía acreditada. La habilitación portable se importa de forma aditiva. Los conflictos viven en el informe temporal. La eliminación de un título sigue sin generar tombstones generales.

Quedan pendientes 2.3 por verificación real TMDB, 4.5 por revisión externa y checkpoint, y S5 por regresión y aceptación finales. Sin aceptación Android física ni uso de la biblioteca personal. La distribución queda pendiente de S5.

## Revisión externa de S4

- P1. La navegación incorpora temporadas durables al índice cacheado por referencia de serie y temporada. Una colisión de temporada mantiene visible el alcance identificado por el índice, avisa de la ambigüedad y evita añadir las unidades del grupo discrepante. Sin índice, un número disputado queda fuera del selector hasta que se identifique el alcance.
- P1. La proyección usa UUID, referencia y grupo para mostrar unidades durables una vez. Solo las coincidencias exactas reciben metadata del snapshot local. Una unidad sin fecha permanece con disponibilidad desconocida. Se conserva un conjunto explícito de miembros editoriales para calcular porcentajes acreditados. Los conteos parciales y los filtros de lista y cuadrícula usan el inventario durable del alcance.
- P1. `s4.cjs` restaura T2 sobre el índice de T1 y tres episodios sobre un snapshot de 12. Comprueba 15 unidades únicas, caché local, marcas, desmarcados, fecha personal, filtros, vencimiento, restauración equivalente, tres reimportaciones, aislamiento entre referencias y conflicto de grupos en la misma coordenada.
- P2. El informe omite el prefijo redundante de temporada, distingue singular y plural y agrega UUID si las etiquetas visibles resultarían iguales.

Chrome TEST aprobó la descarga, la resolución de conflictos, el singular del informe y la restauración sobre caché. El script `s4-web.cjs` desactiva la red de la pestaña después de restaurar, abre T2 desde la ficha en la ruta de seguimiento, alterna lista y cuadrícula y verifica los filtros y la fecha de consumo. Capturas en `.expo/s4-evidence/s4-cache-temporada-restaurada.png` y `.expo/s4-evidence/s4-cache-temporada-15.png`.

También pasaron S1–S4, las 33 regresiones históricas, las cinco suites TMDB, TypeScript, el build Web, OpenSpec estricto y whitespace. Se preservó el índice de Git vacío y el estado de las tareas.

## Inventario desde S3

- Modificado · `app/(tabs)/ajustes.tsx`
- Modificado · `app/_layout.tsx`
- Modificado · `docs/testing/enriched-media-metadata/section-7-ui.cjs`
- Modificado · `docs/testing/granular-episodic-tracking/s2.cjs`
- Modificado · `docs/testing/personal-collections-recommendation-inbox/s3-settings.cjs`
- Modificado · `docs/testing/personal-episodic-progress/s3-settings.cjs`
- Modificado · `docs/testing/personal-episodic-progress/s3-ui.cjs`
- Modificado · `openspec/changes/add-granular-episodic-tracking/tasks.md`
- Modificado · `src/components/granular/GranularPreview.tsx`
- Modificado · `src/components/granular/GranularScreen.tsx`
- Modificado · `src/core/granularCoverage.ts`
- Modificado · `src/core/libraryBackup.ts`
- Modificado · `src/storage/granularInventory.ts`
- Modificado · `src/storage/granularPresentationRepo.ts`
- Modificado · `src/storage/granularRepo.ts`
- Modificado · `src/storage/libraryBackupExport.ts`
- Modificado · `src/storage/libraryBackupMerge.ts`
- Modificado · `src/storage/personalProgressBackupImport.ts`
- Nuevo · `docs/testing/granular-episodic-tracking/s4-validation.md`
- Nuevo · `docs/testing/granular-episodic-tracking/s4-web.cjs`
- Nuevo · `docs/testing/granular-episodic-tracking/s4.cjs`
- Nuevo · `src/components/granular/GranularImportReview.tsx`
- Nuevo · `src/core/libraryBackupV11.ts`
- Nuevo · `src/dev/mediaReview/GranularBackupReview.tsx`
- Nuevo · `src/storage/granularBackup.ts`
- Nuevo · `src/storage/granularDurableGuide.ts`
