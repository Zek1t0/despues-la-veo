# Cierre administrativo del seguimiento granular

27 de noviembre de 2026. Rama `feat/granular-episodic-tracking`. HEAD `8a3701410ecbf68b7ade5de11c9b1f81909c77a3`, verificado en origin. El árbol y el índice estaban limpios al iniciar. La revisión externa informó aprobados S1–S5, incluidas las correcciones de accesibilidad de S5.

| Checkpoint | Commit | Alcance |
| --- | --- | --- |
| S1 | `2e3ea6f` | SQLite v10, identidad portable, decisiones y transacciones |
| S2 | `d9db948` | Inventario TMDB y manual, vigencia y caché offline |
| S3 | `67f2a70` | Interfaz virtualizada, selección y cobertura acreditada |
| S4 | `01e46ea` | Backup v11, remapeo, restauración y conflictos explícitos con revalidación |
| S5 | `8a37014` | Regresión integral y correcciones de Escape, foco y escritura en curso |

## Tareas y validación

**22 de 24 completas.** Se cerró 5.3 con la aprobación externa, el checkpoint publicado y la evidencia de validación. Permanecen abiertas 2.3, verificación real TMDB, y 5.2, aceptación integral de plataformas y accesibilidad.

Se preservaron los [informes S1–S5](../../../../docs/testing/granular-episodic-tracking/) con las suites SQLite TEST, 33 regresiones históricas, cinco suites TMDB con fixtures, TypeScript, build Web y Chrome TEST. El informe S5 distingue la observación de Escape anterior a la corrección del resultado verificado después. El cierre documental no requirió repetir las suites de aplicación.

OpenSpec estricto validó el change activo antes del traslado y las 30 specs principales sincronizadas. Se compararon los bloques de los cuatro deltas con las specs resultantes y los escenarios históricos con el checkpoint. Se conservaron todos los escenarios históricos y quedaron intactos los 41 requisitos ajenos a los deltas en las dos specs existentes. Los ocho artefactos trasladados se verificaron por SHA-256 inmediatamente antes y después de moverlos. El listado final de changes activos quedó vacío.

## Contratos sincronizados

| Capacidad | Requisitos añadidos | Requisitos modificados | Escenarios en los bloques añadidos / modificados |
| --- | ---: | ---: | ---: |
| `editorial-unit-inventory` | 4 | 0 | 11 / 0 |
| `granular-episodic-tracking` | 5 | 0 | 17 / 0 |
| `library-backup-integrity` | 3 | 9 | 9 / 34 |
| `personal-episodic-progress` | 1 | 4 | 1 / 9 |
| Total | 13 | 13 | 38 / 43 |

Los 13 bloques modificados incluyen escenarios históricos conservados. La nota introductoria de backup establece v11 como único formato vigente de exportación y conserva los contratos históricos de importación v1–v10. SQLite sigue en v10. Los deltas archivados conservan el detalle normativo completo.

## Excepciones y riesgos

- TMDB en runtime queda pendiente por falta de credencial TEST autorizada. Faltan endpoints desplegados, alcance de `episode_count`, T0 real, completitud, campos opcionales, fechas y CORS. Las guías de producción conservan parcialidad mientras falte acreditación.
- Quedan pendientes Android físico, TalkBack, lectores de pantalla y ajuste real de fuente al 200 %. La evidencia Web a escala doble es una simulación.
- El arranque en frío de Metro quedó bloqueado sin red. La pestaña cargada y la reapertura SQLite se comprobaron por separado. El arranque offline de un bundle instalado queda pendiente.
- Si existen referencias editoriales disputadas, se conserva el alcance inequívoco con aviso. Si no se puede identificar un alcance, queda fuera del selector. El backup no reconstruye acreditación editorial.
- El proyecto carece de tombstones generales de títulos. Un backup antiguo puede recrear un título eliminado conforme al contrato histórico.
- El cierre administrativo queda disponible para revisión externa y commit manual. La distribución sigue sujeta a la aceptación pendiente.

## Inventario desde S5

- Specs nuevas · `openspec/specs/editorial-unit-inventory/spec.md` y `openspec/specs/granular-episodic-tracking/spec.md`.
- Specs modificadas · `openspec/specs/library-backup-integrity/spec.md` y `openspec/specs/personal-episodic-progress/spec.md`.
- Evidencia modificada · `docs/testing/granular-episodic-tracking/s5-validation.md`.
- Ocho traslados desde el directorio activo a este archive · `.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md`, `specs/editorial-unit-inventory/spec.md`, `specs/granular-episodic-tracking/spec.md`, `specs/library-backup-integrity/spec.md` y `specs/personal-episodic-progress/spec.md`. Solo `tasks.md` recibió un cambio de contenido antes del traslado.
- Nuevo informe · `closure-report.md`.

Sin staging, Git representa los traslados como ocho eliminaciones y ocho archivos nuevos. El índice sigue vacío.
