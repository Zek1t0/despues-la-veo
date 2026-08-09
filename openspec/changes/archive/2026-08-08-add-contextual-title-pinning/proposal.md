## Why

Los títulos importantes no pueden mantenerse accesibles al comienzo de Biblioteca ni de una etiqueta sin depender del orden general. Se necesita un fijado contextual que conserve de forma independiente la organización deliberada del usuario en Biblioteca y en cada etiqueta, sin alterar la pertenencia, los filtros ni la fecha de actualización del título.

## What Changes

- Permitir fijar y desfijar cada título independientemente en Biblioteca y en cada etiqueta exacta a la que pertenece.
- Priorizar los fijados del contexto visible, ordenarlos por `pinnedAt` descendente con el comparator propio de la vista como desempate y ordenar los no fijados por el criterio normal de esa vista; pinning cambia orden, nunca pertenencia.
- Incorporar acciones individuales en las vistas Detalle, una acción explícita según el contexto de origen en el detalle completo y un indicador no interactivo en Mosaico, preservando una única acción de navegación en `TitleGridCard` y evitando `Pressable` anidados.
- Transportar el contexto Biblioteca/etiqueta en los parámetros de navegación y validarlo contra el título persistido, con fallback explícito a Biblioteca cuando falte o sea inválido.
- Persistir los pins en una tabla relacional independiente `title_pins`, sin agregarlos a `SavedTitle`, sin serializarlos como JSON y sin modificar `SavedTitle.updatedAt`.
- Evolucionar SQLite de `user_version = 1` a `2` de forma aditiva, transaccional, idempotente y verificable, preservando títulos, índices y preferencias existentes.
- Mantener limpieza explícita de pins al borrar un título o quitarle una etiqueta, sin convertir etiquetas en entidades ni transferir pins cuando cambia el texto de una etiqueta.
- Exportar títulos y pins deliberados en un contrato JSON v2, conservando la importación completa de JSON v1 y aplicando a pins un merge aditivo, parcial e idempotente.
- Mantener fuera de alcance ratings, drag-and-drop, orden manual, selección o pin masivos, menús contextuales, entidades Tag, renombrado global, colecciones, nuevos sorts, cambios de collages y nuevas dependencias.

## Capabilities

### New Capabilities

- `contextual-title-pinning`: Comportamiento contextual, orden, navegación, acciones, indicadores, accesibilidad y tratamiento de búsqueda/filtros para pins de Biblioteca y etiquetas.
- `pin-persistence`: Modelo relacional, migración SQLite v2, integridad entre títulos, etiquetas derivadas y pins, y escrituras independientes y resilientes.

### Modified Capabilities

- `library-backup-integrity`: Extender exportación/importación a JSON v2 con pins por identidad lógica, mantener compatibilidad de importación v1 y definir validación, reporte y merge aditivo de pins.

## Impact

- Dominio y almacenamiento: nuevos tipos acotados de contexto/pin bajo `src/core/`, evolución de `src/storage/db.ts`, nuevo repositorio de pins y coordinación explícita con `savedTitlesRepo`.
- Backup: nuevo contrato/parser v2 y adaptación del flujo de exportación, validación, merge y reporte de `app/(tabs)/ajustes.tsx`, preservando el parser y comportamiento v1.
- Pantallas: `app/(tabs)/libreria.tsx`, `app/(tabs)/etiquetas.tsx`, `app/title/[id].tsx` y `TitleGridCard` recibirán estado y acciones contextuales; `ViewOptionsPanel`, búsqueda, filtros y collages conservan sus responsabilidades actuales.
- Navegación: `/title/[id]` incorporará parámetros validados de contexto de origen que también sobreviven recarga web y deep links.
- Dependencias: no se agregan ni actualizan dependencias; `app.json` y `package.json` quedan fuera del cambio.

### Riesgos para datos existentes

- Una migración incompleta podría dejar incoherentes tabla y `user_version`; se mitiga creando y verificando toda la estructura en una transacción antes de establecer la versión 2 y rechazando versiones futuras sin escribir.
- Como las etiquetas son strings derivados dentro de `tags_json`, SQLite no puede asegurar por sí solo que todo pin de tag conserve pertenencia; el repositorio debe validar antes de insertar y limpiar explícitamente al quitar etiquetas.
- Parámetros obsoletos o manipulados podrían intentar fijar en una etiqueta ausente; se validarán en presentación y nuevamente en persistencia, con fallback de UI a Biblioteca.
- Respuestas de escritura fuera de orden podrían mostrar un estado falso; las mutaciones se serializarán y la UI volverá al último estado confirmado tras un error.
- Un backup puede contener pins huérfanos o inválidos; se omitirán y reportarán sin abortar los títulos y pins elegibles.

### Estrategia de reversión

La evolución es aditiva: un rollback de código no borra `title_pins`, no reduce `PRAGMA user_version` y no modifica `saved_titles`, su índice ni `app_preferences`. Si una versión anterior rechaza una base con `user_version = 2`, la reversión operativa segura consiste en restaurar el código compatible o restaurar un backup previo; cualquier downgrade físico de esquema requerirá un cambio explícito y nunca se ejecutará automáticamente. JSON v1 continúa siendo importable por la versión nueva, mientras JSON v2 requiere una versión que conozca pins.
