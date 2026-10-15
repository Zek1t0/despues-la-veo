## Why

DespuésLaVeo ya separa identidad local y referencias externas; este milestone amplía el dominio movie/TV para representar audiovisual, cómics y literatura y probarlo con datos sintéticos. MangaUpdates es la segunda fuente elegida para demostrar Manga/Manhwa/Manhua en plataformas elegibles, con evaluación CONDITIONAL GO y disponibilidad real separada de la capacidad del dominio local.

## What Changes

- **BREAKING interno:** reemplazar `SavedTitle.type` por `medium`, `contentFamily` y `primaryFormat`, independientes de namespaces y etiquetas visibles. Incluir audiovisual, comic y literature; familias anime, manga, manhwa, manhua o null; formatos pequeños, nullable y sin inferencias heurísticas.
- **BREAKING de persistencia:** SQLite v4 → v5 y backup v5 → v6. Convertir movie/TV históricos sin inferir anime, conservando identidad, datos personales, referencias, pins, timestamps y preferencias. Mantener importación v1–v5 con validación histórica seguida de conversión.
- Evolucionar snapshots, mappers TMDB, materialización y consumidores locales; distinguir `voteAverage` no suministrado de null suministrado, preservando su propiedad TMDB. No crear almacenamiento universal de ratings.
- Hacer el refresh de clasificación monotónico: medio igual obligatorio; familia/formato conocidos se conservan ante null o discrepancia no-null y los desconocidos pueden refinarse. Backup v6 restaura estado local y conserva null explícito elegible; namespaces externos no son autoridad de primaryFormat.
- Adaptar Biblioteca, Etiquetas y detalle local con filtros predicativos, labels de clasificación y estado según medio, sin rediseño visual ni cambio de tokens personales.
- Preparar Buscar para una categoría/fuente activa, resolución explícita y rechazo de respuestas obsoletas por categoría/source/query/sequence/retry y configuración pertinente. Películas y Series usan TMDB; Manga, Manhwa y Manhua usan MangaUpdates únicamente donde la elegibilidad y el transporte real estén validados. Las categorías, no las marcas de proveedores, son la navegación principal.
- Entregar inmediatamente una revisión de desarrollo aislada con fixtures sintéticas: resultado → detalle → guardado genérico → Biblioteca → detalle local → refresh → backup v6/import. No usar un proveedor mock en datos de producción.
- Conservar `rating-desc` como orden TMDB por voteAverage y label Puntuación TMDB; no convertirlo en orden personal o universal. Los backups sintéticos se identifican como TEST y el harness los restaura únicamente en su segunda base aislada, sin reglas especiales para fixture-review en el importer productivo.
- Entregar el vertical Manga/Manhwa/Manhua de MangaUpdates: search → resultado neutral → `/mangaupdates/series/[id]` → snapshot → guardado/refresh genérico → detalle local y backup v6. Referencia `mangaupdates/series/<series_id decimal canónico>`; mapping inicial comic + familia explícita + formato null, initialTags [], voteAverage totalmente ausente. No importar demografía/categorías como géneros ni nuevos campos persistidos.
- Permitir implementación para este milestone personal, open-source y no comercial mediante términos oficiales suficientemente compatibles o autorización explícita del proveedor, con revisión documentada y uso conservador. No exigir email/permiso individual en todos los casos ni afirmar aprobación de DespuésLaVeo o certeza legal; restricciones materiales incompatibles bloquean el uso afectado y silencio nunca autoriza.
- Mantener MangaUpdates oculto en Web mientras CORS impida transporte directo; Web conserva categorías productivas utilizables y el harness neutral. Validar cada plataforma nativa que se habilite, sin afirmar iOS probado desde Windows. No añadir proxy/backend ni falsificar Origin. Portadas remotas HTTPS permitidas o null, sin descarga permanente ni binarios en backups.

No incluye proveedor anime, literatura/Novel mediante MangaUpdates, Open Library/libros, creación manual local, protocolos comunitarios, lectura/progreso, episodios/capítulos/volúmenes, rewatch/reread, pausado, relaciones/timeline, recomendaciones, cuentas/sync, equivalencia/linking/fusión/prioridad de fuentes, registry, rutas o detalles remotos universales, créditos/disponibilidad universales, ratings externos generalizados, normalización de puntuaciones, precisión webtoon/one-shot, autores/publicación ni cambios de dependencias. La taxonomía y las fixtures anime/literature permanecen; no representan entrega de proveedores para esos catálogos.

## Capabilities

### New Capabilities

- `expanded-media-domain`: clasificación local separada, compatibilidad, SQLite v5, presentación local y estado según medio.
- `provider-neutral-media-review`: recorrido sintético manual y automatizado aislado que consume contratos, materialización y persistencia reales sin constituir una fuente de producción.
- `second-provider-discovery`: categorías explícitas, elegibilidad por políticas oficiales suficientes o autorización y vertical MangaUpdates Manga/Manhwa/Manhua condicionado a disponibilidad por plataforma.

### Modified Capabilities

- `provider-abstraction`: nueva clasificación portable, suministro opcional del campo legacy TMDB, búsqueda por categoría sin registry y preservación de materialización genérica.
- `library-backup-integrity`: exportación v6, importación v1–v6, conversión histórica y conflictos de clasificación sin alterar identidad/merge/pins/Appearance.
- `customizable-browsing-views`: filtros no mutuamente excluyentes y labels españoles según medio, conservando orden, vistas, pins y accesibilidad.

## Impact

Capas afectadas: `src/core`, contratos de proveedor, mappers/compatibilidad TMDB, `src/storage`, browsing, Biblioteca, Buscar, Etiquetas, `/title/[id]`, guardado desde `/tmdb/[type]/[id]` y Ajustes. La fase real añade integración específica `src/providers/mangaupdates/`, `/mangaupdates/series/[id]` y atribución/About. TMDB conserva detalle enriquecido, credenciales y errores propios. MangaUpdates no requiere registry, modelo persistido nuevo, migración adicional ni backup v7.

La revisión es sobre la rama de trabajo actual, sin asumir main. Esta propuesta solo crea artefactos del change; APPLY no debe modificar `package.json`, sus scripts personales android/ios ni ejecutar Git. No se prevén dependencias nuevas ni backend.

Riesgos principales: regresión de migraciones/foreign keys y contratos históricos, compatibilidad taxonómica en merge, borrado accidental de `voteAverage` por refresh, contaminación por fixtures, CORS y cambios de condiciones del proveedor. El diseño mantiene comprobaciones de preservación, contratos históricos separados, aislamiento físico de revisión y exposición por plataforma elegible.

Reversión: fallo de migración revierte la transacción sin publicar v5; una base v5 confirmada no se abre con una app v4. Antes del rollout se conserva backup v5/base v4 de prueba; volver a la app anterior requiere restaurar esa copia, sin degradar datos nuevos. Backup v6 sigue siendo preservable para una versión compatible.

La exploración del 2026-10-11 verificó API oficial pública, search/detail sin credenciales, atribución, caché y espaciado razonable requeridos. Observó 403 con Origin externo/preflight y éxito con el origen permitido de MangaUpdates. El design registra evidencia, incertidumbres de retención/backups/uso comercial y portadas, y política de elegibilidad del desarrollo conservador; no afirma autorización expresa del proveedor. Antes de una release materialmente más amplia/comercial se revisan nuevamente términos y derechos pendientes.

El cierre requiere dominio local expandido, SQLite v5/backup v6, categorías finitas, revisión sintética y vertical MangaUpdates real en plataformas nativas elegibles validadas, con Web honesto sobre CORS. No exige anime ni MangaUpdates Web mientras su transporte esté bloqueado. Anime dedicado, Open Library, manual local, ExternalRating, extensiones comunitarias y lectura/progreso quedan como roadmap no bloqueante, sin tareas de implementación en este change.
