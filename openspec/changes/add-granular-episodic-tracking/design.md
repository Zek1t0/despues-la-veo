## Context

La base publicada es adc9bf0c6ebfce2726ce8fe966c0afa15ea12854. El archive de fundación y las specs principales están presentes. databaseSchema.ts está en v9 y Ajustes exporta con libraryBackupV10. providerReference.ts distingue proveedor, namespace e ID. personalProgressRepo y sus snapshots ofrecen cola, transacciones, comparación de versión y publicación posterior al commit. libraryBackupMerge y personalProgressBackupImport aportan mapas efectivos y conflictos conservadores. ManualEntryForm edita títulos. La ficha usa ScrollView y Biblioteca/Colecciones comparten PersonalProgressSummary. tmdbApi cubre detalle de título y carece de guías.

## Goals / Non-Goals

Mantener disponibles offline identidad y decisiones, permitir inventarios parciales y acreditar métricas por alcance. Mantener separadas las tres dimensiones de posición manual, decisión y disponibilidad. El alcance excluye ciclos de consumo, fusión de unidades, tracking remoto de usuario y las ampliaciones de proposal.md.

## Decisions

### D1. Identidad y SQLite

Usar grupos y unidades en tablas propias por sus ciclos de vida, ambos con UUID portable único y FK al título. Una FK compuesta impide que una unidad apunte a un grupo de otro propietario. Grupo puede ser temporada, volumen o agrupación manual sin imponer jerarquías. Guardar juntos identidad y descriptor mínimo (tipo, coordenada canónica, nombre opcional y retiro) para poder mostrar la unidad tras desalojar caché. Guardar referencias de grupos y unidades aparte, con unicidad (proveedor, namespace, título externo, ID externo), comprobando pertenencia al propietario. Para TMDB el ID del episodio dentro de la serie identifica la referencia, la temporada no forma parte de la clave del episodio. Grupo remoto usa ID editorial de temporada. Conflictos UUID/referencia se reportan; coincidencia de nombre o coordenada no es evidencia.

Guardar decisiones en tabla aparte, una por unidad: marcada o desmarcada, fecha civil opcional solo si marcada, reloj entero y revisión. Ausencia significa sin decisión; no sembrar filas negativas. Mutaciones absolutas, revalidación en cola, reloj creciente por registro y publicación tras commit. Reintento de mismo resultado es no-op. Revalidar versiones de todo lote antes de escribir y limitar lotes a 500 IDs, con particiones explícitas para conjuntos mayores. Cada confirmación tiene su propia transacción, resultado y revalidación; la UI informa que un fallo posterior no revierte particiones confirmadas. Aplicar cascada al eliminar propietario. Editar manual conserva UUID, retirar oculta de listas activas y mantiene decisiones, restaurar reactiva. La interfaz no ofrece borrado físico individual. Un backup anterior al borrado de un título puede recrear título y unidades según contrato histórico; no hay tombstones generales.

Reutilizar validación canónica del cursor donde comparta representación. Mantener capítulo decimal como texto sin coerción y usar claves ordenables de parte entera y fracción rellenada a seis posiciones. Índices de propietario/grupo/estado más claves de orden y UUID; cursor de página por tupla de orden con UUID como desempate. Orden explícito entre clases de numeración. Revisar la página si cambia la revisión de la lista. No identificar unidades por posición ni convertir entre modos.

### D2. Inventario y comprobaciones TMDB

Capacidad separada de búsqueda y detalle; validación y transporte reutilizan tmdbClient y la política de credenciales, admisión y cancelación. Solicitar una temporada por acción y como máximo una consulta adicional del índice de serie si falta o está vencido. Una descarga activa por título y deduplicación por referencia, temporada e idioma. Validar vigencia de referencia y generación al commit. Mantener caché extensa en snapshot por alcance; índice de serie, pertenencia por revisión y evidencia tienen ciclo propio respecto del descriptor durable.

La documentación oficial describe consulta de temporada con listado de episodios y consulta de detalle por coordenadas. Validar IDs, pertenencia, temporada 0, números, fecha y opcionales (nombre, sinopsis, duración, imagen), tolerando opcionales ausentes sin inventarlos. No utilizar el detalle por episodio para poblar filas. Respetar 429 y Retry-After mediante la política vigente. No se probaron autenticación, CORS ni runtime de estos endpoints en Web/Android. S2 debe verificar forma real, conteos, temporada cero y error/cancelación con fixtures y registrar aceptación segura de plataforma. Si no se acredita el contador o su significado, conservar guía parcial sin habilitar cobertura editorial ni retiros.

Fuentes: [Temporada TMDB](https://developer.themoviedb.org/reference/tv-season-details), [Episodio TMDB](https://developer.themoviedb.org/reference/tv-episode-details), [Límites TMDB](https://developer.themoviedb.org/docs/rate-limiting).

Acreditar temporada si índice vigente declara grupo/contador coincidente, la respuesta de ese alcance llega completa, todos los IDs y coordenadas admitidas son coherentes, se comprueba pertenencia y el número de identidades únicas coincide. Si una fuente incorpora paginación, exigir todas las páginas de esa revisión. No interpretar 404, error, cancelación, duplicados, falta de contador o desacuerdo como retirada. En discrepancia conservar snapshot previo y degradar métrica activa. Una revisión acreditada puede retirar ausencias del mismo alcance, nunca borrar decisiones. Registrar mudanza con la misma referencia y desactivar membresía anterior sin fabricar completitud de la temporada afectada. No sumar manuales con TMDB ni guías de distintas referencias. Guía global solo con índice exhaustivo vigente y todos sus alcances acreditados y compatibles.

### D3. Disponibilidad, cobertura y vigencia

Conservar YYYY-MM-DD civil tal como llega e instantes con offset si la fuente los aporta. Comparar civiles con el día local sin UTC artificial: anterior = estrenado según fuente, posterior = anunciado, hoy = hora desconocida. Sin fecha = desconocido, retiro prima. Preservar fecha civil de consumo al viajar. Validarla como día existente y no futuro al registrar, sin revalidar contra la zona actual al restaurar historia.

Calcular intersección de marcas positivas con unidades estrenadas ordinarias acreditadas. Los especiales (incluida T0 de TMDB) se muestran en su alcance separado. Fechas desconocidas o del día actual que impiden determinar pertenencia suprimen porcentaje editorial. Los anuncios futuros quedan fuera. Mostrar por temporada, o cobertura global solo si hay evidencia global. Cero unidades implica ausencia de porcentaje. Sin decisiones explícitas positivas mostrar «Sin marcas» sin inferencias desde el cursor. Mostrar por separado marcas fuera del conjunto. Lista manual activa admite fracción de la lista y rótulo propio, sin atribuir disponibilidad cuando falte evidencia.

Política inicial revisable: acreditar evidencia durante siete días desde consulta válida. Ante fallo transitorio dentro del plazo, se puede mostrar métrica del último snapshot con fecha y corte de disponibilidad de esa consulta, rotulada como histórica, si el snapshot es íntegro y sigue siendo del mismo alcance. Ante contradicción, invalidez de referencia, evidencia no portable o vencimiento, solo conteos con estado visible. Nuevos estrenos se evalúan sobre un snapshot vigente y pueden bajar cobertura. Un reloj anterior a la consulta degrada la evidencia. El vencimiento solo degrada la acreditación: conserva guía, identidades, descriptores y decisiones, y permite marcar y desmarcar offline. No hay refresco de fondo.

### D4. Listas, selección y rangos

Mantener posición manual independiente evita ambigüedad con huecos; una proyección de marcas no puede reinterpretar el dato existente. Una ruta por título virtualiza páginas locales y la ficha solo monta una vista previa acotada. Una variante compacta opcional de cuadrícula usa la misma fuente paginada, IDs y selección. Solo monta una ventana de unidades reales y conserva huecos sin generar celdas desde totales o máximos. Leer agregados por lote dentro de los snapshots. No consultar desde tarjetas. Sinopsis e imágenes se revelan por acción. Mantener teclado, foco al cerrar confirmaciones, estados accesibles, temas y pantallas estrechas.

- Serie: «Mi progreso · Posición manual» → «Episodios [T3] [Descargar/Actualizar]» → «4 de 12 estrenados · 33 %» → vista previa → «Ver episodios». Ruta con filtros Todos / Marcados / Sin marcar / Anunciados, fecha opcional y selección.
- Anime/manga manual: «Episodios/Capítulos» → «Tu lista está vacía» → «Agregar unidad» o «Crear rango» → vista previa con nuevas y coincidencias → confirmar. Mostrar «X de N en tu lista» cuando corresponda. Para literatura episódica o títulos ambiguos exigir clasificación/elegibilidad explícita, sin activar el cursor de formatos excluidos por su contrato.
- Guía parcial: «4 marcadas · 8 conocidas · Guía parcial» con actualización y último dato; sin porcentaje ni etiqueta de temporada completa. Si no hay caché y falla red, ofrecer reintentar y acceso manual. Offline se consulta lo descargado y se operan marcas locales.
- Conflictos en Ajustes: título y descriptor, decisión/fecha local y entrante, omisiones, mantener local/aplicar entrante, copiar/exportar informe completo; conflicto obsoleto pide revisar otra vez.

Los rangos son viables como creación limitada a 200 enteros, modo y grupo fijos, límites de dominio, comparación exacta de coordenadas dentro del inventario manual, previsualización y omisión consentida de coincidencias o cancelación. No bloquea coexistencia con remoto. Una coincidencia retirada se señala y se puede reactivar aparte; el rango no la reactiva. Revalidar incluso con escrituras concurrentes y revertir el lote ante fallo. Decimales y especiales solo individuales. Las acciones de temporada confirman IDs, revisiones de inventario y decisión, filtros y exclusiones; excluir futuros, día sin hora, desconocidos y especiales del preset editorial. Ninguna expansión silenciosa. Selección explícita permite especiales y exige confirmación para cada futuro que se vaya a marcar.

### D5. Portabilidad y migración

SQLite v10 aditivo: preservar filas, validar FK, índices y user_version dentro de la migración transaccional. Si falla, revertir esquema y versión. Downgrade operativo mediante restauración TEST de copia previa, no manipulación del esquema para abrirlo con app antigua. No derivar marcas desde cursor, totales o estado.

v11 agrega bloque granular obligatorio aunque vacío. Exportar en snapshot consistente grupos y unidades durables (incluyendo retiradas), referencias, descriptor y decisiones con reloj y fecha. No exportar evidencia de completitud, pertenencia acreditada de revisiones, caché extensa, imágenes binarias ni credenciales. Las fechas incluidas en descriptor conservan procedencia, sin valor de acreditación. Importar con mapas de títulos y resoluciones de grupo/unidad; coincidencia única de referencia bajo propietario resuelto puede remapear UUID entrante sin reemplazar el local. Si UUID y referencia discrepan, omitir. Mantener atributos locales divergentes y reportar omisión; ausencia nunca elimina. Normalizar y agrupar candidatos por destino antes de aplicar para evitar depender del orden. Resolver decisiones después, equivalentes por estado y fecha, independiente del reloj. Sin decisión local insertar, si discrepa conservar y exponer conflicto. Aplicación posterior valida huella de propietario/referencias y versión, registra reloj local posterior y publica solo tras commit. Usar aislamiento por registro/dependencia y rollback global, sin aplicar cambios asociados a un destino no resuelto. v1–v10 siguen intactos y sus campos granulares ajenos carecen de autoridad. Preservar evidencia local si el import es equivalente y sigue vigente; reevaluar transaccionalmente si cambian referencias, pertenencia, identidad, coordenadas o disponibilidad que la sustentan. No distribuir hasta completar S4 y la aceptación de S5.

## Risks / Trade-offs

- Completitud y CORS de TMDB pueden impedir activar cobertura o descarga en una plataforma. S2 reúne evidencia y conserva modo manual y conteos parciales.
- UUID y referencia pueden divergir por importaciones o cambios editoriales. Preferir omitir y explicar antes que fusionar.
- Datos antiguos pueden recuperar un título eliminado según contrato vigente. Retiro de unidades mantiene decisiones y evita pérdida local.
- Escalas de hasta 5000 unidades requieren medir número de consultas, memoria y montaje de filas con fixtures, sin fijar tiempos arbitrarios.
- El cierre de la fundación dejó excepciones de Android físico, TalkBack/lector, fuente al 200 % y arranque offline del bundle. S5 debe distinguir evidencia nueva de pendientes.

## Migration Plan

Ejecutar S1–S5 en orden con bases TEST, un diff revisado y checkpoint manual por sección. La prueba de round trip compara equivalencia durable e idempotencia, admitiendo regeneración de IDs locales y pérdida intencional del snapshot acreditado. Una revisión posterior puede cambiar la ventana de vigencia o límites operativos con evidencia de APPLY.

Durante el futuro Sync, actualizar la nota introductoria de library-backup-integrity a «El formato vigente de exportación es v11. Las versiones v1–v10 conservan sus contratos históricos y no determinan el formato vigente». Los bloques MODIFIED preservan escenarios históricos y aclaran el alcance de la validación de versiones. Revisar la nota junto con el resultado de la sincronización, porque el delta de requisitos no sustituye esa prosa introductoria.

## Trazabilidad

| Decisión | Requisito y escenarios representativos | Tareas |
|---|---|---|
| D1 identidad y orden | Identidad durable → Renumeración, Identidades incompatibles, Capítulos con huecos | 1.1–1.3, 2.2 |
| D1 decisiones | Decisiones personales → Doble pulsación, Offline y reapertura, Migración y cascada, Fecha opcional | 1.3–1.4, 3.2, 5.1 |
| D2 fuente y caché | Guía TMDB → Temporada cero, Rate limit y cancelación; Revisiones editoriales → Parcial, Retirada, Datos obsoletos, marcado offline tras vencimiento | 2.1–2.3 |
| D3 alcance | Disponibilidad → Cambio de día o zona, Marcado futuro; Cobertura → Temporada acreditada, Parcial vacío y lista manual, Nuevos estrenos | 3.2–3.4 |
| D4 rangos | Inventario manual → Rango sin marcas, Rango obsoleto o fallido, Edición y retiro | 1.2, 2.4, 3.1 |
| D4 concurrencia y presentación | Selección múltiple → Selección cambiada, Más de 500 IDs, Fallo intermedio; Interfaz → Escala y accesibilidad, Cuadrícula opcional con huecos, Snapshots coherentes | 3.1–3.5, 5.2 |
| Cursor separado | Posición manual y decisiones granulares → Huecos y cursor intacto, Literatura serializada, escala de cursor independiente | 1.4, 3.4, 5.1 |
| D5 respaldo | Backup v11 → Exportar cada entrega, Ausencia histórica, Bloque vacío obligatorio, versión no soportada y Round trip; Mapas efectivos → Remapeo y colisión, Evidencia local y restauración equivalente, Fallo parcial o global; Conflictos → Marca antigua frente a negativo, Candidato obsoleto, Reimportación | 4.1–4.4, 5.1 |
