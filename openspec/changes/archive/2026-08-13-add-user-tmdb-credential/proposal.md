## Why

DespuésLaVeo depende hoy de un `EXPO_PUBLIC_TMDB_TOKEN` compartido y expone fallos técnicos cuando esa variable falta, lo que no es apropiado para una app distribuida ni permite que cada persona controle su propio acceso a TMDB. La app necesita una credencial Bearer configurada por el usuario sin perder su funcionamiento local-first cuando TMDB no está disponible.

## What Changes

- Permitir configurar, validar, cambiar y eliminar un `API Read Access Token de TMDB` propio, usando `GET /3/authentication` antes de persistir una credencial nueva.
- Reemplazar `EXPO_PUBLIC_TMDB_TOKEN` por una única fuente de verdad gestionada localmente por la app, sin fallback de entorno, backend, proxy, cuentas ni sincronización cloud.
- Guardar la credencial fuera de SQLite, `app_preferences`, `SavedTitle` y backups: con `expo-secure-store` en Android/iOS y `localStorage` en web, donde se mostrará una advertencia honesta sobre sus garantías menores.
- Introducir estados y errores TMDB diferenciados para credencial ausente, credencial inaccesible por fallo de storage, credencial inválida, red, abort, rate limit, HTTP y respuesta inválida, sin filtrar el token ni cuerpos técnicos completos.
- Separar un transporte HTTP que recibe una credencial explícita y nunca consulta storage/servicio global, de modo que validación y requests runtime reutilicen fetch/clasificación sin crear dependencias circulares ni efectos laterales sobre la credencial configurada.
- Dar a Buscar un estado específico “TMDB no está configurado”, evitar requests sin credencial y permitir configurar u obtener el token sin perder la query pendiente.
- Añadir a Ajustes un resumen de estado TMDB y una screen propia accesible para configurar la credencial; mantener la credencial anterior si un reemplazo no puede validarse.
- Hacer que el detalle remoto responda de forma amistosa a credencial ausente/inválida y errores tipados, preservando su estrategia atómica actual de carga de detalles, créditos y proveedores.
- Incorporar una screen o sección separada de Acerca de / Créditos con la atribución mínima requerida por TMDB, su logo oficial aprobado, notice, enlace y condición de servicio externo.
- Mantener totalmente operativas Biblioteca, detalle local, ratings, estados, tags, notas, pins, filtros, sorting, views y backups ante ausencia o fallo de la credencial o de su store.
- Mantener fuera de alcance cambios de dominio, SQLite, backup, cuentas, backend, cloud sync, temas y degradación parcial del detalle remoto.

## Capabilities

### New Capabilities

- `tmdb-user-credential`: configuración y almacenamiento local por plataforma de la credencial Bearer personal, validación previa, acceso remoto condicionado, UX de Search/Ajustes/detalle remoto, errores seguros y attribution de TMDB.

### Modified Capabilities

Ninguna. Los specs existentes no definen configuración o disponibilidad del proveedor remoto; la apariencia de Search permanece bajo `customizable-browsing-views` sin cambiar sus requisitos.

## Impact

- Afecta el cliente y API provider de TMDB, Buscar, detalle remoto, Ajustes, nuevas screens de configuración y créditos, y nuevos límites de storage/servicio de credencial.
- Requerirá durante Apply instalar la versión de `expo-secure-store` compatible con Expo SDK 54, modificando de forma controlada `package.json`, lockfile y posiblemente `app.json`; los cambios locales preexistentes del usuario en esos archivos deben preservarse.
- No cambia `SavedTitle`, SQLite, `app_preferences`, versiones ni formatos de backup, personal rating, pins, tags, notas, status, sorting, browsing views ni assets remotos ya guardados.
- Riesgo para datos existentes: ninguno previsto; la nueva credencial no migra ni transforma datos de biblioteca y queda excluida del backup.
- Reversión: retirar las screens e integración de credencial y el adapter de SecureStore/localStorage; la biblioteca local permanece intacta. Volver al token compartido de entorno no forma parte de la reversión aprobada.
