# tmdb-user-credential Specification

## Purpose

Permitir que cada persona configure localmente su propio API Read Access Token de TMDB y que el acceso remoto se degrade de forma segura sin afectar la biblioteca local.

## Requirements

### Requirement: cada instalación usa una única credencial TMDB configurada por el usuario
El sistema MUST usar como única credencial para requests autenticados a TMDB el API Read Access Token configurado por el usuario, MUST enviarlo como Bearer token y MUST dejar de obtener credenciales de variables públicas de entorno, credenciales compartidas, backend o proxy.

#### Scenario: request autenticado con credencial configurada
- **GIVEN** una credencial TMDB válida configurada
- **WHEN** la app inicia un request autenticado a TMDB
- **THEN** usa el valor configurado en `Authorization: Bearer <token>`
- **AND** no consulta `EXPO_PUBLIC_TMDB_TOKEN` ni otra fuente alternativa

#### Scenario: token pegado con formato tolerado
- **WHEN** el usuario pega un token rodeado de whitespace o con un único prefijo `Bearer `
- **THEN** el sistema elimina el whitespace exterior y ese prefijo antes de validarlo
- **AND** conserva el resto del token sin otras transformaciones silenciosas
- **AND** nunca almacena el prefijo `Bearer `

### Requirement: una credencial nueva se valida antes de reemplazar la vigente
El sistema MUST comprobar cada candidato mediante `GET /3/authentication` con el candidato como Bearer token, MUST persistirlo únicamente después de una respuesta exitosa y MUST conservar cualquier credencial válida anterior hasta que su reemplazo haya sido validado y guardado correctamente.

#### Scenario: candidato válido
- **WHEN** TMDB responde `200` a la validación del candidato
- **THEN** el sistema lo persiste como credencial configurada
- **AND** los requests futuros pueden usar la nueva credencial

#### Scenario: validación usa exclusivamente el candidato
- **GIVEN** la credencial `A` está configurada
- **WHEN** se valida el candidato explícito `B`
- **THEN** el request de validación usa exclusivamente `B` como Bearer token
- **AND** no consulta ni usa `A` como fallback
- **AND** no lee ni inicializa el credential store para resolver ese request
- **AND** no actualiza cache, status ni generation
- **AND** no persiste nada y la credencial configurada continúa siendo `A` hasta que `B` sea validada y guardada exitosamente

#### Scenario: candidato vacío
- **WHEN** la normalización produce un candidato vacío
- **THEN** el sistema lo rechaza localmente
- **AND** no inicia un request de validación

#### Scenario: candidato inválido
- **WHEN** TMDB responde `401` a la validación del candidato
- **THEN** el sistema informa que el API Read Access Token de TMDB no es válido
- **AND** no persiste el candidato
- **AND** conserva sin cambios una credencial anterior válida si existía

#### Scenario: validación sin conectividad o con fallo temporal
- **WHEN** la validación falla por red, timeout o respuesta temporal `5xx`
- **THEN** el sistema no clasifica el candidato como inválido ni lo persiste
- **AND** conserva el candidato sólo mientras la screen de configuración siga abierta
- **AND** permite reintentar la validación
- **AND** conserva una credencial anterior válida si existía

### Requirement: la credencial se persiste localmente con garantías explícitas por plataforma
El sistema MUST almacenar la credencial fuera de SQLite y del dominio de biblioteca, MUST usar almacenamiento protegido por el sistema operativo en Android e iOS sin exigir biometría y MUST usar almacenamiento persistente del navegador en web con una advertencia clara sobre sus garantías menores.

#### Scenario: persistencia nativa
- **WHEN** una credencial validada se guarda en Android o iOS
- **THEN** queda en el almacenamiento seguro de credenciales provisto por el sistema operativo
- **AND** puede recuperarse después de reiniciar la app según el lifecycle de la plataforma
- **AND** su uso normal no exige autenticación biométrica

#### Scenario: persistencia web
- **WHEN** una credencial validada se guarda en web
- **THEN** persiste entre sesiones mediante el almacenamiento local del navegador
- **AND** la app advierte que no tiene protección equivalente a Keychain, Keystore o SecureStore
- **AND** advierte que puede borrarse al limpiar los datos del navegador y que JavaScript ejecutado en el mismo origin podría accederla

#### Scenario: almacenamiento web no disponible
- **WHEN** el navegador impide leer o escribir su almacenamiento local
- **THEN** la app informa un fallo de almacenamiento distinguible de `TMDB no está configurado`
- **AND** no afirma que conoce la ausencia de una credencial cuando no pudo leerla
- **AND** las funciones locales continúan disponibles

#### Scenario: fallo al persistir o eliminar
- **WHEN** falla la escritura o eliminación de una credencial
- **THEN** el consumer recibe un fallo de credential storage recuperable
- **AND** el sistema no publica silenciosamente un cambio permanente que el store no confirmó

### Requirement: la credencial permanece excluida de datos y salidas no autorizadas
El sistema MUST mantener el token fuera de `SavedTitle`, SQLite, `app_preferences`, exportaciones, importaciones y merges de backup, y MUST evitar incluirlo en mensajes visibles, errores o logs producidos por esta capacidad.

#### Scenario: exportación e importación de biblioteca
- **WHEN** el usuario exporta, importa o mergea un backup
- **THEN** la credencial TMDB no se exporta, importa, mergea ni modifica
- **AND** la versión y el schema del backup permanecen sin cambios por esta capacidad

#### Scenario: fallo con token disponible
- **WHEN** un request, una validación o una operación de storage falla
- **THEN** ningún mensaje visible, error propagado o log creado por esta capacidad contiene el token completo
- **AND** tampoco contiene Authorization headers, URLs o query params con el token, fingerprints, prefijos, sufijos, substrings deliberadamente extraídos ni otra representación derivada intencionalmente del secreto
- **AND** la feature no interpola el token en mensajes, errores o logs
- **AND** no se muestra ni propaga el body técnico crudo recibido de TMDB cuando pudiera incluir material sensible

### Requirement: los cambios de credencial tienen semántica concurrente determinista
El sistema MUST compartir una única inicialización lazy entre consumidores concurrentes, MUST resolver un snapshot de credencial al comenzar cada request y MUST publicar status, disponibilidad del token y generation como un snapshot coherente; generation MUST cambiar únicamente cuando la credencial disponible para requests futuros cambia efectivamente.

#### Scenario: inicialización concurrente
- **WHEN** varios consumers requieren la credencial antes de completar su lectura inicial
- **THEN** esperan el mismo resultado de inicialización
- **AND** no disparan lecturas independientes incompatibles

#### Scenario: retry recupera una credencial después de un fallo de lectura
- **GIVEN** la primera lectura del credential store falló y se publicó `credential-storage-error`
- **WHEN** el usuario elige `Reintentar`
- **THEN** el sistema inicia una nueva lectura sin reutilizar indefinidamente la inicialización fallida
- **AND** retries concurrentes comparten esa única nueva lectura
- **AND** ningún request TMDB sale mientras el retry está pendiente
- **AND** si la lectura devuelve un token se publica `configured`
- **AND** generation no incrementa por esa hidratación

#### Scenario: retry confirma ausencia después de un fallo de lectura
- **GIVEN** la primera lectura del credential store falló
- **WHEN** un retry posterior devuelve `null`
- **THEN** el sistema publica `not-configured`
- **AND** generation no incrementa

#### Scenario: retry vuelve a fallar
- **GIVEN** el sistema está en `storage-error`
- **WHEN** una nueva lectura solicitada por el usuario vuelve a fallar
- **THEN** retorna a `storage-error`
- **AND** continúa permitiendo retries posteriores
- **AND** las funciones locales siguen operativas

#### Scenario: cambio durante un request
- **GIVEN** un request ya iniciado con la credencial anterior
- **WHEN** una credencial nueva queda validada y guardada
- **THEN** el request iniciado puede terminar con su snapshot anterior
- **AND** los requests posteriores usan la credencial nueva

#### Scenario: generation ante cambios efectivos
- **WHEN** un primer save, un reemplazo validado y persistido o un delete termina exitosamente y cambia la credencial efectiva
- **THEN** generation incrementa exactamente una vez junto con el nuevo status y disponibilidad

#### Scenario: generation ante operaciones sin cambio efectivo
- **WHEN** falla la validación, ocurre 401/network/retry, falla el write o un delete falla y restaura la credencial anterior
- **THEN** generation no queda incrementada
- **AND** los consumers no observan un snapshot artificial que represente falsamente un cambio permanente

#### Scenario: eliminación durante uso
- **WHEN** el usuario confirma eliminar la credencial
- **THEN** ningún request autenticado nuevo puede comenzar con el token eliminado
- **AND** un request que ya había salido puede terminar sin provocar cancelación global

#### Scenario: request nuevo espera un delete exitoso
- **GIVEN** la credencial `A` está configurada y comenzó su eliminación
- **WHEN** un request nuevo intenta resolver una credencial antes de terminar el delete
- **THEN** espera el mismo resultado de la mutation sin iniciar fetch TMDB
- **AND** cuando el store confirma el delete se publica `not-configured`
- **AND** generation incrementa exactamente una vez
- **AND** el request esperado obtiene `credential-not-configured`
- **AND** nunca sale con `A`

#### Scenario: request nuevo continúa después de un delete fallido
- **GIVEN** la credencial `A` está configurada y comenzó su eliminación
- **WHEN** un request nuevo espera y el store rechaza el delete
- **THEN** quien inició la eliminación recibe `credential-storage-error`
- **AND** snapshot, cache y generation anteriores permanecen intactos
- **AND** el request esperado vuelve a resolver `A` y puede continuar normalmente
- **AND** no se publica una ausencia falsa ni se produce un deadlock

### Requirement: los fallos TMDB se distinguen sin invalidar credenciales por errores temporales
El sistema MUST distinguir como mínimo credencial no configurada, fallo de credential storage, credencial inválida, error de red, request abortado, rate limit, error HTTP y respuesta inválida; MUST tratar `401` como credencial inválida y `429` como rate limit, y MUST evitar invalidar automáticamente la credencial por red o `5xx`.

#### Scenario: ausencia e invalidez
- **WHEN** un consumer intenta acceder a TMDB sin credencial o recibe `401`
- **THEN** puede distinguir respectivamente `credential-not-configured` y `credential-invalid`
- **AND** presenta una acción adecuada para configurar o cambiar el token

#### Scenario: credencial inaccesible por storage
- **WHEN** un consumer no puede resolver la credencial porque falló la inicialización o lectura del credential store
- **THEN** distingue `credential-storage-error` de `credential-not-configured`
- **AND** no afirma que el token no existe ni borra silenciosamente una credencial

#### Scenario: rate limit y fallo remoto
- **WHEN** TMDB responde `429`, otro HTTP no exitoso o una respuesta que no cumple el contrato esperado
- **THEN** el consumer puede distinguir `rate-limited`, `http` o `invalid-response` según corresponda
- **AND** una respuesta `5xx` no elimina ni invalida por sí sola la credencial guardada

#### Scenario: request abortado
- **WHEN** un request se aborta deliberadamente
- **THEN** se clasifica como `aborted`
- **AND** no se presenta como error al usuario

### Requirement: Buscar se bloquea explícitamente cuando TMDB no está configurado
El sistema MUST modelar el estado de credencial en Buscar, MUST evitar toda búsqueda remota sin token y MUST ofrecer un estado dedicado que conserve la query local y conduzca a obtener o configurar la credencial.

#### Scenario: búsqueda sin credencial
- **WHEN** el usuario escribe una query y TMDB no está configurado
- **THEN** no se llama a la búsqueda remota
- **AND** se conserva la query escrita
- **AND** se muestra `TMDB no está configurado`
- **AND** se explica brevemente que Biblioteca sigue disponible
- **AND** se ofrecen las acciones `Obtener token` y `Configurar`

#### Scenario: configuración con query pendiente
- **GIVEN** una query escrita y ningún token configurado
- **WHEN** el usuario configura correctamente una credencial
- **THEN** la transición a `configured` permite ejecutar la query exactamente una vez mediante el flujo normal
- **AND** no se crea un loop de reintentos

#### Scenario: inicialización encuentra token con query pendiente
- **GIVEN** Search conserva una query mientras la credencial está `initializing`
- **WHEN** la lectura inicial encuentra un token persistido y publica `configured`
- **THEN** la query se ejecuta exactamente una vez
- **AND** generation puede permanecer sin cambio por hydration
- **AND** snapshots o renders repetidos no vuelven a dispararla ni crean un loop

#### Scenario: retry encuentra token con query pendiente
- **GIVEN** Search conserva una query mientras la credencial está `storage-error`
- **WHEN** un retry encuentra un token persistido y publica `configured`
- **THEN** la query se ejecuta exactamente una vez
- **AND** generation permanece sin cambio por hydration
- **AND** no se crea un loop

#### Scenario: replacement cambia la credencial mientras Search está configurado
- **GIVEN** Search está `configured` y tiene una query
- **WHEN** un replacement validado y persistido incrementa generation
- **THEN** la query puede ejecutarse exactamente una vez con la nueva credencial
- **AND** el status puede permanecer `configured`

#### Scenario: eventos sin nueva credencial usable
- **WHEN** ocurre validación fallida, 401 de candidato, network/timeout, retry fallido, retry que confirma `null`, write fallido, delete fallido o se repite la misma snapshot
- **THEN** Search no inicia una búsqueda adicional por ese evento

#### Scenario: credencial eliminada durante Search
- **WHEN** la credencial configurada se elimina
- **THEN** Search deja de iniciar requests nuevos
- **AND** limpia o invalida los resultados remotos vigentes
- **AND** vuelve al estado `TMDB no está configurado`
- **AND** la transición `configured` a `not-configured` no inicia una búsqueda

#### Scenario: errores recuperables de Search
- **WHEN** Search detecta credencial inválida
- **THEN** ofrece cambiar el token
- **WHEN** falla la red o TMDB está temporalmente no disponible
- **THEN** ofrece reintentar sin clasificar la credencial como inválida

#### Scenario: Search no puede acceder al credential store
- **WHEN** la inicialización o lectura del credential store falla
- **THEN** Search realiza cero requests remotos
- **AND** muestra un mensaje amistoso específico de acceso a la configuración
- **AND** ofrece una acción recuperable como `Reintentar` o ir a `Configurar`
- **AND** no muestra el estado `TMDB no está configurado` como si la ausencia fuera conocida

### Requirement: Ajustes ofrece configuración completa en una screen propia
El sistema MUST mostrar en Ajustes un resumen del estado TMDB y MUST abrir una screen propia, no un modal, para obtener, configurar, comprobar, cambiar o eliminar el API Read Access Token.

#### Scenario: resumen no configurado
- **WHEN** no existe credencial configurada
- **THEN** Ajustes muestra una sección `TMDB` con estado `No configurado` y acción `Configurar`

#### Scenario: resumen configurado
- **WHEN** existe una credencial configurada
- **THEN** Ajustes muestra estado `Configurado` y acción `Cambiar`
- **AND** no muestra el token completo ni requiere un fingerprint en esta versión

#### Scenario: Ajustes no puede acceder al credential store
- **WHEN** la lectura o una mutation del credential store falla
- **THEN** Ajustes o la screen de configuración muestran un estado de storage recuperable distinto de `No configurado`
- **AND** ofrecen reintentar o corregir la configuración sin revelar ni borrar silenciosamente el token

#### Scenario: formulario de configuración
- **WHEN** el usuario abre la screen de configuración
- **THEN** encuentra explicación breve, campo ocultable, acción mostrar u ocultar, `Obtener token` y `Guardar y comprobar`
- **AND** puede comprender los estados validando, credencial inválida y fallo recuperable de red
- **AND** la acción Obtener token abre el flujo oficial de TMDB para conseguir el API Read Access Token

#### Scenario: eliminación confirmada
- **WHEN** un usuario con credencial configurada elige eliminarla
- **THEN** la app solicita confirmación
- **AND** tras confirmarla elimina la credencial y publica estado `No configurado`

### Requirement: el detalle remoto responde de forma amistosa sin cambiar su carga atómica
El sistema MUST presentar estados comprensibles ante credencial ausente, inválida o fallo remoto al abrir un detalle TMDB y MUST preservar en esta capacidad la carga atómica vigente de detalles, créditos y proveedores.

#### Scenario: detalle remoto sin credencial o con credencial inválida
- **WHEN** se intenta abrir un detalle remoto sin credencial o TMDB responde `401`
- **THEN** la app no muestra referencias a `.env` ni mensajes técnicos internos
- **AND** ofrece configurar o cambiar la credencial según corresponda

#### Scenario: error temporal en la carga atómica
- **WHEN** falla por red o error remoto cualquiera de los recursos cargados conjuntamente por el detalle
- **THEN** la carga conjunta conserva su comportamiento atómico actual
- **AND** presenta un mensaje seguro y recuperable acorde al error tipado

### Requirement: la indisponibilidad de TMDB no bloquea el producto local-first
El sistema MUST mantener operativas todas las funciones locales cuando la credencial falta, es inválida o su almacenamiento falla, y MUST tratar los fallos de imágenes públicas ya guardadas como fallos de imagen y no como fallos de credencial.

#### Scenario: biblioteca sin credencial
- **WHEN** la app inicia sin credencial TMDB o no puede leer su store
- **THEN** Biblioteca, detalle local, ratings, status, tags, notas, pins, filtros, sorting, views y backups continúan disponibles
- **AND** la inicialización de esas funciones no espera ni depende del acceso remoto

#### Scenario: imagen TMDB pública guardada
- **WHEN** un título local intenta cargar una URL guardada de `image.tmdb.org` sin Bearer token
- **THEN** puede cargarla como recurso público
- **AND** si falla se aplica el tratamiento existente de imagen ausente o fallida

### Requirement: la app incluye attribution mínimo y acceso a información de TMDB
El sistema MUST ofrecer desde Ajustes una screen o sección separada `Acerca de / Créditos` que identifique a TMDB como servicio externo, use un logo oficial aprobado, enlace a TMDB e incluya el notice requerido sin mezclar credencial ni estado de configuración, y MUST atribuir a JustWatch los datos de disponibilidad en streaming, alquiler y compra provistos a través de TMDB.

#### Scenario: créditos de TMDB
- **WHEN** el usuario abre `Acerca de / Créditos`
- **THEN** ve un logo oficial aprobado de TMDB
- **AND** ve exactamente `This product uses the TMDB API but is not endorsed or certified by TMDB.`
- **AND** dispone de un enlace a TMDB y una indicación de que es un servicio externo
- **AND** ve exactamente `Los datos de disponibilidad en streaming, alquiler y compra son provistos por JustWatch a través de TMDB.`
- **AND** dispone de un enlace a `https://www.justwatch.com/`

#### Scenario: separación respecto de la credencial
- **WHEN** se presenta la attribution
- **THEN** no se muestra el token ni su estado
- **AND** no se introduce una infraestructura legal general fuera de esta integración
