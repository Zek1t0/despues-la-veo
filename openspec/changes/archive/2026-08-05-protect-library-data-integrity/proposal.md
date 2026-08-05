# Propuesta: proteger la integridad de la biblioteca

## Problema

La importación de backups JSON versión 1 no restaura actualmente todos los campos persistidos de un título. En particular, la normalización omite `overview`, `voteAverage` y `genres`, y el upsert posterior puede reemplazarlos por valores vacíos. Además, una copia antigua puede sobrescribir estado, etiquetas y notas más recientes sin advertencia ni comparación de fechas.

El esquema SQLite identifica coincidencias mediante `provider + externalId`. Si un backup contiene esa misma combinación con un `type` distinto, el upsert actual podría sobrescribir una fila que representa otra clase de contenido. Los errores por elemento también se reducen a un conteo global, sin distinguir inserciones, actualizaciones, omisiones, conflictos de identidad, elementos inválidos o fallos de persistencia.

Resolver estos riesgos es necesario antes de continuar agregando funcionalidades, porque afectan la capacidad de recuperar la única copia persistida de la biblioteca.

## Objetivo

Hacer que exportar e importar una biblioteca sea una operación segura, predecible y compatible con backups JSON versión 1 existentes, preservando todos los campos persistidos y evitando que datos antiguos, incompletos o con identidad incompatible degraden información local.

## Alcance

- Documentar y centralizar el contrato efectivo del backup JSON versión 1.
- Restaurar todos los campos persistidos de `SavedTitle`.
- Aceptar backups versión 1 anteriores que omitan campos opcionales.
- Distinguir campos ausentes, valores `null` permitidos y valores presentes con tipo inválido.
- Validar que `externalId`, `title` e `id` presente no sean strings vacíos, y que las fechas presentes sean números finitos y no negativos.
- Comparar `updatedAt` al importar una fila coincidente por `provider + externalId` y el mismo `type`.
- Actualizar una coincidencia sólo cuando el backup tenga un `updatedAt` válido y posterior.
- Conservar la fila local como `skipped` cuando `updatedAt` esté ausente, sea anterior o igual; tratar como `invalid` cualquier fecha presente con tipo o valor inválido.
- No escribir cuando coincidan `provider + externalId` pero difiera `type`; contabilizarlo como conflicto de identidad.
- Evitar que un campo ausente en un backup compatible borre un valor local existente.
- Antes de importar, informar cantidades de elementos válidos e inválidos y explicar la política de merge y la posibilidad de resultados parciales.
- Después de importar, informar `inserted`, `updated`, `skipped`, `conflicts`, `invalid` y `failed` reales.
- Mantener la importación como merge: nunca borrar títulos locales que no estén en el backup.
- Añadir comprobaciones automatizadas o verificaciones reproducibles para round-trip, compatibilidad y conflictos.

## Fuera de alcance

- Cambiar el diseño visual o la navegación, salvo los textos necesarios del flujo de importación.
- Agregar funcionalidades de producto.
- Modificar la integración con TMDB.
- Reescribir SQLite o cambiar su esquema e índices.
- Adoptar ahora la identidad definitiva `provider + type + externalId`; requerirá un cambio posterior con migración SQLite explícita.
- Cambiar el formato a una versión 2.
- Agregar o actualizar dependencias.
- Incorporar un dry-run complejo, sincronización entre dispositivos o backend.

## Impacto esperado

Las áreas afectadas serán el flujo de importación/exportación en `app/(tabs)/ajustes.tsx` y las operaciones necesarias del repositorio en `src/storage/savedTitlesRepo.ts`. El modelo persistido y el esquema SQLite se mantienen.

El usuario seguirá importando backups versión 1 desde la misma pantalla. La diferencia visible se limitará a textos más precisos antes y después de importar; no habrá rediseño.

## Riesgos para datos existentes

- Una comparación incorrecta de fechas podría omitir una restauración válida o permitir que un backup antiguo sobrescriba datos nuevos.
- Tratar un campo ausente como `null` podría borrar información agregada por una versión posterior.
- No detectar un `type` distinto bajo la misma clave SQLite podría sobrescribir otra entidad.
- Una importación con errores puede aplicar sólo parte del backup; el resultado debe hacerlo explícito.
- Cambiar ahora la identidad del índice SQLite podría crear duplicados o requerir decisiones de migración fuera de alcance. Se conservará el índice actual y se agregará una barrera lógica ante conflictos de tipo.

## Estrategia de reversión

El cambio no modifica el esquema SQLite ni transforma filas existentes de forma masiva. Si fuera necesario revertirlo, se restaurará el comportamiento anterior del importador y del repositorio sin migración de base. Antes de probar importaciones sobre datos valiosos se deberá generar un backup JSON y conservarlo fuera de la aplicación.

## Criterios de éxito

- Un ciclo exportar → importar conserva todos los campos persistidos.
- Un backup versión 1 sin campos opcionales sigue siendo aceptado.
- Un backup más antiguo, con igual fecha o con `updatedAt` ausente no reemplaza una coincidencia local y se informa como `skipped`.
- Una fecha presente inválida hace `invalid` al elemento y no produce escritura.
- Un backup más reciente actualiza una coincidencia del mismo tipo sin crear duplicados, conserva `id` y `createdAt` locales y persiste el `updatedAt` entrante.
- Una coincidencia con distinto `type` no escribe y se informa como conflicto de identidad.
- Los campos ausentes respetan los valores definidos para inserción y conservación local.
- Un valor `null` sólo borra campos cuyo contrato lo permite y un tipo inválido vuelve inválido al elemento.
- El resultado previo informa válidos e inválidos y explica merge y parcialidad.
- El resultado final diferencia `inserted`, `updated`, `skipped`, `conflicts`, `invalid` y `failed`.
- TypeScript pasa con `npx tsc --noEmit` y el flujo web se revisa manualmente.
