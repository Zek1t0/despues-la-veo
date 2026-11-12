## Why

DespuésLaVeo necesita reducir riesgos de dependencias y trabajo administrativo repetitivo sin perder revisión externa ni compatibilidad con Expo SDK 54. La exploración revisada encontró 37 entradas afectadas (2 críticas, 17 altas, 16 moderadas y 2 bajas), no 37 vulnerabilidades explotables independientes, y scripts personales aún sin integrar.

## What Changes

- A — Maintenance and Stability, en exactamente tres secciones: A1 scripts/helper; A2 remediación compatible aprobada; A3 regresión/cierre técnico.
- Conservar `android: expo run:android` e `ios: expo run:ios`; agregar `android:start: expo start --android` e `ios:start: expo start --ios`. `start` y `web` permanecen iguales. La aprobación del diseño no permite editar package.json durante Propose.
- Helper PowerShell pequeño con solo manifest.md, net.patch y untracked/: baseline explícito, diff tracked final binario seguro y contenido real de nuevos archivos permitidos. El manifiesto sanitizado identifica por separado committed/staged/unstaged, incluidas cancelaciones netas; el patch no representa historia intermedia. Exclusiones previas a exportar, sin ejecutar tests ni mutar Git.
- Gate obligatorio antes de A2: presentar matriz concreta de advisories/versiones/rutas/compatibilidad/riesgo residual/tests y obtener aprobación del subconjunto exacto. Revalidar todos los advisories de shell-quote; 1.9.0 no es un destino seguro asumido.
- Cierre posible con riesgos externos residuales precisamente documentados y aceptados; no se exige cero hallazgos cuando no existe solución segura compatible.
- A1 y A2 conservan revisión externa del diff real y checkpoint manual antes de continuar. A3: validación/regresión final → UN evento externo que revisa tanto el diff A3 desde checkpoint A2 como el diff completo desde f234faa → correcciones/revalidación pertinente y aprobación externa → UN checkpoint final manual. Archive y revisión del archive siguen siendo independientes y posteriores.

Fuera de alcance: migración mayor Expo/RN/Router, actualizaciones masivas, overrides genéricamente aprobados, npm audit fix automático, CI/CD, refactors UI/arquitectura, schema SQLite o formato de backup, activación de arte MangaUpdates y automatización de commits/push/integración.

## Capabilities

### New Capabilities

- `maintenance-review-workflow`: contrato observable para el desarrollador sobre scripts, bundles revisables seguros y remediación/cierre con evidencia y aprobación explícita.

### Modified Capabilities

Ninguna. Se inspeccionó el catálogo canónico: `provider-neutral-media-review` define una biblioteca sintética dentro de la app, no revisión Git; `library-backup-integrity` y `second-provider-discovery` conservan sus requisitos. Ninguna capacidad existente expresa coherentemente este nuevo comportamiento de herramientas para el desarrollador. No se agregan deltas artificiales a capacidades del producto.

## Impact

Rama esperada y observada: `feat/maintenance-stability`; baseline integrado `f234faaa2955ee2ce5ed2da95bd2a69c026a482f`. Archivos futuros: package.json, package-lock.json solo según aprobación A2, scripts/New-ReviewBundle.ps1, docs/testing/maintenance-stability/Test-ReviewBundle.ps1 y documentación/evidencia en docs/testing/maintenance-stability/. Propose solo crea artefactos de este cambio.

No cambia la persistencia: SQLite v5, backups v6 e importación histórica permanecen vigentes. El riesgo indirecto es una regresión de runtime/tooling o exposición de contenido personal en bundles; se controla con validación proporcional, exclusión antes de exportar y revisión. No se abre ni migra la biblioteca personal. Reversión futura mediante un cambio revisado de manifest/lockfile y retirada del helper, con checkpoint manual; nunca reset del trabajo personal ni borrado de datos.
