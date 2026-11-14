## Why

Las fichas guardadas conservan un snapshot limitado y Kitsu todavía omite arte y puntuaciones; la biblioteca pierde contexto sin conexión y no dispone de una revisión organizada de metadata. Este change propone una ficha básica enriquecida y portable, junto con Actualizaciones, manteniendo identidad, datos personales y las restricciones reales de cada proveedor.

## What Changes

- Normalizar metadata enriquecida de Kitsu: títulos e idiomas, sinopsis, imágenes por URL, puntuación pública con escala y origen, clasificación, fechas, estado editorial, episodios, duraciones, géneros/categorías, edad y advertencias; admitir desconocidos.
- Conservar metadata básica offline en SQLite y JSON portable; proponer migración aditiva SQLite v6→v7 y backup v7→v8 con imports históricos v1–v7 intactos.
- Mostrar arte y puntuaciones sobre 10 mediante componentes compartidos; distinguir puntuación personal, pública y proveedor. Preferencias de idioma con fallback local y títulos alternativos buscables.
- Actualización individual y global explícitas, más actualización automática configurable al abrir fichas desactualizadas; contenido local inmediato, cancelación, límites HTTP, resultados y preservación personal.
- Quinta pestaña inferior «Actualizaciones»: última revisión, progreso, resumen y actividad agrupada por fechas con Todos/Metadata/Mi actividad; historial local acotado.
- Filtro sensible opcional y desactivado inicialmente en búsqueda, descubrimiento existente y biblioteca, sin borrar títulos.
- No incluir descargas permanentes, gestor de imágenes, ZIP/binarios, personajes/staff/voces, relaciones avanzadas, episodios individuales, lectura/reproducción, nuevos proveedores, matching ni nube. No ampliar Kitsu en producción/iOS ni MangaUpdates en otras plataformas.

## Capabilities

### New Capabilities

- `enriched-media-metadata`: normalización, ficha básica offline, arte, puntuación pública y procedencia.
- `media-presentation-preferences`: idioma, títulos alternativos y fallback sin cambiar identidad.
- `library-metadata-refresh`: actualización individual/global/automática y protección de datos.
- `library-updates-feed`: pestaña, revisiones, actividad y retención local.
- `sensitive-content-preference`: clasificaciones honestas y filtro opcional transversal.

### Modified Capabilities

- `provider-abstraction`: ampliar la frontera portable y admitir capacidades explícitas de refresh sin universalizar endpoints ni contaminar componentes.
- `library-backup-integrity`: backup vigente enriquecido y merge independiente de metadata conservando identidad y compatibilidad histórica.

## Impact

Capas afectadas en una futura implementación: contratos/core, adaptadores y transportes existentes, materialización y repositorios SQLite, parsers/export/merge JSON, navegación Expo Router, detalle/búsqueda/biblioteca/Ajustes y componentes con tokens de temas. No se proponen dependencias nuevas. El detalle de archivos y alternativas está en design.md.

Baseline inspeccionado el 2026-11-13: rama `feat/anime-catalog-manual-entries`, HEAD `1c14377bd95c31a3240bf9846ab2272cf45c1c55`, árbol limpio antes de PROPOSE. Único change abierto previo: `add-anime-catalog-and-manual-entries`, 22/24, pendientes 3.5 y 4.4. El usuario confirmó checkpoint B4 y Kitsu Web de desarrollo; Git acredita el commit B4, no archive/sync/integración. Este diseño depende de sus contratos implementados, no de un supuesto cierre. Sus exclusiones de arte/score describen la entrega anterior: esta entrega las sucede explícitamente sin reabrir sus tareas ni satisfacer gates M/T por inferencia.

Riesgos: pérdida de campos por null/ausencia, imports que hagan parecer recientes cambios personales antiguos, carreras entre refresh/edición/borrado, y referencias de imágenes caducadas. Mitigaciones: separación de propiedad y relojes, patches validados, transacciones serializadas y fixtures históricos. Reversión: conservar copia SQLite v6 consistente y export v7 antes de migrar; rollback completo ante fallo de migración y restauración de esa copia con la versión anterior, nunca downgrade destructivo de una DB v7. Revisión externa: arquitectura y alcance aprobados conceptualmente; se mantienen SQLite v7/backup v8 y se ratifican auto-refresh inicial al abrir, intervalo 7 días configurable/desactivable, cooldown 15 minutos respetando esperas mayores, eventos 90 días/2000, revisiones 30 días/20 y 100 detalles de error por revisión con contadores completos. Esta revisión precisa proyección visible/exportable, invalidación poscommit y validación de imágenes externas; no amplía alcance ni autoriza APPLY. Las políticas son defaults propios del producto, no cuotas de proveedores.
