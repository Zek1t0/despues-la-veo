# S1 · Validación de tema y componentes

Base de revisión `087f8abcb76131371d498c600c1f607b0cc4a65b`, checkpoint PROPOSE v2 publicado en `origin/feat/redesign-core-experience`. Referencias aprobadas `despues-la-veo-prototipo-ui-v2.html` y el brief de PROPOSE. Datos de la galería y de regresión aislados mediante el entorno TEST existente.

## Original y contraste

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | #14151B | #F4F3F8 |
| Superficie | #22242E | #FFFFFF |
| Elevada | #30333E | #E7E5EE |
| Texto principal | #F3F2F8 | #20212B |
| Secundario y atenuado | #B0B2C2 | #616375 |
| Acento | #C4AFFF | #6442B4 |
| Sobre acento | #251746 | #FFFFFF |
| Borde decorativo | #414451 | #D2CDDF |
| Fondo seleccionado | #40345B | #E8DFFD |
| Campo | #14151B | #FFFFFF |
| Borde funcional | #827A95 | #81758F |
| Texto seleccionado | #F3F2F8 | #392362 |
| Borde seleccionado | #C4AFFF | #6442B4 |

Los nueve roles cromáticos aprobados coinciden con V2. Campo, borde funcional y foreground y borde de selección completan los roles que V2 no especificó. El bootstrap Web replica los roles del tema hasta la hidratación y los colores derivados de scrollbar. Los colores de los estados, de arte y del backdrop siguen los contratos compartidos. El aviso existente de error de puntuación usa un fondo del tema dentro de su tarjeta para conservar el foreground histórico. En Original oscuro pasa de 4,05:1 sobre la tarjeta a 4,78:1 sobre ese fondo. Se mantiene el splash de marca.

| Mínimo de Original, en los pares medidos | Oscuro | Claro |
|---|---:|---:|
| Texto principal sobre fondo, superficies y campo | 11,31 | 12,82 |
| Texto secundario sobre esos mismos fondos | 5,99 | 4,74 |
| Texto sobre acento | 8,47 | 7,05 |
| Texto sobre selección | 10,14 | 10,31 |
| Borde funcional frente a fondo, superficies y campo | 3,10 | 3,45 |
| Borde de campo frente a tarjeta o al propio campo | 3,80 | 4,31 |
| Foco de acento frente a fondo, superficies, campo y selección | 5,87 | 5,50 |
| Texto del botón destructivo | 12,45 | 8,48 |
| Error general sobre fondo, superficies y campo | 7,43 | 8,02 |
| Texto deshabilitado | 10,01 | 3,63 |
| Puntuaciones, el menor entre las tres bandas | 8,31 | 8,31 |

El borde decorativo separa superficies. El umbral de 3:1 se aplica a límites funcionales y foco. La auditoría contractual de sección 12 pasó las 14 combinaciones. `s1-contrast.cjs` amplía la matriz con pares adicionales y compara las otras seis paletas con el checkpoint. La matriz teórica registra 2,67:1 para el borde funcional heredado de Lavanda claro contra una superficie elevada y 4,10:1 para su texto atenuado.

El contrato simulado renderiza los componentes reales con las 14 combinaciones y verifica los colores efectivamente elegidos en reposo y foco. Los botones secundarios usan la superficie normal. Cuando `borderStrong` queda por debajo de 3:1 en alguna superficie admitida, el límite toma `textSecondary`, que en Lavanda claro alcanza 6,78:1 sobre la tarjeta elevada. Los campos usan el mismo límite compatible y texto secundario para el placeholder. Los textos secundarios sobre superficies elevadas usan `textSecondary`. Controles primarios y destructivos usan su par semántico. El foco cambia el borde con un color contrastante sobre el propio control. Los botones deshabilitados conservan el estado accesible y la exención de contraste de texto activo. Los pares heredados teóricos quedan documentados para cualquier futura adopción que los necesite. El pulido no requirió cambiar contratos cromáticos ni modificar tokens.

El resolver conserva el ID y etiqueta «Original», el default `dark + original`, la paleta independiente `lavender` y los IDs existentes. Original histórico restaura la nueva base con su esquema guardado. Las bases heredadas, las otras seis paletas, SQLite v10 y el formato Backup v11 se mantienen.

## Componentes y áreas seguras

- `OrganizationUI` reutiliza tarjeta y superficie elevada, textos, botones, iconos, chips, campos y avisos. Añade variantes de estado y señal de selección con icono, etiqueta y estado accesible. Los objetivos compartidos son de al menos 48 dp en Android y 44 en Web. El texto puede envolver y crecer sin altura fija.
- `Screen` aplica solo el inset superior que corresponde a un encabezado propio. Con encabezado del navegador, el navegador controla el superior. Aplica los laterales al contenedor. La barra de tabs controla su inset inferior. En stack lo aplica el cuerpo desplazable o el pie fijo. El pie ocupa su propio espacio en layout. `OrganizationPage` usa este contenedor.
- `ActionPanel` reutiliza controles para selector, menú y confirmación. El overlay aplica sus propios insets. El scroll conserva la interacción con el teclado. En Android el modal nativo ajusta al teclado y expone Atrás mediante `onRequestClose`. En Web, React Native Web gestiona la trampa de foco y Escape. El panel enfoca Cerrar y devuelve el foco al disparador. El menú anclado de Colecciones conserva su flujo.
- `OrganizationOption` comparte la fila de ancho completo para selector de paleta, opciones de galería y menú anclado de Colecciones. La etiqueta se alinea a la izquierda y puede envolver. La selección usa su superficie, un check a la derecha y estado accesible. El borde aparece como indicador de foco o pulsación. Se usan pesos de lectura 400, opciones y controles secundarios 500 y botón primario 700. Los títulos editoriales conservan su peso y tamaños.
- `ConfirmAction` admite retornos síncronos y promesas. Bloquea dobles pulsaciones antes del siguiente render. Durante la escritura muestra progreso y bloquea cierre, Atrás, Escape y backdrop. Cierra al confirmar éxito, restituye el foco y, en caso de fallo, mantiene el diálogo con aviso y reintento. La galería verifica estos recorridos con fixtures aislados. La confirmación de producción existente en Colecciones mantiene su flujo.
- Se añadieron títulos editorial y de pantalla, cuerpo y el paso de 32 dp a la escala 4/8/12/16/24/32. La galería usa bloques de 24 dp y distancias más cortas entre componentes relacionados. Las tarjetas siguen la jerarquía V2 de fondo, superficie y elevación por color. La galería usa texto y fixtures de revisión en vez de los datos y arte de la maqueta. El panel, sus nombres y los estados son deliberadamente operables con teclado.

## Abrir la galería

Desde PowerShell en la raíz del repo, iniciar Metro de desarrollo con el gate TEST. Usar una sesión nueva de Chrome para aislar cookies y storage.

```powershell
$env:EXPO_PUBLIC_MEDIA_REVIEW = '1'
$env:EXPO_NO_DOTENV = '1'
node node_modules/expo/bin/cli start --web --lan --port 8197
```

- **Chrome:** abrir `http://localhost:8197/dev/media-review?gallery=s1`. Para reproducir las capturas automatizadas, ejecutar `node docs/testing/redesign-core-experience/s1-web.cjs` con un puerto libre en `S1_METRO_PORT` si el 8197 ya está ocupado.
- **Android:** conectar el teléfono a la misma red que el equipo, abrir el QR de Metro en un cliente de desarrollo compatible con el SDK de este proyecto y pulsar **Abrir galería S1 TEST**. Si se usa un development build ya instalado, iniciar Metro con `--dev-client --lan --port 8197` y abrir su QR. Probar con gestos y tres botones, teclado visible, Atrás, TalkBack y tamaño de fuente ampliado en Ajustes del sistema. La sesión TEST abre bases aisladas y aplica Claro, Oscuro, Sistema y las siete paletas mediante el resolver real.

## Evidencia y pruebas

Capturas de Chrome reales en `.expo/redesign-s1-evidence/`, excluidas del diff por la regla de `.expo`.

| Captura | Evidencia |
|---|---|
| `original-oscuro-390.png`, `original-claro-320.png` | Original, superficies y tipografía a 390 y 320 px. |
| `campos-y-controles-320.png` | Controles, chip activo, campos, foco y error. |
| `menu-320.png`, `confirmacion-320.png`, `selector-320.png` | Menú, confirmación y paletas, respectivamente. |
| `confirmacion-en-curso-320.png`, `confirmacion-error-320.png` | Demora con cierre bloqueado y rechazo recuperable. |
| `lavanda-claro-elevada-320.png` | Lavanda claro con un control en superficie elevada. |
| `pinky-claro-390.png`, `obsidiana-oscuro-390.png` | Otras paletas en el resolver real. |
| `obsidiana-texto-web-200.png` | Texto y line-height simulados al 200 % en Chrome, a 390 px. |

- TypeScript y exportación Web de producción verificados. La galería usa los gates de revisión de desarrollo.
- Preferencias y backup de apariencia, secciones 2 y 11. Bootstrap y navegación Web, sección 3. Tema de Buscar, sección 7. Contraste histórico y actual, sección 12. Matriz ampliada, `s1-contrast.cjs`.
- `s1-web.cjs` comprobó Original oscuro y claro, selección, campos, confirmación síncrona, demora, bloqueo de Escape durante la escritura, rechazo y reintento, y retorno de foco de la galería. `s1-native-contract.cjs` verificó insets, Atrás y foco sin DOM, estilos de componentes en las 14 combinaciones, doble pulsación antes del render y montaje del fallback de producción con el contexto real de tema. El fallback resolvió Original oscuro mientras el sistema simulado estaba en claro y la hidratación seguía pendiente.
- El harness del hotfix Android pasó AppState, cambios de día y guardas DOM. Su regresión Chrome abrió cuatro fichas locales sin avisos de claves duplicadas. También pasó la regresión de UI de metadata enriquecida con fixtures.
- OpenSpec estricto y whitespace verificados.

Las revisiones históricas de tema 1, 5, 6 y 8 también se ejecutaron. Sus primeras aserciones de patrón contra Biblioteca, tarjetas o Etiquetas ya fallan al leer los archivos del checkpoint PROPOSE. Se conservan para revisar por separado.

S1: revisión externa y aprobación visual completadas. Checkpoint manual autorizado. La evidencia disponible no sustituye Android físico, TalkBack, teclado del dispositivo ni fuente ampliada del sistema.
