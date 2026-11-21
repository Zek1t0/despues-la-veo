## Why

Biblioteca permite decidir el estado de un título, pero no recordar por dónde continuar sin reutilizar notas. Hace falta progreso personal offline y portable que permita después seguimiento granular con huecos, temporadas e historial, sin confundir una última posición con consumo demostrado.

## What Changes

- Incorporar una posición manual por título local: episodio continuo, temporada/episodio, capítulo decimal canónico textual o especial identificado por texto. Permitir registrar, corregir hacia atrás, sumar uno cuando sea inequívoco y restablecer explícitamente.
- Mantener independientes estado, rating, notas, etiquetas, metadata, organización y reloj histórico del título. Cada progreso tiene su propio reloj.
- Integrar «Mi progreso» en ficha local y una presentación compacta compartida en Detalle, Mosaico y miembros de Colecciones; accesibilidad Web/Android sin otra pestaña.
- Permitir una barra de posición solamente con total conocido y evidencia de compatibilidad de numeración; nunca porcentajes ni cantidad consumida inferida. No habilitar barras con los totales actuales si esa compatibilidad no está acreditada.
- Proponer tabla independiente y migración SQLite v8→v9, backup v10 completo y restauración con remapeo e informe revisable de conflictos; preservar local por defecto incluso frente a un entrante más reciente.
- Preservar posiciones ante refresh, cambios de fuente y clasificación; requerir resolución explícita si una edición manual vuelve incompatible el seguimiento.
- Delimitar A como fundación manual. B será un change posterior: unidades individuales, temporadas completas, cobertura, fechas e historial durable, rewatch/relectura y catálogos compatibles. A no fabrica marcas de unidades anteriores.

Fuera de alcance: implementar B, volúmenes, proveedores nuevos, cambios de gates, consultas externas nuevas o automáticas, nueva pestaña, rediseño general, sincronización remota y cambios en reglas históricas de merge personal. A no agrega eventos de progreso al feed: evita confundir su retención acotada con historial de consumo y mantiene intactos los parsers históricos de actividad.

## Capabilities

### New Capabilities

- `personal-episodic-progress`: posición manual independiente, reglas por formato, persistencia, edición concurrente, UI compacta y accesible, visualización honesta y transición futura sin inferir cobertura.

### Modified Capabilities

- `library-backup-integrity`: exportación vigente v10 con progreso completo, importación v1–v9 histórica, remapeo, restablecimientos fechados, conflictos conservadores y resultados revisables.
- `manual-content-entries`: edición de clasificación conserva progreso y exige una decisión explícita ante incompatibilidad, sin borrado ni conversión silenciosa.

## Impact

Baseline verificado: `main`, `d724f1a`, SQLite v8 y backup v9. Este documento no autoriza APPLY. Solo se crean artefactos OpenSpec, sin rama, código, migraciones ejecutadas, commits, push, merge ni archive.

Afecta dominio de progreso nuevo, bootstrap/verificación SQLite, repositorio y snapshots locales, invalidación poscommit, ficha, tarjetas/filas, Colecciones, edición manual y export/import en Ajustes. Sin dependencias nuevas ni cambios de integraciones externas. El diseño enumera archivos y pruebas por checkpoint S1–S4.

Riesgos: remap incorrecto de IDs, pérdida de una corrección por frescura, resurrección de progreso restablecido, lecturas obsoletas, clasificación incompatible y barras interpretadas como cobertura. Se mitigan con FK, estado vacío fechado, comparación independiente, conflictos conservadores y ausencia de inferencias editoriales.

Reversión: fallo de migración/import revierte la transacción completa; no se publica éxito antes de commit. Una app v8 rechaza SQLite v9 y no se promete downgrade. Antes de pruebas sobre datos reales conservar copia íntegra de SQLite y backup v9; después de usar progreso conservar backup v10. Volver al binario anterior exige restaurar una copia v8 en un entorno separado y reconoce la pérdida de cambios posteriores; nunca eliminar tablas o convertir v10 a v9 silenciosamente. S1/S2 son checkpoints de desarrollo, no entregas distribuibles: el change solo puede cerrarse con portabilidad S3 y aceptación S4 completas.
