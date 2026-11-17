# S8 — Regresiones y entrega para revisión

Fecha: 2026-11-16. Change `add-enriched-media-metadata-and-library-updates`, esquema spec-driven. Alcance autorizado 8.1–8.4; **8.3 y 8.5 permanecen pendientes**. No archive, sync, merge, staging, commit o push. Ninguna funcionalidad o pantalla nueva.

## Checkpoint y aceptación anterior

- Rama `feat/anime-catalog-manual-entries`.
- HEAD `fdedda6c6e99dccb6c3351667fd789406c41e5be`, commit `feat: add optional sensitive content filtering`, 2026-11-16 20:56:52 -0300.
- Worktree y staging inicialmente limpios. El commit contiene los 27 archivos S7, incluidos el selector compartido, Ajustes y el aviso previo al arte. No hubo cambios locales ajenos que preservar.
- Revisión técnica S7 realizada en un turno anterior de solo lectura: **APROBABLE CON LIMITACIONES**, sin bloqueantes reportados. No se presenta este trabajo como una nueva revisión externa independiente.
- Antes de comenzar S8, 7.4 seguía pendiente en tasks. En esta ejecución el usuario respondió a la consulta sobre los cuatro recorridos Web: «probé todo lo que dijiste, creería que todo anda como debería». Se registra esa aceptación informada para filtro reversible, acceso protegido, cambios con ficha abierta y temas/ancho/fuente. No se atribuyen dispositivo, medidas o lector de pantalla específicos no informados.
- **7.4 cerrada administrativamente** por revisión, checkpoint y aceptación Web informada. Android no aprobado. Los documentos originales S1–S7 se conservan sin reescribir sus estados históricos.

## 8.1 — Matriz de proveedores y plataformas

Esta pasada es determinista: transportes/capacidades simulados, hooks de UI y SQLite real aislado. No se hicieron nuevas consultas HTTP reales a proveedores ni recorridos nativos. La disponibilidad esperada no equivale a aceptación física.

| Proveedor / plataforma | Disponibilidad conservada | Cobertura actual | Evidencia principal |
| --- | --- | --- | --- |
| TMDB Web/Android | Credencial de usuario obligatoria; endpoints movie/tv exactos | Credenciales y aislamiento, búsqueda/detalle, watch providers/atribución, mapping/save, relectura local, imágenes/score, refresh individual/global; sin créditos/watch providers innecesarios en refresh | `tmdb-user-credential/section-1..5`, `provider-abstraction/section-2/4/5`, S3 presentation/renderer, S5 bindings/product/coordinator/runs |
| Kitsu Web/Android desarrollo | Habilitado por gate existente | Búsqueda/detalle, fieldset enriquecido, arte directo, banner ausente, score original, idiomas/scripts/alias, edad/NSFW triestado, fuente activa, refresh | anime B3 contracts/verificación/UI, S1 providers, S3, S4, S5 bindings/product, S7 contracts/UI/preferences |
| Kitsu producción/iOS | Bloqueado | Matriz de gates y ausencia de llamadas en plataformas cerradas | desarrollo activation, B3 contracts/UI y S5 bindings/product |
| MangaUpdates Android | Gate Android existente; no se reabre ni certifica su aceptación histórica en S8 | selectedType/clasificación, mapping, coverPolicy, score ausente, cola compartida y refresh | expanded-domain section-2/4, covers section-2, S5 bindings/http/product |
| MangaUpdates Web/iOS | Bloqueado | Gates, razones y cero llamadas de detalle en plataforma cerrada | mismas suites con transporte inyectado |
| Manuales todas las superficies locales | Sin proveedor/HTTP | Crear/editar/borrar, identidad estable, offline, pins/personales, export/import, refresh omitido y visibilidad desconocida | anime B1/B2/B2 UI, S2 backups/history, S5 bindings/automatic, S6 activity, S7 |

Las tres suites antiguas de UI que necesitan un fixture explícito de preferencias se distinguen en resultados, no se presentan como pases directos. No se añadió matching ni un proveedor/capacidad de producto.

## 8.2 — Matriz de preservación y recuperación

| Contrato | Comprobaciones ejecutadas |
| --- | --- |
| Identidad y referencias | B1, B3 y backup-v5: identidad local/manual/legacy, referencias completas movie/tv, colisiones, remapeo, idempotencia y ausencia de duplicados |
| Autoridad y alias | S2 storage con reloj explícito, S4 sources/languages/Unicode: A→B→A, ambigüedad, selección sin documento, parciales/nulls, alias activos/inactivos y marcas japonesas preservadas |
| Editorial e imágenes | S1/S3/S4: fechas/unidades/cero, score original/escala/fuente, legacy TMDB histórico, rechazo antes del renderer, placeholders, banners inexistentes y callbacks obsoletos |
| Personales | Comparaciones de notas, tags, status, rating, pins, ID, createdAt/updatedAt antes/después en B1/B2, S2 backups/history/storage, S4 sources, S5 coordinator y S7 preferences; borradores comprobados por hosts de componentes |
| Transacciones e invalidación | S2 migration/storage/observers, S4 sources y S5 coordinator: rollback, no-op, poscommit, respuestas viejas, edición y eliminación concurrente sin recreación |
| Coordinación y relojes | S5 coordinator/runs/http/errors/automatic/retry-expiry: single-flight, consumidores independientes, cancelación, Retry-After conocido/desconocido, límites y recuperación interrupted |
| Actividad | S6 activity/retention/retention-clock/service/feed: no-op, privacidad, 90 días/2000, revisiones 30 días/20, 150 errores→100 detalles/contador150, cascade y paginación estable |
| SQLite | S2 recovery/migration y S6: archivos SQLite aislados, evolución histórica a v7, WAL/copia consistente, FK, fallos/rollback y reapertura; ninguna base personal |
| Backup v1–v8 | S2 history-consistency recorre 1–7 comparando campos personales originales; S2 backups, S3 backups, S4 sources, S5 automatic y S7 preferences verifican v8, selección, parciales, conflictos, preferencias y round-trip |
| Filtro sensible | S7: off por defecto, solo marca explícita de la fuente activa, desconocidos visibles, reversibilidad, sin HTTP/eventos por filtrar, biblioteca completa en export y run global |

Los fixtures antiguos de migración que fijan literalmente SQLite6 no se ejecutaron adicionalmente como prueba de SQLite7: están sucedidos por S2 migration y las integraciones B1/S2 actuales. No se modificaron contratos históricos para obtener verde.

## Resultados actuales y reproducibilidad

```text
node docs/testing/enriched-media-metadata/section-8-regressions.cjs
node docs/testing/enriched-media-metadata/section-8-checks.cjs
```

`section-8-results.json` conserva comando, exit code, señal, duración y salida de **67 ejecuciones**:

- Matriz actual S1–S7: **53/58 exit 0; cinco exit 1**, los mismos que S7. Ningún resultado inesperado respecto de la evidencia previa.
- Cinco probes con fuentes runtime S6: **tres exit 0 y dos exit 1**. Se cargan fuentes mediante `git show` sin checkout o cambios Git; las pruebas y el log histórico usados no cambiaron desde S6.
- Diagnósticos explícitos: reloj controlado **1/1 exit 0**, fixtures de preferencias de UI **3/3 exit 0**.
- El runner devuelve 0 cuando los resultados coinciden con esas expectativas documentadas; **no significa que las 58 suites originales estén verdes**. Los exit 1 originales no se suprimen.

No se reejecutó reiteradamente la matriz completa. Se ejecuta una única pasada de S8 más sus comparaciones diagnósticas, sin HTTP real.

### Clasificación de los cinco fallos

| Suite | Actual | Runtime S6 | Diagnóstico |
| --- | --- | --- | --- |
| `enriched-media-metadata/section-2-storage.cjs` | 1 | 1 | Evento de epoch 100 ya vencido por la retención S6 corregida; espera count1 y obtiene0. Con Date.now=1000 la misma prueba pasa. Fixture temporal obsoleto, no regresión S7/S8. |
| `expanded-media-domain/section-3-ui-verification.cjs` | 1 | 0 | Fixture sin repositorio de preferencias. El detalle ahora espera conocer la política antes de montar el contenido. |
| `expanded-media-domain/section-4-verification.cjs` | 1 | 0 | Misma falta de hidratación en fixture de búsqueda. |
| `mangaupdates-cover-images/section-2-verification.cjs` | 1 | 0 | Misma falta de hidratación; el test intenta usar un resultado antes de conocer las preferencias. |
| `tmdb-user-credential/section-2-verification.cjs` | 1 | 1 | Escáner rechaza un nombre de variable en el log Metro committeado S5. El log y el escáner permanecen intactos. La coincidencia concreta no es un valor secreto. |

Las tres incompatibilidades UI son introducidas por la nueva precondición de S7, **no fallos que ya ocurrieran en S6**. Con el preload S7 de preferencias listas/off pasan sus aserciones originales. Ese preload sustituye el hook: preserva los contratos anteriores de mapping/rutas/gates/errores/presentación, pero no prueba hidratación/filtrado. Esto último se ejecuta con el hook real y servicios inyectados en S7 UI, incluyendo pendiente, error, reintento, cambios y unsubscribe.

El probe S6 cambia solo las fuentes runtime leídas de src/app; no crea un checkout completo del repositorio antiguo. Para el escáner se verificó adicionalmente que el propio escáner y el artefacto S5 son idénticos a S6. No se borró evidencia ni se relajó el escáner. No se identificaron regresiones reales nuevas que requirieran cambios de aplicación.

## 8.3 — Evidencia manual consolidada

| Origen | Alcance real | Límites |
| --- | --- | --- |
| S1/S2 | Suites y checkpoints/revisión informados | No hay una aceptación visual adicional deducible de esas suites |
| S3 | Aceptación Web limitada informada por el usuario al comenzar S4; probes HTTP reales históricos para una obra y variantes descritas en S3 | No es una nueva ejecución S8 ni prueba de todos los hosts/obras; Android sin comprobar |
| S4 | Documento S4: Brave escritorio oscuro, zoom110%, búsqueda/detalle TEST, editorial/atribución, placeholder y banner ausente. Aceptación Web posterior informada por el usuario al comenzar S5 | Transporte sintético del recorrido observado por agente; sin certificar todos los temas/anchos/fuentes; correcciones Unicode/TMDB cubiertas en suites |
| S5 | Aceptación Web limitada informada al comenzar S6, incluida corrección Retry-After revisada | Sin reproducción manual HTTP429 ni aceptación Android |
| S6 | Usuario informó que las siete comprobaciones Web funcionaron, incluida corrección de retención aprobada | No sustituye validación nativa ni acredita todas las variantes no descritas |
| S7 | Usuario informó en este turno haber probado los cuatro recorridos propuestos: reversibilidad, acceso, cambios abiertos y presentación | Aceptación informada, no observación de agente; sin dispositivo/ancho/lector de pantalla específicos declarados |
| S8 intento nuevo | Computer Use pudo listar Brave; al capturar su estado se detuvo por no poder determinar la URL con confianza para aplicar política | Ninguna interacción con app, sin screenshot/aceptación Web nueva. No se insistió ni se eludió el bloqueo; no se inició un servidor o base personal |

Android: `adb` no está disponible en PATH ni en la ruta estándar `LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe`. No hubo conexión a dispositivo/emulador ni recorrido físico. Una entrada de Android Studio instalada no acredita runtime o dispositivo. **8.3 pendiente**, no aprobada por mocks o por el build Web.

Para completar 8.3 falta un recorrido real registrado Web/Android de cinco tabs y regreso, detalle/arte/score, idiomas/fuentes/alias, actualización individual/automática/global/feed y filtro/aviso, con claro/oscuro/sistema, ancho compacto/fuente grande y controles accesibles. Reutilizar las aceptaciones informadas donde cubran exactamente el caso; no repetir datos o suites ya acreditados. Registrar dispositivo/runtime y separar capacidades bloqueadas por plataforma.

## 8.4 — Comandos técnicos y alcance

`section-8-checks.json` registra comandos y salidas finales de TypeScript, OpenSpec estricto, whitespace, export Web y control de alcance. Una primera pasada de TypeScript/OpenSpec/diff también finalizó sin errores antes de los documentos finales.

La primera exportación Web compiló 993 módulos, pero terminó **exit1 / EPERM** al crear `.expo/s8-web-validation-20261116/_expo/static`. La comprobación de mkdir recursivo directa funcionó. Se prepararon únicamente los directorios de salida ignorados; el reintento dentro del sandbox volvió a fallar en el mismo punto (checks.json). La ejecución final con escalación autorizada terminó **exit0**, exportó los 993 módulos y los cuatro bundles al mismo directorio: `section-8-export-final.json`. Esto separa el fallo reproducible del entorno de escritura de un fallo de compilación. No se cambiaron ACL, seguridad, dependencias o configuración de proveedores. Se usó Expo offline y sin cargar `.env.local`; no se incluyeron credenciales personales en la evidencia nueva. Compilación/export no son aceptación visual ni despliegue.

`section-8-scope.json` compara desde el baseline previo al change `1c14377bd95c31a3240bf9846ab2272cf45c1c55`: package/lock, gates Kitsu/MangaUpdates y el change anterior sin diferencias; no nuevas imágenes binarias, ZIP o DB versionadas. S8 no modifica src/app. SQLite7 y backup8 permanecen vigentes. No hay nuevas dependencias, endpoints, matching, nube o historial de episodios; todo el diff S8 se limita a evidencia y tareas. No se tocaron las bases personales.

## Inventario y pendientes

Inventario exacto en `section-8-inventory.json`. Nuevos: runner/probe, checks y control de alcance, resultados JSON, este informe e inventario. Modificado: tasks.md únicamente. No se corrigió código de aplicación porque no se demostró una regresión nueva.

- **8.1 y 8.2 verificadas** en el alcance determinista descrito; no se atribuye aceptación física a ellas.
- **8.3 pendiente** de validación manual completa y Android.
- **8.4 verificada:** TypeScript, OpenSpec estricto, whitespace, control de alcance y exportación Web final exit0; conserva registrados los dos fallos EPERM previos y los cinco fallos originales de suites.
- **8.5 pendiente** de revisión externa del conjunto/diff final y checkpoint manual. Este informe prepara esa revisión sin declararla realizada.

Riesgos antes de release: aceptación Android pendiente y Web residual, manual HTTP429 no observado, matriz original con cinco excepciones abiertas de fixtures/escáner, límites de DNS/redirects del renderer S3, imágenes sin garantía offline y permisos/gates de distribución externos que no se amplían. Los pendientes del change anterior siguen independientes. No archive ni merge.

## Aclaración de revisión externa: baseline TMDB

El probe contra S6 del escáner TMDB termina antes de ejecutar su
aserción: intenta leer app/settings/sensitive-content.tsx, que no
existía en ese checkpoint. Por tanto, ese exit 1 no constituye una
reproducción directa del fallo actual.

La clasificación como fallo histórico se apoya separadamente en
que el escáner y el log S5 señalado por la prueba permanecen
sin modificaciones desde S6. No se identificó un valor secreto
expuesto en la coincidencia documentada.

Revisión S8: aprobable con limitaciones. Android y la aceptación
manual integral de 8.3 continúan pendientes.

## Cierre final S8 - aceptación y revisión externa

- Android: 19/19 comprobaciones aprobadas según prueba manual informada por el usuario.
- Dispositivo y runtime: SDK 54, xiaomi note 13.
- Web: aceptaciones manuales previas consolidadas.
- Revisión externa: APROBABLE CON LIMITACIONES.
- Matriz original: 53/58; las cinco excepciones conocidas permanecen documentadas.
- El probe TMDB contra S6 no reprodujo directamente el fallo original porque se detuvo al buscar un archivo inexistente en ese baseline.
- 8.3: completada con evidencia manual Web/Android y sus límites documentados.
- 8.5: completada tras revisión externa y checkpoint S8 confirmado.
- Sin cambios adicionales de código, versiones o dependencias.
- Archive e integración pendientes como operaciones separadas.
