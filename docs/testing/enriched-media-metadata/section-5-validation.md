# S5 — Refresh individual, global y automático

Change: `add-enriched-media-metadata-and-library-updates`. Alcance exclusivo: 5.1–5.6. 5.7 permanece pendiente de revisión externa, aceptación real y checkpoint manual. No se implementó S6, S7 ni S8.

## Checkpoint y alcance Git

- Rama: `feat/anime-catalog-manual-entries`.
- HEAD: `c5039f579bb52245d0d54f4cc39384681f50d011`.
- Último commit: `feat: add enriched editorial details, language preferences and source selection`.
- El worktree y staging estaban limpios antes de esta implementación. El checkpoint incorpora S4, la corrección Unicode japonesa y la eliminación de información editorial duplicada en TMDB.
- 4.4 cerrada **administrativamente**: aceptación Web y checkpoint manual informados por el usuario; Android no comprobado. Esto no atribuye aceptación visual nueva a S5.
- No se ejecutó Git de escritura. SQLite sigue en v7, backup en v8; dependencias, gates, política de imágenes S3 y el change anterior permanecen intactos.
- Inventario exacto: `section-5-inventory.json`. Todo el diff local corresponde a S5 y al cierre administrativo autorizado de 4.4.

## Capacidades por proveedor (5.1)

| Fuente | Condiciones | Consulta y campos |
| --- | --- | --- |
| TMDB | Credencial configurada; referencia canónica `movie`/`tv`; plataformas existentes | Cliente compartido, únicamente `/{movie|tv}/{id}` con el idioma existente. Mappers actuales para título, sinopsis, géneros, fecha, duración de película, póster y score neutral/legacy. Sin créditos, reparto ni watch providers. |
| MangaUpdates | Solo Android; referencia exacta y clasificación manga/manhwa/manhua compatible con `selectedType` | Cliente y cola existentes. Bypass explícito del TTL de detalle en refresh, sin crear otra cola. Título, clasificación, sinopsis/géneros conocidos y año conocido. `coverPolicy=omit`, sin nueva puntuación. Web/iOS siguen bloqueados. |
| Kitsu | Exclusivamente Web/Android de desarrollo; producción/iOS cerrados | Cliente serial, fieldsets y normalización existentes; ID exacto. Arte/score/editorial siguen la política aprobada S3. |

Manuales y proveedores desconocidos no hacen HTTP. Una selección ambigua exige elegir con el selector S4; no se hace matching ni se elige el primer proveedor. Las opciones no crean documentos ni referencias.

MangaUpdates pierde presencia opcional en su DTO histórico. Por eso el refresh conserva sinopsis/géneros ausentes o vacíos no verificables y registra diagnóstico parcial; no los interpreta como borrado. El año se actualiza mediante snapshot de esa misma fuente, sin inventar una fecha completa. Es una capacidad conservadora parcial deliberada.

## Coordinación, persistencia y UI (5.2–5.4)

- `metadataRefreshCoordinator`: un flight por identidad local/referencia, con consumidores independientes. Cancelar uno no cancela a otro. Sin consumidores se aborta/invalida; una respuesta de transporte que ignora aborto nunca confirma metadata descartada.
- Captura referencia, reloj de selección (incluido A→B→A), identidad local/createdAt y generación S2. La transacción revalida pertenencia, borrado y generación. No recrea títulos eliminados.
- `metadataRefreshRepo` usa exclusivamente el escritor transaccional S2 para documentos, proyección, alias y evento semántico. Conserva omisiones e inválidos; aplica nulls autoritativos de los mappers y no sustituye relaciones parciales. No cambia notas, tags, estado/rating personal, pins, identidad ni relojes personales.
- Intento: `media_refresh_state.last_attempt_at`. Éxito: `checkedAt`/`fetchedAt`. Cambio semántico: `metadataChangedAt` S2. Reloj del proveedor: `sourceUpdatedAt`. Los errores y cancelaciones no renuevan frescura.
- No-op actualiza consulta exitosa y estado de operación, sin evento ni invalidación visual innecesarios. La invalidación de proyección se publica exclusivamente después del commit; rollback no publica.
- `SavedMetadataRefresh` se integra en el detalle guardado conservando su contenido y borradores. Muestra última consulta, progreso, éxito con/sin cambios, error recuperable, reintento y motivos de indisponibilidad. Bloquea doble toque. Las notificaciones de credencial/conexión solo releen estado local; no generan aperturas automáticas.
- `metadataRunManager`: `start()` devuelve el mismo handle mientras hay un run activo; `getActive()`, `subscribe()`, `latest()` y handle `done/cancel/getSnapshot` quedan disponibles para S6. No hay UI global ni feed nuevo.
- Captura IDs reales de toda la biblioteca sin filtros. Consume un ID por vez, con máximo una operación propia en curso, y comparte trabajos individuales. No precarga la cola del proveedor.
- Persiste resumen incremental en `library_update_runs`, errores acotados a 100 códigos sin cuerpos HTTP/credenciales. Contadores: total, terminales procesados, modificados, sin cambios, omitidos (razones agregadas), fallidos, cancelados y pendientes. En final normal/cancelado, las categorías terminales particionan el total; procesados incluye cancelados sin HTTP. En interrupted los pendientes siguen identificados.
- Cancelación detiene consumo y cancela solo al consumidor global. Conserva commits previos. Un borrado de ID capturado termina como omitido; fallo de una fuente no impide otras.
- Bootstrap marca runs `running` como `interrupted`, sin reanudar ni iniciar HTTP. No cambia versiones o estructura SQLite.

## HTTP y temporización (5.5)

- Errores diferenciados: offline, timeout, 404, acceso 401/403, 429, servidor, payload inválido y persistencia. 404 conserva toda la ficha.
- TMDB no añade reintentos automáticos. El cliente compartido bloquea por credencial ante acceso rechazado y respeta `Retry-After` en segundos/fecha HTTP. El timeout de ingeniería es 15 segundos y la cancelación lógica no depende del aborto físico del transporte.
- Kitsu conserva cola/spacing/timeout y comportamiento sin reintentos existentes; espera desconocida detiene la fuente.
- MangaUpdates conserva serialización, spacing, timeout y límite de un reintento automático conocido de hasta 30 segundos. Un header ausente/inválido detiene la fuente, eliminando el anterior fallback arbitrario. El bloqueo se fija **antes** de esperar, de modo que cancelar la espera no lo borra.
- El coordinador suspende una fuente por acceso/429, evitando repetir HTTP por cada título. Esperas 429 conocidas se recuperan por proveedor desde las filas operativas SQLite, incluso al recrear el coordinador con otra ficha. Esperas desconocidas y rechazos de acceso cierran la fuente durante el runtime; una nueva credencial cambia el scope TMDB. No hay bucles de reintento.
- Los bloqueos en memoria no son una cuota oficial ni aislamiento total de transportes. Si un transporte ignora el aborto, puede quedar físicamente activo hasta finalizar; sus resultados cancelados no escriben SQLite. No se promete poder terminar físicamente esa conexión.

## Automático y preferencias (5.6)

- Default existente S2 aplicado: habilitado al abrir, 7 días. Ajustes agrega presets 1/7/30, intervalo personalizado positivo hasta el límite existente de 3650 días (incluye fracciones), desactivación y validación visible.
- Solo se escribe `autoRefresh` tras releer las demás preferencias dentro de la transacción. Idiomas y hideSensitive se conservan. No-op/rollback no notifican; la publicación es poscommit. Backup v8 conserva desactivado e intervalos personalizados explícitos sin nuevos campos.
- Una apertura efectiva monta el panel/evalúa `open`. Render, foco, invalidación y cambio de presentación no vuelven a abrir. Otra apertura real reevalúa y comparte el mismo flight si aún existe.
- La política pura compartida `metadataFreshness` se revalida en el coordinador y dentro de la transacción de inicio: una lectura anterior a un éxito rápido no puede disparar otro HTTP automático. Solo `checkedAt` exitoso establece frescura: ausente, inválido, futuro o edad >= intervalo son candidatos. La evaluación no modifica la evidencia original de un backup. No se usan updatedAt personal ni fecha de emisión.
- Cooldown automático de 15 minutos desde la **finalización del fallo**, combinado con una espera HTTP mayor. El marcador operativo existente `error_code` guarda `auto|manual/código@failedAt`; `last_attempt_at` sigue representando inicio y `backoff_until` la espera HTTP. No se añadieron columnas ni se exportan estados operativos. Una protección local monotónica conserva el cooldown incluso si falla la escritura del marcador operativo. El reloj monotónico local acota el cooldown durante el runtime; en reapertura/reinicio se rehidrata desde el marcador persistido.
- El cooldown automático no inventa una prohibición HTTP manual de 15 minutos: manual puede reintentar antes si ya venció el bloqueo real de la fuente. Un fallo automático se muestra inline, sin diálogo ni reintento en bucle.
- Evalúa gates, credencial, selección y señal de red conocida antes de consultar. En Web usa `navigator.onLine` como indicio, no garantía de conectividad. Sin dependencia nativa de conectividad disponible, Android no puede certificar offline por anticipado; el transporte categoriza la falla y conserva el contenido local. No se añadió una dependencia para simular certeza de red.
- No hay scheduler de fondo ni revisión global al arrancar. Importar preferencias/metadata no inicia HTTP por sí mismo. Los defaults y esperas de ingeniería se etiquetan como políticas propias de DespuésLaVeo.

## Evidencia reproducible y límites

1. `node docs/testing/enriched-media-metadata/section-5-regressions.cjs`: resultados completos en `section-5-results.json`. Incluye las 34 regresiones usadas en el cierre S4, 5 suites de credenciales TMDB y 8 suites nuevas S5.
2. Nuevas suites: `section-5-bindings.cjs`, `section-5-coordinator.cjs`, `section-5-ui.cjs`, `section-5-runs.cjs`, `section-5-http.cjs`, `section-5-errors.cjs`, `section-5-automatic.cjs`, `section-5-product.cjs`.
3. Cubren SQLite real aislado en archivos temporales, transacciones/rollback, reopen, checkedAt/no-op, preservación personal, poscommit, A→B→A, generación, cancelación compartida, ignorar aborto, borrado concurrente, interrupción sin reanudación, contadores, fuentes mixtas y backup v8 real export/parse/import.
4. Transportes y relojes inyectados cubren Retry-After segundos/fecha/ausente/inválido, espera y cancelación (incluido conservar bloqueo), 401/403/404/5xx/offline/timeout, payload inválido/parcial, reintentos finitos, colas compartidas y TTL MU. **No son respuestas HTTP reales** de proveedores.
5. El hook-host ejecuta panel y Ajustes reales con React/native simulados: doble toque, contenido retenido, reintento, desmontaje, apertura vs render/invalidación, preferencias desactivadas, custom inválido/válido. **No es aceptación visual de navegador/dispositivo**.
6. Límites temporales con reloj controlado: primera apertura, reciente, vencimiento exacto, custom, disabled, concurrentes, cooldown/reinicio/vencimiento exacto, fallo demorado, salto de reloj local, espera mayor, reintento manual, checkedAt futuro y cambio explícito de fuente.
7. `npx tsc --noEmit`, `openspec validate add-enriched-media-metadata-and-library-updates --strict` y `git diff --check`: registros finales en `section-5-checks.json`.
8. Exportación Metro Web: `$env:EXPO_OFFLINE='1'; npx expo export --platform web --output-dir .expo/s5-web-final-20261115`. Solo compilación estática local; no despliegue ni ejecución interactiva. Advertencias de Browserslist antiguo/NO_COLOR, sin actualizar dependencias.
9. Intento de smoke Web: Metro local puerto 8093 inició y se detuvo. Computer Use terminó antes de acciones de aplicación porque no pudo determinar con confianza la URL del navegador para aplicar su política. No se interactuó con la biblioteca habitual, no hubo smoke visual ni HTTP real S5.
10. Android: `adb` no disponible en PATH; sin emulador/dispositivo comprobado. iOS y producción no aceptados visualmente. El build Web no sustituye estas aceptaciones.

**Estado final:** 5.1–5.6 implementadas y verificadas con los límites anteriores. 5.7 pendiente. Sin checkpoint Git ni trabajo S6.
