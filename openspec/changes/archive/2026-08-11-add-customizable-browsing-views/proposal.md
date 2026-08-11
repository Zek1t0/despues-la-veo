## Why

Biblioteca, Buscar y Etiquetas ofrecen hoy presentaciones fijas, controles poco adaptados al tamaño de pantalla y textos visibles mezclados entre español e inglés. El usuario necesita elegir una apariencia útil para cada contexto, conservarla localmente y combinarla con búsqueda, filtros y orden sin cambiar sus títulos ni el contrato de backup.

## What Changes

- Agregar preferencias independientes y persistentes para la apariencia de Biblioteca (`Detalle` predeterminado), Buscar (`Detalle` predeterminado) y Etiquetas (`Mosaico` predeterminado).
- Agregar orden persistente para Biblioteca —actualización reciente, título ascendente o descendente, puntuación y año— y Etiquetas —cantidad o nombre ascendente o descendente— con tratamiento determinista de datos ausentes y empates.
- Mantener la vista detallada actual de Biblioteca y sumar, también en Buscar, un mosaico donde el póster de proporción aproximada 2:3 ocupa casi toda la tarjeta, el tipo aparece en la esquina superior izquierda y el título de hasta dos líneas se superpone abajo con contraste; la tarjeta completa es la única acción y no muestra metadatos, botones ni acciones internas, y el placeholder conserva esa misma estructura.
- Hacer que la búsqueda interna y los resultados de una etiqueta usen la apariencia elegida para Biblioteca, sin preferencias adicionales.
- Mantener la búsqueda remota y su orden natural en Buscar, y sumar un mosaico equivalente sin filtros ni criterios remotos nuevos.
- Presentar Etiquetas como mosaico predeterminado o lista, con tarjetas táctiles y collages estables de hasta cuatro pósters priorizados por actualización reciente.
- Incorporar un único control extensible de opciones con sólo las secciones aplicables (`Apariencia`, `Ordenar`, `Filtrar`), adaptado a panel inferior o modal en móvil y control compacto en web; cada selección se aplica inmediatamente, sin botones `Aplicar` o `Restablecer` ni estado provisional dentro del panel.
- Adaptar Biblioteca a controles frecuentes visibles en web y a encabezado, búsqueda activable y barra horizontal de estados en móvil, manteniendo una única fuente de estado compartida y sincronizada entre chips, barra y panel.
- Normalizar al español los textos visibles nuevos y existentes de Biblioteca, Buscar, Etiquetas y las partes afectadas del detalle de título.
- Persistir la configuración local en SQLite mediante una evolución aditiva e idempotente separada de `saved_titles`, compatible con rollback de código pero no descrita como reversible; no agregar dependencias.
- Mantener sin cambios la identidad de los títulos, las filas existentes de biblioteca, el índice `idx_saved_titles_provider_external` y la exportación/importación JSON v1.

### Fuera de alcance

- Fijar títulos, ordenar fijados o personalizar manualmente collages; esas capacidades quedan para `add-contextual-title-pinning`.
- Cambiar `SavedTitle`, la identidad de títulos, el formato JSON v1 o su flujo de importación/exportación.
- Agregar filtros avanzados de TMDB, género o año, orden remoto, selector de idioma o internacionalización completa.
- Agregar un signo `+` o interacción a placeholders, un menú de tres puntos o acciones dentro de tarjetas de mosaico.
- Crear entidades persistentes o almacenamiento para etiquetas sin títulos; las etiquetas continúan derivándose exclusivamente de `SavedTitle`.
- Actualizar dependencias, hacer refactorizaciones generales o rediseñar por completo la aplicación.

## Capabilities

### New Capabilities

- `customizable-browsing-views`: Apariencias, órdenes, filtros sincronizados, comportamiento responsive y accesible para Biblioteca, Buscar y Etiquetas.
- `local-view-preferences`: Valores predeterminados, validación, lectura y escritura resilientes de preferencias locales independientes, aisladas del dominio y del backup JSON v1.

### Modified Capabilities

- Ninguna. `library-backup-integrity` conserva sus requisitos actuales y se verificará que el cambio no altere su contrato.

## Impact

- Pantallas: `app/(tabs)/libreria.tsx`, `app/(tabs)/buscar.tsx`, `app/(tabs)/etiquetas.tsx` y textos afectados de `app/title/[id].tsx`.
- Dominio y presentación: nuevos tipos acotados de preferencias y componentes visuales compartidos bajo `src/core/`, una ubicación compartida mínima por definir y `src/theme/`; `SavedTitle` permanece intacto.
- Persistencia: `src/storage/db.ts` incorporará una versión explícita y una tabla separada de preferencias; un repositorio pequeño gestionará lectura y escritura. `saved_titles` y su índice no se modificarán.
- Proveedores: `src/providers/tmdb/` seguirá entregando el orden natural actual; no cambia la API de TMDB.
- Dependencias y backup: `package.json`, JSON v1 y las rutas de importación/exportación no cambian.

### Riesgos para datos existentes

- Una evolución SQLite mal ordenada podría dejar la base con una versión inconsistente; se mitigará ejecutando la creación idempotente dentro de una transacción y actualizando la versión sólo al finalizar.
- Valores corruptos o desconocidos podrían romper la pantalla; cada lectura se validará y volverá al valor predeterminado sin tocar la biblioteca.
- Un error al guardar podría dejar una selección sólo en memoria; la interfaz seguirá utilizable, informará el fallo de forma comprensible y conservará los datos de títulos.
- Reordenar o filtrar en memoria podría producir saltos no deterministas ante empates o datos ausentes; se definirán desempates estables.

### Compatibilidad con rollback de código

El rollback de código dejará de consultar las preferencias sin requerir cambios sobre `saved_titles`. La tabla nueva permanecerá sin uso porque la evolución es aditiva: no se ejecutará `DROP TABLE` ni se reducirá `PRAGMA user_version` automáticamente. Volver a una versión anterior conservará intactos títulos, identidad, índice y backups v1; cualquier retiro futuro de `app_preferences` requerirá otro cambio explícito.
