## Why

El dominio ya representa anime y sus formatos, pero no permite crear contenido manual desde la interfaz ni buscar en un catálogo dedicado de anime. Los manuales nuevos necesitan una identidad portable explícita: el exportador v6 exige referencia externa o identidad histórica y el ID local por sí solo no permite reimportación segura tras colisiones.

## What Changes

Decisión actualizada del usuario, 2026-11-13: habilitar API viva `https://kitsu.io/api/edge`
solo en desarrollo local Web/Android dentro de Buscar normal, con guardado individual
y detalle offline, sin MediaReview obligatorio. Esta autorización técnica no acredita
derechos externos; release público sigue cerrado por M/T pendientes, arte omitido.
Las referencias históricas siguientes a activación condicionada aplican al release.

Consolidación 13/11/2026: el usuario acepta Chrome local (búsqueda real cowboy bebop y
navegación al detalle) y la revisión externa combinada sin bloqueantes de código. Se
priorizan funcionalidades completas y gratuitas, aceptando posibles sustituciones de
proveedores o reimplementaciones futuras. La experimentación local queda separada de
los requisitos de distribución pública, que siguen diferidos sin afirmar derechos
externos. No se amplía el alcance técnico ni se inicia enriquecimiento de metadata.
Producción/iOS, arte y puntuaciones conservan sus restricciones. Ver tasks.md y los
informes de validación para evidencia, límites de revisión y pendientes Android/release.

- B1: proponer identidad manual portable estable, distinta del ID local opaco, ProviderReference y legacyIdentity. Proponer SQLite v5 → v6 y backup v6 → v7; estas versiones y su migración requieren aprobación explícita antes de APPLY, no quedan autorizadas por crear esta propuesta.
- B2: crear y editar manuales offline desde «Agregar manualmente» en Biblioteca, reutilizando detalle y datos personales existentes; título y medio obligatorios, familia/formato compatibles, año y resumen opcionales, estado inicial planned y cero referencias externas. Advertencia de duplicados no bloqueante, sin linking/merge ni imágenes propias.
- B3: proponer Kitsu (kitsu.io) como candidato condicional, con una categoría Anime, mapping explícito de subtipos y uso de la abstracción actual. Activación de metadata sujeta a elegibilidad documentada y aceptación técnica por plataforma; arte tiene gate independiente y por defecto se omite. No se presupone permiso de retención, backups o redistribución por existir GET públicos.
- B4: definir regresión conjunta de identidad, migración/rollback, imports v1–v7, manuales, búsqueda/detalle, vistas, TMDB, MangaUpdates, Android/Web y offline.
- Mantener clasificación e identidad universal existentes. Diferir filtros OVA/ONA/especial, no reclasificar TMDB y no suministrar scores Kitsu en voteAverage.
- **BREAKING (propuesto, condicionado):** una base v6 y backup v7 no serán legibles por versiones anteriores; conservar importación histórica y una estrategia de recuperación previa a migrar.

## Capabilities

### New Capabilities

- `manual-content-entries`: creación/edición offline, navegación, validación y duplicados no bloqueantes.
- `anime-catalog`: catálogo Kitsu condicional, elegibilidad, mapping, errores, plataformas y fallback sin arte.

### Modified Capabilities

- `universal-media-identity`: añadir identidad portable manual sin reemplazar el ID local ni referencias/identidad histórica; migración íntegra propuesta.
- `library-backup-integrity`: exportación v7 propuesta, resolución portable manual, colisiones y reimportación; preservar semánticas de v1–v6.

No se modifican requisitos de clasificación, ratings o MangaUpdates: se reutilizan y se verifican como regresión. Las cuatro secciones son límites de implementación dentro de este único change, no cuatro cambios separados.

## Impact

Capas afectadas si se aprueba APPLY: core de identidad/backup, SQLite/bootstrap/repositorios/export-import, Biblioteca/detalle local/nueva ruta manual, composición de Buscar/nueva ruta y cliente Kitsu, pruebas y review sintético. Sin cambios de dependencias, credenciales personales, backend ni SDK nuevo.

Riesgos principales: confundir colisión de ID con igualdad de obra; alterar imports históricos; perder pins o timestamps; activar una fuente sin derechos suficientes; confundir HTTP de escritorio con CORS/Android validado. Se mitigarán con identidades separadas, resolución sin heurísticas, transacciones y pruebas de fallos, gates explícitos y datos aislados.

Reversión: una migración fallida revierte estructuras/datos y no publica user_version. Tras una migración confirmada no se hace downgrade destructivo: recuperar copia previa verificada con la versión anterior o continuar con una versión compatible, según design. No tocar datos personales en PROPOSE.

Hechos actuales, recomendaciones, aprobaciones pendientes y gates externos se separan en design.md. Flujo: EXPLORE → PROPOSE → APPLY B1/B2/B3/B4 con revisión de diff y checkpoint por sección → regresión final → revisión externa → archive/review/checkpoint → integración. No ejecutar esas etapas posteriores ahora.

Fuera de alcance: Maintenance & Stability, AniList, arte o expansión Web/iOS de MangaUpdates, Books/Open Library, nuevos flujos de libros, progreso, recomendaciones/relaciones, linking/merge automático, sync, archivos de imagen y ratings globales.
