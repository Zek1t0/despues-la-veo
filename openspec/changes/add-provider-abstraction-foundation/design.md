## Context

Ver `proposal.md` para la motivación. La identidad local y externa ya está separada: `SavedTitle.id` es opaco y `ProviderReference` identifica recursos externos mediante provider, namespace e ID. SQLite v4 y backup v5 ya persisten esas referencias de forma genérica.

El acoplamiento restante está en el flujo remoto. `app/(tabs)/buscar.tsx` consume `TmdbSearchItem` y transforma `media_type`, `title/name`, fechas y `poster_path`; `app/tmdb/[type]/[id].tsx` consume un detalle sin tipo (`any`), transforma campos portables y llama a `saveTmdbTitle`; `src/core/tmdbSavedTitle.ts` combina interpretación TMDB con preservación de estado local; y `src/storage/savedTitlesRepo.ts` expone un guardado cuyo input sigue siendo TMDB.

Al mismo tiempo, créditos, watch providers, credenciales, atribución y la ruta remota solamente existen para TMDB. Convertirlos en conceptos universales ahora crearía contratos basados en una sola API.

## Goals / Non-Goals

**Goals:**

- Establecer una frontera pequeña entre DTOs remotos, datos normalizados y materialización local.
- Evitar que Buscar conozca nombres de campos crudos de TMDB.
- Hacer reutilizable la preservación de identidad y estado personal al guardar o refrescar metadata.
- Mantener la interpretación y políticas propias de TMDB en un adaptador explícito.
- Permitir implementar y revisar el refactor en etapas sin cambios de datos ni de producto.

**Non-Goals:**

- Agregar un segundo proveedor, registro/resolver de proveedores o búsqueda multiproveedor.
- Rediseñar `TitleType`, agregar anime/manga u otra taxonomía.
- Generalizar créditos, disponibilidad, imágenes, credenciales, atribución, networking o rutas.
- Cambiar el flujo integral de éxito/fallo del detalle TMDB.
- Fusionar metadata, vincular proveedores o elegir fuentes para un MediaItem.
- Cambiar SQLite v4, backup v5 o compatibilidad histórica.

## Decisions

### 1. Usar solamente el contrato operativo que tiene un consumidor actual

Se introducirá un contrato estrecho de búsqueda normalizada porque Buscar es un consumidor actual. TMDB tendrá un adaptador explícito que lo implementa.

No se introducirá `ProviderDescriptor`: no hay registry, selector, orquestación multiproveedor ni UI genérica de configuración o atribución que consuma `id` y `displayName`. `ProviderReference.provider` continúa siendo la identidad completa ya utilizada por el sistema.

Forma conceptual, sujeta a nombres finales durante implementación:

```ts
interface ProviderSearchCapability {
  search(query: string): Promise<readonly ProviderSearchResult[]>;
}
```

El contrato no incluirá page, `hasMore`, cursor ni metadata de paginación porque Buscar no los consume. Tampoco se creará una interfaz remota de detalle: la ruta TMDB ya realiza una sola consulta de detalle y necesita la misma respuesta para metadata portable y presentación específica.

No se creará una interfaz grande con search, detail, images, credits, watch, configuración y atribución. Tampoco se creará infraestructura dinámica de capabilities.

**Alternativas consideradas:** una interfaz `MediaProvider` integral acoplaría todos los proveedores al conjunto de funciones de TMDB; un descriptor sin consumidor agregaría simetría nominal; paginación reflejaría la API remota, no el uso actual; y una capability remota de detalle podría duplicar el request o contaminar el contrato portable. El contrato operativo queda limitado a search y el detalle comparte solamente tipos y mappers puros.

### 2. No introducir un registry con un único proveedor

Buscar continuará importando el adaptador TMDB explícitamente. No existe hoy una decisión runtime entre proveedores, por lo que un mapa que sólo puede resolver `tmdb` agrega indirección sin consumidor real.

Un registry estático podrá incorporarse cuando un segundo proveedor obligue a resolver capacidades por `ProviderReference.provider`.

### 3. Normalizar el resultado antes de entregarlo a Buscar

El contrato compartido contendrá solamente lo consumido por la UI:

```ts
type ProviderSearchResult = Readonly<{
  reference: ProviderReference;
  displayTitle: string;
  releaseLabel: string | null;
  posterUrl: string | null;
  description: string | null;
  kindLabel: string;
}>;
```

`kindLabel` es presentación, no taxonomía. El adaptador TMDB filtrará resultados ajenos a movie/TV, mapeará title/name y sus fechas respectivas, construirá la referencia canónica y resolverá el póster a URL absoluta.

La navegación seguirá siendo TMDB específica. Como Buscar permanece respaldado solamente por TMDB, puede construir `/tmdb/${reference.resourceNamespace}/${reference.externalId}` después de recibir la referencia normalizada.

**Alternativas consideradas:** incluir `TitleType` en cada resultado afirmaría que todos los recursos remotos caben en el dominio local; incluir una unión `movie|tv|anime|manga` adelantaría la taxonomía; exponer un href desde el adaptador mezclaría metadata con routing.

### 4. Mapear una única respuesta de detalle a metadata portable

La ruta continuará llamando una sola vez a `getMovieDetails` o `getTvDetails`. Usará esa respuesta cruda tanto para runtime/temporadas y otra presentación TMDB como para invocar un mapper puro que produzca el modelo portable:

```ts
type ProviderMediaDetails = Readonly<{
  reference: ProviderReference;
  snapshot: ProviderLocalSnapshot;
}>;

type ProviderLocalSnapshot = Readonly<{
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  voteAverage: number | null;
}>; 
```

No existirá `getPortableDetails()` provider-neutral en este cambio. `ProviderMediaDetails` es un tipo normalizado, no una operación remota, y por lo tanto no provoca una segunda consulta TMDB.

`type` significa compatibilidad explícita con el dominio local actual; no define una taxonomía remota universal. Un recurso futuro que no pueda mapearse honestamente a `movie|tv` no podrá usar este materializador hasta que una futura capacidad de dominio amplíe el modelo.

`voteAverage` se mantiene como el campo histórico del snapshot local. El contrato no agrega procedencia, escala ni equivalencia entre proveedores.

Los nombres de género no forman parte de `ProviderMediaDetails`. Son input de una política local de creación provista explícitamente por TMDB:

```ts
type ProviderMaterializationInput = Readonly<{
  reference: ProviderReference;
  snapshot: ProviderLocalSnapshot;
  initialTags: readonly string[];
}>;
```

No se creará un framework de políticas. El mapper o caller TMDB puede derivar el array de nombres de género antes de construir este input local.

Runtime, temporadas, créditos, director y watch providers permanecen en tipos y funciones TMDB consumidos por `/tmdb/[type]/[id]`. Para preservar el comportamiento actual, la ruta seguirá esperando conjuntamente detalle, créditos y watch providers antes de publicar éxito, reutilizando el único detalle ya obtenido para el mapper portable.

### 5. Hacer genérica solamente la preservación local

La función de materialización recibirá:

- `ProviderReference` ya validada por el adaptador;
- snapshot compatible con el dominio local;
- tags iniciales definidos por el proveedor;
- MediaItem existente o nulo;
- generador de ID y reloj.

No comprobará `provider === "tmdb"`. Al crear, generará el ID local y aplicará los tags iniciales suministrados. Al refrescar, preservará ID, `createdAt`, status, tags, notas y puntuación personal, y usará la lógica vigente de `updatedAt`.

La validación de coincidencia entre namespace TMDB, ID canónico y tipo local ocurrirá en el adaptador antes de cruzar el límite. La capa genérica se limitará a validar invariantes locales y la presencia de una referencia canónica genérica.

**Alternativa considerada:** conservar `materializeTmdbSavedTitle` como única implementación mantendría la política local atada a TMDB. Hacer que el materializador interprete géneros generalizaría una política que sólo está probada para TMDB.

### 6. Orientar el repositorio a referencia más snapshot normalizado

El camino reusable de guardado aceptará la referencia, el snapshot y los tags iniciales. Dentro de la transacción:

1. buscará el MediaItem por la referencia completa;
2. materializará con preservación local;
3. hará upsert del MediaItem;
4. adjuntará la referencia solamente si el item es nuevo.

Puede mantenerse temporalmente `saveTmdbTitle` como wrapper fino durante la migración de callers, pero el camino final reusable no recibirá DTOs ni IDs sueltos de TMDB.

No se agrega linking: si una referencia nueva no existe, crea un MediaItem nuevo; no intenta encontrar equivalentes mediante otra referencia.

### 7. Mantener imágenes como valores normalizados, no como capability

`posterUrl` cruza la frontera como URL absoluta porque eso es lo que consumen las vistas y persiste el snapshot. La construcción desde `poster_path` y los tamaños TMDB permanecen en TMDB.

`profileUrl` y `providerLogoUrl` continúan siendo helpers TMDB, ya que solamente sirven a enriquecimientos TMDB. No se agrega modelo de backdrops o galerías.

### 8. No generalizar credenciales, errores legales ni atribución

`TmdbCredentialService`, sus stores web/native, validación, provider React, pantallas y presentadores de error permanecen bajo `src/providers/tmdb/credential/`. Buscar y el detalle seguirán usando su snapshot y generation.

La atribución de TMDB/JustWatch continuará codificada explícitamente en la pantalla Acerca de. No se define una interfaz legal común.

### 9. Extraer request identity sólo si el resultado es realmente genérico

`sequence`, `resource` y comparación para rechazar respuestas obsoletas pueden moverse a un helper sin nombre TMDB si búsqueda y detalle lo consumen sin importar tipos de credencial. La decisión de ejecutar una búsqueda, `TmdbCredentialStatus` y `generation` por cambio de token permanecen en helpers TMDB.

No se introduce cancelación, cliente HTTP común, retries automáticos ni un framework de requests.

### 10. Mantener persistencia y formatos exactamente iguales

La versión anterior y posterior de SQLite es 4; no hay migración. La versión anterior y posterior del backup es 5; no hay conversión de formato. `media_provider_references` y `ProviderReference[]` ya contienen la extensibilidad necesaria.

La lógica explícita de TMDB en `databaseSchema.ts`, `libraryBackupV5.ts`, `libraryBackupMerge.ts`, `titlePinsRepo.ts` y helpers históricos se conserva porque protege compatibilidad, no porque participe del runtime abstracto.

Una necesidad aparente de schema v5 o backup v6 detiene esa línea de implementación y exige una revisión de diseño separada.

## Affected Areas

- Nuevos contratos compartidos: ubicación final bajo `src/providers/` o `src/core/`, evitando dependencias hacia UI o storage; no incluyen descriptor, paginación ni capability remota de detalle.
- Adaptación TMDB: `src/providers/tmdb/tmdbTypes.ts`, `tmdbApi.ts` y uno o más archivos de adapter/mapping dedicados.
- UI remota: `app/(tabs)/buscar.tsx` y `app/tmdb/[type]/[id].tsx`.
- Dominio/materialización: `src/core/tmdbSavedTitle.ts` y un materializador local compartido nuevo o extraído.
- Repositorio: `src/storage/savedTitlesRepo.ts`.
- Helpers async: `src/providers/tmdb/credential/tmdbRemoteRequestIdentity.ts` y, sólo si se demuestra reutilización concreta, un helper compartido estrecho.
- Verificación: scripts focalizados bajo `docs/testing/` siguiendo el patrón existente.

No se espera modificar `databaseSchema.ts`, contratos de backup, credenciales, atribución, rutas locales ni componentes de biblioteca salvo ajustes de imports estrictamente necesarios.

## Risks / Trade-offs

- [El contrato compartido se convierte en una taxonomía implícita] → Mantener `kindLabel` como presentación y `TitleType` solamente en el snapshot materializable actual.
- [Se universaliza accidentalmente `voteAverage`] → Documentarlo como campo local legado y no agregar escalas, procedencia ni comparación entre proveedores.
- [El refactor cambia resultados o textos de Buscar] → Comparar mapeos movie/TV, ausencia de campos, etiquetas, rutas y estados runtime con el comportamiento actual.
- [Se pierden campos personales durante refresh] → Probar por separado cada campo preservado y reutilizar `nextSavedTitleUpdatedAt`.
- [El nuevo save path crea duplicados] → Resolver siempre por la referencia completa antes del upsert y cubrir movie/TV con el mismo ID.
- [Separar detalle portable altera el `Promise.all`] → Mantener la misma coordinación en la ruta TMDB; solamente mover transformaciones portables.
- [Un wrapper TMDB temporal sobrevive indefinidamente] → Las tareas exigen que el caller final use el camino normalizado; el wrapper sólo puede quedar como compatibilidad fina sin DTOs crudos.
- [Más archivos sin beneficio runtime inmediato] → Limitar el contrato operativo a búsqueda y compartir solamente tipos/mappers puros para detalle y materialización; no crear descriptor, registry ni capabilities especulativas.

## Migration Plan

1. Agregar tipos compartidos sin cambiar consumidores.
2. Introducir y verificar mappers puros TMDB.
3. Migrar Buscar al resultado normalizado manteniendo TMDB explícito.
4. Extraer materialización local y agregar el save path por referencia/snapshot.
5. Migrar el guardado del detalle TMDB al nuevo límite manteniendo enriquecimientos y coordinación actuales.
6. Extraer helpers async solamente si la implementación demuestra una separación limpia.
7. Ejecutar verificaciones focalizadas, suite existente, TypeScript y validación web manual.

Cada etapa debe mantener compilación y permitir revertir sus cambios de código sin transformar datos. No existe rollback de persistencia porque no se modifica el esquema ni el formato de backup.
