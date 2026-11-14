## Purpose

Permitir consultar y conservar fichas básicas enriquecidas de las obras guardadas, con procedencia explícita y disponibilidad local sin depender de una conexión.

## ADDED Requirements

### Requirement: Metadata enriquecida honesta
El sistema MUST normalizar Kitsu para búsqueda, detalle y biblioteca según el contexto: títulos principal/alternativos, sinopsis, póster/banner, puntuación pública, medio/familia/formato, fechas de inicio/finalización, estado editorial, episodios, duración por episodio/total, géneros/categorías, clasificación de edad, advertencias y procedencia. MUST conservar desconocidos sin fabricar información, traducir textos ni confundir categorías con etiquetas personales, estado editorial con estado personal o formato con identidad.

#### Scenario: Ficha completa
- **WHEN** el proveedor entrega una ficha válida con los campos enriquecidos
- **THEN** el detalle muestra esos campos con unidades y fuente, la búsqueda muestra su resumen y la biblioteca conserva la ficha básica
- **AND** guardar no agrega categorías arbitrarias como etiquetas personales

#### Scenario: Campos incompletos o inválidos
- **WHEN** faltan episodios, fechas, duración o clasificación, o contienen tipos/rangos inválidos
- **THEN** esos datos se muestran como desconocidos u omitidos sin valores inventados
- **AND** una respuesta con identidad inválida o diferente de la solicitada no modifica la ficha guardada

### Requirement: Puntuación pública independiente
El sistema MUST mostrar puntuaciones públicas sobre 10 y conservar valor original, escala y proveedor. MUST distinguirlas visualmente de la puntuación personal, admitir ausencia/null, no combinar fuentes y no almacenar puntuación Kitsu en el campo legacy TMDB voteAverage.

#### Scenario: Conversión de puntuación
- **WHEN** Kitsu entrega averageRating válido de 82.28 sobre 100
- **THEN** se presenta como 8,2/10 identificado como público de Kitsu y se conserva 82.28 con escala 0–100
- **AND** la puntuación personal no cambia

#### Scenario: Puntuación inválida o ausente
- **WHEN** llega un valor fuera de escala, no finito, vacío o desconocido
- **THEN** no se muestra como cero ni como puntuación personal y se preserva el dato previo según la semántica de actualización

### Requirement: Referencias de imágenes sin almacenamiento permanente
El sistema MUST conservar las URLs de variantes suministradas por el proveedor y seleccionar una adecuada para cards, listas, póster de detalle y banner. MUST manejar ausencia/error mediante placeholders, sin construir URLs Kitsu ni asumir un host común. MUST permitir caché oportunista del dispositivo sin garantizar binarios offline ni incluirlos en JSON. MUST validar también URLs históricas/restauradas antes de renderizar: HTTPS absoluto sin credenciales/autoridad ambigua, host de imágenes revisado para la fuente y rechazo de destinos locales/privados inesperados identificables. MUST admitir múltiples hosts legítimos sin autorizar cualquier host de un payload o backup. MUST aplicar la política al destino final cuando el renderer permita comprobarlo antes del acceso; si una variante depende de redirects no verificables o no puede admitirse con los controles disponibles, MUST usar placeholder. MUST documentar que la validación de hostname no garantiza resolución DNS pública ni bloqueo de todos los redirects y que un fallback posterior no deshace conexiones previas.

#### Scenario: Variantes de distintos hosts
- **WHEN** póster y banner válidos pertenecen a hosts diferentes y ofrecen variantes
- **THEN** se utilizan sus URLs recibidas y una variante apropiada para cada contexto

#### Scenario: Imagen ausente o fallida
- **WHEN** una URL falta, es inválida, caducó o falla sin conexión
- **THEN** aparece el fallback sin impedir acceso a textos, acciones y metadata local

#### Scenario: URL externa insegura restaurada
- **WHEN** una URL de respuesta o backup contiene credenciales, protocolo no HTTPS, localhost, IP local/privada o un host engañoso fuera de la política de imágenes
- **THEN** no se entrega esa URI al renderer ni se sondea por HTTP y se muestra placeholder conservando la ficha utilizable

#### Scenario: Redirect y límites del renderer
- **WHEN** una variante requiere un redirect que no puede verificarse con el renderer habilitado, o un destino final comprobable viola la política
- **THEN** se usa fallback sin añadir descargas o proxy y se registra el límite técnico sin afirmar aislamiento total frente a DNS o redirecciones

### Requirement: Ficha básica offline y procedencia
El sistema MUST conservar localmente todos los campos básicos normalizados enumerados en esta capacidad, incluidas referencias de imágenes, puntuación y fuente, fecha de consulta exitosa y fecha de modificación del proveedor si existe. MUST permitir leerlos sin red ni credenciales y distinguir fecha de consulta de fecha editorial o personal. Los datos históricos sin fechas verificadas MUST permanecer sin frescura inventada.

#### Scenario: Reapertura offline
- **WHEN** se guarda una ficha enriquecida y se vuelve a abrir sin red
- **THEN** su metadata básica permanece disponible y solo las imágenes dependen de la caché oportunista

#### Scenario: Ficha histórica
- **WHEN** se abre un título de SQLite v6 o de backup anterior sin enriquecimiento
- **THEN** conserva los datos existentes, muestra desconocidos y no requiere una consulta remota para poder utilizarlo

### Requirement: Proyección coherente por propiedad y fuente activa
El sistema MUST resolver una misma metadata efectiva para detalle, biblioteca, tarjetas y exportación compatible. MUST priorizar modificaciones personales explícitas preservadas, después campos declarados por el documento de la fuente activa y finalmente snapshot histórico solo cuando su procedencia sea compatible; null autoritativo MUST NOT activar fallback. MUST mantener el snapshot histórico separado de su proyección para no reutilizar campos de una fuente anterior como propios de otra. MUST NOT elegir ni mezclar documentos por orden de referencias, antigüedad personal o puntuación mayor. Sin fuente inequívoca MUST conservar presentación histórica identificada y solicitar selección para refrescar; el título local puede ser fallback explícito sin atribución remota. El merge histórico personal MUST conservar íntegramente sus reglas, independiente de esta resolución.

#### Scenario: Importación antigua después de refresh
- **WHEN** una ficha tiene metadata activa enriquecida reciente y se importa un snapshot histórico anterior
- **THEN** la ficha visible y su exportación conservan los campos declarados por el documento reciente, mientras los datos personales se procesan según sus reglas históricas de merge

#### Scenario: Dos referencias sin selección inequívoca
- **WHEN** una obra posee documentos de dos proveedores y su fuente activa no está determinada
- **THEN** no se elige por orden ni score, se conserva fallback histórico identificado y se solicita selección sin combinar puntuaciones

#### Scenario: Null de la fuente activa
- **WHEN** la fuente activa declara duración desconocida y otra fuente o snapshot histórico tiene un valor
- **THEN** se muestra desconocida sin rellenarla con la duración de otra fuente ni alterar información personal
