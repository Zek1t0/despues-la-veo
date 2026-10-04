## 1. Contratos compartidos

- [x] 1.1 Definir el resultado normalizado de búsqueda, el tipo de detalle portable, el snapshot local compatible y el input separado de materialización; verificar con un contrato TypeScript que no contienen descriptor de proveedor, paginación, DTOs TMDB, credenciales, rutas ni enriquecimientos.
- [x] 1.2 Definir solamente la operación de search que consume Buscar, con `search(query)` y resultados readonly; verificar que no existen `page`, `hasMore`, cursor, metadata de paginación ni capability remota de detalle.
- [x] 1.3 Someter el diff completo de la Sección 1 a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; el commit/push de checkpoint es una acción manual del usuario posterior a esa aprobación.

## 2. Mapeos puros y adaptador TMDB

- [x] 2.1 Tipar las formas de detalle TMDB actualmente consumidas y crear el mapper puro de search que filtra movie/TV, construye referencias canónicas y normaliza title/name, fechas, overview y póster absoluto; verificar movie, TV, recurso no soportado, póster ausente y referencia canónica.
- [x] 2.2 Crear un mapper puro que transforma el detalle TMDB ya obtenido en `ProviderMediaDetails`, incluyendo año, resumen nulo, póster absoluto y `voteAverage`; verificar movie, TV, fechas válidas/ausentes/inválidas e IDs inválidos.
- [x] 2.3 Derivar por separado los nombres de género TMDB como `initialTags` para construir el input local de materialización, y verificar que `ProviderMediaDetails` no contiene esa política.
- [x] 2.4 Exponer search normalizado y los mappers puros desde un adaptador/módulo TMDB explícito sin mover créditos, watch providers, profile/logo helpers, credenciales ni atribución; verificar que los endpoints y parámetros actuales siguen siendo los mismos.
- [x] 2.5 Someter el diff completo de la Sección 2 a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; el commit/push de checkpoint es una acción manual del usuario posterior a esa aprobación.

## 3. Migración de Buscar

- [x] 3.1 Reemplazar el estado y render de `TmdbSearchItem` por resultados normalizados, eliminando de la pantalla el conocimiento de `media_type`, `poster_path`, `release_date`, `first_air_date` y `title/name`; verificar que textos, tarjetas, claves y navegación `/tmdb/[type]/[id]` no cambian.
- [x] 3.2 Verificar el runtime de Buscar para query vacía, debounce, credencial inicializando/no configurada/con error/configurada, retry, loading, errores y rechazo de respuestas obsoletas por consulta o generación.
- [x] 3.3 Someter el diff y la evidencia runtime de la Sección 3 a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; el commit/push de checkpoint es una acción manual del usuario posterior a esa aprobación.

## Corrección de compatibilidad de Secciones 1/2 — requisito previo a Sección 4

Las tareas completadas de Secciones 1–3 conservan su estado. Este parche acotado corrige la omisión de metadata ya persistida; no reabre trabajo ajeno ni implementa materialización. Sección 4 sólo puede comenzar después de completar el parche y obtener aprobación externa en C.3.

- [x] C.1 Agregar `genres: readonly string[]` a `ProviderLocalSnapshot` como metadata compatible con el `SavedTitle` actual y actualizar la verificación de type-contract de Sección 1; verificar que `ProviderMediaDetails.snapshot` incluye géneros y que `initialTags` permanece separado y fuera de `ProviderMediaDetails`, sin agregar taxonomía, IDs ni procedencia.
- [x] C.2 Actualizar el mapper puro de detalle TMDB para mapear nombres de género a `snapshot.genres` y actualizar la verificación de Sección 2 para movie, TV y géneros ausentes; conservar la política separada de `initialTags`, verificar que ambos valores usan el mismo DTO ya obtenido sin request adicional y reejecutar las verificaciones de Secciones 1–3 y `npx tsc --noEmit` sin cambiar enriquecimientos ni consumidores.
- [x] C.3 Someter el parche correctivo de C.1–C.2 y su evidencia a revisión externa antes de retomar Sección 4; dejar este checkpoint sin marcar hasta recibir aprobación. Todo commit/push posterior es una acción manual del usuario.

## 4. Materialización y guardado reutilizables

- [x] 4.1 Tras la aprobación de C.3, extraer la preservación de estado local a un materializador que recibe `ProviderMaterializationInput` sin comprobar `provider === "tmdb"`; verificar creación con ID opaco, `snapshot.genres` en `SavedTitle.genres` e `initialTags` en `SavedTitle.tags`, y refresh que actualiza géneros pero preserva ID, `createdAt`, status, tags, notas, puntuación personal, referencias existentes y semántica de `updatedAt`, ignorando `initialTags` para tags existentes.
- [x] 4.2 Incorporar en el repositorio un camino transaccional de guardado por `ProviderReference`, snapshot normalizado e `initialTags` explícitos, manteniendo lookup, upsert y attach actuales; verificar que guardar la misma referencia no duplica el MediaItem.
- [x] 4.3 Mantener o reducir `saveTmdbTitle` a un wrapper fino solamente si ayuda a una migración incremental, y verificar que el camino reusable final no acepta DTOs crudos, IDs sueltos ni interpreta géneros.
- [x] 4.4 Verificar que el primer guardado TMDB conserva géneros del snapshot y tags iniciales derivados por su política, que refresh actualiza `SavedTitle.genres` y preserva tags personalizados aunque difieran de `initialTags`, que la capa genérica no equipara géneros con tags, que `tmdb/movie/N` y `tmdb/tv/N` siguen independientes y que se conserva la protección contra referencias ya asignadas.
- [x] 4.5 Someter el diff completo de la Sección 4 a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; el commit/push de checkpoint es una acción manual del usuario posterior a esa aprobación.

## 5. Migración del detalle remoto TMDB

- [x] 5.1 Mantener una sola llamada a `getMovieDetails` o `getTvDetails` y pasar esa misma respuesta tanto a la presentación TMDB como al mapper portable usado al guardar/refrescar; verificar mediante dobles o conteo focalizado que el request de detalle no se duplica.
- [x] 5.2 Remover de la ruta el mapeo duplicado de año, géneros, overview y `vote_average`, construir por separado el input de materialización y verificar save, re-save y lookup por la referencia completa.
- [x] 5.3 Mantener en la ruta TMDB runtime, temporadas, director, reparto, perfiles, watch providers, fallback AR→US, logos y enlaces; verificar que su presentación e imágenes continúan iguales.
- [x] 5.4 Preservar la coordinación conjunta actual de details, credits y watch providers y comprobar que una falla de cualquiera mantiene el flujo integral de error, sin introducir render parcial.
- [x] 5.5 Someter el diff y la evidencia runtime de la Sección 5 a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; el commit/push de checkpoint es una acción manual del usuario posterior a esa aprobación.

## 6. Evaluación opcional de helpers async

- [x] 6.1 Evaluar con los consumidores ya migrados si secuencia, identidad de recurso y comparación de requests ofrecen reutilización concreta sin depender de credenciales; documentar como resultado válido que no corresponde extraer nada y conservar el helper TMDB cuando esa reutilización no exista.
  - Resultado revisado: **no extraction warranted**. Buscar y el detalle remoto son los dos consumidores, pero ambos son flujos exclusivamente TMDB y necesitan que la identidad compare conjuntamente secuencia, recurso y `snapshot.generation` para invalidar éxitos y fallos tras cambios de credencial. Extraer sólo secuencia/recurso obligaría a recomponer o esconder la generación TMDB en cada caller, sin un consumidor provider-independent actual y con más indirección que el helper cohesivo existente. Se conserva `tmdbRemoteRequestIdentity.ts` sin cambios de producción; las regresiones focalizadas existentes cubren consulta/recurso vigente, secuencia obsoleta, cambio de recurso, cambio de generación, unmount y fallo obsoleto.
- [x] 6.2 Si la evaluación justifica una extracción, mover solamente secuencia/recurso/comparación y verificar rechazo de respuestas obsoletas; mantener `TmdbCredentialStatus`, generation, elegibilidad y configuración en TMDB, sin introducir networking genérico.
- [x] 6.3 Si la Sección 6 produce cambios de código, someter su diff a revisión externa y dejar este checkpoint sin marcar hasta recibir aprobación; si no produce cambios, registrar la decisión revisada de no extracción. Todo commit/push posterior es manual del usuario.

## 7. Regresión y cierre

- [x] 7.1 Agregar/ejecutar verificaciones focalizadas de search mapping, detail mapping desde una respuesta ya obtenida y materialización genérica, sin incorporar un framework de tests nuevo.
- [x] 7.2 Reejecutar las verificaciones relevantes de identidad universal: SQLite v4, backup v5, imports históricos, referencias movie/TV con mismo ID, detalle local/offline y pins; confirmar que no cambiaron schema ni formato.
- [x] 7.3 Reejecutar las verificaciones relevantes de credenciales, personal rating, sorting y preferencias de browsing, y comprobar que la atribución TMDB/JustWatch permanece intacta.
- [x] 7.4 Ejecutar `npx tsc --noEmit` y resolver cualquier error sin modificar dependencias ni el `package.json` ajeno al cambio.
  - Evidencia automatizada y revisión estática: `docs/testing/provider-abstraction/section-7-validation.md`. Pasaron 35 scripts CJS existentes, los contratos de tipos incluidos en `npx.cmd tsc --noEmit` y la validación OpenSpec estricta. No se detectó una regresión ni se modificó producción.
- [x] 7.5 Revisar manualmente en web Buscar, detalle TMDB, guardar/refrescar, navegación al detalle local, errores y estados de credencial; documentar el resultado y confirmar que no existen descriptor sin consumidor, paginación compartida, capability remota de detalle, registry, segundo proveedor, anime/manga, taxonomía nueva, schema v5 ni backup v6.
- [x] 7.6 Someter el diff completo y toda la evidencia de regresión a revisión externa final antes de archivar; dejar este checkpoint sin marcar hasta la aprobación externa y mantener cualquier commit/push como acción manual del usuario.
