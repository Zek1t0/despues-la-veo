# Corrección S6 — Reloj de retención de actividad

Change: `add-enriched-media-metadata-and-library-updates`. Alcance exclusivo: corregir el reloj usado al podar actividad. **6.6 permanece pendiente. S7 no iniciada.**

## Baseline e inventario incremental

Rama `feat/anime-catalog-manual-entries`, HEAD `77e0588f9549d742215ce3a38ed4f03405d4df35`. Staging vacío. El bundle S6 estaba presente sin commit al comenzar; el diff incremental compara contra ese contenido local, no contra HEAD S5.

Producción: exactamente **dos líneas ajustadas**, una en cada archivo:

- `src/storage/libraryActivityRepo.ts`: `recordActivityWithDb` invoca `pruneLibraryActivityWithDb(db)`, que obtiene el reloj actual mediante su default `Date.now()`.
- `src/storage/mediaMetadataRepo.ts`: el escritor transaccional de metadata utiliza esa misma llamada, sin pasar su reloj histórico de modificación.

Cuatro archivos nuevos de prueba/evidencia:

- `docs/testing/enriched-media-metadata/section-6-retention-clock.cjs`.
- `docs/testing/enriched-media-metadata/section-6-retention-clock-results.json`.
- `docs/testing/enriched-media-metadata/section-6-retention-clock-validation.md` (este informe).
- `docs/testing/enriched-media-metadata/section-6-retention-clock.patch`.

Se guardaron copias de comparación y hashes en `.expo/s6-retention-clock-baseline`, ignorada por Git. Todos los archivos preexistentes salvo los dos escritores son byte a byte iguales al baseline local. Esto incluye UI, retención de runs, tareas, contratos, suites anteriores y evidencia S5/S6. No se ejecutó Git de escritura.

## Causa y recorrido revisado

El mínimo entre un evento de hace 60 días y el reloj actual desplazaba el corte de poda a hace 150 días. Un evento de hace 120 días podía sobrevivir. La retención ahora se calcula únicamente como **reloj actual de retención menos 90 días**.

`occurredAt`, la clave/identidad del evento, los relojes personales, `pinnedAt` y `metadataChangedAt` conservan sus valores originales. El máximo de 2000 eventos y el orden descendente `(occurredAt,eventId)` no cambian.

| Camino inspeccionado | Reloj/política |
| --- | --- |
| Actividad personal, altas y edición manual | Escritor compartido corregido: reloj actual, independientemente del timestamp del evento. |
| Metadata semánticamente modificada | Escritor corregido: reloj actual, conservando su reloj de modificación y procedencia. |
| Pin directo | `pinTitleWithDb` conserva `pinnedAt` y el timestamp histórico de su evento; el escritor compartido poda con reloj actual. |
| Cambio/unpin de estado de pin | Continúa conservando la semántica existente de su evento con `Date.now()`; comparte la retención corregida. |
| Lectura del feed | Ya utiliza el reloj actual de retención, con inyección explícita de reloj para pruebas. Sin cambios. |
| Exportación v8 | Ya filtra por reloj actual y limita a 2000; conserva IDs/timestamps y su comportamiento no mutante. Sin cambios. |
| Importación v8 | Ya poda respecto de `Date.now()` y limita a 2000 tras el merge; conserva identidad/remap/deduplicación. Sin cambios. |
| Revisiones globales | Política independiente 30 días/20. Archivo y comportamiento sin cambios. |

La poda continúa dentro de la transacción de la escritura. No se agregan timers, dependencias, consultas a proveedores ni modificaciones de SQLite v7, backup v8 o contratos portables.

## Regresión nueva

Reproducción: `node docs/testing/enriched-media-metadata/section-6-retention-clock.cjs`.

**21 grupos aprobados**, con SQLite real aislado en archivos temporales y reloj actual controlado. Se inspeccionan las filas crudas inmediatamente después del escritor, antes de leer el feed, para que la poda de lectura no oculte el defecto.

- Cuatro escritores: actividad compartida, metadata, pin directo y cambio de estado del pin.
- Para cada uno: operación histórica de hace 60 días, timestamp futuro y límite exacto de 90 días. Un evento de hace 120 días y uno anterior por 1 ms al corte son eliminados en esa misma operación; los eventos de 60 y exactamente 90 días permanecen.
- El timestamp original de la operación se conserva, incluido el futuro. Se comprueban por separado los relojes históricos de metadata y pins.
- Los cuatro escritores mantienen el máximo de 2000 y el desempate determinista por ID.
- Rollback después de ejecutar la poda restaura eventos, datos y pins; no publica actividad falsa ni filtra una marca revertida a una lectura posterior.
- Comparación completa de las columnas personales de todos los títulos antes/después: notas, tags, estado, rating, createdAt y updatedAt sin modificaciones de retención.
- Lectura, exportación, parse/import v8 y reimportación: corte actual, timestamps e identidades preservados, deduplicación y datos personales intactos. Exportar sigue filtrando sin mutar el historial fuente.

No se usó la base personal, HTTP real ni UI. No se afirma aceptación visual o validación de dispositivo.

## Resultados exactos

Registro completo: `section-6-retention-clock-results.json`.

**13/14 comprobaciones correctas; un fallo de baseline registrado por separado.**

- Nueva regresión de reloj: correcta.
- Seis suites S6 existentes (actividad, retención, tabs, cabecera/run, feed, servicio): correctas.
- Backups S2/S3 y coordinador S5: correctos.
- `npx tsc --noEmit`: exit 0.
- `openspec validate add-enriched-media-metadata-and-library-updates --strict`: exit 0.
- `git diff --check`: exit 0. También se verifica UTF-8 y whitespace de los archivos incrementales.

### Baseline 53/54

`tmdb-user-credential/section-2-verification.cjs` conserva exit 1: detecta un nombre de variable legacy en el log Metro de `section-5-checks.json`. Se confirmó que el identificador está en el artefacto committeado en HEAD y que tanto el artefacto como el escáner están intactos. No se borró evidencia ni se alteró el change anterior para ocultarlo.

La coincidencia corresponde al nombre de la variable en una línea de exportación de nombres, no a un valor de credencial mostrado en esa línea. La corrección no introduce logging, lecturas de credenciales ni nuevos caminos de red; no se identificó una consecuencia nueva de seguridad en este alcance. Esto no constituye una auditoría general de secretos del proyecto.

El patch incluye solamente las dos líneas de runtime y la nueva regresión. Informe y resultados se entregan por separado para evitar mezclar el bundle S6 anterior o generar un patch autorreferente.

**Estado:** 36/46 tareas completas, sin cambios administrativos; 6.6 pendiente. Sin UI modificada, sin checkpoint Git y sin trabajo S7.
