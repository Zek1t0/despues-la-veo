# Tareas

Cada sección constituye una sesión coherente de implementación y verificación en Codex.

## 1. Contrato y normalización

- [ ] 1.1 Inventariar cada campo de `SavedTitle`, su representación JSON versión 1, tipos admitidos, nulabilidad y columna SQLite.
- [ ] 1.2 Definir tipos internos para elemento normalizado, presencia de campos opcionales y errores de validación.
- [ ] 1.3 Exigir `provider`, `externalId`, `type` y `title`; validar que `externalId` y `title` sean strings no vacíos después de `trim` y que `id`, si aparece, sea un string no vacío.
- [ ] 1.4 Restaurar `overview`, `voteAverage` y `genres`, además de los campos ya contemplados.
- [ ] 1.5 Aplicar a inserciones los valores por ausencia: `planned`, arrays vacíos, campos anulables en `null` y fechas locales coherentes sólo cuando `createdAt` o `updatedAt` estén ausentes.
- [ ] 1.6 Preservar la diferencia entre campo ausente y `null` explícito, permitiendo `null` sólo en los campos anulables definidos.
- [ ] 1.7 Validar que `createdAt` y `updatedAt` presentes sean números finitos y no negativos; si no, producir `invalid` sin escribir tanto en inserciones como en coincidencias.
- [ ] 1.8 Mantener compatibilidad con backups JSON versión 1 anteriores y rechazo completo de JSON o versión inválidos.

## 2. Merge seguro y conflictos

- [ ] 2.1 Consultar la fila existente por `provider + externalId` antes de decidir cada escritura.
- [ ] 2.2 Detectar distinto `type` bajo la misma clave, no escribir y contabilizar `conflicts` con referencia y motivo.
- [ ] 2.3 Para coincidencias del mismo tipo, actualizar sólo cuando `updatedAt` entrante sea válido y posterior.
- [ ] 2.4 Contabilizar como `skipped` y conservar la fila local ante `updatedAt` anterior, igual o ausente; los valores presentes inválidos ya deben llegar como `invalid` sin escritura.
- [ ] 2.5 En una actualización válida, conservar siempre `id` y `createdAt` locales, conservar cualquier campo ausente y persistir exactamente el `updatedAt` entrante.
- [ ] 2.6 Aplicar `null` explícito únicamente a `year`, `posterUrl`, `overview`, `voteAverage` y `notes`.
- [ ] 2.7 Resolver una colisión de `id` en una inserción sin reemplazar otra fila.
- [ ] 2.8 Mantener el procesamiento parcial por elemento y devolver resultados acordes a lo efectivamente persistido.

## 3. Resultados e interfaz

- [ ] 3.1 Definir el resultado final con `inserted`, `updated`, `skipped`, `conflicts`, `invalid` y `failed`.
- [ ] 3.2 Conservar referencias y motivos seguros para elementos conflictivos, inválidos o fallidos.
- [ ] 3.3 Mostrar antes de confirmar sólo las cantidades de elementos válidos e inválidos.
- [ ] 3.4 Explicar antes de confirmar la política de merge, la protección por tipo y fecha, y la posibilidad de resultados parciales.
- [ ] 3.5 Mostrar después los seis resultados reales y evitar describir una importación parcial como éxito total.
- [ ] 3.6 Reutilizar la pantalla y los estilos actuales, limitando los cambios visuales a los textos de importación.

## 4. Verificación y documentación

- [ ] 4.1 Verificar round-trip completo y backups versión 1 con cada campo opcional ausente.
- [ ] 4.2 Verificar valores de inserción, conservación de campos ausentes en coincidencias y `null` explícito permitido.
- [ ] 4.3 Verificar strings obligatorios vacíos, `id` vacío y fechas presentes negativas, no finitas o con tipo inválido; todos deben producir `invalid` sin escritura.
- [ ] 4.4 Verificar inserciones con fechas ausentes y válidas, y coincidencias del mismo tipo con `updatedAt` posterior, anterior, igual y ausente.
- [ ] 4.5 Verificar que una actualización persiste el `updatedAt` entrante y conserva siempre `createdAt` local.
- [ ] 4.6 Verificar conflicto de distinto `type`, colisión de `id` y que títulos ausentes del backup nunca se borren.
- [ ] 4.7 Verificar mezclas de `inserted`, `updated`, `skipped`, `conflicts`, `invalid` y `failed`, incluidos referencias y motivos.
- [ ] 4.8 Documentar el contrato JSON versión 1, la política de merge y que `provider + type + externalId` queda para una migración SQLite posterior.
- [ ] 4.9 Confirmar que no se modificaron esquema SQLite, dependencias ni TMDB.
- [ ] 4.10 Ejecutar `npx tsc --noEmit`.
- [ ] 4.11 Revisar manualmente en web los textos previos, la confirmación y el resultado final.
