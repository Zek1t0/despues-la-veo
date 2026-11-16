# Corrección S5: vencimiento visual de Retry-After

Fecha: 2026-11-16 (America/Buenos_Aires). Change: `add-enriched-media-metadata-and-library-updates`.

## Baseline y alcance

Rama `feat/anime-catalog-manual-entries`; HEAD `c5039f579bb52245d0d54f4cc39384681f50d011`. Al comenzar ya estaban presentes los 41 archivos del bundle S5 revisado, sin commit, con staging vacío. Esta corrección parte de ese contenido local, **no** del HEAD S4. No se ejecutó Git de escritura ni se alteraron los demás archivos preexistentes.

OpenSpec spec-driven: 30/46 tareas completas. 5.7 sigue pendiente; tasks.md no se modifica. No se implementan S6, S7 o S8.

## Recorrido y corrección

1. Una respuesta HTTP 429 entrega la espera al cliente compartido y al coordinador existentes. Los relojes y bloqueos siguen siendo su autoridad; no se agrega otro backoff.
2. `inspect()` expone `retryAt` únicamente si la suspensión HTTP tiene un deadline confiable. Considera el máximo de los bloqueos ya existentes de memoria, proveedor persistido y referencia. Un deadline más largo no queda oculto por un bloqueo en memoria más corto.
3. Una suspensión indefinida conserva el bloqueo sin prometer fecha. Un timestamp no representable de forma confiable tampoco se expone y la razón explica la ausencia de fecha. Los gates, credenciales y conectividad siguen evaluándose antes de ofrecer la acción.
4. El servicio pasa ese deadline al panel. No expone el cooldown automático como espera manual. El panel muestra la fecha del próximo intento manual cuando corresponde.
5. El panel mantiene un solo timer por efecto activo. Al vencer, **solo** llama `inspect()` y vuelve a representar su resultado: no habilita por su cuenta, no hace HTTP y no llama `refresh()`, `open()` ni al servicio global. Si la autoridad prolongó el bloqueo, programa el nuevo deadline.
6. Una notificación de credencial/conectividad, cambio de fuente/identidad o desmontaje limpia el timer y la suscripción anteriores. Las revisiones de lectura y generaciones de contexto impiden aplicar respuestas tardías, incluidos resultados de acciones manuales/automáticas de una identidad o fuente anterior.
7. La finalización manual vuelve a usar la lectura protegida del efecto; no escribe directamente un estado de disponibilidad que pueda quedar fuera de la programación del timer. Un fallo de lectura conserva el error recuperable y no deja el spinner bloqueado.

No se cambian transporte, proveedores, gates, dependencias, SQLite v7, backup v8, datos personales ni política automática de 15 minutos.

## Inventario incremental exacto

Cuatro archivos existentes ajustados respecto del bundle S5 local:

- `src/application/metadataRefreshCoordinator.ts`: deadline HTTP y explicación de suspensión indefinida/no confiable.
- `src/application/savedMetadataRefreshService.ts`: campo opcional `SavedRefreshStatus.retryAt`, documentado como exclusivamente HTTP.
- `src/application/productMetadataRefresh.ts`: proyección del campo desde `inspect()`.
- `src/components/browsing/SavedMetadataRefresh.tsx`: timer de lectura, fecha visible, limpieza y guardas de resultados obsoletos.

Cuatro archivos nuevos de prueba/evidencia:

- `docs/testing/enriched-media-metadata/section-5-retry-expiry.cjs`.
- `docs/testing/enriched-media-metadata/section-5-retry-expiry-results.json`.
- `docs/testing/enriched-media-metadata/section-5-retry-expiry-validation.md` (este documento).
- `docs/testing/enriched-media-metadata/section-5-retry-expiry.patch`.

El patch compara las copias exactas tomadas antes de esta corrección con los cuatro archivos de runtime actuales, e incluye la nueva prueba. Los resultados y este informe se entregan por separado para no mezclar el bundle S5 anterior ni generar un patch autorreferente. La copia de comparación queda en `.expo/s5-retry-expiry-baseline`, ignorada por Git.

## Validación reproducible

Nueva regresión: `node docs/testing/enriched-media-metadata/section-5-retry-expiry.cjs`.

Ejecuta clientes compartidos/coordinador/servicio/panel reales con fetch y reloj simulados, SQLite real en archivo temporal aislado y un hook-host React/native simulado. No usa la biblioteca personal. Cubre:

| Caso | Verificación |
| --- | --- |
| 429 conocido | Deadline de 60 segundos expuesto por el servicio; botón deshabilitado antes y habilitado exactamente al vencer sin remontar. |
| Vencimiento | Una lectura local adicional, cero HTTP nuevo y cero timers restantes si se permite reintentar. |
| Renders repetidos | No vuelven a inspeccionar SQLite ni duplican timers. |
| Nueva respuesta 429 | Dos requests ya en vuelo responden 429 con 60/180 segundos. El timer anterior reconsulta, conserva el botón deshabilitado y espera el deadline prolongado. |
| Espera desconocida | Fecha ausente, suspensión explicada, sin timer/polling aunque avance un día el reloj. |
| Fecha no confiable | Timestamp fuera del rango Date: bloqueo conservado, sin `retryAt` prometido. |
| Cambio de fuente | Mismo ID local cambia TMDB→Kitsu: se limpia la espera anterior y se inspecciona la fuente actual. |
| Cambio de ficha | El timer anterior no provoca otra lectura ni bloquea la nueva identidad. |
| Desmontaje | Timer y listeners de credencial/conectividad eliminados; sin lecturas ni actualizaciones tardías. |
| Lecturas obsoletas | Una lectura vieja no sustituye el estado más reciente ni crea timers; una respuesta posterior al desmontaje no escribe estado. |
| Credencial/conectividad | Eventos releen estado local, limpian/reprograman el timer según la autoridad actual y no generan HTTP. |
| Cooldown automático | Tras 60 segundos se permite el reintento manual; el servicio automático todavía omite la consulta por su cooldown de 15 minutos. |

Resultados: **13 suites y 3 comprobaciones, 16/16 correctas**. Registro de comandos, exit codes y salida completa: `section-5-retry-expiry-results.json`.

- S5: retry-expiry, bindings, coordinator, errors, http, automatic, ui, runs, product.
- Regresiones: section-4-ui, section-4-sources, section-2-observers, section-2-backups.
- `npx tsc --noEmit`.
- `openspec validate add-enriched-media-metadata-and-library-updates --strict`.
- `git diff --check`.

Los ocho archivos incrementales se comprueban adicionalmente como UTF-8. Se verifica ausencia de whitespace final en fuentes, prueba e informes; el patch conserva los prefijos de contexto propios del formato unified diff. Se comparan hashes del baseline para confirmar que el resto del contenido preexistente se conserva.

## Límites reales

No se realizaron solicitudes HTTP reales, smoke Web/Android ni aceptación visual en esta corrección. El hook-host comprueba comportamiento del componente; no acredita layout ni ejecución en un navegador/dispositivo.

El timer depende del event loop de la plataforma: si está suspendido o ralentizado, la relectura ocurre cuando puede ejecutarse. Esperas superiores al máximo de `setTimeout` se dividen en despertares acotados para volver a consultar la misma autoridad, sin adelantar el permiso ni iniciar HTTP. No se agrega scheduler de fondo.

5.7 permanece pendiente de revisión final, aceptación visual y checkpoint Git manual.
