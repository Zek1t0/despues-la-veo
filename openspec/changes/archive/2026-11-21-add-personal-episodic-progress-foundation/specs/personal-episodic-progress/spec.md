## Purpose

Permitir recordar y corregir offline una posición personal por título, con numeraciones explícitas y una presentación integrada, sin inferir unidades consumidas ni cambiar otras decisiones personales.

## ADDED Requirements

### Requirement: Posición manual independiente y durable
El sistema MUST permitir registrar una posición actual por título local, manual o con cero o varias referencias externas, sin red ni credenciales. MUST persistirla tras reiniciar y mantener un reloj propio. Registrar, corregir, incrementar o restablecer MUST NOT modificar status, rating, notas, etiquetas, createdAt/updatedAt históricos del título, metadata, colecciones o recomendaciones. MUST NOT inferir progreso desde planned, watching, done o dropped ni cambiar esos estados automáticamente. El refresh o cambio de fuente MUST NOT convertir ni borrar progreso. A MUST NOT registrar eventos de consumo ni nuevas entradas de progreso en Actualizaciones.

#### Scenario: Primer episodio de un pendiente
- **WHEN** se guarda el episodio 1 de un título planned sin conexión
- **THEN** al reiniciar se recupera la posición y se conservan planned y todos los demás campos y relojes del título

#### Scenario: Terminado sin posición completa
- **WHEN** se cambia explícitamente watching a done teniendo episodio 8 y total editorial 12
- **THEN** se conserva episodio 8 sin completar posiciones ni producir marcas individuales

#### Scenario: Proveedor cerrado o cambio editorial
- **WHEN** un título guardado tiene su proveedor bloqueado o cambia su total o fuente editorial
- **THEN** su posición personal sigue disponible y no se reabre ni termina automáticamente

### Requirement: Numeración explícita validada
El sistema MUST admitir episodio continuo, temporada/episodio, capítulo decimal y posición especial textual. MUST exigir selección explícita inicial del esquema y confirmación del reemplazo al cambiarlo, sin conversiones. Episodios MUST admitir enteros 0–999999; temporadas enteros 0–9999. Capítulos MUST admitir 0–999999.999999 con hasta seis decimales, aceptar coma o punto en el formulario y conservar representación textual canónica sin ceros iniciales o finales innecesarios; el contrato portable MUST exigir esa representación canónica. MUST rechazar negativos, exponentes, separadores de miles, NaN, Infinity, precisión excedida, componentes ausentes y campos incompatibles. Especial MUST exigir 1–120 puntos de código Unicode después de trim, sin saltos de línea ni caracteres de control. Cero MUST representar una posición y no ausencia.

#### Scenario: Decimal exacto
- **WHEN** se ingresa 042,500 y se guarda
- **THEN** se conserva el capítulo como texto canónico 42.5 y se recupera sin redondeo

#### Scenario: Límites inválidos
- **WHEN** se ingresa 1000000, 1.0000001, 1e3 o un especial vacío
- **THEN** se informa el error sin modificar el progreso confirmado ni perder el borrador

#### Scenario: Cambio de esquema
- **WHEN** se cambia de temporada 2 episodio 8 a episodio continuo
- **THEN** se exige introducir y confirmar la nueva posición sin calcular una equivalencia

### Requirement: Elegibilidad conservadora por clasificación
El sistema MUST ofrecer seguimiento a audiovisual/tv y cómics excepto one-shot, incluidos manga, manhwa, manhua y webtoon. MUST permitir activación explícita en anime ova, ona o special y en formatos null de audiovisual o comic, sin deducir serialización de la cantidad editorial. MUST NOT ofrecer controles nuevos en movie, music, one-shot o literature. MUST limitar episodios a audiovisual y capítulos a comic; posición especial MUST ser admisible en ambos medios elegibles. Un progreso existente incompatible MUST seguir visible como conservado, sin incremento o reinterpretación y con explicación; una importación histórica o cambio editorial MUST NOT borrarlo.

#### Scenario: Película anime
- **WHEN** se abre un anime con formato movie sin progreso
- **THEN** no aparecen controles episódicos por pertenecer a Anime

#### Scenario: Manual sin formato
- **WHEN** se abre un manual comic con formato null
- **THEN** se puede activar explícitamente capítulo o especial sin proveedor ni total

### Requirement: Mutaciones explícitas recuperables y sin pérdida concurrente
El sistema MUST permitir editar hacia delante o atrás. MUST ofrecer suma rápida solo para episodios numéricos: sumar exactamente 1 en el mismo esquema y temporada, indicando destino y sin prometer el siguiente episodio editorial. MUST ocultarla para capítulos, especiales, ausencia de posición o límite máximo. MUST confirmar restablecer y conservarlo como decisión vacía fechada distinta de nunca registrado; repetir el mismo valor o restablecimiento vacío MUST ser un no-op. MUST impedir dobles envíos de la misma intención, detectar versiones obsoletas y ofrecer revisar sin sobrescritura. El borrado del título MUST borrar su progreso íntegramente manteniendo los efectos vigentes de Colecciones e Inbox.

#### Scenario: Incremento al final de una temporada
- **WHEN** se suma uno desde temporada 2 episodio 12
- **THEN** el destino es temporada 2 episodio 13, sin salto a temporada 3 y sin inferir consumo acumulado

#### Scenario: Corrección, reset y cancelación
- **WHEN** se corrige 20 a 8 y después se cancela restablecer
- **THEN** permanece 8; si luego se confirma restablecer queda sin posición con fecha propia

#### Scenario: Edición concurrente o fallo
- **WHEN** se guarda un borrador cuya posición base cambió o falla el commit
- **THEN** no se reemplaza la versión confirmada ni se publica éxito y el borrador permite revisar/reintentar

### Requirement: Ficha y resúmenes accesibles coherentes
La ficha local MUST incluir «Mi progreso» en acciones personales antes de la ficha editorial, con posición destacada, esquema comprensible, registrar/editar, suma elegible y restablecer. MUST distinguir carga, nunca registrado, restablecido, incompatibilidad y fallo recuperable; una lectura fallida MUST NOT mostrarse como ausencia confirmada. Biblioteca MUST mostrar una línea en Detalle y texto discreto en Mosaico sin superponer póster, rating o estado; miembros de Colecciones MUST reutilizar esa representación del mismo título sin copia. MUST omitir resúmenes sin posición, mantener las cinco pestañas, temas/paletas actuales, filtros sensibles y navegación existente. Web/Android MUST permitir 320 px, fuente 200 %, scroll, teclado, foco visible y lectores de pantalla con acciones nombradas y resultado anunciado. Las superficies montadas MUST actualizarse solo tras commit, sin perder borradores ni mostrar resultados obsoletos.

#### Scenario: Cambio visible en varias superficies
- **WHEN** se confirma una corrección en ficha
- **THEN** Biblioteca y Colecciones muestran la misma posición confirmada sin modificar membresías ni exigir reiniciar

#### Scenario: Accesibilidad y carga fallida
- **WHEN** se usa tema claro/oscuro con pantalla estrecha y fuente ampliada o falla la lectura
- **THEN** se puede operar con teclado/lector sin solapamientos y se ofrece reintentar conservando el último dato confirmado

### Requirement: Barra de posición honesta y cobertura no inferida
El sistema MUST mostrar una barra solo con total editorial entero positivo conocido, fuente/procedencia identificada y evidencia explícita de equivalencia entre el ámbito y numeración de ese total y la posición. MUST limitarla a episodio continuo entero dentro de 0–total, rotular «Posición X de Y» y aclarar que no representa cantidad vista; MUST NOT mostrar porcentajes, cobertura ni unidades consumidas inferidas. Total desconocido, fuente ambigua, incompatibilidad, temporada sin total propio, capítulo decimal, especial o posición superior al total MUST suprimir la barra sin impedir guardar. Los totales existentes sin evidencia de numeración MUST NOT bastar para activarla. Un cambio editorial MUST reevaluar u ocultar la barra sin alterar posición. A MUST NOT añadir consultas externas para obtener esa evidencia.

#### Scenario: Total existente sin equivalencia
- **WHEN** existe episodeCount de Kitsu pero no evidencia de que comparte numeración y ámbito con el cursor manual
- **THEN** se muestra solo la posición textual, sin barra ni porcentaje

#### Scenario: Escala compatible y salto de episodios
- **WHEN** una escala acreditada 1–12 coincide con el episodio continuo 8 introducido tras un salto
- **THEN** se puede mostrar Posición 8 de 12, nunca ocho episodios vistos ni 67 % de cobertura

### Requirement: Extensión granular conserva incertidumbre
A MUST conservar una posición manual sin catálogo, marcas individuales, volúmenes o ciclos de consumo. La posición MUST NOT convertirse automáticamente en todas las unidades anteriores vistas/leídas ni usar su número como identidad editorial. Una evolución a B MUST preservar esa posición y su procedencia manual hasta que el usuario resuelva cualquier correspondencia ambigua, incluidas temporadas, huecos, especiales, renumeraciones y rewatch/relectura.

#### Scenario: Evolución con huecos desconocidos
- **WHEN** B incorpore unidades individuales a un título con episodio manual 24
- **THEN** los episodios 1–24 no se consideran vistos por esa posición y la cobertura permanece desconocida hasta disponer de marcas explícitas
