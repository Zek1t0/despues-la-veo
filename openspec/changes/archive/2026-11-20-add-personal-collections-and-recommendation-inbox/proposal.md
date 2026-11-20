## Why

Biblioteca permite organizar títulos ya guardados, pero no reunirlos en colecciones personales independientes ni conservar sugerencias pendientes sin incorporarlas. Este change reúne ambas necesidades locales en tres entregas funcionales, preservando identidades, datos personales y portabilidad.

## What Changes

- Colecciones con nombre, descripción opcional, CRUD, membresías múltiples sobre IDs locales existentes, orden por incorporación o alfabético y portada derivada segura; admite colecciones vacías.
- Bandeja local con captura offline por nombre, enlace HTTP(S) o referencia; persona, origen y comentario opcionales; estados Pendiente, Incorporada y Descartada; edición, descarte y reapertura.
- Resolución local primero, confirmación de candidatos por nombre y búsqueda remota solo explícita bajo los gates vigentes. Vincular existentes nunca sobrescribe sus datos; incorporar uno nuevo es deliberado y recuperable.
- Acceso «Organizar» desde Biblioteca, con Colecciones y Bandeja de recomendaciones; conservar cinco pestañas, Mosaico, vista Detalle y «¿Qué veo hoy?». La gestión desde fichas es una acción de organización en la ficha local, sin rediseñar esas vistas.
- Migración aditiva SQLite v7→v8; exportación backup v9 de colecciones desde S1 y de Inbox desde S2; restauración v9 de colecciones desde S1 e Inbox desde S2; historia v1–v8 conservada y cobertura profunda en S3.
- Tres tandas: S1 Colecciones y persistencia; S2 Inbox completo; S3 Restauración e integridad. Cada una incluye comprobaciones y checkpoint manual propio.
- Fuera de alcance: orden manual, drag-and-drop, IA, recomendaciones por varios títulos, swipe, compartir nativo, nuevos proveedores, cambios a gates, rediseño global, cloud y tombstones.

## Capabilities

### New Capabilities

- `personal-collections`: colecciones, membresías, presentación y navegación Organizar.
- `recommendation-inbox`: captura y ciclo de sugerencias, resolución e incorporación sin segunda Biblioteca.

### Modified Capabilities

- `library-backup-integrity`: añadir contrato v9, exportación e importación progresivas, reconstrucción relacional y merge de los nuevos registros, manteniendo los contratos históricos.

## Impact

Capas de dominio, SQLite/repositorios, rutas de organización y ficha local, Biblioteca y Ajustes de backup. Reutilizar Expo Router, cola/transacciones SQLite, identidad universal, entradas manuales, adaptadores, controles visuales y tokens; ninguna dependencia nueva ni API/backend.

Riesgos: referencias huérfanas, falsos positivos por nombre, duplicados por carreras, conflictos de identidad al restaurar y pérdida de bajas al importar backups viejos. Se abordan mediante restricciones, confirmación, relectura transaccional, mapas de identidad y merge aditivo explícito. Sin tombstones, un backup antiguo puede reintroducir una membresía o registro eliminado; no se promete sincronización de borrados.

Reversión: rollback completo de migración o mutación fallida; no publicar v8 antes de verificar integridad. Tras persistir datos v8, no ejecutar downgrade destructivo: conservar la base y usar un build compatible o restaurar una copia previa verificada en entorno separado. Cada entrega exporta e importa sus nuevos datos: S1 colecciones/membresías y S2 recomendaciones. S3 profundiza regresiones, conflictos y aceptación; nunca posterga la recuperación básica. Esta propuesta no ejecuta migraciones ni implementación.
