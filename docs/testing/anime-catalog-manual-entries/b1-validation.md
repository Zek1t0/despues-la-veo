# B1 — evidencia para revisión externa

Fecha de proyecto: 2026-11-12. Rama `feat/anime-catalog-manual-entries`.
HEAD y checkpoint de propuesta: `ad9b2aa57a16acc12f9a95f1dd132b9c1e386f65` (`docs: propose anime catalog and manual entries`). El árbol inicial estaba limpio. `git ls-remote origin refs/heads/feat/anime-catalog-manual-entries` verificó ese mismo hash publicado, exit 0; el primer intento sin red habilitada falló y se repitió con permiso de lectura de red. No hubo stage, commits, pushes, archive, sync ni merge.

Tareas 1.1–1.5 completas; progreso 5/22. **1.6 pendiente** de revisión externa del diff B1 real, correcciones/revalidación pertinentes y checkpoint manual commit/push del usuario. B2–B4 no iniciados.

## Archivos

Nuevos:

- `src/core/manualEntryIdentity.ts`
- `src/core/libraryBackupV7.ts`
- `src/storage/manualEntryIdentities.ts`
- `docs/testing/anime-catalog-manual-entries/b1-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b1-regressions.cjs`
- `docs/testing/anime-catalog-manual-entries/b1-validation.md`

Modificados de producto/composición:

- `src/core/savedTitle.ts`
- `src/core/libraryBackup.ts`
- `src/storage/databaseSchema.ts`
- `src/storage/savedTitleStorage.ts`
- `src/storage/libraryBackupExport.ts`
- `src/storage/libraryBackupMerge.ts`
- `app/(tabs)/ajustes.tsx` (export/import v7, textos de versión y Appearance)
- `src/dev/mediaReview/session.ts`
- `src/dev/mediaReview/MediaReview.tsx` (backup sintético v7)

Regresiones actualizadas para el esquema vigente, sin ampliar los formatos históricos:

- `docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs`
- `docs/testing/universal-media-identity/section-3-persistence-verification.cjs`
- `docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs`
- `docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs`
- `docs/testing/expanded-media-domain/section-1-verification.cjs`
- `docs/testing/expanded-media-domain/section-2-verification.cjs`
- `docs/testing/expanded-media-domain/section-5-verification.cjs`
- `docs/testing/expanded-media-domain/section-8-verification.cjs`
- `docs/testing/library-backup-integrity/controlled-sqlite-failure.cjs`
- `docs/testing/personal-title-rating/section-2-verification.cjs`
- `docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs`

Documentación: `openspec/changes/add-anime-catalog-and-manual-entries/{design,tasks}.md`. Se registra aprobación B1 y se aclara que BlueStacks solo satisface hitos de desarrollo con aceptación explícita del usuario para ese hito, manteniendo aceptación física de release separada. El gate Kitsu M pendiente no bloquea B1/B2; M/T/A siguen siendo requisitos de activación sin relajación.

`package.json`, `package-lock.json`, parsers v1–v6 y comportamiento de TMDB/MangaUpdates no modificados. No se creó UI manual ni código Kitsu.

## SQLite v5 → v6

La cadena histórica hasta v5 se mantiene dentro de la transacción pública existente. Una instalación nueva crea las tablas actuales y la tabla aditiva v6 dentro de esa misma transacción. Una v5 existente verifica primero su esquema; no se reconstruye `saved_titles`.

Tabla `manual_entry_identities`: `portable_id TEXT PRIMARY KEY NOT NULL`, `saved_title_id TEXT NOT NULL UNIQUE`, FK a `saved_titles(id) ON DELETE CASCADE`, CHECK de token no vacío y sin espacios exteriores. Helpers validan además `String.trim()` y rechazan controles. La verificación v6 comprueba columnas, CHECK, índices únicos no parciales, FK/cascade y tokens almacenados, además de toda la integridad v5.

Backfill exclusivo de filas sin ninguna referencia externa y sin ninguna identidad legacy. Las filas históricas con legacy exacta no reciben token nuevo. Se compara el conjunto exacto de destinatarios y el contenido completo de las cinco tablas previas antes/después (todos los campos y relaciones, incluidas preferencias). No se ejecuta UPDATE sobre títulos: IDs, snapshots, campos personales, timestamps y pins quedan intactos. Se publica `user_version=6` solo después de verificar, dentro de la transacción. Reopen v6 verifica y no genera identidades. Un esquema futuro se rechaza antes de WAL/DDL, sin reset ni downgrade.

El generador independiente usa cuatro bloques aleatorios de 32 bits con `Math.random`, disponible como JavaScript en Expo/Android/Web sin dependencia nueva. **No es un token criptográfico** ni una afirmación de validación en dispositivo. No depende de ID local, proveedor, título o año. La propiedad es 1:1 y se reintenta hasta 25 candidatos solo ante colisión comprobada; errores de escritura no se ocultan como colisiones. Los helpers WithDb requieren transacción/cola del caller, no inicializan la biblioteca ni anidan transacciones.

## Backup v7 y merge

Export v7 transporta manualIdentity separada de referencias y legacy exacta, conserva clasificación/snapshot/personales/timestamps, pins por itemId y Appearance. Rechaza local-only sin vía portable y estados inválidos/duplicados. Un token compartido entre items invalida todos los candidatos afectados sin ganador por orden.

El dispatch mantiene parsers1–6; campos v7 añadidos a archivos históricos no tienen autoridad. v1–v4 siguen resolviendo identidad histórica. v5/v6 conservan resolución por referencias/legacy; un local-only sin identidad con ID libre recibe token al insertarse en la misma mutación, pero reimportar el archivo histórico vuelve a producir conflicto por ID ocupado. Dos instalaciones que importan separadamente ese archivo obtienen tokens distintos: no se fabrica deduplicación retroactiva.

v7 reúne propietarios de todas las identidades suministradas antes de writes y frescura. Propietarios divergentes, medium incompatible o una identidad manual distinta en destino son conflictos; no se fusionan filas. Se conserva ID local y createdAt del destino resuelto. Sin propietario, un ID ocupado se remapea solo si existe identidad portable suficiente, con límite vigente de 25 candidatos totales para ID local (el ID preferido más hasta 24 generados). No se compara título/año/similitud. Referencias ausentes permanecen; asociaciones compatibles pueden restaurarse aun con contenido antiguo. Snapshot/personales respetan updatedAt, presencia/ausencia y null explícito v6.

Cada item conserva savepoint y reporte parcial; un fallo revierte también asociaciones ya realizadas y deja sus pins sin mapping. Los items válidos continúan. Pins se resuelven por ID final y conservan reglas contextuales/aditivas. Appearance se reserva y activa mediante el pipeline existente después del commit; su fallo posterior no revierte biblioteca/pins. Un fallo del commit principal no activa Appearance.

## Pruebas y comandos

Comprobación final: `node docs/testing/anime-catalog-manual-entries/b1-regressions.cjs` — **exit 0, 17/17 suites**. El runner imprime el comando individual y exit de cada suite. Todas las siguientes invocaciones `node docs/testing/<ruta>` terminaron en **exit 0**:

| Ruta | Cobertura |
| --- | --- |
| `anime-catalog-manual-entries/b1-verification.cjs` | B1 nuevo: SQLite real, identidades, migración, recovery, parsers/imports/rollback |
| `universal-media-identity/section-1-verification.cjs` | Contratos de identidad |
| `universal-media-identity/section-2-sqlite-v4-verification.cjs` | Cadena histórica, bootstrap, fallos por fase |
| `universal-media-identity/section-3-persistence-verification.cjs` | Runtime/repositorios tras migración |
| `universal-media-identity/section-4-backup-v5-verification.cjs` | Backup5 y compatibilidad histórica |
| `universal-media-identity/section-5-runtime-consumers-verification.cjs` | Lecturas, personales, pins, referencias |
| `expanded-media-domain/section-1-verification.cjs` | Clasificación, refresh, persistencia |
| `expanded-media-domain/section-2-verification.cjs` | SQLite, backup6, imports1–6, null/presencia y Appearance |
| `expanded-media-domain/section-5-verification.cjs` | Review aislado con dos DB externas y export/import7 |
| `expanded-media-domain/section-5-ui-verification.cjs` | Hook-host aislado, cero inicialización personal |
| `expanded-media-domain/section-8-verification.cjs` | Guardado genérico y conservación de personales |
| `library-backup-integrity/controlled-sqlite-failure.cjs` | Fallo real de item y continuación parcial |
| `personal-title-rating/section-2-verification.cjs` | Ratings/repositorio/TMDB re-save |
| `personal-title-rating/section-2-integration-verification.cjs` | Integración de ratings |
| `provider-abstraction/section-4-materialization-save-verification.cjs` | Materialización/guardado y serialización |
| `global-appearance-themes/section-2-verification.cjs` | Coordinator, precedencia, persistencia |
| `global-appearance-themes/section-11-verification.cjs` | Backup histórico/Appearance poscommit |

También ejecutadas, exit 0: `node docs/testing/global-appearance-themes/section-{3,4,5,7}-verification.cjs` (cuatro comandos individuales). Comprobaciones adicionales:

| Comando | Exit |
| --- | --- |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-anime-catalog-and-manual-entries --strict` | 0 |
| `git diff --check` | 0 |
| `git diff --quiet -- package.json package-lock.json` | 0 |
| `git diff --cached --exit-code` | 0 |

Hubo ejecuciones iniciales exit 1 por expectativas antiguas de versión/fixtures sin tabla v6 y por composición de review aún restringida a v6; se corrigieron y la ejecución final integral pasó. Un primer TypeScript detectó un field de diagnóstico fuera de la unión histórica: se corrigió sin ampliar esa unión. Los avisos experimentales de `node:sqlite` y LF/CRLF de Git no son fallos de validación.

La suite B1 compara registros completos y relaciones. Verifica nueva/histórica/mixta, tokens inválidos, colisiones/reintentos/agotamiento, propietarios contradictorios, ID ocupado/remap y reimport7, referencias múltiples/TMDB namespaces iguales/MangaUpdates ID grande, legacy con whitespace exacto, null/presencia/frescura, pins y Appearance. Inyecta fallos de creación/asignación/verificación/publicación, escritura parcial, asociación sobre fila existente y transacción externa. Un FK diferido provoca fallo de **COMMIT real de SQLite** tras publicar v6; se compara snapshot íntegro anterior tras rollback. No quedan tabla/token/version parciales. Reopening conserva tokens y borrado cascade elimina asociaciones.

## Recuperación y límites

Se ensayó copia v5 consistente sintética: checkpoint WAL(TRUNCATE), cierre de todas las conexiones, copia del archivo, migración de original, reapertura de copia previa y comparación íntegra de esquema, versión, registros y relaciones contra baseline. Los archivos SQLite, sidecars y JSON nuevos de las pruebas viven en directorios externos temporales descartables. El test de review dejó de escribir un JSON generado dentro del repositorio. Ninguna prueba abrió, inspeccionó, migró ni restableció biblioteca personal.

No se ejecutó aceptación manual en browser, BlueStacks o dispositivo físico, ni pruebas Expo SQLite Android/Web: las pruebas SQLite usan Node SQLite real y contratos async equivalentes. No se afirma validación personal ni release readiness. Los cambios visibles se limitan a textos/composición de backup vigente; su aceptación runtime queda para el checkpoint correspondiente. El generador no es criptográfico; la migración verifica snapshots en memoria, con costo proporcional al tamaño de biblioteca.

Después de un commit v6 exitoso **no hay downgrade automático**: se recupera una copia v5 consistente previa con runtime anterior o se usa un runtime compatible v6. La copia previa no contiene datos creados posteriormente; recuperarlos exige runtime compatible. Una app anterior no lee backup7. No se ejecutó recuperación destructiva sobre datos personales.

## Bundle para revisión B1

El checkpoint de scripts `a793d459c841814291c1e3c0887c8bf7b77ecc10` fue verificado con `git show`, diff de package.json respecto del padre y ancestry a HEAD, exit 0; no se asumió el hash. Desde la raíz, PowerShell 7.2+:

```powershell
$b1ReviewDirectory = Join-Path $env:TEMP ('dlv-b1-review-' + [guid]::NewGuid().ToString('N'))
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline ad9b2aa57a16acc12f9a95f1dd132b9c1e386f65 -OutputDirectory $b1ReviewDirectory -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint a793d459c841814291c1e3c0887c8bf7b77ecc10
Get-Content -LiteralPath (Join-Path $b1ReviewDirectory 'manifest.md')
```

Comandos entregados; no se generó ni compartió bundle automáticamente. El helper incluye nuevos archivos permitidos sin staging. Revisar el manifiesto y el diff real con reviewer externo. **STOP: no comenzar B2 antes de completar 1.6 y el checkpoint manual.**
