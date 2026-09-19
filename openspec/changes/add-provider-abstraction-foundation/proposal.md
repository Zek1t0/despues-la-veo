## Why

La búsqueda, el detalle remoto y el guardado desde TMDB dependen hoy de DTOs y reglas de transformación de TMDB dentro de las pantallas y del repositorio. Se necesita una frontera mínima que permita reutilizar esos flujos con datos remotos normalizados y materialización local independiente del proveedor, sin agregar otro proveedor ni anticipar una taxonomía futura.

## What Changes

- Introducir contratos compartidos estrechos para representar resultados de búsqueda y metadata portable de detalle ya normalizados, usando `ProviderReference.provider` como la identidad de proveedor existente y sin agregar un descriptor sin consumidor actual.
- Incorporar un adaptador explícito de TMDB que filtre y transforme DTOs de búsqueda y detalle, construya `ProviderReference` canónicas y entregue URLs de imagen absolutas cuando el contrato compartido las necesite.
- Hacer que Buscar consuma resultados normalizados sin conocer campos crudos de TMDB, manteniendo TMDB como su única fuente y preservando debounce, credenciales, errores, carga, protección contra respuestas obsoletas, etiquetas y navegación actuales.
- Extraer la preservación de estado personal a una materialización local independiente del proveedor y orientar el guardado a `ProviderReference` más snapshot normalizado, manteniendo la política de tags iniciales derivados de géneros dentro de TMDB.
- Delegar desde `/tmdb/[type]/[id]` el mapeo de metadata portable al adaptador, sin generalizar ni cambiar créditos, runtime, temporadas, disponibilidad, imágenes de perfiles/logos ni el flujo de éxito o fallo conjunto del detalle.
- Separar helpers de identidad de requests solamente cuando la mecánica de secuencia, recurso y rechazo de respuestas obsoletas sea concretamente reutilizable; la elegibilidad e invalidación por credenciales continúan siendo de TMDB.
- Mantener explícitos y sin cambios el almacenamiento y UI de credenciales, atribución TMDB/JustWatch, rutas TMDB, migraciones históricas y compatibilidad de backups.
- No introducir registro de proveedores, búsqueda multiproveedor, selección de proveedor, otro proveedor ni una taxonomía multimedia universal.

## Capabilities

### New Capabilities

- `provider-abstraction`: Define la frontera normalizada para búsqueda y metadata portable de proveedores, el mapeo explícito de una respuesta TMDB ya obtenida y la materialización local que preserva identidad y estado personal.

### Modified Capabilities

- Ninguna. Los contratos canónicos de identidad universal, persistencia y backup no cambian.

## Impact

- Afecta contratos nuevos bajo `src/providers/` o `src/core/`, el adaptador bajo `src/providers/tmdb/`, Buscar, el detalle remoto TMDB y el límite de guardado/materialización del repositorio.
- Mantiene `TitleType = "movie" | "tv"`, `ProviderReference`, IDs locales opacos, `/title/[id]` y `/tmdb/[type]/[id]`.
- SQLite permanece en versión 4 y el backup en versión 5; no se espera migración ni cambio de formato. Si la implementación pareciera requerir schema v5 o backup v6, se detendrá y tratará como advertencia de diseño fuera del alcance.
- No se agregan dependencias ni frameworks de prueba.
- El riesgo principal es una regresión de mapeo o de semántica de refresh; se mitiga con mappers puros, etapas pequeñas y regresiones específicas de identidad, materialización, búsqueda y detalle.
