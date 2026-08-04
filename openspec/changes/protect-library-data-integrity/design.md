# Diseño: importación segura de la biblioteca

## Situación actual

`app/(tabs)/ajustes.tsx` define localmente el payload versión 1, valida el archivo, normaliza cada título y llama a `bulkUpsertSavedTitles()`. La normalización no incluye `overview`, `voteAverage` ni `genres`.

`src/storage/savedTitlesRepo.ts` implementa un upsert que reemplaza todos los campos ante un conflicto por `provider + externalId`. No compara `updatedAt`, no protege una diferencia de `type` y devuelve únicamente cantidades `ok` y `fail`.

El esquema `saved_titles` ya contiene todos los campos requeridos y un índice único sobre `provider + externalId`. Este cambio no modifica `src/storage/db.ts`, el esquema ni el índice.

## Decisiones

### 1. Mantener JSON versión 1

No se crea una versión nueva porque el formato exportado ya puede serializar objetos `SavedTitle` completos. El problema está en la lectura incompleta y en la política de conflicto, no en la capacidad del formato actual.

El contrato versión 1 reconocerá todos los campos persistidos. Los campos compatibles definidos como opcionales podrán faltar. La normalización preservará la diferencia entre campo ausente, campo presente con `null` y campo presente con tipo inválido.

### 2. Separar validación, normalización y aplicación

El flujo tendrá tres etapas conceptuales:

1. Validar la envoltura `{ version, exportedAt, items }` sin escribir en SQLite y contar elementos válidos e inválidos.
2. Normalizar cada elemento, conservando presencia y validez de los campos.
3. Aplicar los elementos válidos contra el estado local usando las políticas de identidad, fecha y merge.

No habrá un dry-run que simule todas las escrituras. La confirmación previa usará sólo la validación y explicará que el merge puede terminar parcialmente. La lógica pura podrá extraerse de la pantalla a un módulo pequeño si facilita su verificación, sin introducir una arquitectura nueva ni dependencias.

### 3. Identidad y conflicto de tipo

El índice SQLite existente obliga a buscar coincidencias por `provider + externalId` y se mantiene sin cambios.

- Mismo `provider + externalId` y mismo `type`: se aplica la política normal de fechas y campos.
- Mismo `provider + externalId` y distinto `type`: no se inserta ni actualiza; se conserva la fila local y el elemento se contabiliza como `conflicts` por conflicto de identidad.

La identidad definitiva `provider + type + externalId` requerirá un cambio posterior que modifique el índice y migre SQLite de forma explícita y verificable. No se anticipará esa migración en este cambio.

Para una actualización válida se conservarán siempre `id` y `createdAt` locales. Para una inserción se aceptará un `id` entrante válido sólo si no colisiona; ante una colisión ajena se generará un UUID local antes de persistir.

### 4. Contrato explícito de campos

| Campo | Validez en el backup | Si se inserta y está ausente | Si coincide y está ausente | Regla adicional |
| --- | --- | --- | --- | --- |
| `provider` | Obligatorio y proveedor soportado | No aplica: elemento inválido | No aplica: elemento inválido | Parte de la búsqueda SQLite |
| `externalId` | Obligatorio, `string` no vacío después de `trim` | No aplica: elemento inválido | No aplica: elemento inválido | Parte de la búsqueda SQLite |
| `type` | Obligatorio: `movie` o `tv` | No aplica: elemento inválido | No aplica: elemento inválido | Si difiere del local, conflicto de identidad |
| `title` | Obligatorio, `string` no vacío después de `trim` | No aplica: elemento inválido | No aplica: elemento inválido | Un tipo o valor inválido invalida el elemento |
| `id` | Opcional; si está presente debe ser `string` no vacío | Se usa si no colisiona; de lo contrario se genera uno local | Se conserva el `id` local | No redefine la identidad lógica |
| `createdAt` | Opcional por compatibilidad; si está presente debe ser número finito y no negativo | Si falta se genera una fecha local coherente; si es válido se usa | Se conserva siempre el valor local | Si está presente pero es inválido, el elemento es `invalid` y no se escribe |
| `updatedAt` | Opcional por compatibilidad; si está presente debe ser número finito y no negativo | Si falta se genera una fecha local coherente; si es válido se usa | Si falta, se conserva la fila local como `skipped` | Si está presente pero es inválido, el elemento es `invalid`; si habilita una actualización, se persiste el valor entrante |
| `status` | Opcional; si está presente debe ser un estado permitido | `planned` | Se conserva el local | No admite `null` |
| `tags` | Opcional; si está presente debe ser array de strings | `[]` | Se conservan los locales | No admite `null` |
| `year` | Opcional; número válido o `null` | `null` | Se conserva el local | `null` explícito borra en actualización válida |
| `posterUrl` | Opcional; `string` o `null` | `null` | Se conserva el local | `null` explícito borra en actualización válida |
| `overview` | Opcional; `string` o `null` | `null` | Se conserva el local | `null` explícito borra en actualización válida |
| `voteAverage` | Opcional; número válido o `null` | `null` | Se conserva el local | `null` explícito borra en actualización válida |
| `notes` | Opcional; `string` o `null` | `null` | Se conserva el local | `null` explícito borra en actualización válida |
| `genres` | Opcional; si está presente debe ser array de strings | `[]` | Se conservan los locales | No admite `null` |

Reglas generales:

- Todo campo presente con un tipo no permitido vuelve inválido al elemento completo; no se corrige silenciosamente ni se convierte en ausencia.
- `null` explícito sólo puede borrar `year`, `posterUrl`, `overview`, `voteAverage` y `notes` durante una actualización habilitada.
- La ausencia de `status`, `tags`, campos anulables o `genres` aplica los valores de inserción de la tabla sólo para títulos nuevos; en coincidencias conserva el valor local.
- `createdAt` y `updatedAt`, cuando están presentes, deben ser números finitos y no negativos; cualquier incumplimiento vuelve `invalid` al elemento completo, tanto para inserciones como para coincidencias.
- La ausencia de `updatedAt` en una coincidencia no la hace más reciente: conserva la fila local como `skipped`.

### 5. Política de fechas conservadora

Después de confirmar que la coincidencia también tiene el mismo `type`:

- `incoming.updatedAt > local.updatedAt`: el backup es elegible para actualizar según el contrato de campos y se persiste exactamente el `updatedAt` entrante.
- `incoming.updatedAt <= local.updatedAt`: se conserva la fila local y el resultado es `skipped`.
- `updatedAt` ausente: se conserva la fila local y el resultado es `skipped`.
- `updatedAt` presente pero con tipo o valor inválido: el elemento es `invalid` y no se escribe.

No se usará la hora de importación como reemplazo de una fecha ausente para una coincidencia ni como `updatedAt` de una actualización válida. Una inserción puede generar fechas locales sólo cuando `createdAt` o `updatedAt` estén ausentes; nunca cuando estén presentes pero sean inválidos. En toda actualización se conserva `createdAt` local.

### 6. Resultado previo y resultado final

Antes de importar se mostrarán:

- cantidad de elementos válidos;
- cantidad de elementos inválidos;
- explicación breve de que el merge no borra elementos ausentes, sólo actualiza coincidencias más antiguas del mismo tipo y conserva datos locales ante ambigüedad;
- advertencia de que algunos elementos pueden procesarse y otros fallar o ser omitidos.

Esto no es un dry-run: no anticipa `inserted`, `updated`, `skipped` ni `conflicts` porque esos resultados dependen de la aplicación real contra SQLite.

Después de importar se mostrarán los resultados reales:

- `inserted`: filas nuevas persistidas;
- `updated`: coincidencias del mismo tipo reemplazadas por una versión posterior;
- `skipped`: filas locales conservadas por fecha anterior, igual o no confiable;
- `conflicts`: coincidencias de `provider + externalId` con distinto `type`;
- `invalid`: elementos rechazados por el contrato antes de persistir;
- `failed`: elementos válidos que no pudieron guardarse.

Los elementos en `conflicts`, `invalid` o `failed` conservarán una referencia segura —título o combinación de proveedor e ID externo— y un motivo breve. Se reutilizarán los componentes y estilos actuales; sólo cambiarán los textos necesarios.

### 7. Atomicidad y errores parciales

Se mantiene el procesamiento por elemento para que una fila defectuosa no bloquee la recuperación de todas las demás. La importación puede ser parcial y debe decirlo expresamente tanto antes de confirmar como en el resultado final.

La transacción existente puede conservarse siempre que los errores capturados no oculten lo que quedó persistido y cada categoría refleje el resultado real.

## Archivos previstos

- `app/(tabs)/ajustes.tsx`: coordinación del selector, validación previa, confirmación y resultado final.
- `src/storage/savedTitlesRepo.ts`: lectura de coincidencias, barrera de conflicto de tipo, persistencia segura y resultado detallado.
- `src/core/savedTitle.ts`: sólo si hacen falta tipos compartidos; no se cambiará el modelo persistido.
- Un módulo nuevo y pequeño junto al almacenamiento o dominio, únicamente si hace falta aislar contrato, normalización y política de merge.
- Archivos de prueba si la infraestructura existente lo permite sin dependencias; de lo contrario, verificaciones reproducibles documentadas.

## Compatibilidad y alcance técnico

- Se mantiene JSON `version: 1`.
- Se aceptan campos opcionales ausentes con las reglas de la tabla.
- Se conserva el índice SQLite `provider + externalId`.
- No se modifica el esquema SQLite ni se realiza una migración.
- No se agregan ni actualizan dependencias.
- No se modifican TMDB, rutas ni estilos ajenos a los textos de importación.

## Alternativas descartadas

### Cambiar ahora a `provider + type + externalId`

Es la solución definitiva para la identidad, pero exige cambiar el índice y migrar datos SQLite. Se deja para un cambio posterior dedicado.

### Sobrescribir siempre

Puede destruir ediciones posteriores al backup o una entidad de distinto tipo.

### Nunca actualizar coincidencias

Protege datos locales, pero impide restaurar deliberadamente una copia más nueva.

### Crear JSON versión 2

No es necesario: los exports actuales ya pueden contener el objeto completo y los backups anteriores pueden normalizarse de forma compatible.

### Reemplazar toda la biblioteca o hacer un dry-run completo

Reemplazar contradice el merge y aumenta el riesgo. Un dry-run completo duplicaría complejidad sin ser necesario para informar válidos, inválidos y posibles resultados parciales.

## Verificación

- Round-trip de un título con todos los campos.
- Inserciones con cada campo opcional ausente y sus valores predeterminados.
- Coincidencias con campos ausentes y conservación local.
- `null` explícito en cada campo que lo permite.
- Tipo inválido en cualquier campo presente.
- Inserciones con `createdAt` y `updatedAt` ausentes, presentes válidos y presentes inválidos.
- Coincidencias del mismo tipo con `updatedAt` posterior, anterior, igual, ausente y presente inválido.
- Persistencia exacta del `updatedAt` entrante y conservación del `createdAt` local en una actualización válida.
- Strings obligatorios vacíos después de `trim` e `id` opcional vacío.
- Coincidencia de `provider + externalId` con distinto `type`.
- Colisión de `id` con distinta identidad lógica.
- Mezcla de elementos válidos, inválidos, conflictivos y con fallo de persistencia.
- Mensaje previo y las seis categorías del resultado final.
- `npx tsc --noEmit`.
- Revisión manual web de selección, confirmación y resumen.
