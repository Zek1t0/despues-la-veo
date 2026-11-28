## Why

El cursor manual registra una posición, pero no identifica las unidades consumidas ni permite medir cobertura con huecos. Una guía local y decisiones por unidad permiten seguir series y publicaciones serializadas sin inferir consumo.

## What Changes

- Identidades portables de episodios, capítulos, especiales y grupos, con guías TMDB bajo referencias de serie verificadas y unidades manuales individuales o por rango.
- Marcado y desmarcado offline, fecha de consumo opcional, selecciones múltiples y cobertura acotada a evidencia verificable.
- Vista previa en ficha, lista dedicada por título y resúmenes compartidos en Biblioteca y Colecciones.
- Migración aditiva SQLite v10 y backup v11 con restauración conservadora y compatibilidad v1–v10.

## Capabilities

### New Capabilities

- `granular-episodic-tracking` — Identidad durable, decisiones personales, cobertura e interfaz.
- `editorial-unit-inventory` — Guías TMDB, inventarios locales y mantenimiento de unidades manuales.

### Modified Capabilities

- `personal-episodic-progress` — Independencia operativa del cursor y distinción visual frente a las marcas.
- `library-backup-integrity` — Contrato v11, remapeo y resolución de conflictos granulares.

## Impact

Afecta dominio, SQLite, snapshots, adaptador TMDB, ficha, ruta de unidades, Biblioteca, Colecciones y respaldo desde Ajustes. Las entradas manuales de títulos conservan su contrato. La gestión de unidades pertenece al inventario. La distribución depende de la portabilidad completa.

Quedan fuera rewatch, relectura, historial de eventos, calendario global, notificaciones, sincronización cloud, guías Kitsu/MangaUpdates, ampliación de gates, fusiones entre fuentes, tombstones generales de títulos y rediseño global.
