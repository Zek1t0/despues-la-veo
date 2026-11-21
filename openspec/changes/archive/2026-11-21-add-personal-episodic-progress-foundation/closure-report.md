# Cierre administrativo — fundación de progreso personal

Fecha: 2026-11-21, America/Buenos_Aires. Change: add-personal-episodic-progress-foundation. Esquema: spec-driven.

## Autorización y preflight

El usuario solicitó expresamente sincronizar y archivar el change con las excepciones documentadas, conservando cinco tareas abiertas. Esta autorización permite el cierre administrativo con advertencias; no convierte aceptaciones no ejecutadas en pruebas superadas ni declara completadas todas las tareas. La solicitud actual de cierre sustituye únicamente la prohibición histórica de archive automático en las etapas de implementación; los artefactos originales se conservan sin reescribir su historia.

Rama: feat/personal-episodic-progress-foundation. HEAD S4: 7ec17dc0f86d49a7f965b64b50d5f68cf6a4abc8, confirmado en origin por git ls-remote. Árbol e índice inicialmente limpios. Checkpoints técnicos publicados y presentes en la cadena: S1 62e6c0f, S2 9bf0eb2, S3 54840fa, S4 7ec17dc. Se informó revisión externa por el usuario. Publicación técnica y revisión informada no acreditan Android o accesibilidad física.

Al iniciar había un único change activo, el indicado, todavía sin archive. Se comprobaron sus siete archivos originales: .openspec.yaml, proposal.md, design.md, tasks.md y tres deltas. Todos los artefactos del grafo estaban done. Los informes y resultados de validación se conservan en docs/testing/personal-episodic-progress; no se trasladan ni sobrescriben.

## Estado final de tareas: 24/29

Se conserva tasks.md byte por byte. Permanecen abiertas, por criterios distintos:

| Tarea | Criterio exacto resumido y estado de la evidencia |
| --- | --- |
| 1.9 | Revisión del diff S1, comandos TypeScript/pruebas y registro del checkpoint. Checkpoint técnico publicado e informes existentes; la casilla administrativa original no se marca durante este cierre. No es una tarea de aceptación Android. |
| 2.6 | Checkpoint S2 y recorrido Web/Android, temas, 320 px, fuente 200 %, teclado/foco/lector, scroll, carga/error y reinicio offline. Hay pruebas y revisión Web parciales; no existe evidencia suficiente de todas las aceptaciones físicas. |
| 3.9 | Checkpoint S3, exportar/restaurar/reimportar Web/Android sin red, conflicto, reexport y v9 histórico. Hay SQLite TEST, hook-host y revisión Web; Android y parte del recorrido offline real continúan sin ejecución. |
| 4.2 | Aceptación E2E completa de plataformas, superficies, temas, accesibilidad y funcionamiento sin conexión. Cobertura automatizada amplia y Web parcial no reemplazan esa aceptación. |
| 4.5 | Revisión externa/checkpoint final y trazabilidad S1–S4 con validaciones. S4 está publicada y el usuario informa revisión externa; se mantiene la casilla pendiente sin certificar automáticamente el criterio completo. |

Las otras 24 tareas permanecen completas según los informes originales. No se crean checks artificiales ni se cambia su redacción. La advertencia de cinco tareas incompletas se acepta únicamente para este archive administrativo.

## Evidencia técnica conservada

- SQLite v9 y progreso personal independiente; dominio estricto, cuatro numeraciones, reset fechado, concurrencia y publicación poscommit.
- Mi progreso, edición y resúmenes de Biblioteca/Colecciones revisados en Web; temas y ancho de 320 px comprobados parcialmente.
- Backup v10 con importación v1–v10, remapeo portable, política conservadora, informe temporal completo/exportable y aplicación explícita protegida contra versión/identidad/clasificación obsoletas.
- Restauración, round trip, tres reimportaciones e inyección de fallos con bases SQLite TEST independientes y comparación de valores/relaciones.
- S4 informa 33 suites exitosas, TypeScript, build Web final y OpenSpec estricto. Dos fallos históricos reproducidos antes del change y corregidos en pruebas, sin debilitar el contrato.
- EPERM reproducido durante mkdir de dist/s3-web/_expo/static al persistir assets de Expo. Reintento y build final exitosos; es escritura de build, no exportación de datos personales. No se conoce el agente concreto del bloqueo ambiental.

Referencias desde el archive definitivo:

- [Validación S1](../../../../docs/testing/personal-episodic-progress/s1-validation.md)
- [Validación S2](../../../../docs/testing/personal-episodic-progress/s2-validation.md)
- [Validación S3](../../../../docs/testing/personal-episodic-progress/s3-validation.md)
- [Validación S4 y matriz final](../../../../docs/testing/personal-episodic-progress/s4-validation.md)
- [33 suites S4](../../../../docs/testing/personal-episodic-progress/s4-regression-results.json)
- [Diagnóstico de build](../../../../docs/testing/personal-episodic-progress/s4-build-results.json)

No se reejecutan suites de aplicación durante este cierre: no hay modificaciones de código, datos, SQLite, backup, dependencias o gates. Se validan únicamente OpenSpec, integridad documental y whitespace.

## Excepciones aceptadas y riesgos residuales

El usuario acepta para el cierre administrativo las siguientes excepciones, que permanecen sin aprobar como pruebas:

- Android físico/emulador: migración en dispositivo, persistencia, edición/incremento/reset, backup/restauración/conflictos, compartir nativo y reinicio sin red.
- TalkBack y lector de pantalla físico; la presencia de etiquetas y pruebas de componentes no acredita aceptación física.
- Verificación visual completa con fuente al 200 %; fontScale 1/2 en harnesses no equivale a esa aceptación.
- Arranque real del bundle Web offline. La recarga y persistencia SQLite probadas, y la desconexión de la fuente sintética en memoria, no acreditan ese arranque.
- Recorrido manual completo de todas las superficies, incluidos Mosaico y Colecciones, donde los informes distinguen regresión de componentes de aceptación manual.

El cierre administrativo no rebaja los requisitos de las specs, no constituye certificación de accesibilidad/plataformas y no promete cobertura completa. El informe temporal se pierde al salir si no se exporta; sus candidatos pendientes nunca se aplican solos. No existen tombstones generales: restaurar backups antiguos puede recuperar títulos, colecciones o relaciones borrados. Reset de progreso es una decisión vacía fechada propia, no un historial universal de borrado. No se promete downgrade de SQLite v9/backup v10.

La última posición manual NO acredita consumo individual de episodios o capítulos anteriores, cobertura, fecha de consumo, temporadas completas o ciclos de rewatch/relectura. Episodio 24 no marca 1–24 como vistos. El seguimiento granular avanzado sigue fuera de este change. No se habilitan proveedores ni gates y no se introduce sincronización cloud.

## Sincronización y validación

Se aplicó una sola sincronización semántica de los tres deltas autorizados. Se consultaron una vez las instrucciones vigentes de specs y se preservaron los requisitos/escenarios históricos no afectados y los Purpose existentes.

| Spec principal | Cambio |
| --- | --- |
| personal-episodic-progress | Nueva spec con Purpose del delta, 7 requisitos y 16 escenarios |
| library-backup-integrity | 4 requisitos nuevos, 1 modificado; 9 escenarios nuevos y 1 actualizado. Nota introductoria: formato vigente v10; v1–v9 históricos. |
| manual-content-entries | 1 requisito modificado; 2 escenarios nuevos y 1 actualizado, con el resto intacto |

Total: 11 requisitos nuevos y 2 modificados, 27 escenarios nuevos y 2 actualizados. Sin operaciones REMOVED/RENAMED. Conservados contratos de Biblioteca, Colecciones e Inbox, identidad, preferencias, metadata y actividad histórica. Las specs principales tienen un único bloque Requirements y no contienen cabeceras operativas de delta.

Antes del archive pasaron openspec validate --specs --strict --no-interactive (28 specs, cero fallos) y la validación estricta del change. Se verificará que cada delta esté completamente reflejado y los bloques ajenos permanezcan intactos antes de mover el directorio. El archive usará --skip-specs para evitar una segunda sincronización y --yes conforme a la autorización expresa del usuario, sin deshabilitar validaciones.

## Integridad de originales y evidencia

Las huellas SHA-256 de archivos originales y evidencia publicadas se añaden abajo antes del archive. Permiten comprobar preservación exacta tras el traslado, incluida .openspec.yaml. Los informes de pruebas mantienen su ubicación; el archive conserva estas referencias y el informe de cierre.

## Resultado definitivo y revisión externa

Archive definitivo: openspec/changes/archive/2026-11-21-add-personal-episodic-progress-foundation/.

El CLI completó openspec archive add-personal-episodic-progress-foundation --skip-specs --yes con validación habilitada. Informó cinco tareas incompletas y una recomendación no bloqueante de dividir propuestas con más de diez deltas; se conserva la advertencia sin cambiar el alcance aprobado. --skip-specs evitó una segunda escritura de specs. Los siete originales y las seis referencias de evidencia de la tabla de huellas se verificaron después del traslado, sin diferencias SHA-256. La representación de los siete originales también coincide con el checkpoint S4, incluida la lista de tareas sin cambios.

Validaciones posteriores: openspec validate --all --strict --no-interactive pasó con 28 specs y cero fallos; openspec list --json devolvió changes vacío. Los tres deltas siguen reflejados íntegramente en las specs principales, sin requisitos duplicados ni operaciones de delta en main. El contenido archivado es exactamente el del change validado estrictamente antes de moverlo. Whitespace revisado tanto en el diff rastreado como en cada archivo nuevo/trasladado.

Estado Git final: mismo HEAD 7ec17dc, índice vacío y cambios exclusivamente bajo openspec/. Ninguna modificación de aplicación, SQLite, backup, dependencias, gates, evidencia publicada u otros changes. No se volvieron a ejecutar suites de aplicación. Listo para revisión externa del cierre y commit manual; ninguna integración en main ni archive adicional.

Inventario lógico completo desde S4:

| Operación | Archivo relativo |
| --- | --- |
| Modificado | openspec/specs/library-backup-integrity/spec.md |
| Modificado | openspec/specs/manual-content-entries/spec.md |
| Nuevo | openspec/specs/personal-episodic-progress/spec.md |
| Nuevo | openspec/changes/archive/2026-11-21-add-personal-episodic-progress-foundation/closure-report.md |

Siete traslados íntegros desde openspec/changes/add-personal-episodic-progress-foundation/ hacia el archive definitivo, conservando los siguientes sufijos:

- .openspec.yaml
- proposal.md
- design.md
- tasks.md
- specs/library-backup-integrity/spec.md
- specs/manual-content-entries/spec.md
- specs/personal-episodic-progress/spec.md

Son once archivos lógicos: siete trasladados, dos specs modificadas y dos nuevos. Sin staging, Git muestra los traslados como siete eliminaciones del directorio activo y siete archivos no rastreados en archive; las huellas verificadas demuestran que no se perdió contenido. El informe de cierre se conserva junto a los originales sin sustituirlos.

| Archivo relativo | SHA-256 |
| --- | --- |
| .openspec.yaml | 7cce64d2c3b8e65d1a3f8d66d31ed92a02b622d6acc027e344d6658d017cf7d8 |
| proposal.md | ebcba41b709d317bcbe396fa21d8c4ece7a3401d03eb69848bbd62b30d8b7e44 |
| design.md | da7c77393ef6f341664313ff8b2eb940dca2bc0b759b3757678ff062b24b8b7b |
| tasks.md | a20a1f63ea8bd5d3e38b08d17eb7a5196e95e3e5983b1b00b2a785f69ffa08ec |
| specs/library-backup-integrity/spec.md | 526c9daeb9e92741604ccde47f010ffc7ec3915104043a44fdde9c40e0f4c4b7 |
| specs/manual-content-entries/spec.md | eb99aaf9dd71233520122c41dc264c22f010580ef0647070b6e4f679f8c8563a |
| specs/personal-episodic-progress/spec.md | 1a07434b478241e5b220929a9e5e593361aab91fe4c4a50f1c75825b2a165def |
| docs/testing/personal-episodic-progress/s1-validation.md | 6e081886cf74480a9e1feab6162d7b00c63b2291692033ba37560917427d317a |
| docs/testing/personal-episodic-progress/s2-validation.md | 3f0f39aaa9ae42881c4792320f41d04f1120232ac027139f496094c761cb2ec0 |
| docs/testing/personal-episodic-progress/s3-validation.md | d7c5cdcfd49d2dd61d98184a03e3570577c22d9e99813a042d3ecb538fa2dedb |
| docs/testing/personal-episodic-progress/s4-validation.md | 20f4a6ca22b66f59395af956280250f854a617d679a34af0fee2b81c2bead951 |
| docs/testing/personal-episodic-progress/s4-regression-results.json | 7e6629eff0b0b9bbc368317c9868fd0cbd8f420c5e5037f14bfdbf88b50537c5 |
| docs/testing/personal-episodic-progress/s4-build-results.json | 6d0c57a52eacdb23f084398a70159dc8526bf66d366cba7a13e99b243ee3bb51 |
