## 1. S1 — Dominio, identidad, persistencia y migración

- [x] 1.1 Implementar SQLite v10 aditivo y verificar en bases TEST apertura nueva, migración histórica, reapertura, índices, FK, cascadas y rollback inyectado con filas y versión originales.
- [x] 1.2 Implementar validación de identidad, propietario, grupos, referencias, retiro y coordenadas. Probar colisiones, temporada cero y orden/paginación exactos con capítulos 12, 12.5 y 15.
- [x] 1.3 Implementar decisiones positivas y negativas, fecha opcional, reloj y revisión. Probar escrituras repetidas, concurrencia, rollback y publicación solo tras commit.
- [x] 1.4 Probar migración sin consumo inventado, huecos, desmarcado, aislamiento de posición y datos personales y persistencia tras reapertura.
- [x] 1.5 Registrar resultados TEST y someter el diff S1 a revisión externa antes del checkpoint manual.

## 2. S2 — Inventario editorial y manual

- [x] 2.1 Implementar adaptador TMDB de guías con fixtures de temporada y T0, opcionales ausentes, pertenencia, IDs inválidos, error 429, cancelación y presupuesto de peticiones bajo gates existentes.
- [x] 2.2 Implementar snapshots de inventario y evidencia, refresco transaccional, caché y retiro no destructivo. Probar contador contradictorio, páginas incompletas, mudanza, renumeración, cambio de fuente, reloj anterior a la consulta y vencimiento sin pérdida ni bloqueo offline.
- [ ] 2.3 Verificar con entorno TEST autorizado contratos desplegados de TMDB, forma y significado de los conteos, CORS y comportamiento Web/Android. Registrar por separado plataformas y condiciones no probadas; conservar parcialidad sin evidencia.
- [x] 2.4 Implementar alta y edición manual, retiro reversible y rangos confirmados. Probar duplicados, unidades retiradas, vista previa obsoleta, creación sin marcas y rollback atómico.
- [x] 2.5 Registrar fixtures, resultados y pendientes de runtime y someter diff S2 a revisión externa antes del checkpoint manual.

## 3. S3 — Interfaz granular y cobertura

- [x] 3.1 Integrar vista previa, ruta virtualizada, filtros, grupos, estados de guía, edición manual y confirmación de rangos. Comprobar acceso explícito a sinopsis/imágenes. Si se ofrece cuadrícula, verificar virtualización, huecos y selección por ID compartida.
- [x] 3.2 Integrar marcar/desmarcar, fecha opcional y Hoy, advertencia de futuros y operaciones masivas con selección cerrada. Probar doble pulsación, lote cambiado, rollback por confirmación y particiones visibles e independientes para más de 500 IDs.
- [x] 3.3 Implementar cobertura y disponibilidad con reloj inyectable. Probar 4/12, parcial, vacío, lista manual, especiales, fechas civiles, zonas, nuevos estrenos, antigüedad y marcas externas.
- [x] 3.4 Compartir resúmenes de snapshots en Biblioteca y Colecciones y rotular posición manual. Verificar independencia y ausencia de consultas por tarjeta o solicitudes remotas al abrir ambas pantallas.
- [x] 3.5 Medir consultas, filas montadas y comportamiento con 12, 100, 1000 y 5000 unidades. Registrar condiciones y resultados sin umbrales especulativos.
- [x] 3.6 Registrar resultados de interfaz y someter diff S3 a revisión externa antes del checkpoint manual.

## 4. S4 — Backup y restauración

- [x] 4.1 Implementar exportación v11 de snapshot íntegro, validación de contrato y compatibilidad con fixtures v1–v10, ignorando campos granulares artificiales. Verificar bloque v11 obligatorio incluso vacío, rechazo de versión futura y exportación íntegra sin ofrecer formatos anteriores. Comprobar omisión de credenciales y caché extensa.
- [x] 4.2 Implementar mapa efectivo de grupos y unidades y restauración de decisiones. Probar colisiones, candidatos contradictorios, omisiones dependientes, rollback y degradación de métricas tras restaurar. Comprobar que los cambios relevantes invalidan evidencia que pierde sustento y los imports equivalentes conservan evidencia local válida.
- [x] 4.3 Implementar revisión accesible de conflictos y exportación de informe en Ajustes. Probar negativos frente a marcas antiguas, conflictos de fecha, candidato obsoleto y aplicación explícita.
- [x] 4.4 Completar round trip v11 sobre bases TEST vacía y poblada, reimportaciones, equivalencia durable y regresión de posición, organización y otros datos históricos. Mantener bloqueada distribución hasta completar portabilidad.
- [x] 4.5 Registrar resultados de restauración y someter diff S4 a revisión externa antes del checkpoint manual.

## 5. S5 — Regresión integral y aceptación

- [x] 5.1 Ejecutar regresiones focalizadas de SQLite, backup, identidad, Biblioteca, Colecciones, Inbox, entradas manuales, cursor y gates. Registrar comandos, fixtures y resultados.
- [ ] 5.2 Comprobar aceptación Web y Android, teclado, lector de pantalla, TalkBack, fuente al 200 %, pantallas estrechas, temas, listas grandes, offline y reapertura incluida prueba de arranque del bundle. Mantener pendientes las aceptaciones sin evidencia y distinguir las excepciones de la fundación.
- [x] 5.3 Validar OpenSpec estricto, tipos, build y whitespace. Registrar evidencia, excepciones, cobertura de trazabilidad y recordatorio de actualizar la nota de formato vigente durante el futuro Sync, y someter diff S5 a revisión externa antes del checkpoint manual y la posterior sincronización y archivo.
