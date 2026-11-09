## Why

Preparar portadas MangaUpdates es técnicamente viable, pero activar arte real depende de derechos y aceptación nativa aún pendientes. Este milestone entrega capacidad técnica inactiva y verificable, con cierre independiente de autorizaciones externas.

## What Changes

- Selección provider-specific original válido → thumbnail válido → null; validación inicial estricta HTTPS/host exacto cdn.mangaupdates.com.
- Composición coherente de búsqueda, detalle remoto y materialización con política productiva omit durante y al finalizar el cambio.
- Rendering/fallback reutilizable, reset de error por identidad/URL y pruebas sintéticas con assets propios mediante composición test-only.
- Verificación de posterUrl, re-save, SQLite v5, backup v6/import histórico, identidad, datos personales, ratings, TMDB y review isolation sin arte de terceros.
- Documentar derechos y limitaciones de redirects; handoff al futuro cambio provisional activate-mangaupdates-cover-images-android, sin crearlo ahora.

**Definición de terminado:** preparación técnica implementada e inactiva, pruebas deterministas y visuales/runtime sintéticas aprobadas, regresión y reporte revisables. Tras revisiones externas por sección, checkpoints manuales, regresión final y revisión integral, este cambio puede completarse y archivarse aunque los derechos sigan pendientes. Activación productiva NO es entregable.

Fuera de alcance: permisos/respuesta del proveedor, pruebas con arte real, aceptación Android de portadas reales, activar reference-https productivo, habilitar Web/iOS, nuevos proveedores/registry/matching, migraciones, dependencias, proxy/downloader, binarios y backfill.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `second-provider-discovery`: preparación inactiva, selección inicial segura, fallback y compatibilidad local; condiciones de activación explícitamente diferidas.

## Impact

Mapping/composición MangaUpdates, detalle remoto y fallbacks Buscar/Biblioteca; reutilización de grid, detalle local y collages. No se implementan aquí esos cambios ni se duplican foundations.

Se preservan metadata Android, API bloqueada Web/iOS, atribución, voteAverage TMDB, datos personales y refresh posterUrl incluido null. Validar host inicial no garantiza destino final de redirects nativos. No cambian schema/identidad; reversión técnica sin migración ni limpieza de datos. Omit nunca se abandona y no se purgan URLs/cache existentes.
