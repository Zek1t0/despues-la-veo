## Why

La aceptación física de Android mostró que la navegación, las fichas y el seguimiento dificultan retomar un título y registrar avances. La dirección V2 aprobada permite reorganizar estas tareas sobre los datos e integraciones existentes.

## What Changes

- Adoptar la base lavanda V2, componentes semánticos compartidos e insets coherentes en Android y Web.
- Mantener Biblioteca como entrada con Retomar y tres destinos en la barra. Dar acceso a Ajustes y organización desde Biblioteca.
- Reorganizar Biblioteca, fichas locales y remotas, y seguimiento granular. Separar orden, filtrado y presentación, y reducir los controles permanentes.
- Limitar Buscar, Actividad, Colecciones, Etiquetas, Inbox y Ajustes a integración. El selector local, los backups y la resolución de recomendaciones conservan sus flujos. Sus rediseños completos y los cambios de proveedores quedan fuera del alcance.

## Capabilities

### New Capabilities

- `core-app-navigation` — entrada, destinos y retornos de la experiencia principal.

### Modified Capabilities

- `global-appearance-themes` — base V2 y continuidad portable.
- `customizable-browsing-views` — Retomar y controles independientes.
- `media-detail-experience` — encabezado y secciones de ficha.
- `personal-episodic-progress` — presentación del cursor y navegación.
- `personal-collections` — acceso directo desde Biblioteca y desde la ficha.
- `granular-episodic-tracking` — presentación inicial por formato, selección y acciones individuales.

## Impact

Afecta rutas Expo Router, tema, componentes de presentación y consumidores de lecturas locales. SQLite v10, Backup v11, dependencias, identidad universal, gates, credenciales y transacciones conservan sus contratos. Los riesgos principales son confundir cursor con marcas, perder contexto al volver, aplicar un lote obsoleto o cambiar el significado de una preferencia restaurada. Los checkpoints aíslan los cambios visuales y de navegación para permitir revertirlos sin migraciones de datos.
