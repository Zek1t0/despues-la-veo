## Why

DespuésLaVeo necesita reducir riesgos de dependencias y trabajo administrativo repetitivo sin perder revisión externa ni compatibilidad con Expo SDK 54. La exploración revisada encontró 37 entradas afectadas (2 críticas, 17 altas, 16 moderadas y 2 bajas), no 37 vulnerabilidades explotables independientes, y scripts personales aún sin integrar.

Actualización de especificación 2026-11-12: A1 está completada y checkpointed; L1+L2 ya actualizaron 25 nodos autorizados y su evidencia permanece vigente. El audit del lockfile actual registra 23 entradas, 15 GHSA y cero críticas. Antes de aceptar residuales y cerrar A2 se propone evaluar dos grupos adicionales independientes: Babel (ocho nodos existentes) y Browserslist/datos (cuatro). Son candidatos sin autorización de mutación; esta revisión no cambia dependencias.

Estado posterior APPLY autorizado: ambos grupos adicionales aprobados explícitamente (matriz G.13) e implementados/validados (G.14);37 nodos físicos totales actualizados, audit21 entradas/12 GHSA/0 críticas. Se conserva el snapshot de propuesta anterior como trazabilidad. A2 valida dependencias/build y checks automatizados aislados; A3 mantiene aceptación final manual/física, especialmente nanoid. Pendientes revisión externa, residuales y checkpoint2.5; A3 sin iniciar.

## What Changes

- A — Maintenance and Stability, en exactamente tres secciones: A1 scripts/helper; A2 remediación compatible aprobada; A3 regresión/cierre técnico.
- Conservar `android: expo run:android` e `ios: expo run:ios`; agregar `android:start: expo start --android` e `ios:start: expo start --ios`. `start` y `web` permanecen iguales. La aprobación del diseño no permite editar package.json durante Propose.
- Helper PowerShell pequeño con solo manifest.md, net.patch y untracked/: baseline explícito, diff tracked final binario seguro y contenido real de nuevos archivos permitidos. El manifiesto sanitizado identifica por separado committed/staged/unstaged, incluidas cancelaciones netas; el patch no representa historia intermedia. Exclusiones previas a exportar, sin ejecutar tests ni mutar Git.
- Gate obligatorio antes de A2: presentar matriz concreta de advisories/versiones/rutas/compatibilidad/riesgo residual/tests y obtener aprobación del subconjunto exacto. Revalidar todos los advisories de shell-quote; 1.9.0 no es un destino seguro asumido.
- Ampliar A2 dentro de las mismas quince tareas: conservar aprobación/evidencia L1+L2 y exigir una decisión explícita independiente para cada grupo adicional, sus doce paths/versiones exactos (design.md §6.1) y las implicaciones de soporte de navegadores. Autorizar esta especificación no autoriza Babel/Browserslist ni acepta residuales. Reabrir 2.2–2.4 solo por los nuevos criterios; no invalidar el trabajo original ni iniciar A3.
- Babel requiere cierre exacto/metadata, npm ci aislado reproducible, TSX/Flow/source maps, Metro/Web y evidencia Android/Hermes si material. Browserslist requiere comparación de targets añadidos/retirados, aceptación explícita del soporte resultante, export/smoke Web/CSS y navegación/SQLite Web pertinentes. Semver y audits hipotéticos no prueban compatibilidad runtime.
- Cierre posible con riesgos externos residuales precisamente documentados y aceptados; no se exige cero hallazgos cuando no existe solución segura compatible.
- A1 y A2 conservan revisión externa del diff real y checkpoint manual antes de continuar. A3: validación/regresión final → UN evento externo que revisa tanto el diff A3 desde checkpoint A2 como el diff completo desde f234faa → correcciones/revalidación pertinente y aprobación externa → UN checkpoint final manual. Archive y revisión del archive siguen siendo independientes y posteriores.

Fuera de alcance: migración mayor Expo/RN/Router, actualizaciones masivas, overrides genéricamente aprobados, npm audit fix automático, CI/CD, refactors UI/arquitectura, schema SQLite o formato de backup, activación de arte MangaUpdates y automatización de commits/push/integración.

Permanecen evaluados por separado y diferidos: config-plugins54.0.6/xcode4 y dependencias nativas relacionadas, retirada de uuid por ese cambio, override directo del decoder y sustituciones forzadas de glob/minimatch/PostCSS/image-size/deepmerge. La ruta observada URL.searchParams del fork Router6 reduce la exposición demostrada al decoder, sin declararlo universalmente inalcanzable ni aceptar su riesgo residual.

## Capabilities

### New Capabilities

- `maintenance-review-workflow`: contrato observable para el desarrollador sobre scripts, bundles revisables seguros y remediación/cierre con evidencia y aprobación explícita.

### Modified Capabilities

Ninguna. Se inspeccionó el catálogo canónico: `provider-neutral-media-review` define una biblioteca sintética dentro de la app, no revisión Git; `library-backup-integrity` y `second-provider-discovery` conservan sus requisitos. Ninguna capacidad existente expresa coherentemente este nuevo comportamiento de herramientas para el desarrollador. No se agregan deltas artificiales a capacidades del producto.

## Impact

Rama esperada y observada: `feat/maintenance-stability`; baseline integrado `f234faaa2955ee2ce5ed2da95bd2a69c026a482f`. Archivos futuros: package.json, package-lock.json solo según aprobación A2, scripts/New-ReviewBundle.ps1, docs/testing/maintenance-stability/Test-ReviewBundle.ps1 y documentación/evidencia en docs/testing/maintenance-stability/. Propose solo crea artefactos de este cambio.

No cambia la persistencia: SQLite v5, backups v6 e importación histórica permanecen vigentes. El riesgo indirecto es una regresión de runtime/tooling o exposición de contenido personal en bundles; se controla con validación proporcional, exclusión antes de exportar y revisión. No se abre ni migra la biblioteca personal. Reversión futura mediante un cambio revisado de manifest/lockfile y retirada del helper, con checkpoint manual; nunca reset del trabajo personal ni borrado de datos.
