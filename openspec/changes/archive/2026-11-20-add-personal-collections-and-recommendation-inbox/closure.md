# Cierre administrativo con excepciones aceptadas

Fecha: 2026-11-20. Change: `add-personal-collections-and-recommendation-inbox`. Schema: spec-driven.

## Autorización y preflight

El usuario solicitó explícitamente sincronizar los tres deltas, validar y archivar con las excepciones conocidas de aceptación. Este cierre no certifica Android ni una restauración completa en runtimes reales. No se modifican casillas de tareas para obtener un archivo exitoso.

- Rama: `feat/personal-collections-recommendation-inbox`.
- HEAD/checkpoint S3: `26b96e80ad98ba347f17059eaee923239aef9f0b` (`test: verify collection and inbox backup integrity`).
- Checkpoint S2: `99144ede296a5694ad6dfdce34e2080d7abdaa5b`.
- Checkpoint S1: `78a955ab14c764dca77d1fb18d17cf116436b7d4`.
- Worktree e índice iniciales limpios. Origin confirmó directamente el mismo HEAD para la rama. La primera consulta de red falló por DNS del sandbox; la consulta de solo lectura autorizada tuvo éxito. No se hizo fetch ni se cambiaron referencias.
- Change activo antes de comenzar; proposal, design, tasks y los tres deltas presentes y completos como artefactos. La completitud de artefactos no implica completar las tareas de aceptación.
- Validación estricta del change antes de escribir: PASS.

## Evidencia por procedencia

| Procedencia | Evidencia y alcance |
| --- | --- |
| Informada por el usuario en el pedido de cierre | S1: interfaz de Colecciones revisada visualmente en Web |
| Informada por el usuario en el pedido de cierre | S2: flujo Web probado, incluyendo captura, duplicados, coincidencias, incorporación, estados y eliminación de un título vinculado |
| Informada por el usuario en el pedido de cierre | Backup v9 real exportado y revisado estructuralmente; no se atribuye a Codex una inspección nueva de ese archivo ni una restauración en runtime |
| Ejecutada por Codex en los checkpoints, conservada sin reejecución en este cierre | S3: 17/17 suites exitosas, SQLite TEST, matrices de migración/identidad/conflictos, round trip v9, reintentos y fallos inyectados; evidencia en `docs/testing/personal-collections-recommendation-inbox/s3-results.json` y `s3-validation.md` |
| Ejecutada por Codex en los checkpoints | TypeScript, build Web y pruebas focalizadas; harness de componentes/hooks no equivale a aceptación visual de navegador ni Android físico |
| Ejecutada por Codex en este cierre | Comprobaciones Git/OpenSpec, merge de specs, validación estricta, comparación de requisitos/escenarios, preservación de artefactos/evidencia y scope documental |

Los informes de S1/S2/S3 conservan lo observado por Codex en sus fechas de ejecución, incluidas limitaciones de control del navegador. La aceptación Web posterior informada por el usuario complementa esa evidencia; no convierte los intentos fallidos de Codex en pruebas manuales exitosas.

## Tareas y excepciones vigentes

11/15 completas; cuatro tareas permanecen sin marcar en tasks.md:

| Tarea | Realizado | Excepción conservada |
| --- | --- | --- |
| 1.5 | Interfaz Web S1 revisada por el usuario; pruebas técnicas de Colecciones | Falta completar aceptación Android/Web extensa, accesibilidad, teclado/safe areas y restauración real según el recorrido |
| 2.5 | Flujo funcional Web S2 informado por el usuario; pruebas técnicas de Inbox | Falta Android físico y aceptación extensa de fuentes/gates productivos, accesibilidad y restauración de plataforma |
| 3.4 | Fallos, rollback, serialización, integridad y round trip sobre SQLite Node TEST | No se verificaron completamente los runtimes SQLite Android/Web de extremo a extremo |
| 3.5 | Matrices automatizadas y guía de aceptación conjunta preparadas | Falta recorrido manual profundo de restauración, conflictos, accesibilidad y recuperación en ambas plataformas |

El usuario acepta estas excepciones para el cierre administrativo. No se registran como realizadas y las casillas se conservan exactamente. No se ejecutó Android físico. No se inventan resultados de TalkBack, lectores, permisos/diálogos ni restauración real. El archive conserva esta advertencia y la guía pendiente de `s3-validation.md`.

## Sincronización a las specs principales

Se usaron exclusivamente los tres deltas que devolvió `openspec status`, con una sola consulta válida a `openspec instructions specs`. El merge se realizó inline y terminó antes de mover el change.

- `personal-collections`: nueva spec principal; Purpose del delta conservado; 5 requisitos y 11 escenarios.
- `recommendation-inbox`: nueva spec principal; Purpose del delta conservado; 5 requisitos y 15 escenarios.
- `library-backup-integrity`: 4 requisitos y 10 escenarios añadidos, conservando exactamente los 39 bloques históricos de requisitos y su Purpose previo. Nota de formato vigente actualizada de v8 a v9 y contratos históricos hasta v8.
- No hay eliminaciones ni renombres de requisitos, ni escenarios descartados. Total: 14 requisitos y 36 escenarios incorporados.
- Las menciones al calendario S1/S2/S3 se expresaron como comportamiento vigente y compatibilidad: ambos destinos funcionales, v9 completo y aceptación de v9 anteriores sin Inbox. Se conserva el rechazo seguro de secciones que una versión antigua no soporte. El calendario original permanece en los deltas archivados.
- Se explicita SQLite v8 en la persistencia aditiva. Permanecen backup v9, captura original inmutable, vinculación deliberada, referencias fuertes, remapeo, updatedAt mayor/igualdad local, idempotencia, reapertura al borrar y límites sin tombstones.
- Las specs principales tienen una sección Requirements, sin encabezados de operaciones delta. No se modificaron contratos de proveedores/gates ni otras capacidades.
- Validación estricta de las 27 specs principales tras sync: 27 PASS, 0 fallos. Solo avisos INFO sobre extensión de requisitos; no se reescribieron contratos para silenciarlos.

## Archivo y validación final

Ubicación exacta: `openspec/changes/archive/2026-11-20-add-personal-collections-and-recommendation-inbox/`.

Se archiva con cuatro tareas pendientes aceptadas, sin forzar validaciones ni falsear tasks.md. La sincronización de specs se verificó antes del archive. Los siete archivos originales del change, incluida `.openspec.yaml`, conservan sus bytes; se añade únicamente este documento de cierre. La evidencia técnica de docs/testing no se mueve ni modifica.

Resultado final: archive completado por `openspec archive add-personal-collections-and-recommendation-inbox --skip-specs --yes --json` (exit 0). El flag skip-specs evita repetir el merge ya ejecutado y verificado; no se usó no-validate. La respuesta specsUpdated=false describe ese paso del CLI, no la sincronización previa, que sí se completó. Las confirmaciones se resolvieron con la autorización explícita del usuario para archivar con estas cuatro excepciones.

Validaciones finales:

- `openspec validate --all --strict --json`: 27/27 specs válidas, cero cambios activos y cero errores.
- `openspec validate archive/2026-11-20-add-personal-collections-and-recommendation-inbox --type change --strict --json`: archive válido, 1/1 y cero errores.
- Comparación de las tres capacidades: 14 requisitos y los 36 escenarios presentes una sola vez; 39 bloques históricos de backup conservados exactamente.
- Hashes de los siete artefactos originales archivados y de los 15 archivos de evidencia técnica sin cambios. tasks.md conserva 11 completas y cuatro abiertas.
- git diff --check y comprobación equivalente de todos los nuevos: sin errores de whitespace.
- Alcance: solo las tres specs principales y el directorio del change trasladado con este informe; ningún archivo de app, versión, dependencia, gate, otro change o evidencia técnica modificado. Índice vacío; HEAD sin cambios.

El resultado está listo para revisión externa del diff y commit manual, con estas excepciones visibles; no implica integración en main ni aceptación de plataformas pendientes.

## Riesgos residuales para revisión externa

- Las excepciones de plataforma y accesibilidad siguen abiertas; aprobación visual/funcional Web no certifica Android ni restauración completa en runtime.
- Merge aditivo sin tombstones: una copia antigua puede recuperar registros/membresías eliminados; ausencia no implica borrado.
- Los relojes updatedAt mantienen mayor gana/igualdad local; no constituyen causalidad distribuida.
- Captura original contradictoria, identidad incompatible o membresía contradictoria empatada se reportan sin fusión automática ni asociación al ocupante casual de un ID.
- Archivos manuales local-only v5/v6 sin identidad portable pueden generar conflictos defensivos al reimportar; no se inventa equivalencia ni se duplica por resolverlos.
- Gates, disponibilidad de fuentes y políticas de arte/sensibles conservan sus restricciones previas.

## Inventario administrativo desde el checkpoint S3

| Operación | Archivo |
| --- | --- |
| Crear | `openspec/specs/personal-collections/spec.md` |
| Crear | `openspec/specs/recommendation-inbox/spec.md` |
| Modificar | `openspec/specs/library-backup-integrity/spec.md` |
| Mover sin cambiar bytes | `.openspec.yaml` del change activo al destino archive |
| Mover sin cambiar bytes | `proposal.md` del change activo al destino archive |
| Mover sin cambiar bytes | `design.md` del change activo al destino archive |
| Mover sin cambiar bytes | `tasks.md` del change activo al destino archive |
| Mover sin cambiar bytes | `specs/personal-collections/spec.md` del change activo al destino archive |
| Mover sin cambiar bytes | `specs/recommendation-inbox/spec.md` del change activo al destino archive |
| Mover sin cambiar bytes | `specs/library-backup-integrity/spec.md` del change activo al destino archive |
| Crear | `closure.md` en el destino archive (este informe) |

No se modifica código de aplicación, SQLite, backups, versiones, dependencias, pruebas/evidencia existentes ni otros changes. HEAD y rama permanecen iguales; el resultado queda sin staging para revisión del diff y commit manual. No se ejecutan suites de aplicación durante este cierre documental.
