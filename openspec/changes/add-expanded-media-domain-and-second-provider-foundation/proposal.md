## Why

DespuésLaVeo ya separa identidad local y referencias externas, pero su clasificación movie/TV impide guardar correctamente OVA, manga, manhwa y literatura. El siguiente milestone necesita un dominio portable y un recorrido revisable con datos sintéticos antes de habilitar un segundo proveedor cuya elegibilidad todavía no está confirmada.

## What Changes

- **BREAKING interno:** reemplazar `SavedTitle.type` por `medium`, `contentFamily` y `primaryFormat`, independientes de namespaces y etiquetas visibles. Incluir audiovisual, comic y literature; familias anime, manga, manhwa, manhua o null; formatos pequeños, nullable y sin inferencias heurísticas.
- **BREAKING de persistencia:** SQLite v4 → v5 y backup v5 → v6. Convertir movie/TV históricos sin inferir anime, conservando identidad, datos personales, referencias, pins, timestamps y preferencias. Mantener importación v1–v5 con validación histórica seguida de conversión.
- Evolucionar snapshots, mappers TMDB, materialización y consumidores locales; distinguir `voteAverage` no suministrado de null suministrado, preservando su propiedad TMDB. No crear almacenamiento universal de ratings.
- Hacer el refresh de clasificación monotónico: medio igual obligatorio; familia/formato conocidos se conservan ante null o discrepancia no-null y los desconocidos pueden refinarse. Backup v6 restaura estado local y conserva null explícito elegible; namespaces externos no son autoridad de primaryFormat.
- Adaptar Biblioteca, Etiquetas y detalle local con filtros predicativos, labels de clasificación y estado según medio, sin rediseño visual ni cambio de tokens personales.
- Preparar Buscar para una categoría/fuente activa, resolución explícita y rechazo de respuestas obsoletas por categoría. Mantener la experiencia TMDB actual; categorías reales nuevas permanecen invisibles en producción hasta aprobación y disponibilidad de su fuente.
- Entregar inmediatamente una revisión de desarrollo aislada con fixtures sintéticas: resultado → detalle → guardado genérico → Biblioteca → detalle local → refresh → backup v6/import. No usar un proveedor mock en datos de producción.
- Conservar `rating-desc` como orden TMDB por voteAverage y label Puntuación TMDB; no convertirlo en orden personal o universal. Los backups sintéticos se identifican como TEST y el harness los restaura únicamente en su segunda base aislada, sin reglas especiales para fixture-review en el importer productivo.
- Tras resolver el gate externo, entregar adaptador real y verticales anime y manga/familias adyacentes admitidas por el mismo proveedor aprobado. Esta fase forma parte del alcance, pero sus tareas permanecen explícitamente bloqueadas.

No incluye progreso, episodios/capítulos/volúmenes, rewatch/reread, pausado, relaciones/timeline, recomendaciones, cuentas/sync, equivalencia/linking/fusión/prioridad de fuentes, registry, rutas o detalles remotos universales, créditos/disponibilidad universales, ratings externos generalizados, normalización de puntuaciones, proveedores adicionales para libros/cómics ni cambios de dependencias.

## Capabilities

### New Capabilities

- `expanded-media-domain`: clasificación local separada, compatibilidad, SQLite v5, presentación local y estado según medio.
- `provider-neutral-media-review`: recorrido sintético manual y automatizado aislado que consume contratos, materialización y persistencia reales sin constituir una fuente de producción.
- `second-provider-discovery`: categorías de búsqueda explícitas, gate de elegibilidad y verticales reales condicionados a selección autorizada.

### Modified Capabilities

- `provider-abstraction`: nueva clasificación portable, suministro opcional del campo legacy TMDB, búsqueda por categoría sin registry y preservación de materialización genérica.
- `library-backup-integrity`: exportación v6, importación v1–v6, conversión histórica y conflictos de clasificación sin alterar identidad/merge/pins/Appearance.
- `customizable-browsing-views`: filtros no mutuamente excluyentes y labels españoles según medio, conservando orden, vistas, pins y accesibilidad.

## Impact

Capas afectadas: `src/core`, `src/providers/providerContracts.ts`, mappers/compatibilidad TMDB, `src/storage`, componentes de browsing, Biblioteca, Buscar, Etiquetas, `/title/[id]`, guardado desde `/tmdb/[type]/[id]` y exportación/importación en Ajustes. El detalle enriquecido, credenciales y atribución TMDB permanecen específicos. Rutas, configuración y atribución del segundo proveedor se concretan solo después del gate.

La revisión es sobre la rama de trabajo actual, sin asumir main. Esta propuesta solo crea artefactos del change; APPLY no debe modificar `package.json`, sus scripts personales android/ios ni ejecutar Git. No se prevén dependencias nuevas ni backend.

Riesgos principales: migración con foreign keys, tipos históricos acoplados a `SavedTitle`, merge que hoy compara `type`, borrado accidental de `voteAverage` por refresh y contaminación de la biblioteca mediante fixtures. El diseño exige transacciones, comprobaciones de preservación, separación de contratos históricos y aislamiento físico de revisión.

Reversión: fallo de migración revierte la transacción sin publicar v5; una base v5 confirmada no se abre con una app v4. Antes del rollout se conserva backup v5/base v4 de prueba; volver a la app anterior requiere restaurar esa copia, sin degradar datos nuevos. Backup v6 sigue siendo preservable para una versión compatible.

Selección pendiente según la decisión de producto de esta sesión: Kitsu necesita API terms; MAL necesita verificación primaria de uso/storage/export; AniList está indisponible salvo permiso expreso; MangaBaka necesita aclaración de licencias/procedencia upstream. Ninguno está aprobado ni hardcodeado. La ausencia de elección no bloquea revisión ni las secciones 1–5; sí bloquea las secciones 6–8 y el cierre completo del milestone.
