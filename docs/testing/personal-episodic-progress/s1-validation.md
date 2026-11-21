# S1 — Fundación de progreso: validación técnica

Fecha: 2026-11-20. Alcance autorizado: tasks 1.1–1.8. **1.9 pendiente de revisión externa del diff/checkpoint manual. S2/S3/S4 no iniciados. Checkpoint de desarrollo, no distribuible.**

## Preflight y protección de datos

- Rama inicial/final: `feat/personal-episodic-progress-foundation`.
- HEAD inicial/final: `76cbeba861b75dbd807a325e00a2b406d7306cc6` (`docs: propose personal episodic progress foundation`).
- Working tree e índice inicialmente limpios. No se encontraron cambios personales/ajenos que preservar o revertir.
- `git ls-remote --heads origin feat/personal-episodic-progress-foundation` confirmó exactamente ese SHA publicado. El primer intento en sandbox falló por resolución de red; el reintento de solo lectura con acceso autorizado confirmó origin, sin fetch.
- `git show --stat HEAD`: el checkpoint agrega solo los siete artefactos de PROPOSE; base funcional `d724f1a`, SQLite v8, export vigente backup v9/import v1–v9.
- No staging, commit, push, merge, sync, archive, checkout ni otra escritura Git. No cambios en proveedores, gates, dependencias o parsers de backup.
- No se abrió la aplicación ni `despues-la-veo.db`. Los arneses inyectan SQLite TEST en archivos temporales y bloquean initDb personal/red. Para la prueba de eliminación, initDb se reemplaza temporalmente por el handle TEST y se restaura en finally.
- La suite S1 copia físicamente una base mixta v8 cerrada después de checkpoint WAL antes de migrar, y conserva la copia temporal. `s1-results.json` registra ruta TEST y SHA-256. Ninguna base de datos ni sidecar personal se copia al repositorio.

## Implementación verificada

- Dominio PersonalProgress shape 1 independiente de SavedTitle: cuatro variantes exclusivas, posición null como reset fechado y ausencia de fila como nunca registrado.
- Capítulo canónico textual por operaciones de cadenas; acepta coma/punto en normalizador de entrada, rechaza coerción en parser persistido, más de seis decimales, exponentes, campos extra y magnitud fuera de rango. Episodios 0–999999, temporada 0–9999, especial 1–120 puntos Unicode sin controles/saltos/surrogates aislados.
- Tabla personal_title_progress con PK/FK cascade, exclusión de variantes, rangos/tipos/CHECK; verificación de DDL/FK/integridad y parser de filas al abrir v9.
- Migración aditiva transaccional v8→v9; los pasos v7/v8 no se recrean sobre v8. Hooks antes/después de publicar v9. Base nueva y cadena histórica llegan a v9; cero backfill por estado o metadata.
- Mutadores públicos serializados, helpers WithDb componibles, versión base = payload+reloj y clasificación esperada. Incremento se representa como destino absoluto; reintento igual es no-op, objetivo distinto desde base obsoleta es conflicto. Reloj propio monotónico, sin escribir saved_titles.updatedAt ni actividad.
- Lecturas de progreso en lotes de hasta 500 IDs, no una consulta por tarjeta. Snapshots de ficha/Biblioteca/Colecciones transaccionales; fallo de lectura diferenciado de ausencia mediante progressReadError.
- Edición manual: conservar/reset/cancelar incompatibilidad dentro de la misma transacción que cambia ficha, con comprobación de progreso/clasificación. Una posición incompatible ya conservada no exige nueva decisión por editar campos ajenos a clasificación. Editar ficha conserva la regla histórica de su updatedAt. Invalidación de Biblioteca solo después de commit.
- El único cambio UI es la decisión de incompatibilidad del formulario manual; no sección de seguimiento, resúmenes, barras o nueva pestaña.

## Comandos y resultados

Entorno de la suite S1: Node v22.18.0 y SQLite 3.50.2 real (`node:sqlite`); aparece su advertencia ExperimentalWarning habitual. No dependencias nuevas.

| Comprobación | Resultado |
| --- | --- |
| `node docs/testing/personal-episodic-progress/s1-verification.cjs` | PASS, diez grupos de dominio/SQLite/concurrencia/snapshots/invariantes |
| `node docs/testing/personal-episodic-progress/s1-manual-ui.cjs` | PASS, hook-host del formulario conectado a SQLite TEST real |
| `node docs/testing/personal-episodic-progress/s1-regressions.cjs` | PASS del runner; once recorridos pasan y dos fallos heredados se identifican como resultados esperados, detallados abajo |
| `npx tsc --noEmit` | PASS, sin errores |
| `git diff --check` y comprobación equivalente `--no-index --check` de cada archivo nuevo | PASS; sin staging |
| `openspec validate add-personal-episodic-progress-foundation --strict` | PASS |

Evidencia reproducible: s1-results.json y s1-regression-results.json; el segundo conserva comandos, exit codes esperados/reales y salida íntegra, incluidos los fallos heredados. No deben confundirse con pruebas de aceptación manual Web/Android.

## Matriz S1

| Área | Casos y comprobaciones sobre datos reales TEST |
| --- | --- |
| Instalación/migración | Nueva, v3/v4/v6, v8 mixta, reapertura v9, futuro v10 rechazado y schema v9 incompleto rechazado. En la v8 mixta se comparan filas completas de todas las tablas anteriores: personales, identidades, metadata, pins, preferencias, actividad, Colecciones e Inbox. |
| Rollback | Fallo después de crear tabla, antes/después de publicar v9 y fallo de commit; comparación exacta de datos, DDL y user_version anterior. |
| Posiciones | Cuatro variantes escritas/leídas; episodio/capítulo cero no son ausencia; temporadas y especial Unicode se comprueban en columnas SQLite; capítulo tiene typeof text. |
| Corrección/reset | 20→8→0, cambio explícito de variante, reset y reset repetido; reloj avanza solo con cambio real. Sin alteración de ninguna tabla previa al operar progreso. |
| Concurrencia | Dos envíos simultáneos del mismo destino confirman una sola modificación/señal; destinos distintos desde la misma base producen un éxito y un conflicto; base/reloj/clasificación obsoletos rechazados. |
| Relojes | Reloj del dispositivo anterior conserva monotonía; valor MAX_SAFE permite el último registro y luego rechaza avanzar sin escrituras. |
| Fallos de escritura | Error SQL y commit fallido mantienen snapshot previo y contador de invalidaciones; retry no queda bloqueado por la cola. |
| Snapshots | Transacción de lectura observada, dos consultas de lote para dos listados pequeños y lectura individual de ficha; 1002 IDs requieren tres lotes, lista vacía cero queries; error no se representa como lista vacía confirmada. |
| Manual | Edición compatible preserva progreso/reloj; incompatible sin decisión rechazada; cancelar no escribe; conservar mantiene payload/reloj; reset atómico; clasificación obsoleta y commit fallido preservan ambos datos. El hook-host ejercita los botones reales. |
| Eliminación | Progreso y membresía desaparecen por cascade, colección conserva nombre/datos; Inbox vuelve a pending sin vínculo y conserva captura original/persona/comentario; intención tardía no recrea título. |
| Defensa | Unión SQL incoherente, campos extra, límites, huérfano y decimal no canónico rechazados; fila corrompida artificialmente hace fallar verificación al abrir. foreign_key_check sin huérfanos en bases TEST válidas. |

## Regresiones y fallos encontrados

Pasan los recorridos existentes: manuales/identidad (b3-verification), búsqueda/detalle hook-host (b3-ui-verification), Colecciones/Inbox S1 y S2, portabilidad histórica v1–v9, conflictos y fallos de backup, picker local y metadata storage con reloj TEST controlado. Las pruebas de backup siguen siendo v9: no prueban ni implementan portabilidad de progreso.

Se corrigió la expectativa de versión vigente en `personal-collections-recommendation-inbox/s1-verification.cjs`: usa DATABASE_SCHEMA_VERSION para llegada/reapertura y +1 para futuro. No se alteran sus verificaciones semánticas o fixtures históricos.

Fallos investigados, sin cambiar producto ajeno a S1:

1. `enriched-media-metadata/section-2-storage.cjs` con reloj real espera un evento fechado en 100 ms; la retención vigente lo elimina y resulta `0 !== 1`. Reproducido cargando fuentes de HEAD con `git show` de solo lectura. Con Date.now=1000 dentro del proceso TEST pasa el recorrido completo. El runner conserva ambos resultados; no se modifica retención ni el test histórico.
2. `personal-title-rating/section-2-integration-verification.cjs` falla en una regex que espera `personalRatingPresentation?.accessibilityLabel` y otros nombres/layouts anteriores. El test y TitleGridCard se comparan con HEAD normalizando CRLF y son iguales: el fallo es previo a S1. Se conserva la salida y no se modifica la UI de rating para satisfacer una aserción de fuente obsoleta. La suite S1 verifica preservación exacta de rating y relojes en SQLite.

Durante desarrollo el fixture v3 nuevo tuvo inicialmente 15 placeholders para 16 columnas; se corrigió el fixture, sin cambios de producto para resolverlo. Todas las ejecuciones finales S1 pasan.

## Inventario completo del diff S1

Archivos nuevos:

- src/core/personalProgress.ts
- src/storage/personalProgressSchema.ts
- src/storage/personalProgressRepo.ts
- docs/testing/personal-episodic-progress/s1-verification.cjs
- docs/testing/personal-episodic-progress/s1-manual-ui.cjs
- docs/testing/personal-episodic-progress/s1-regressions.cjs
- docs/testing/personal-episodic-progress/s1-results.json
- docs/testing/personal-episodic-progress/s1-regression-results.json
- docs/testing/personal-episodic-progress/s1-validation.md

Archivos modificados:

- src/storage/databaseSchema.ts
- src/storage/libraryScreenSnapshot.ts
- src/storage/titleDetailPinSnapshot.ts
- src/storage/organizationSnapshot.ts
- src/storage/manualContentEntries.ts
- src/components/ManualEntryForm.tsx
- app/manual-entry.tsx
- docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs
- openspec/changes/add-personal-episodic-progress-foundation/tasks.md (solo 1.1–1.8 marcadas)

Índice final vacío, HEAD sin cambios; los archivos anteriores quedan unstaged/untracked para revisión. Proposal/design/deltas aprobados no se modificaron.

## Limitaciones y revisión pendiente

- No arrancar esta versión contra la biblioteca personal para validar S1. Solo se ejecutaron bases TEST.
- Export público permanece v9 y **no transporta progreso**; backup/restauración de progreso corresponde a S3 y está pendiente. No distribuir S1 aisladamente ni usar su backup como copia completa del progreso.
- No se probó un render visual real en navegador/dispositivo ni aceptación de teclado/lector de pantalla físico; se probó el flujo mínimo con hook-host/SQLite. La revisión externa/manual 1.9 queda pendiente, sin marcar; la UI de seguimiento y su aceptación pertenecen a S2.
- Relojes agotados fallan de forma explícita; no hay downgrade automático de SQLite v9. La copia previa es exclusivamente TEST y no reemplaza una estrategia de resguardo personal antes de una entrega futura.
- No se implementa historial, cobertura, marcas individuales, volúmenes, catálogos, rewatch/relectura ni nuevas consultas externas. Ningún episodio anterior se considera consumido por una posición.
