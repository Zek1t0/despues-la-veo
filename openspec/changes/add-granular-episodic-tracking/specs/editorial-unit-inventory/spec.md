## Purpose

Gestiona inventarios locales de unidades manuales y guías TMDB con evidencia editorial explícita y conservación de decisiones personales.

## ADDED Requirements

### Requirement: Guía TMDB explícita y acotada
La descarga MUST requerir acción explícita y una referencia TMDB tv del propietario, validada y admitida por los gates existentes, también para anime. MUST reutilizar credenciales, admisión y cancelación vigentes, deduplicar en curso y limitar el trabajo a una consulta de serie si se necesita el índice y una por temporada elegida. MUST respetar 429 y no hacer peticiones por cada episodio ni ampliar gates Kitsu/MangaUpdates.

#### Scenario: Compatibilidad y temporada cero
- **WHEN** un anime tiene referencia tv acreditada y el usuario solicita T0
- **THEN** se puede consultar esa agrupación de especiales bajo el gate TMDB

#### Scenario: Sin referencia acreditada
- **WHEN** solo coincide el nombre con una serie remota
- **THEN** se ofrece lista manual sin vincular ni consultar automáticamente

#### Scenario: Rate limit y cancelación
- **WHEN** el proveedor responde 429 o se cancela la carga
- **THEN** se respeta la admisión y se conserva la guía previa sin escrituras de retirada

### Requirement: Revisiones editoriales verificables
El inventario MUST guardar fuente, alcance, revisión, consulta, completitud y discrepancias. Una temporada acreditada MUST tener respuesta completa validada, identidades inequívocas, pertenencia confirmada y concordancia con evidencia independiente y vigente del conteo del mismo alcance. Las páginas faltantes, filas contradictorias, fallos y cancelaciones MUST impedir acreditar o retirar. Una revisión acreditada del mismo alcance puede retirar ausencias sin perder identidades ni decisiones; una mudanza de grupo verificada preserva ambas. El snapshot previo MUST seguir disponible con fecha y estado visible. La evidencia vence a los siete días y no es vigente si el reloj precede a la consulta. Este cambio MUST degradar solo la acreditación, conservar guía, identidades, descriptores y decisiones y permitir operar marcas offline.

#### Scenario: Respuesta parcial
- **WHEN** faltan páginas o discrepan listado y contador
- **THEN** no se retiran unidades ni se publica una revisión acreditada

#### Scenario: Retirada y cambio de fuente
- **WHEN** una revisión completa confirma ausencia o se selecciona otra fuente
- **THEN** la retirada conserva identidad y marca y el cambio de fuente no combina inventarios ni fusiona manuales con remotas

#### Scenario: Datos obsoletos
- **WHEN** vence la ventana de vigencia, el reloj precede a la consulta o una contradicción invalida la evidencia activa
- **THEN** se muestran conteos con fecha y parcialidad u obsolescencia sin porcentaje vigente y sin borrar datos ni bloquear marcado/desmarcado offline

### Requirement: Disponibilidad con precisión declarada
La guía MUST distinguir estrenado según fuente, anunciado, desconocido y retirado, con procedencia y fecha de consulta. MUST preservar fechas civiles e instantes con zona cuando existan. Una fecha civil del día actual sin hora MUST mostrar «Hoy · hora desconocida» y quedar fuera de estrenados hasta el día siguiente. MUST evitar afirmaciones de streaming regional. Una marca futura MUST exigir confirmación explícita y permanecer fuera de cobertura de estrenados.

#### Scenario: Cambio de día o zona
- **WHEN** una unidad tiene fecha civil de hoy, otra fecha futura y otra ninguna
- **THEN** la primera conserva su día sin conversión UTC, la futura se anuncia y la tercera admite marca sin acreditar disponibilidad

#### Scenario: Marcado futuro
- **WHEN** se intenta marcar un episodio anunciado
- **THEN** solo se guarda después de confirmar y no suma a estrenados

### Requirement: Inventario manual editable y recuperable
El sistema MUST permitir creación y edición offline de unidades en series, anime y formatos serializados elegibles, incluidos manga, manhwa, manhua, cómics y literatura episódica explícitamente clasificada. MUST validar numeraciones canónicas y ofrecer rango entero inclusivo de hasta 200 unidades con vista previa, detección de coincidencias en el mismo grupo y modo manual y confirmación. MUST omitir coincidencias declaradas o cancelar; si cambian antes de confirmar MUST revalidar sin escribir. Crear unidades MUST dejar sus decisiones ausentes. Retirar MUST preservar identidad y decisiones, y restaurar MUST recuperar la unidad. La guía remota y las unidades manuales MUST coexistir sin adoptarse automáticamente.

#### Scenario: Rango sin marcas
- **WHEN** se confirma un rango con dos coincidencias detectadas
- **THEN** se crean solo las unidades nuevas anunciadas, sin marcas ni decimales o especiales implícitos

#### Scenario: Rango obsoleto o fallido
- **WHEN** surge una coincidencia tras la vista previa o falla la transacción
- **THEN** no se aplica ningún cambio

#### Scenario: Edición y retiro
- **WHEN** se cambia etiqueta, grupo o número de una unidad manual y luego se retira
- **THEN** se conserva UUID y decisión y puede volver a activarse
