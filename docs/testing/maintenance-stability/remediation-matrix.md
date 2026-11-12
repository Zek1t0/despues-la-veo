# A2 — Matriz y evidencia de remediación para Expo SDK 54

## A. Resumen ejecutivo y auditoría inicial (snapshot 2.1)

**Estado actual 2026-11-12:** L1/L2+Babel+Browserslist implementados y validados externamente:37 nodos físicos exactos (25 previos conservados +12 nuevos), sin padres/overrides/directas. Audit21 entradas (0 críticas/6 altas/14 moderadas/1 baja),12 GHSA residuales, cero nuevos;88 GHSA del baseline dejan de aplicar. Aprobaciones G.6/G.13 y evidencia G.8–G.14 preservadas. 2.2–2.4 completas;2.5 pendiente de revisión externa, aceptación residual y checkpoint MANUAL; A3 sin iniciar, con aceptación manual/física pendiente.

Consulta: sesión del **2026-11-11, America/Buenos_Aires**. Snapshot de investigación 2.1. **Aprobación acotada L1+L2 registrada el 2026-11-12 en G.6**; todavía sin actualizaciones implementadas al registrar el gate.

Prerrequisitos comprobados: rama `feat/maintenance-stability`, working tree inicialmente limpio; HEAD `1131ddefeac97a7f3fd88735cccf320f2600c5d2` (`docs: record A1 review completion`); checkpoint de incorporación A1 `a793d459c841814291c1e3c0887c8bf7b77ecc10` (`chore: add secure review bundle workflow and dev scripts`). HEAD contiene scripts/helper aprobados y 1.1–1.5 checked. El checkpoint de scripts es a793d45, no el commit documental posterior.

`npm audit --json` actual terminó con exit **1 por hallazgos**, con JSON válido, no por fallo de red:

| Severidad npm | Entradas actuales |
| --- | ---: |
| Crítica | 2 |
| Alta | 17 |
| Moderada | 16 |
| Baja | 2 |
| Total | **37** |

Coincide con Explore, pero se volvió a consultar. Las 37 entradas contienen **23 paquetes con advisories propios y 14 entradas de propagación**. Hay **100 GHSA distintos aplicables a las versiones instaladas**, contrastados con GitHub; un paquete puede agrupar muchos y una vulnerabilidad propagarse a varios paquetes. No son 37 ni 100 caminos de explotación demostrados en esta app. Todo el inventario afectado está `dev:false` en lockfile; eso NO convierte herramientas CLI/build en código ejecutado por el usuario final.

Solo `expo` y `expo-router` son directos entre las entradas afectadas; el resto es transitivo, incluyendo peers resueltos por npm. Instalado y locked coinciden en todos los nodos auditados. Stack: Expo **54.0.32**, RN **0.81.5**, Router **6.0.22**, React/DOM **19.1.0**, Metro **0.83.3**, wrapper `@expo/metro 54.2.0`, TypeScript 5.9; Node **22.18.0**, npm **10.9.3**. La matriz local `node_modules/expo/bundledNativeModules.json` coincide con los módulos del manifest. SDK 54 usa RN 0.81/React 19.1 y mínimo Node 20.19.4 según [changelog oficial](https://expo.dev/changelog/sdk-54) y [matriz SDK](https://docs.expo.dev/versions/v55.0.0/). La página v54 de docs redirigió a latest: no se usó latest como prueba de compatibilidad de SDK54.

**Hechos verificados (V):** audit, versiones instaladas/locked, rutas resueltas, rangos/peers/engines de metadata publicada, advisories públicos no retirados. **Inferencia (I):** impacto probable y reducción teórica de entradas. **No probado (NP):** resolución npm final, compatibilidad de APIs/build/runtime de las versiones nuevas, funcionamiento Android/iOS, ausencia de advisories futuros. Satisfacer semver/engines no equivale a aceptación Expo.

Fuentes primarias: [npm registry](https://registry.npmjs.org/), [GitHub Global Security Advisories API](https://docs.github.com/en/rest/security-advisories/global-advisories), advisories enlazados en G.3, archivos locales y fuentes instaladas. Se consultó el endpoint público `GET /advisories?ecosystem=npm&affects=<package>&per_page=100` para los **37 nombres** (ninguna respuesta alcanzó 100, sin página pendiente); se excluyeron withdrawn. Para candidatos se contrastaron TODOS los rangos públicos de su paquete, no solo los advisories que aparecen en audit para la versión vieja. No se afirma cobertura de vulnerabilidades aún no publicadas.

Evidencia de lectura preservada fuera del repo: `C:\Users\elias\.codex\visualizations\2026\11\11\01a1cd0c-0601-72b0-b90c-2e3de09dc1bb\a2-evidence\`: audit.json, github-advisories.json, metadata.json, inventory.json y override-api-metadata.json. Las tablas G contienen los datos relevantes sin depender de esa carpeta para revisar IDs/rangos/rutas. `npm explain shell-quote --json` corroboró la ruta RN→react-devtools-core; el grafo de G se reconstruyó de dependencias/optional/peers del lockfile con resolución real de node_modules.

## B. Candidatos compatibles con los rangos actuales

Todos son transitivos. Los destinos exactos de esta tabla y C.1 están publicados, fuera de los rangos de advisories contrastados, satisfacen los rangos de TODOS sus padres actualmente resueltos y sus engines aceptan Node 22.18.0 (V). Se eligió la menor versión publicada suficiente en la rama correspondiente, no `latest`. Las rutas completas, nodos duplicados, rangos individuales y advisories están en G.2/G.3. Este inventario describe la investigación original; los targets L1/L2 se aprobaron en G.6 y el resultado instalado/locked está en G.8. Las alternativas fuera de F siguen sin implementar.

| Paquete: instalado/locked → candidato exacto | Restricciones relevantes de padres | Engine del destino | Exposición y residual si se difiere | Tests G.1 |
| --- | --- | --- | --- | --- |
| `tar 7.5.12 → 7.5.21` | CLI `^7.5.2` | `>=18` | CLI/build: archivos manipulados pueden consumir CPU/disco o fallar parsing. No hay import tar de usuario en la app demostrado | V0,T1,T4 |
| `ws 6.2.3 → 6.2.4` (2 nodos), `7.5.10 → 7.5.11`, `8.19.0 → 8.21.0` | RN/dev-middleware `^6.2.3`; Metro `^7.5.10`, devtools `^7`; CLI `^8.12.1` | 6: no declarado; 7: `>=8.3`; 8: `>=10` | Servidores/clientes de debug y Metro: memoria/fragmentación. Reachability depende de exposición de esos servicios; no prueba de explotación en release | V0,T1,T4 |
| `compression 1.8.1 → 1.8.2` | CLI `^1.7.4` | `>=0.8` | Servidor CLI: memoria retenida si abortan respuestas comprimidas; pertinente si accesible a terceros | V0,T1,T4 |
| `source-map-js 1.2.1 → 1.2.2` | PostCSS `^1.2.1` | `>=0.10` | Tooling: mapas manipulados pueden bloquear event loop; no corrige advisories de PostCSS | V0,T1 |
| `baseline-browser-mapping 2.9.19 → 2.11.0` | Browserslist actual `^2.9.0` | `>=6` | Tooling: input inválido puede terminar proceso. Browserslist conserva sus propios hallazgos | V0,T1 |
| `brace-expansion 1.1.12 → 1.1.21` (4 nodos), `2.0.2 → 2.1.7`, `5.0.4 → 5.0.12` | Minimatch `^1.1.7`, `^2.0.2`, `^5.0.2` respectivamente | 1/2: no declarado; 5: `20 || >=22` | Globbing/codegen/build: varias familias de CPU/memoria/stack DoS con patrones controlados; no desaparece el advisory propio de minimatch | V0,T1,T4 |
| `picomatch 2.3.1 → 2.3.2`, `3.0.1 → 3.0.2`, `4.0.3 → 4.0.4` | AnyMatch/Jest/micromatch `^2`; CLI `^3.0.1`; tinyglobby `^4.0.3`, fdir peer `^3 || ^4` | `>=8.6`, `>=10`, `>=12` | Watchers/tooling: patrones maliciosos causan ReDoS/matching incorrecto; sin input adversario demostrado | V0,T1 |
| `js-yaml 3.14.2 → 3.15.2`, `4.1.1 → 4.3.2` | load-nyc-config `^3.13.1`, xcpretty `^4.1.0` | No declarado | Config/tests/log tooling: merges/aliases/omap fuerzan CPU cuadrática. No se usa para backups JSON de usuario | V0,T1,T4 |
| `yaml 2.8.2 → 2.8.3` | metro-config `^2.6.1` | `>=14.6` | Config Metro: anidamiento excesivo produce stack overflow; no parser productivo de backups | V0,T1 |

Peers nuevos del subconjunto: solo `ws 7/8` declara `bufferutil ^4.0.1` y `utf-8-validate ^5.0.2` (7) / `>=5.0.2` (8), todos **opcionales**. Ninguno está instalado en el lockfile; no se propone añadirlos. Los otros destinos del subconjunto no declaran peers nuevos. Si la resolución intenta introducir módulos nativos opcionales o cambiar padres, debe detenerse y volver al gate.

Impacto esperado (I): lockfile de los nodos enumerados, integrity/resolved y aristas internas; no cambios de package.json, SDK, RN ni Router. `compression 1.8.2` añade `destroy 1.2.0`, ya instalado. Las dependencias de tar/brace/YAML siguen admitiendo las versiones actuales de minipass/chownr/minizlib/fs-minipass/yallist/balanced-match/argparse/esprima. No se autoriza resolver arbitrariamente nuevas versiones de esos hijos.

## C. Candidatos que necesitan trabajo extra de compatibilidad

### C.1 Dentro de rangos, incluidos en F con tests específicos

| Instalado/locked → candidato | Padres / engine / peers | Motivo y riesgo residual | Verificación exigida |
| --- | --- | --- | --- |
| `shell-quote 1.8.3 → 1.11.0` | react-devtools-core `^1.6.1`; Node `>=0.4`; sin peers | Devtools/quoting; cambios de validación pueden lanzar TypeError. No hay camino demostrado desde datos de esta app hasta ejecución de shell | V0,T1,T3,T4: quote/parse con strings/operadores/comentarios y rechazo de terminadores; debug real pertinente |
| `undici 6.24.1 → 6.29.1` | CLI `^6.18.2`; Node `>=18.17`; sin peers | Red de CLI: TLS/cookies/headers/retry/EventSource/WebSocket. No es el fetch nativo de Android por el solo hecho de estar prod en lockfile | V0,T1,T3,T4: HTTPS CLI local/controlado, errores TLS/headers y startup sin cambiar controles de proveedor |
| `node-forge 1.3.3 → 1.4.3` | CLI y code-signing-certificates `^1.3.3`; Node `>=6.13`; sin peers | Tooling criptográfico: verificación de firmas/certificados más estricta puede rechazar fixtures antiguas. La app usa expo-secure-store, no se demostró uso productivo de Forge | V0,T1,T3: claves/certificados **sintéticos**, validación de code-signing/HTTPS de dev pertinente, nunca credenciales reales |
| `@xmldom/xmldom 0.8.11 → 0.8.15` | plist y @expo/plist `^0.8.8`; Node `>=10`; sin peers | Config/plist XML: inyección/recursión/CPU/memoria; parsing/serialización más estrictos pueden alterar configuración nativa | V0,T1,T3,T4: round-trip de plist sintético, Expo config y prebuild aislado cuando corresponda |
| `nanoid 3.3.11 → 3.3.18` | Router `^3.3.8`, navigation `^3.3.11`, PostCSS `^3.3.7`; Node `^10 || ^12 || ^13.7 || ^14 || >=15.0.1`; sin peers | JS runtime de navegación y tooling. Router llama nanoid() sin size en los sitios inspeccionados: no demuestra el tamaño cero/negativo vulnerable, pero la dependencia está presente | V0,T1,T2: navegación/back/IDs y reproducción controlada de límites de generador; Android si impacto material |

### C.2 Evaluación original separada, DIFERIDA del subconjunto L1/L2 de F

| Candidato exacto | Compatibilidad verificada y cambio esperado | Por qué no está en F / pruebas para reconsiderarlo |
| --- | --- | --- |
| `@babel/core 7.28.6 → 7.29.6` | Cabe en todos los parents/peers observados (`^7.20.0`, `^7.25.2`, `^7.11.6`, peers Babel 7, etc.); Node `>=6.9`. Elimina lectura de source maps del advisory propio | Requiere también elevar generator a `^7.29.6`, parser `^7.29.3`, helpers `^7.29.2`, types/traverse/code-frame a `^7.29.0`. Hoy esos módulos están mayormente en 7.28.6. No se ha seleccionado/cerrado ese grafo adicional exacto. Matriz ampliada y aprobación antes de resolverlo; T1/T2/T4 |
| `browserslist 4.28.1 → 4.28.7` | Padres `^4.24.0`, `^4.25.0`, `^4.28.1`, peer `>=4.21.0`; engine acepta Node actual. Eleva caniuse-lite a `^1.0.30001806`, electron-to-chromium `^1.5.393`, node-releases `^2.0.51`, baseline mapping `^2.10.44` | Los tres primeros están por debajo de esos mínimos. Cambia selección de targets y requiere lista de versiones auxiliares/advisories y comparación de targets Web antes de aprobar; no autoriza refresh masivo de datos. T1/T2 |
| `@expo/config-plugins 54.0.4 → 54.0.6` con `xcode 3.0.1 → 4.0.0` | Todos los padres actuales `~54.0.4` admiten 54.0.6. Esa versión cambia su dependencia a xcode `^4.0.0`; xcode4 elimina uuid y exige Node `>=14.17`. **Alternativa regular sin override** a uuid/xcode | Cambia APIs de herramientas nativas; agrega sdk-runtime-versions y cambia @expo/plist. Falta closure transitivo y prueba de plugins/prebuild Android e iOS aislados. No soluciona glob/deepmerge. T1/T3/T4 y revisión separada antes de ampliarlo |
| `@react-navigation/core 7.14.0 → 7.22.1` | Native actual exige `^7.14.0`; peer React `>=18.2` satisfecho por 19.1. 7.22.1 elimina query-string de core y exige routers `^7.6.4` (actual 7.5.3) | Quita una ruta vulnerable, pero **Router 6 sigue exigiendo query-string7**. Cambio de comportamiento de navegación y subgrafo; no se aprueba como falso fix global. T2 y aceptación Android pertinente |
| `expo 54.0.32 → 54.0.38` | Cabe en `~54.0.32`, sigue siendo SDK54. Mueve CLI 54.0.22→54.0.28, Metro config 54.0.14→54.0.17, modules-core 3.0.29→3.0.30, autolinking 3.0.24→3.0.28 y módulos Expo | No es migración de SDK, pero amplía mucho el cambio nativo; conserva glob13/PostCSS8.4/deepmerge. No se justifica como primer remedio. Requiere alineación de módulos/bundledNativeModules y build/aceptación Android; separado de F |
| `expo-router 6.0.22 → 6.0.24` | Cabe en `~6.0.22`; aumenta peer expo-linking a `^8.0.12`, hoy 8.0.11. RSC peer es opcional y no se propone añadirlo | Sigue usando query-string `^7.1.3`: no resuelve el decoder. No actualizar Router solo para reducir un warning. Tests T2 y nueva matriz si se decide ampliar |

Los destinos de padres no se declaran limpios por carecer de advisory propio: hay que analizar sus hijos. `npm fixAvailable: true` puede implicar cambios mayores o dejar otras causas; no es criterio de compatibilidad.

### C.3 shell-quote: conjunto completo consultado

Se consultaron [advisories del mantenedor](https://github.com/ljharb/shell-quote/security/advisories) y API global, que devolvió cinco records públicos no retirados:

| Advisory | Rango vulnerable | Primer parche de ese record | Instalado 1.8.3 / candidato 1.11.0 |
| --- | --- | --- | --- |
| [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) | `>=1.1.0 <=1.8.3` | 1.8.4 | afectado / fuera |
| [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | `<=1.8.4` | 1.9.0 | afectado / fuera |
| [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) | `>=1.8.4 <1.11.0` | 1.11.0 | fuera del rango publicado / fuera |
| [GHSA-g4rg-993r-mgx7](https://github.com/advisories/GHSA-g4rg-993r-mgx7) | `>=1.6.3 <=1.7.2` | 1.7.3 | fuera / fuera |
| [GHSA-qg8p-v9q4-gh34](https://github.com/advisories/GHSA-qg8p-v9q4-gh34) | `<1.6.1` | 1.6.1 | fuera / fuera |

**1.9.0 NO es destino aceptable**: cae en el record pqg4, aunque no aparezca al auditar el instalado1.8.3. 1.11.0 satisface `^1.6.1` y no cae en ninguno de esos rangos (V); la compatibilidad operativa aún es NP. El nuevo control rechaza terminadores en strings posteriores a un token comentario; ese TypeError exige verificar el consumidor. No se extrapola el exploit POSIX del advisory a Windows ni a datos de esta app sin demostrar condiciones.

## D. Candidatos que exigirían override o cambios mayores de padres

**Ningún override aprobado ni incluido en F. Todas las opciones de esta tabla REQUIEREN APROBACIÓN EXPLÍCITA de paquete/versión/ruta/plan antes de cualquier implementación.** Son alternativas de investigación, no instrucciones para aplicar --force. No se propone SDK58/RN nuevo/Router58.

| Destino exacto y ruta actual bloqueada | Por qué no basta actualización regular | Riesgos/API/engine y plan requerido | Alternativa / decisión propuesta |
| --- | --- | --- | --- |
| `decode-uri-component 0.5.1`, Router6→query-string7.1.3→decoder0.2.2 | query-string7 solo publica `^0.2.2`; no hay 7.x nuevo que lo amplíe | 0.5.1 es **ESM** (`type:module`), pero query-string7 usa require(). Puede romper Node/Metro aunque Node22 acepte algunos casos. Requiere prueba de import CJS/Metro/Hermes, decoding de casos válidos/malformados y navegación URL/deep links; T2 | Diferir override. query-string10.0.0 elimina decoder, pero es ESM, Node>=22 y mayor fuera de `^7.1.3`: tampoco sustitución compatible aprobada |
| `glob 14.0.2`, Expo CLI/config/plugins/fingerprint/Metro-config→glob13 | Todos esos padres piden `^13.0.0` | Mueve minimatch a `^11.0.0`, path-scurry a `^3.0.0`; engine `18 || 20 || >=22`. Debe elegir también minimatch11.0.1, verificar APIs/cancelación/watch/platform paths y cierre transitivo; T1/T4 | Diferir; versiones SDK54 actuales inspeccionadas conservan glob13 |
| `minimatch 11.0.1`, CLI/fingerprint/Metro config→9.0.9 y glob13→10.2.4 | Padres `^9.0.0` / `^10.1.1` excluyen11 | Engine `18 || 20 || >=22`; nuevos exports/algoritmos y dependencia @isaacs/nonrecursive-glob-match; se debe probar corpus de patrones, extglobs, brace y Windows paths, más CLI/Metro; T1/T4 | Diferir; actualizar brace-expansion reduce otros advisories pero no este |
| `postcss 8.5.23`, Expo→Metro-config54.0.14→8.4.49 | Metro-config actual y 54.0.17 mantienen `~8.4.32`, excluye8.5 | Mismo major no elimina el conflicto de rango. Probar CSS Web/source maps y rutas from/sourceMappingURL con fixtures locales; Nanoid/source-map-js deben seguir destinos F; T1/T2 | Diferir override; fuente CSS/source maps confiable como mitigación operativa, no parche |
| `image-size 2.0.3`, Expo→@expo/metro54.2.0→Metro0.83.3→1.2.1 | Metro exige `^1.0.2`; wrapper SDK54 fija familias Metro exactamente0.83.3 | v2 ofrece exports CJS/ESM, pero no se ha demostrado que conserve el contrato funcional default usado en Assets.js:68/173. Comprobar tipos/exports, assets PNG/JPEG/WebP/WASM y parsers malformados en proceso aislado; T1 | Diferir. Metro0.83.8 elimina image-size, pero sustituir la familia fijada por wrapper requeriría otro override coordinado, no un leaf update normal |
| `uuid 11.1.1`, Expo→config-plugins54.0.4→xcode3.0.1→uuid7.0.3 | xcode3 publica `^7.0.3`, no hay xcode3 nuevo con fix | API/CommonJS/ESM y semánticas v3/v5/v6/Buffer requieren contrato con xcode; T3/iOS prebuild | **Preferir evaluar padre config-plugins54.0.6 + xcode4.0.0 (C.2)**, que elimina uuid; no proponer override uuid directo ahora |

Engines aceptan el Node22.18 actual en esas alternativas, pero query-string10 eleva el mínimo sobre Node20 admitido por SDK54. No hay validación instalada de ninguna. Si un destino exige una migración mayor de SDK para ser soportado, queda fuera de este paquete de mantenimiento.

## E. Hallazgos sin fix actual aceptable en el alcance

`deepmerge 4.3.1`: [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), baja, prototype poisoning del objeto resultante; API GitHub identifica `>=4.2.0 <=4.3.1`, primer parche **null**. npm da rango agregado `>=4.2.0`. No se encontró versión publicada superior limpia; @expo/config12.0.13 y12.0.14 requieren `^4.3.1`. Downgrade4.1.1 no satisface el rango y no constituye parche demostrado: no se propone. Exposición: configuración de Expo fusionada desde objetos controlados; no se demostró un camino desde JSON de biblioteca del usuario a ese merge. Residual: configuración/dependencias maliciosas pueden afectar objetos de configuración. Mantener configuración confiable y revisar cambios; aceptar explícitamente el residual y revisar ante fix/upstream nuevo. No afirmar seguridad por ser low.

Los seis grupos D tienen parches publicados, pero NO una sustitución actualmente aceptada en los rangos del proyecto. En la evaluación original C.2, Babel/Browserslist tenían expansión de hijos aún no cerrada; G.12 fijó doce candidatos exactos y G.13/G.14 registran su aprobación/implementación posterior. Son diferidos por compatibilidad/alcance, no se describen falsamente como paquetes sin parche.

## F. Subconjunto exacto propuesto para el gate 2.2

**L1 y L2 APROBADOS explícitamente el 2026-11-12 bajo las condiciones de G.6.** Subconjunto limitado a L1+L2, catorce grupos / veinticinco nodos afectados actuales, todos transitivos; package.json y padres permanecen iguales. Los grupos C.2 y D se excluyen. Separar L1/L2 permite aprobación/revisión independiente sin inventar tareas adicionales.

| Decisión solicitada | Versiones exactas propuestas | Justificación / pruebas / residual |
| --- | --- | --- |
| **L1 — aprobado, implementado y validado** | shell-quote **1.11.0**; tar **7.5.21**; ws **6.2.4 / 7.5.11 / 8.21.0** en sus ramas; undici **6.29.1**; compression **1.8.2** | Reduce ambos paquetes críticos y servicios de dev expuestos. V0/T1/T3/T4 antes de cerrar; no prueba seguridad del runtime release ni resuelve D/E |
| **L2 — aprobado, implementado y validado** | @xmldom/xmldom **0.8.15**; baseline-browser-mapping **2.11.0**; brace-expansion **1.1.21 / 2.1.7 / 5.0.12**; js-yaml **3.15.2 / 4.3.2**; nanoid **3.3.18**; node-forge **1.4.3**; picomatch **2.3.2 / 3.0.2 / 4.0.4**; source-map-js **1.2.2**; yaml **2.8.3** | Reduce XML/YAML/globbing/IDs/crypto; V0/T1/T2/T3 pertinentes. Riesgos de Babel/Browserslist y D/E siguen presentes |
| **Babel — aprobado, implementado y validado** | Ocho paths/targets exactos G.12.1 | Gate adicional independiente G.12.2; tests TSX/Flow/source maps/Metro y Android-Hermes si material |
| **Browserslist — aprobado, implementado y validado** | Cuatro paths/targets exactos G.12.1 | Gate adicional independiente G.12.2, aceptación targets retirados/soporte Web y pruebas G.12.3/G.12.4 |
| **P — otros padres, DIFERIDOS** | config-plugins54.0.6/xcode4.0.0; navigation-core7.22.1; Expo54.0.38; Router6.0.24 | Evaluados separadamente, fuera de la implementación; no upgrades de padres/auxiliares autorizados |
| **O — overrides, NO incluidos** | Alternativas exactas en D | REQUIEREN APROBACIÓN EXPLÍCITA separada; recomendación actual: diferir |
| **R — residuales, aceptación pendiente** | C.2, D, E y propagación G.4 | Confirmar aceptación temporal, condiciones de exposición y seguimiento; aceptar matriz no implica aceptar todos los riesgos por defecto |

La aprobación debe nombrar L1/L2 o paquetes/ramas concretos; no equivale a “npm update todo”. El método futuro debe conservar exactamente esas versiones y revisar diff de lockfile. No se propone añadir todas estas hojas a dependencies directas ni usar overrides para fijarlas. Si el resolver instala otra versión, actualiza un padre, añade paquetes no revisados o cambia peers/engines fuera del cierre previsto, detenerse y presentar el nuevo diff/matriz para decisión antes de continuar. La metadata admite mantener hijos actuales, con la arista nueva compression→destroy1.2.0 ya satisfecha; eso NO simula una resolución npm ni autoriza cambios auxiliares desconocidos.

Decisión vigente: L1+L2 aprobados, implementados y validados; P/O siguen diferidos. No se reabre la aprobación de los mismos targets. La ampliación Babel/Browserslist fue aprobada explícitamente en G.13, con aceptación condicional de defaults G.12.3 y checks actuales G.14;2.2–2.4 completas para el alcance autorizado. Pendiente2.5: revisión externa real A2, aceptación explícita de residuales y checkpoint manual.

## G. Riesgos, verificaciones y evidencia exhaustiva

### G.1 Plan original de verificación por alcance (ejecuciones actuales en G.9/G.11)

- **V0, todos los grupos:** diff real manifest/lockfile, npm ls/explain de nodos afectados, peers/engines y duplicados; audit JSON comparado por GHSA/rango. Instalación reproducible futura con npm ci solo tras aprobación y en copia externa limpia. No se ejecutó install/update/ci/audit fix en 2.1.
- **T1, tooling:** TypeScript; Expo config; Metro startup/Web y export Web según el cambio; preservar WASM de SQLite en metro.config.js. Comandos futuros con binarios instalados, nunca npx que instale tooling faltante. Comparar resultados y no debilitar assertions ante un cambio de formato/API.
- **T2, navegación/runtime:** smoke Web de Buscar/Biblioteca/detalle/back/recarga; IDs/navigation history y query params; suites `provider-abstraction/section-3-buscar-verification.cjs`, `expanded-media-domain/section-5-ui-verification.cjs`, `section-8-verification.cjs` y `section-8-ui-verification.cjs`, más `mangaupdates-cover-images/section-3-verification.cjs` y `section-5-verification.cjs` cuando corresponda. Un control del decoder debe usar fixtures sintéticas en proceso con límite de tiempo, no bloquear Metro con payloads ilimitados.
- **T3, formatos/crypto:** pequeños checks de los contratos consumidores de shell-quote, Forge, plist/XML y YAML con datos originales sintéticos; errores esperados y timeouts acotados. No usar certificados, DBs, credenciales o arte reales para reproducir advisories.
- **T4, plataforma:** si se cambia código runtime/native/Expo con impacto Android material, build instalado y aceptación física de navegación/save/SQLite/backup/providers pertinentes antes de cerrar A2/A3; Node/Web no sustituyen esa aceptación. Para hojas CLI sin impacto nativo demostrado, registrar justificación de no repetir build caro. iOS/prebuild no acreditado en Windows: si se amplían plugins/xcode, requerirá entorno macOS/evidencia adicional.
- **Regresión final proporcional:** suites SQLite/backup `universal-media-identity/section-2-sqlite-v4-verification.cjs`, `section-3-persistence-verification.cjs`, `section-4-backup-v5-verification.cjs`, `mangaupdates-cover-images/section-4-verification.cjs`, más expanded-media/credentials según impacto. SQLite sigue v5, backups v6/import histórico. El runner expanded-media-domain/section-5-verification.cjs escribe una fixture: ejecutarlo solo en copia aislada. Repetir helper PowerShell, TypeScript y OpenSpec estricto al cierre; no ejecutar suites live/arte MangaUpdates ni repetir suites caras por cambios documentales menores.

**Residual esperado de L1+L2 (I, no resultado de audit posterior):** permanecen nueve hojas raíz de hallazgos: @babel/core, browserslist, decode-uri-component, deepmerge, glob, image-size, minimatch, postcss y uuid. Persisten las catorce entradas agregadas de G.4 porque conservan al menos una causa. Si solo cambian esos targets sin novedades de resolución/advisories, el conteo teórico sería 23 entradas (0 críticas, 7 altas, 14 moderadas, 2 bajas) y 15 GHSA actuales distintos residuales. **No se promete ese resultado:** requiere audit real después de una implementación autorizada. Shell1.11 evita además introducir pqg4 al pasar por1.9. No hay aceptación de residuales registrada todavía.

Prioridad de impacto: decoder en navegación es la superficie runtime más plausible (query-string.parse se usa en getStateFromPath); tamaño/control de input suficientes no demostrados. El advisory distingue límites de query URL de cuerpos HTTP: no asumir que su peor caso de servidor aplica aquí. Nanoid de Router se usa sin size en createMemoryHistory, por lo que los tamaños vulnerables no se demostraron. Compression/ws importan si Metro/CLI están al alcance de terceros. Tar/Forge/Undici/Babel/XML/YAML/image-size son principalmente tooling; Metro usa image-size en assets de build, no se infiere que lea las portadas remotas del renderer nativo. No se demostró un exploit completo de esta aplicación ni ausencia universal de exposición.

Las secciones siguientes contienen inventario, constraints y TODOS los advisories aplicables actuales para auditar la decisión sin confundir agregación con advisories nuevos.

### G.2 Inventario instalado/locked, rutas y constraints por nodo

Inventario ORIGINAL anterior a A2; los nodos remediados e instalados en copias externas se contrastan en G.8. Todos los nodos de esta sección son transitivos, prod en el lockfile original, sin discrepancia instalado/locked antes de A2. Se muestran TODOS los nodos auditados con advisory propio, una ruta raíz verificable por nodo y sus padres de dependencia/optional; los constraints peer se condensan por rango para evitar repetir plugins Babel. No se ha instalado el target. Las versiones de salida fuera de rango son diagnósticas y remiten a D, no recomendaciones aprobadas.

#### @babel/core — low

Rango agregado npm: `<=7.29.0`. [Metadata publicada](https://registry.npmjs.org/%40babel%2Fcore).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/@babel/core`<br>`7.28.6` | expo@54.0.32 → @expo/metro-config@54.0.14 → @babel/core@7.28.6 | @expo/metro-config [dep] ^7.20.0; @jest/transform [dep] ^7.11.6; @react-native/babel-preset [dep] ^7.25.2; @react-native/codegen [dep] ^7.25.2; istanbul-lib-instrument [dep] ^7.12.3; metro [dep] ^7.25.2; metro-babel-transformer [dep] ^7.25.2; metro-transform-plugins [dep] ^7.25.2; metro-transform-worker [dep] ^7.25.2; peers: ^7.0.0; ^7.4.0 \|\| ^8.0.0-0 <8.0.0; ^7.0.0-0; ^7.12.0; *; ^7.8.0; ^7.0.0 \|\| ^8.0.0-0 | `7.29.6`; Node `>=6.9.0`; dentro del rango (NP integración); diferido C.2 |

#### @xmldom/xmldom — high

Rango agregado npm: `<=0.8.14`. [Metadata publicada](https://registry.npmjs.org/%40xmldom%2Fxmldom).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/@xmldom/xmldom`<br>`0.8.11` | expo@54.0.32 → @expo/cli@54.0.22 → @expo/plist@0.4.8 → @xmldom/xmldom@0.8.11 | @expo/plist [dep] ^0.8.8; plist [dep] ^0.8.8 | `0.8.15`; Node `>=10.0.0`; dentro del rango (NP integración) |

#### baseline-browser-mapping — moderate

Rango agregado npm: `>=2.0.0 <2.11.0`. [Metadata publicada](https://registry.npmjs.org/baseline-browser-mapping).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/baseline-browser-mapping`<br>`2.9.19` | expo@54.0.32 → @expo/metro-config@54.0.14 → browserslist@4.28.1 → baseline-browser-mapping@2.9.19 | browserslist [dep] ^2.9.0 | `2.11.0`; Node `>=6.0.0`; dentro del rango (NP integración) |

#### brace-expansion — high

Rango agregado npm: `<=1.1.20 \|\| 2.0.0 - 2.1.6 \|\| 3.0.0 - 5.0.11`. [Metadata publicada](https://registry.npmjs.org/brace-expansion).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/@react-native/codegen/node_modules/brace-expansion`<br>`1.1.12` | react-native@0.81.5 → @react-native/codegen@0.81.5 → glob@7.2.3 → minimatch@3.1.5 → brace-expansion@1.1.12 | minimatch [dep] ^1.1.7 | `1.1.21`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/brace-expansion`<br>`2.0.2` | expo@54.0.32 → @expo/cli@54.0.22 → minimatch@9.0.9 → brace-expansion@2.0.2 | minimatch [dep] ^2.0.2 | `2.1.7`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/glob/node_modules/brace-expansion`<br>`5.0.4` | expo@54.0.32 → @expo/cli@54.0.22 → glob@13.0.0 → minimatch@10.2.4 → brace-expansion@5.0.4 | minimatch [dep] ^5.0.2 | `5.0.12`; Node `20 \|\| >=22`; dentro del rango (NP integración) |
| `node_modules/react-native/node_modules/brace-expansion`<br>`1.1.12` | react-native@0.81.5 → glob@7.2.3 → minimatch@3.1.5 → brace-expansion@1.1.12 | minimatch [dep] ^1.1.7 | `1.1.21`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/rimraf/node_modules/brace-expansion`<br>`1.1.12` | expo@54.0.32 → @expo/cli@54.0.22 → @react-native/dev-middleware@0.81.5 → chromium-edge-launcher@0.2.0 → rimraf@3.0.2 → glob@7.2.3 → minimatch@3.1.5 → brace-expansion@1.1.12 | minimatch [dep] ^1.1.7 | `1.1.21`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/test-exclude/node_modules/brace-expansion`<br>`1.1.12` | react-native@0.81.5 → babel-jest@29.7.0 → babel-plugin-istanbul@6.1.1 → test-exclude@6.0.0 → minimatch@3.1.5 → brace-expansion@1.1.12 | minimatch [dep] ^1.1.7 | `1.1.21`; Node no declarado; dentro del rango (NP integración) |

#### browserslist — high

Rango agregado npm: `<=4.28.6`. [Metadata publicada](https://registry.npmjs.org/browserslist).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/browserslist`<br>`4.28.1` | expo@54.0.32 → @expo/metro-config@54.0.14 → browserslist@4.28.1 | @babel/helper-compilation-targets [dep] ^4.24.0; @expo/metro-config [dep] ^4.25.0; core-js-compat [dep] ^4.28.1; peers: >= 4.21.0 | `4.28.7`; Node `^6 \|\| ^7 \|\| ^8 \|\| ^9 \|\| ^10 \|\| ^11 \|\| ^12 \|\| >=13.7`; dentro del rango (NP integración); diferido C.2 |

#### compression — high

Rango agregado npm: `<1.8.2`. [Metadata publicada](https://registry.npmjs.org/compression).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/compression`<br>`1.8.1` | expo@54.0.32 → @expo/cli@54.0.22 → compression@1.8.1 | @expo/cli [dep] ^1.7.4 | `1.8.2`; Node `>= 0.8.0`; dentro del rango (NP integración) |

#### decode-uri-component — high

Rango agregado npm: `<=0.5.0`. [Metadata publicada](https://registry.npmjs.org/decode-uri-component).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/decode-uri-component`<br>`0.2.2` | expo-router@6.0.22 → query-string@7.1.3 → decode-uri-component@0.2.2 | query-string [dep] ^0.2.2 | `0.5.1`; Node `>=14.16`; FUERA de rango, ver D |

#### deepmerge — low

Rango agregado npm: `>=4.2.0`. [Metadata publicada](https://registry.npmjs.org/deepmerge).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/deepmerge`<br>`4.3.1` | expo@54.0.32 → @expo/config@12.0.13 → deepmerge@4.3.1 | @expo/config [dep] ^4.3.1 | —; Node no declarado; sin fix publicado |

#### glob — moderate

Rango agregado npm: `9.0.0 - 14.0.1`. [Metadata publicada](https://registry.npmjs.org/glob).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/glob`<br>`13.0.0` | expo@54.0.32 → @expo/cli@54.0.22 → glob@13.0.0 | @expo/config [dep] ^13.0.0; @expo/config-plugins [dep] ^13.0.0; @expo/fingerprint [dep] ^13.0.0; @expo/metro-config [dep] ^13.0.0; @expo/cli [dep] ^13.0.0 | `14.0.2`; Node `18 \|\| 20 \|\| >=22`; FUERA de rango, ver D |

#### image-size — high

Rango agregado npm: `0.6.3 - 2.0.2`. [Metadata publicada](https://registry.npmjs.org/image-size).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/image-size`<br>`1.2.1` | expo@54.0.32 → @expo/metro@54.2.0 → metro@0.83.3 → image-size@1.2.1 | metro [dep] ^1.0.2 | `2.0.3`; Node `>=18`; FUERA de rango, ver D |

#### js-yaml — high

Rango agregado npm: `<=3.15.1 \|\| 4.0.0 - 4.3.1`. [Metadata publicada](https://registry.npmjs.org/js-yaml).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/@expo/xcpretty/node_modules/js-yaml`<br>`4.1.1` | expo@54.0.32 → @expo/cli@54.0.22 → @expo/xcpretty@4.4.0 → js-yaml@4.1.1 | @expo/xcpretty [dep] ^4.1.0 | `4.3.2`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/js-yaml`<br>`3.14.2` | react-native@0.81.5 → babel-jest@29.7.0 → babel-plugin-istanbul@6.1.1 → @istanbuljs/load-nyc-config@1.1.0 → js-yaml@3.14.2 | @istanbuljs/load-nyc-config [dep] ^3.13.1 | `3.15.2`; Node no declarado; dentro del rango (NP integración) |

#### minimatch — moderate

Rango agregado npm: `7.0.0 - 11.0.0`. [Metadata publicada](https://registry.npmjs.org/minimatch).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/glob/node_modules/minimatch`<br>`10.2.4` | expo@54.0.32 → @expo/cli@54.0.22 → glob@13.0.0 → minimatch@10.2.4 | glob [dep] ^10.1.1 | `11.0.1`; Node `18 \|\| 20 \|\| >=22`; FUERA de rango, ver D |
| `node_modules/minimatch`<br>`9.0.9` | expo@54.0.32 → @expo/cli@54.0.22 → minimatch@9.0.9 | @expo/fingerprint [dep] ^9.0.0; @expo/metro-config [dep] ^9.0.0; @expo/cli [dep] ^9.0.0 | `11.0.1`; Node `18 \|\| 20 \|\| >=22`; FUERA de rango, ver D |

#### nanoid — high

Rango agregado npm: `<=3.3.17`. [Metadata publicada](https://registry.npmjs.org/nanoid).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/nanoid`<br>`3.3.11` | expo-router@6.0.22 → nanoid@3.3.11 | @react-navigation/core [dep] ^3.3.11; @react-navigation/native [dep] ^3.3.11; @react-navigation/routers [dep] ^3.3.11; expo-router [dep] ^3.3.8; postcss [dep] ^3.3.7 | `3.3.18`; Node `^10 \|\| ^12 \|\| ^13.7 \|\| ^14 \|\| >=15.0.1`; dentro del rango (NP integración) |

#### node-forge — high

Rango agregado npm: `<=1.4.2`. [Metadata publicada](https://registry.npmjs.org/node-forge).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/node-forge`<br>`1.3.3` | expo@54.0.32 → @expo/cli@54.0.22 → node-forge@1.3.3 | @expo/code-signing-certificates [dep] ^1.3.3; @expo/cli [dep] ^1.3.3 | `1.4.3`; Node `>= 6.13.0`; dentro del rango (NP integración) |

#### picomatch — high

Rango agregado npm: `<=2.3.1 \|\| 3.0.0 - 3.0.1 \|\| 4.0.0 - 4.0.3`. [Metadata publicada](https://registry.npmjs.org/picomatch).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/expo/node_modules/picomatch`<br>`3.0.1` | expo@54.0.32 → @expo/cli@54.0.22 → picomatch@3.0.1 | @expo/cli [dep] ^3.0.1 | `3.0.2`; Node `>=10`; dentro del rango (NP integración) |
| `node_modules/picomatch`<br>`2.3.1` | react-native@0.81.5 → jest-environment-node@29.7.0 → jest-util@29.7.0 → picomatch@2.3.1 | anymatch [dep] ^2.0.4; jest-util [dep] ^2.2.3; micromatch [dep] ^2.3.1 | `2.3.2`; Node `>=8.6`; dentro del rango (NP integración) |
| `node_modules/tinyglobby/node_modules/picomatch`<br>`4.0.3` | expo@54.0.32 → @expo/config@12.0.13 → sucrase@3.35.1 → tinyglobby@0.2.15 → picomatch@4.0.3 | tinyglobby [dep] ^4.0.3; peers: ^3 \|\| ^4 | `4.0.4`; Node `>=12`; dentro del rango (NP integración) |

#### postcss — high

Rango agregado npm: `<=8.5.22`. [Metadata publicada](https://registry.npmjs.org/postcss).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/postcss`<br>`8.4.49` | expo@54.0.32 → @expo/metro-config@54.0.14 → postcss@8.4.49 | @expo/metro-config [dep] ~8.4.32 | `8.5.23`; Node `^10 \|\| ^12 \|\| >=14`; FUERA de rango, ver D |

#### shell-quote — critical

Rango agregado npm: `<=1.8.4`. [Metadata publicada](https://registry.npmjs.org/shell-quote).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/shell-quote`<br>`1.8.3` | react-native@0.81.5 → react-devtools-core@6.1.5 → shell-quote@1.8.3 | react-devtools-core [dep] ^1.6.1 | `1.11.0`; Node `>= 0.4`; dentro del rango (NP integración) |

#### source-map-js — high

Rango agregado npm: `1.0.0 - 1.2.1`. [Metadata publicada](https://registry.npmjs.org/source-map-js).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/source-map-js`<br>`1.2.1` | expo@54.0.32 → @expo/metro-config@54.0.14 → postcss@8.4.49 → source-map-js@1.2.1 | postcss [dep] ^1.2.1 | `1.2.2`; Node `>=0.10.0`; dentro del rango (NP integración) |

#### tar — critical

Rango agregado npm: `<=7.5.20`. [Metadata publicada](https://registry.npmjs.org/tar).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/tar`<br>`7.5.12` | expo@54.0.32 → @expo/cli@54.0.22 → tar@7.5.12 | @expo/cli [dep] ^7.5.2 | `7.5.21`; Node `>=18`; dentro del rango (NP integración) |

#### undici — high

Rango agregado npm: `<=6.29.0`. [Metadata publicada](https://registry.npmjs.org/undici).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/undici`<br>`6.24.1` | expo@54.0.32 → @expo/cli@54.0.22 → undici@6.24.1 | @expo/cli [dep] ^6.18.2 | `6.29.1`; Node `>=18.17`; dentro del rango (NP integración) |

#### uuid — moderate

Rango agregado npm: `<11.1.1`. [Metadata publicada](https://registry.npmjs.org/uuid).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/uuid`<br>`7.0.3` | expo@54.0.32 → @expo/config-plugins@54.0.4 → xcode@3.0.1 → uuid@7.0.3 | xcode [dep] ^7.0.3 | `11.1.1`; Node no declarado; FUERA de rango, ver D |

#### ws — high

Rango agregado npm: `6.0.0 - 6.2.3 \|\| 7.0.0 - 7.5.10 \|\| 8.0.0 - 8.20.1`. [Metadata publicada](https://registry.npmjs.org/ws).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/@react-native/dev-middleware/node_modules/ws`<br>`6.2.3` | expo@54.0.32 → @expo/cli@54.0.22 → @react-native/dev-middleware@0.81.5 → ws@6.2.3 | @react-native/dev-middleware [dep] ^6.2.3 | `6.2.4`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/expo/node_modules/ws`<br>`8.19.0` | expo@54.0.32 → @expo/cli@54.0.22 → ws@8.19.0 | @expo/cli [dep] ^8.12.1 | `8.21.0`; Node `>=10.0.0`; dentro del rango (NP integración) |
| `node_modules/react-native/node_modules/ws`<br>`6.2.3` | react-native@0.81.5 → ws@6.2.3 | react-native [dep] ^6.2.3 | `6.2.4`; Node no declarado; dentro del rango (NP integración) |
| `node_modules/ws`<br>`7.5.10` | react-native@0.81.5 → react-devtools-core@6.1.5 → ws@7.5.10 | metro [dep] ^7.5.10; react-devtools-core [dep] ^7 | `7.5.11`; Node `>=8.3.0`; dentro del rango (NP integración) |

#### yaml — moderate

Rango agregado npm: `2.0.0 - 2.8.2`. [Metadata publicada](https://registry.npmjs.org/yaml).

| Nodo y versión instalada = locked | Ruta desde raíz (versiones locked) | Padres y constraints actuales | Destino / engine / estado |
| --- | --- | --- | --- |
| `node_modules/yaml`<br>`2.8.2` | expo@54.0.32 → @expo/metro@54.2.0 → metro-config@0.83.3 → yaml@2.8.2 | metro-config [dep] ^2.6.1 | `2.8.3`; Node `>= 14.6`; dentro del rango (NP integración) |

Total: 35 nodos físicos bajo los 23 nombres con advisory propio. Las políticas/engines son metadata verificada; la compatibilidad de ejecución sigue NP.

### G.3 Advisories aplicables actuales y parches por rama

Listado exhaustivo de los 100 GHSA aplicables a al menos un nodo instalado de los paquetes auditados. Se agrupan las ramas por ID; cada par rango→primer parche se conserva. **Primer parche se refiere a ESA rama y ESE advisory, no a un intervalo global seguro ni a todos los advisories del paquete**: shell1.9 es el contraejemplo de C.3. Para escoger targets se comprobó también el resto de records de GitHub, incluidos los no aplicables al instalado pero relevantes al candidato. Severidades de esta tabla son GitHub; las tablas iniciales usan npm. No son PoCs ejecutados.

#### Advisories — @babel/core

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | low | `<= 7.29.0` → `7.29.6` |

#### Advisories — @xmldom/xmldom

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-c7q8-3ch8-vqpv](https://github.com/advisories/GHSA-c7q8-3ch8-vqpv) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-27p8-2357-5qqv](https://github.com/advisories/GHSA-27p8-2357-5qqv) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-6h8r-xr42-gp59](https://github.com/advisories/GHSA-6h8r-xr42-gp59) | medium | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-8344-3jmq-59r6](https://github.com/advisories/GHSA-8344-3jmq-59r6) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-x4fp-j954-r2f4](https://github.com/advisories/GHSA-x4fp-j954-r2f4) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-965w-775f-mr7g](https://github.com/advisories/GHSA-965w-775f-mr7g) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-93r5-fhx6-vmg9](https://github.com/advisories/GHSA-93r5-fhx6-vmg9) | high | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-w2rr-34g9-rvrj](https://github.com/advisories/GHSA-w2rr-34g9-rvrj) | high | `>= 0.7.0, <= 0.8.13` → `0.8.14` |
| [GHSA-4w3w-2rp5-g8jm](https://github.com/advisories/GHSA-4w3w-2rp5-g8jm) | high | `>= 0.7.0, <= 0.8.13` → `0.8.14` |
| [GHSA-6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) | medium | `>= 0.7.0, <= 0.8.14` → `0.8.15` |
| [GHSA-2v35-w6hq-6mfw](https://github.com/advisories/GHSA-2v35-w6hq-6mfw) | high | `< 0.8.13` → `0.8.13` |
| [GHSA-f6ww-3ggp-fr8h](https://github.com/advisories/GHSA-f6ww-3ggp-fr8h) | high | `< 0.8.13` → `0.8.13` |
| [GHSA-x6wf-f3px-wcqx](https://github.com/advisories/GHSA-x6wf-f3px-wcqx) | high | `< 0.8.13` → `0.8.13` |
| [GHSA-j759-j44w-7fr8](https://github.com/advisories/GHSA-j759-j44w-7fr8) | high | `< 0.8.13` → `0.8.13` |
| [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) | high | `< 0.8.12` → `0.8.12` |

#### Advisories — baseline-browser-mapping

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | medium | `>= 2.0.0, < 2.11.0` → `2.11.0` |

#### Advisories — brace-expansion

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | medium | `>= 4.0.0, < 5.0.12` → `5.0.12`<br>`>= 2.0.0, < 2.1.7` → `2.1.7`<br>`< 1.1.21` → `1.1.21` |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | high | `>= 4.0.0, < 5.0.11` → `5.0.11`<br>`>= 2.0.0, < 2.1.6` → `2.1.6`<br>`< 1.1.20` → `1.1.20` |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | high | `>= 4.0.0, < 5.0.10` → `5.0.10`<br>`>= 2.0.0, < 2.1.5` → `2.1.5`<br>`< 1.1.19` → `1.1.19` |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | high | `< 1.1.18` → `1.1.18`<br>`>= 2.0.0, < 2.1.4` → `2.1.4`<br>`>= 4.0.0, < 5.0.9` → `5.0.9` |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | high | `>= 4.0.0, < 5.0.8` → `5.0.8`<br>`>= 2.0.0, < 2.1.3` → `2.1.3`<br>`< 1.1.17` → `1.1.17` |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | high | `>= 3.0.0, < 5.0.7` → `5.0.7`<br>`< 1.1.16` → `1.1.16`<br>`>= 2.0.0, < 2.1.2` → `2.1.2` |
| [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2) | medium | `>= 5.0.0, < 5.0.6` → `5.0.6` |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | medium | `>= 4.0.0, < 5.0.5` → `5.0.5`<br>`>= 2.0.0, < 2.0.3` → `2.0.3`<br>`< 1.1.13` → `1.1.13` |

#### Advisories — browserslist

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | high | `<= 4.28.6` → `4.28.7` |
| [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | high | `<= 4.28.6` → `4.28.7` |

#### Advisories — compression

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95) | high | `< 1.8.2` → `1.8.2` |

#### Advisories — decode-uri-component

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | high | `<= 0.5.0` → `0.5.1` |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | medium | `<= 0.4.2` → `0.5.0` |

#### Advisories — deepmerge

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | low | `>= 4.2.0, <= 4.3.1` → **ninguno** |

#### Advisories — glob

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | medium | `>= 9.0.0, <= 14.0.1` → `14.0.2` |

#### Advisories — image-size

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | high | `>= 0.6.3, <= 2.0.2` → `2.0.3` |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | high | `>= 1.2.0, <= 2.0.2` → `2.0.3` |

#### Advisories — js-yaml

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | high | `>= 4.0.0, < 4.3.2` → `4.3.2`<br>`>= 3.0.0, < 3.15.2` → `3.15.2` |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | high | `>= 4.0.0, < 4.3.1` → `4.3.1`<br>`>= 3.0.0, < 3.15.1` → `3.15.1` |
| [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | high | `>= 3.0.0, < 3.15.0` → `3.15.0`<br>`>= 4.0.0, < 4.3.0` → `4.3.0` |
| [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) | medium | `>= 4.0.0, <= 4.1.1` → `4.2.0`<br>`< 3.15.0` → `3.15.0` |

#### Advisories — minimatch

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | medium | `>= 7.0.0, < 11.0.1` → `11.0.1` |

#### Advisories — nanoid

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | high | `< 3.3.12` → `3.3.12` |
| [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | high | `< 3.3.16` → `3.3.16` |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | high | `< 3.3.18` → `3.3.18` |

#### Advisories — node-forge

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-6889-vf6x-f3g5](https://github.com/advisories/GHSA-6889-vf6x-f3g5) | low | `<= 1.4.2` → `1.4.3` |
| [GHSA-w4xr-hqv8-ch44](https://github.com/advisories/GHSA-w4xr-hqv8-ch44) | medium | `<= 1.4.2` → `1.4.3` |
| [GHSA-6cv4-p8m7-4r25](https://github.com/advisories/GHSA-6cv4-p8m7-4r25) | medium | `>= 0.1.2, <= 1.4.2` → `1.4.3` |
| [GHSA-j8rw-jp99-435v](https://github.com/advisories/GHSA-j8rw-jp99-435v) | medium | `<= 1.4.2` → `1.4.3` |
| [GHSA-9wg5-mj3p-v49q](https://github.com/advisories/GHSA-9wg5-mj3p-v49q) | low | `<= 1.4.0` → `1.4.1` |
| [GHSA-2vgq-wchc-25w7](https://github.com/advisories/GHSA-2vgq-wchc-25w7) | low | `<= 1.4.0` → `1.4.1` |
| [GHSA-h46v-rmh6-fq4f](https://github.com/advisories/GHSA-h46v-rmh6-fq4f) | medium | `<= 1.4.0` → `1.4.1` |
| [GHSA-rhr8-3pm8-cq29](https://github.com/advisories/GHSA-rhr8-3pm8-cq29) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-6qrw-m8cv-hcxf](https://github.com/advisories/GHSA-6qrw-m8cv-hcxf) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-4642-5mcj-2rqw](https://github.com/advisories/GHSA-4642-5mcj-2rqw) | low | `<= 1.4.0` → `1.4.1` |
| [GHSA-6wvx-3r32-xmcg](https://github.com/advisories/GHSA-6wvx-3r32-xmcg) | medium | `<= 1.4.0` → `1.4.1` |
| [GHSA-525v-9gp9-w22h](https://github.com/advisories/GHSA-525v-9gp9-w22h) | medium | `<= 1.4.0` → `1.4.1` |
| [GHSA-7wch-p9px-956x](https://github.com/advisories/GHSA-7wch-p9px-956x) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-h6cr-wjv9-3cpp](https://github.com/advisories/GHSA-h6cr-wjv9-3cpp) | low | `<= 1.4.0` → `1.4.1` |
| [GHSA-4487-j8r4-4g2f](https://github.com/advisories/GHSA-4487-j8r4-4g2f) | low | `<= 1.4.0` → `1.4.1` |
| [GHSA-5cwg-6vw7-rj6p](https://github.com/advisories/GHSA-5cwg-6vw7-rj6p) | medium | `<= 1.4.0` → `1.4.1` |
| [GHSA-jc66-7q78-782g](https://github.com/advisories/GHSA-jc66-7q78-782g) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-8hrf-8g6f-7xwp](https://github.com/advisories/GHSA-8hrf-8g6f-7xwp) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-hqq3-7jhf-c5jx](https://github.com/advisories/GHSA-hqq3-7jhf-c5jx) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-5x38-2vff-x55p](https://github.com/advisories/GHSA-5x38-2vff-x55p) | high | `<= 1.4.0` → `1.4.1` |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | high | `<= 1.4.0` → **ninguno** |
| [GHSA-2328-f5f3-gj25](https://github.com/advisories/GHSA-2328-f5f3-gj25) | high | `<= 1.3.3` → `1.4.0` |
| [GHSA-q67f-28xg-22rw](https://github.com/advisories/GHSA-q67f-28xg-22rw) | high | `< 1.4.0` → `1.4.0` |
| [GHSA-ppp5-5v6c-4jwp](https://github.com/advisories/GHSA-ppp5-5v6c-4jwp) | high | `< 1.4.0` → `1.4.0` |
| [GHSA-5m6q-g25r-mvwx](https://github.com/advisories/GHSA-5m6q-g25r-mvwx) | high | `< 1.4.0` → `1.4.0` |

#### Advisories — picomatch

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | medium | `>= 4.0.0, < 4.0.4` → `4.0.4`<br>`>= 3.0.0, < 3.0.2` → `3.0.2`<br>`< 2.3.2` → `2.3.2` |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | high | `>= 4.0.0, < 4.0.4` → `4.0.4`<br>`>= 3.0.0, < 3.0.2` → `3.0.2`<br>`< 2.3.2` → `2.3.2` |

#### Advisories — postcss

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | medium | `<= 8.5.22` → `8.5.23` |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | high | `<= 8.5.17` → `8.5.18` |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | high | `<= 8.5.11` → `8.5.12` |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | medium | `< 8.5.10` → `8.5.10` |

#### Advisories — shell-quote

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | high | `<= 1.8.4` → `1.9.0` |
| [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) | critical | `>= 1.1.0, <= 1.8.3` → `1.8.4` |

#### Advisories — source-map-js

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | high | `>= 1.0.0, < 1.2.2` → `1.2.2` |

#### Advisories — tar

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | high | `<= 7.5.20` → `7.5.21` |
| [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | medium | `<= 7.5.17` → `7.5.18` |
| [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | critical | `<= 7.5.18` → `7.5.19` |
| [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | high | `<= 7.5.17` → `7.5.18` |
| [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | medium | `<= 7.5.16` → `7.5.17` |
| [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | medium | `<= 7.5.15` → `7.5.16` |

#### Advisories — undici

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | high | `>= 4.0.0, < 6.29.1` → `6.29.1` |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | high | `>= 4.2.1, < 6.29.1` → `6.29.1` |
| [GHSA-9fm3-97px-rjf6](https://github.com/advisories/GHSA-9fm3-97px-rjf6) | medium | `>= 5.15.0, < 6.29.1` → `6.29.1` |
| [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | high | `>= 6.23.0, < 6.29.1` → `6.29.1` |
| [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | medium | `>= 6.5.0, < 6.29.1` → `6.29.1` |
| [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | low | `< 6.28.1` → `6.28.1` |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | high | `>= 6.7.0, < 6.28.1` → `6.28.1` |
| [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | medium | `< 6.28.0` → `6.28.0` |
| [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | medium | `< 6.28.0` → `6.28.0` |
| [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | medium | `< 6.28.0` → `6.28.0` |
| [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) | low | `< 6.27.0` → `6.27.0` |
| [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) | high | `< 6.27.0` → `6.27.0` |
| [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv) | medium | `< 6.27.0` → `6.27.0` |
| [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) | low | `< 6.27.0` → `6.27.0` |

#### Advisories — uuid

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | medium | `< 11.1.1` → `11.1.1` |

#### Advisories — ws

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | high | `>= 6.0.0, < 6.2.4` → `6.2.4`<br>`>= 7.0.0, < 7.5.11` → `7.5.11`<br>`>= 8.0.0, < 8.21.0` → `8.21.0` |
| [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) | medium | `>= 8.0.0, < 8.20.1` → `8.20.1` |

#### Advisories — yaml

| ID primario | Severidad | Rango vulnerable → primer parche publicado de la rama |
| --- | --- | --- |
| [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) | medium | `>= 2.0.0, < 2.8.3` → `2.8.3` |

Comprobación: 100 IDs únicos en esta sección; el nuevo advisory de shell-quote que afecta a1.9 se presenta adicionalmente en C.3. Los antiguos advisories propios de expo (<48 y <9.1) no afectan54.0.32.

### G.4 Las catorce entradas de propagación

Estas entradas no añaden un advisory propio actual; las causas son las hojas G.3. Se conserva el rango agregado exacto de npm para no confundirlo con un advisory nuevo. Targets de padres fueron evaluados en C.2; no hay salto automático al fixAvailable sugerido por npm.

| Paquete (directo/transitivo) y locked = instalado | Ruta / padres actuales | Rango agregado npm | Causas heredadas y decisión |
| --- | --- | --- | --- |
| `@expo/cli@54.0.22` (transitivo), moderate | expo@54.0.32 → @expo/cli@54.0.22<br>Padres: expo 54.0.22 | `0.19.0-canary-20240625-2333e70 - 57.0.32 \|\| 58.0.0-canary-20260806-8c2d007 - 58.1.19` | @expo/config, @expo/config-plugins, @expo/metro-config, @expo/prebuild-config, glob, minimatch; **residual**, padres fuera de F |
| `@expo/config@12.0.13` (transitivo), moderate | expo@54.0.32 → @expo/config@12.0.13<br>Padres: @expo/metro-config ~12.0.13; @expo/prebuild-config ~12.0.13; expo ~12.0.13; expo-constants ~12.0.13; @expo/cli ~12.0.13 | `9.1.0-canary-20240628-1ba8152 - 57.0.10 \|\| 58.0.0-canary-20260806-8c2d007 - 58.0.10` | @expo/config-plugins, deepmerge, glob; **residual**, padres fuera de F |
| `@expo/config-plugins@54.0.4` (transitivo), moderate | expo@54.0.32 → @expo/config-plugins@54.0.4<br>Padres: @expo/config ~54.0.4; @expo/prebuild-config ~54.0.4; expo ~54.0.4; @expo/cli ~54.0.4 | `<=57.0.11 \|\| 58.0.0-canary-20260806-8c2d007 - 58.0.11` | glob, xcode; **residual**, padres fuera de F |
| `@expo/fingerprint@0.15.4` (transitivo), moderate | expo@54.0.32 → @expo/fingerprint@0.15.4<br>Padres: expo 0.15.4 | `>=0.11.12-canary-20250303-4dba60e` | glob, minimatch; **residual**, padres fuera de F |
| `@expo/metro-config@54.0.14` (transitivo), moderate | expo@54.0.32 → @expo/metro-config@54.0.14<br>Padres: expo 54.0.14; @expo/cli ~54.0.14 | `<=0.0.1-canary-20240418-8d74597 \|\| 0.8.0 - 57.0.13 \|\| 58.0.0-canary-20260806-8c2d007 - 58.0.20` | @expo/config, glob, minimatch, postcss; **residual**, padres fuera de F |
| `@expo/prebuild-config@54.0.8` (transitivo), moderate | expo@54.0.32 → @expo/cli@54.0.22 → @expo/prebuild-config@54.0.8<br>Padres: @expo/cli ^54.0.8 | `7.0.9-canary-20240719-83ee47b - 7.0.9-canary-20240814-ce0f7d5 \|\| 7.1.0-canary-20240904-69100c1 - 57.0.0-canary-20260723-64edab9 \|\| 58.0.0-canary-20260806-8c2d007 - 58.0.0-canary-20260909-ea7a89a` | @expo/config, @expo/config-plugins; **residual**, padres fuera de F |
| `@react-navigation/core@7.14.0` (transitivo), high | expo-router@6.0.22 → @react-navigation/native@7.1.28 → @react-navigation/core@7.14.0<br>Padres: @react-navigation/native ^7.14.0 | `<=7.22.0 \|\| 8.0.0-alpha.0 - 8.0.0-alpha.9` | query-string; **residual**, padres fuera de F |
| `expo@54.0.32` (directo), moderate | expo@54.0.32<br>Padres: ROOT ~54.0.32 | `52.0.0-canary-20240625-2333e70 - 58.0.0-preview.8` | @expo/cli, @expo/config, @expo/config-plugins, @expo/fingerprint, @expo/metro-config, expo-asset, expo-constants; **residual**, padres fuera de F |
| `expo-asset@12.0.12` (transitivo), moderate | expo@54.0.32 → expo-asset@12.0.12<br>Padres: expo ~12.0.12 | `10.0.11-canary-20240625-2333e70 - 55.0.0-canary-20260223-05214f1 \|\| 55.0.3-canary-20260128-67ce8d5 \|\| 55.0.8-canary-20260424-7bedc9d - 55.0.8-canary-20260429-a5e59cf \|\| 55.0.11-canary-20260327-0789fbc - 55.0.11-canary-20260402-9da566b \|\| 56.0.0-canary-20260212-4f61309 - 56.0.0-canary-20260506-964f25d` | expo-constants; **residual**, padres fuera de F |
| `expo-constants@18.0.13` (transitivo), moderate | expo@54.0.32 → expo-constants@18.0.13<br>Padres: expo ~18.0.13; expo-asset ~18.0.12; expo-linking ~18.0.12 | `16.0.3-canary-20240625-2333e70 - 55.0.14 \|\| 56.0.0-canary-20260212-4f61309 - 56.0.0-canary-20260506-964f25d` | @expo/config; **residual**, padres fuera de F |
| `expo-linking@8.0.11` (transitivo), moderate | expo-router@6.0.22 → expo-linking@8.0.11<br>Padres: expo-router [peer] ^8.0.11 | `6.3.2-canary-20240625-2333e70 - 55.0.0-canary-20260223-05214f1 \|\| 55.0.4-canary-20260128-67ce8d5 \|\| 55.0.8-canary-20260424-7bedc9d - 55.0.8-canary-20260429-a5e59cf \|\| 55.0.10-canary-20260327-0789fbc - 55.0.10-canary-20260402-9da566b \|\| 56.0.0-canary-20260212-4f61309 - 56.0.0-canary-20260506-964f25d \|\| 57.0.0-canary-20260526-13e89ca - 57.0.0-canary-20260623-1c70a78 \|\| 58.0.0-canary-20260806-8c2d007 - 58.0.0-canary-20260908-e343e6e` | expo-constants; **residual**, padres fuera de F |
| `expo-router@6.0.22` (directo), high | expo-router@6.0.22<br>Padres: ROOT ~6.0.22 | `1.2.2 - 3.1.2 \|\| 4.0.13-canary-20241211-61c49bd \|\| 4.0.18-canary-20250124-42fe332 - 4.0.18-canary-20250306-d9d3e02 \|\| 4.0.20-canary-20250320-7a205d3 \|\| 4.0.21 - 5.0.2-preview.6 \|\| 5.2.0-canary-20250611-f0afe80 - 58.0.12` | expo-constants, expo-linking, query-string; **residual**, padres fuera de F |
| `query-string@7.1.3` (transitivo), high | expo-router@6.0.22 → query-string@7.1.3<br>Padres: @react-navigation/core ^7.1.3; expo-router ^7.1.3 | `5.0.0 - 9.4.1` | decode-uri-component; **residual**, padres fuera de F |
| `xcode@3.0.1` (transitivo), moderate | expo@54.0.32 → @expo/config-plugins@54.0.4 → xcode@3.0.1<br>Padres: @expo/config-plugins ^3.0.1 | `0.9.2 - 3.0.2-nightly.20251125002453809.sha.e6b981ec` | uuid; **residual**, padres fuera de F |

### G.5 Integridad, comandos y estado de implementación

Comandos de lectura: git branch/rev-parse/status/log/show/ls-tree/diff; npm audit --json; npm explain shell-quote --json; lecturas JSON de manifest/lockfile/package.json instalados y consultas HTTPS GET de npm/GitHub. No se ejecutaron instalaciones, updates, ci, audit fix, cambios de source o acceso a DBs. Los cálculos de semver se hicieron con el módulo semver ya instalado, sin añadir herramientas.

Hashes preservados durante 2.1: package.json SHA256 `DC114766FA9DB8CADB497BDC4A909FFD74DBC226384B6BCADE8100509BE46A9F`; package-lock.json SHA256 `7EB6A96DF94D78B76C89A3E0B305AD95E1316DD91D7BB0B7B18DC4B13F3EED05`. Scripts A1 intactos. Estado al cerrar 2.1: ningún target implementado; el gate posterior se registra en G.6 y su intento en G.7.

Validación de 2.1: cobertura automatizada de los 37 nombres, 49 nodos con padres/ruta resueltos y los 100 IDs de audit en el documento; consulta GitHub completa para los 37 nombres; 14 grupos/25 nodos de F contrastados contra todos sus rangos de padres, advisories públicos y engines del Node actual. Todos los primeros parches indicados por GitHub existen en la metadata npm consultada. Esto valida la evidencia, NO ejecuta compatibilidad de candidatos. `npx --no-install tsc --noEmit`: exit 0; `openspec validate improve-dependency-security-and-review-workflow --strict`: exit 0; `git diff --check` y whitespace del archivo nuevo: sin errores. No se ejecutaron suites/runtime sobre nuevas versiones porque no se instaló ninguna.

### G.6 Gate 2.2 — aprobación explícita del usuario (2026-11-12)

El usuario aprobó AMBOS grupos L1 y L2 de F, solo las versiones exactas y los 25 nodos existentes de G.2. L1 debe validarse antes de intentar L2. Se preservan las ramas ws6/7/8, brace1/2/5, js-yaml3/4 y picomatch2/3/4 en sus paths documentados. La aprobación NO autoriza padres, overrides, nuevas dependencias directas, SDK/RN/Router/Metro nuevos, audit fix/--force ni cambios ajenos del grafo. P y O permanecen DIFERIDOS. Los residuales conocidos pueden permanecer documentados temporalmente, sin aceptación general de riesgos desconocidos o inesperados.

Primero resolver e instalar solo en copias externas limpias del código aprobado, sin .git, env, DBs, backups, credenciales ni perfiles personales. El checkout personal no recibe instalaciones. Revisar diferencias completas de lockfile y exigir los targets/rutas aprobados, parents/peers/engines compatibles y pruebas pertinentes antes de copiar un resultado al repo real. Si npm propone otra versión, otro path, cambios de padres/hijos no aprobados o requiere ampliación, DETENERSE y pedir aprobación renovada; no sustituir versiones ni forzar resolución. 2.2 se completa al registrar esta decisión; 2.3/2.4 solo tras sus criterios reales; 2.5 y A3 siguen pendientes.

### G.7 Intento A2 — resolución L1 bloqueada (2026-11-12)

Estado verificado: branch `feat/maintenance-stability`, HEAD `1131ddefeac97a7f3fd88735cccf320f2600c5d2`; ScriptsCheckpoint A1 `a793d459c841814291c1e3c0887c8bf7b77ecc10` es ancestro, tasks 1.1–1.5 completas. Solo estaban pendientes los artefactos esperados de 2.1 (esta matriz nueva y tasks.md); índice limpio.

Entorno: Node 22.18.0, npm 10.9.3. Se copiaron únicamente blobs HEAD de source/config/tests permitidos, sin .git ni archivos personales, a `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-apply-20261112/l1-resolution`. Perfil, cache, TMP y npmrc vacíos externos; registry público explícito y entorno sin tokens/configuración npm personal. No se instaló node_modules.

Audit ANTES: `npm audit --json`, exit 1 por hallazgos, **37 entradas: 2 critical, 17 high, 16 moderate, 2 low**, 100 URLs GHSA distintas. Evidencia: `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-apply-20261112/before.stdout`. No son 37 exploits independientes. Coincide con 2.1; no se aceptan riesgos adicionales por inferencia.

Comando de resolución (solo copia externa): `npm update shell-quote tar ws undici compression --package-lock-only --ignore-scripts --no-audit --no-fund`, con `--userconfig`/`--globalconfig` vacíos, `--cache` externo y `--registry=https://registry.npmjs.org`. Exit 0, “up to date in 3s”. La inspección completa por entrada/campo produjo ocho nodos modificados, cero adiciones/eliminaciones/reubicaciones ni cambios de padres; resultado **RECHAZADO**, porque seis nodos resuelven versiones no autorizadas:

| Path | Antes | Aprobado | Resuelto externo |
| --- | --- | --- | --- |
| node_modules/shell-quote | 1.8.3 | 1.11.0 | **1.12.0 — no autorizado** |
| node_modules/tar | 7.5.12 | 7.5.21 | **7.5.23 — no autorizado** |
| node_modules/@react-native/dev-middleware/node_modules/ws | 6.2.3 | 6.2.4 | **6.2.6 — no autorizado** |
| node_modules/react-native/node_modules/ws | 6.2.3 | 6.2.4 | **6.2.6 — no autorizado** |
| node_modules/ws | 7.5.10 | 7.5.11 | **7.5.13 — no autorizado** |
| node_modules/expo/node_modules/ws | 8.19.0 | 8.21.0 | **8.22.2 — no autorizado** |
| node_modules/undici | 6.24.1 | 6.29.1 | 6.29.1 |
| node_modules/compression | 1.8.1 | 1.8.2 | 1.8.2 |

Cambios de campos externos: version/resolved/integrity en los ocho; compression además dependencies/funding (incluye destroy1.2.0 ya existente). npm normalizó CRLF→LF del package.json externo (1039→1002 bytes), sin diferencias semánticas. Nada de ello fue copiado al repo. Evidencia completa por path/campo: `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-apply-20261112/l1-diff.json`; lockfile candidato conservado exclusivamente en sandbox. Integridades generadas por npm, no editadas manualmente.

Se detuvo inmediatamente por el límite explícito G.6, sin instalar/testear este grafo no aprobado, sin intentar L2 ni técnicas alternativas para forzarlo. Esta observación demuestra el resultado de ESTE comando, no que toda técnica npm compatible sea imposible. Requiere decisión renovada antes de otro intento: conservar targets y autorizar una estrategia exacta verificable, o evaluar nuevamente las versiones propuestas por el resolver; estas últimas NO están aprobadas ni evaluadas aquí por advisory/compatibilidad.

Resultado aplicado al repo: **cero cambios de dependencias**, package.json y package-lock.json conservan los hashes G.5. Audit después del intento, para el proyecto real: mismo lockfile y mismos 37 hallazgos del audit fresco; no se atribuye ninguna reducción ni advisory resuelto. No se auditó el candidato rechazado para evitar confundirlo con una remediación aplicada. Todos los advisories/exposiciones de B–E/G.3/G.4 siguen pendientes, incluido deepmerge sin fix aceptable y P/O diferidos.

2.2 completa; **2.3 y 2.4 incompletas**, 2.5 pendiente; A3 no iniciado. No npm ci/reproducibilidad de un resultado aprobado, Expo/Metro/Web ni regresiones de navegación/nanoid, XML/plist, YAML, crypto o helper sobre nuevas dependencias: no existe subset instalado aprobado que validar. No aceptación Android física/iOS. No acceso a SQLite v5, backup v6 ni imports históricos. Las pruebas históricas no cuentan como ejecución actual.

Validación actual tras documentar el bloqueo: `node node_modules/typescript/bin/tsc --noEmit` exit 0; `openspec validate improve-dependency-security-and-review-workflow --strict` exit 0; `git diff --check` exit 0 (aviso informativo LF/CRLF de tasks.md); matriz nueva sin whitespace final. Estas validaciones corresponden al checkout sin actualizaciones, no al candidato externo rechazado. Solo se modifican esta matriz y tasks.md; no staging ni checkpoint.

### G.8 Reanudación autorizada — selecciones exactas (2026-11-12)

El usuario mantiene los targets exactos de F y autoriza evaluar preparación controlada exclusivamente externa si npm no puede expresarlos. No se reabre 2.2, no se aprueban los targets superiores rechazados en G.7 ni P/O. Mismos HEAD/branch/checkpoint G.7; sin cambios inesperados al retomar.

**Método real.** [npm update](https://docs.npmjs.com/cli/v10/commands/npm-update/) actualiza nombres respetando rangos; npm10.9.3 rechaza specs exactos: intento aislado `npm update shell-quote@1.11.0 --package-lock-only --ignore-scripts --no-audit --no-fund` → exit1, EUPDATEARGS, sin cambios. Código oficial instalado: `npm/node_modules/@npmcli/arborist/lib/arborist/build-ideal-tree.js`, parseSettings, valida nombres sin ranges. `npm install name@version` selecciona raíz; --no-save no ofrece selección por nodo/path con lockfile guardado; overrides/padres/directas están prohibidos. No se usa un registry artificial, dist-tag ni fecha global que altere selección de otros paquetes. Esto delimita la CLI inspeccionada, no afirma imposibilidad matemática de cualquier herramienta.

Se prepararon las entradas transitorias autorizadas con el serializador de metadata del propio npm10.9.3: `@npmcli/arborist/lib/shrinkwrap.js: Shrinkwrap.metaFromNode` y `Node`, sin instalar herramientas. Algoritmo reproducible:

1. Partir del package-lock original G.5 y package.json byte-idéntico. Copia selectiva de blobs HEAD de app/src/assets/docs/testing/scripts/config/este OpenSpec, sin .git, perfiles, env, DBs, backups ni credenciales. Se incluyó explícitamente global.css de HEAD para Metro. Raíz externa: `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-exact-20261112`; scripts de evidencia `targets.json`, `prepare.cjs`, `verify.cjs`, `inventory.cjs` y `run.cjs`.
2. Para cada nombre/versión aprobada, GET HTTPS `https://registry.npmjs.org/<nombre-encoded>/<versión-exacta>`; exigir name/version exactos y dist.tarball HTTPS del registry oficial. Descargar tarball en memoria y contrastar SHA-512 con dist.integrity Y SHA-1 con dist.shasum. Sin hashes inventados ni omisión de verificación. `pacote.extract` de npm con integrity y scripts desactivados materializa SOLO cada paquete público en published/ externo; package.json del tarball debe coincidir con registry en nombre, versión, dependencies, optionalDependencies, peers/peerMeta, engines/os/cpu. Las respuestas completas quedan en metadata/.
3. Generar metadata de lockfile desde el manifest publicado y resolved/integrity verificados; conservar flags de contexto previos (dev/optional/devOptional/peer/inBundle). Excluir name redundante y devDependencies/extraneous de nodo raíz aislado: son contexto de un Node independiente, no metadata de una hoja transitiva. Preservar campos publicados requeridos, bin, licencia, funding, engines y peers. No copiar devDependencies del paquete al grafo. Reemplazar SOLO los paths aprobados; ninguna otra entrada ni raíz cambia. Orden de claves internas puede variar, sin cambiar semántica.
4. L1: `node prepare.cjs L1 l1`, `node verify.cjs L1 l1`; copiar código/manifest/lock a l1-ci limpio y ejecutar npm ci. Verificar las ocho versiones instaladas, todos sus padres/hijos/peers/engines, hashes, TypeScript/config/consumidores y audit antes de validar L2. L1 export Web se verificó además (ver incidencia de copia abajo).
5. L2 parte del lock L1 aprobado: `node prepare.cjs L2 l2`, `node verify.cjs ALL l2`; otra copia limpia final-ci, npm ci y `node verify.cjs ALL final-ci installed`, `node inventory.cjs`. Nunca npm install/ci en checkout personal. Preservar datos/source y copiar al repo únicamente el lockfile completo tras checks.

Los scripts/evidencia externos registran el procedimiento real; no se incorporó un nuevo gestor de dependencias al producto. Si se reproduce en otro equipo, usar misma versión npm/Node, copias limpias y adaptar SOLO la raíz de evidencia y ubicación del npm instalado. Los scripts no son una API pública estable de Arborist; el resultado final es lockfile v3 estándar consumible por npm ci normal, sin necesidad del preparador.

**Diff completo de nodos (instalado = locked en final-ci):** 25 de 810 entradas (809 paquetes + raíz); cero nodos añadidos/eliminados/movidos, ningún padre/directa/SDK/RN/Router/Metro cambiado, sin overrides. Las 798 instalaciones Windows coinciden con lock, y las once ausencias son opcionales de otras plataformas (inventario externo detalla paths). Rangos de TODOS los padres y outgoing edges válidos en árbol completo; peers opcionales ws no instalados y todos los engines instalados aceptan Node22.18.0. npm ls --all --json exit0.

| Path exacto | Original | Final instalado/locked |
| --- | --- | --- |
| `node_modules/@expo/xcpretty/node_modules/js-yaml` | 4.1.1 | **4.3.2** |
| `node_modules/@react-native/codegen/node_modules/brace-expansion` | 1.1.12 | **1.1.21** |
| `node_modules/@react-native/dev-middleware/node_modules/ws` | 6.2.3 | **6.2.4** |
| `node_modules/@xmldom/xmldom` | 0.8.11 | **0.8.15** |
| `node_modules/baseline-browser-mapping` | 2.9.19 | **2.11.0** |
| `node_modules/brace-expansion` | 2.0.2 | **2.1.7** |
| `node_modules/compression` | 1.8.1 | **1.8.2** |
| `node_modules/expo/node_modules/picomatch` | 3.0.1 | **3.0.2** |
| `node_modules/expo/node_modules/ws` | 8.19.0 | **8.21.0** |
| `node_modules/glob/node_modules/brace-expansion` | 5.0.4 | **5.0.12** |
| `node_modules/js-yaml` | 3.14.2 | **3.15.2** |
| `node_modules/nanoid` | 3.3.11 | **3.3.18** |
| `node_modules/node-forge` | 1.3.3 | **1.4.3** |
| `node_modules/picomatch` | 2.3.1 | **2.3.2** |
| `node_modules/react-native/node_modules/brace-expansion` | 1.1.12 | **1.1.21** |
| `node_modules/react-native/node_modules/ws` | 6.2.3 | **6.2.4** |
| `node_modules/rimraf/node_modules/brace-expansion` | 1.1.12 | **1.1.21** |
| `node_modules/shell-quote` | 1.8.3 | **1.11.0** |
| `node_modules/source-map-js` | 1.2.1 | **1.2.2** |
| `node_modules/tar` | 7.5.12 | **7.5.21** |
| `node_modules/test-exclude/node_modules/brace-expansion` | 1.1.12 | **1.1.21** |
| `node_modules/tinyglobby/node_modules/picomatch` | 4.0.3 | **4.0.4** |
| `node_modules/undici` | 6.24.1 | **6.29.1** |
| `node_modules/ws` | 7.5.10 | **7.5.11** |
| `node_modules/yaml` | 2.8.2 | **2.8.3** |

Todos los nodos modificados cambian version/resolved/integrity. Cambios semánticos adicionales, todos auténticos del target aprobado: compression añade destroy1.2.0 (nodo existente) y funding; baseline-browser-mapping cambia bin dist/cli.js→dist/cli.cjs y declara Node>=6; brace-expansion5 declara Node20||>=22 (original18||20||>=22); js-yaml4 añade funding. Reordenamientos sin cambio de valores: dependencies de tar, brace1/js-yaml3, funding de nanoid y metadata compression. No hubo cambios inesperados de grafo. Los peers/engines requeridos se preservan, no se suprimen para hacer pasar instalación. Evidencia exhaustiva antes/después por campo y todas las aristas: final-ci-verification.json.

### G.9 Instalación reproducible y compatibilidad A2

Windows x64; Node22.18.0; npm10.9.3; PowerShell7.6.9. Comando en CADA copia limpia: `npm ci --no-audit --no-fund --foreground-scripts`, más userconfig/globalconfig vacíos, cache externa, registry=https://registry.npmjs.org. Entorno explícito sin npm tokens ni configuración personal; HOME/USERPROFILE/APPDATA/LOCALAPPDATA/TEMP/TMP externos, CI=1, EXPO_NO_TELEMETRY=1, EXPO_OFFLINE=1. CLI npm ejecutada con Node directamente, sin depender de quoting de cmd. No --ignore-scripts ni --legacy-peer-deps/--force durante ci. Único hasInstallScript del lock: fsevents, opcional Darwin omitido en Windows; no lifecycle ejecutado en esta plataforma. Advertencias de deprecación conocidas rimraf3/inflight/glob7, sin EBADENGINE/errores peer.

| Instalación | Resultado | Integridad |
| --- | --- | --- |
| l1-ci limpia | exit0, 798 paquetes, 23s | manifest y lock idénticos al candidato L1; ocho targets exactos verificados |
| final-ci limpia, independiente | exit0, 798 paquetes, 18s | manifest y lock idénticos al candidato L1+L2; 25 targets y 798 nodos instalados verificados |

Hash SHA256 manifest sin cambios: `dc114766fa9db8cadb497bdc4a909ffd74dbc226384b6bcade8100509be46a9f`. Lockfile final: `5d695f86534b1f2c7bc8d2700f49e4eb272c77e6013e86aaf6b96d2a3f91909d`, idéntico antes/después de ci y validaciones. Original lock: G.5. No paquetes nuevos en package.json; scripts A1 byte-idénticos. Todos los hijos actuales satisfacen los nuevos manifests, incluida compression→destroy1.2.0; no se descargaron optional peers ws.

| Check actual, siempre externo | Exit / evidencia |
| --- | --- |
| TypeScript L1 y final: node node_modules/typescript/bin/tsc --noEmit | 0 / l1-tsc, final-tsc |
| Expo public config L1 y final: node node_modules/expo/bin/cli config --type public --json | 0 / configs semánticamente iguales, SDK54, plataformas/plugins preservados |
| Metro/Web: node node_modules/expo/bin/cli export --platform web --output-dir ../<dist-externo> | L1 retry0 y final0; JS/CSS/worker y SQLite WASM exportados |
| Synthetic L1: node ../l1-consumers.cjs | 0 / siete escenarios: quoting/operators/comment terminator, tar gzip Unicode, compression gzip+undici HTTP/headers, echo en los cuatro paths ws |
| Synthetic L2: node ../l2-consumers.cjs | 0 / ocho escenarios: XML/ambos plist, YAML3/4/yaml2, Expo code-signing/CSR/Forge, todas las ramas brace/picomatch, source maps/browsers targets, nanoid seguro/no seguro, React Navigation real stack/IDs/query, Expo Router real memory history con window simulado |
| Synthetic TLS: node ../tls.cjs | 0 / Undici rechaza CA no confiable y acepta únicamente CA sintética explícita, sin desactivar TLS; llaves/certificado nuevos en memoria, loopback |
| node docs/testing/provider-abstraction/section-3-buscar-verification.cjs | 0 / suite-1 |
| node docs/testing/expanded-media-domain/section-5-ui-verification.cjs | 0 / suite-2 |
| node docs/testing/expanded-media-domain/section-8-verification.cjs | 0 / suite-3 |
| node docs/testing/expanded-media-domain/section-8-ui-verification.cjs | 0 / suite-4 |
| node docs/testing/mangaupdates-cover-images/section-3-verification.cjs | 0 / suite-5 |
| node docs/testing/mangaupdates-cover-images/section-5-verification.cjs | 0 / suite-6 |
| node docs/testing/mangaupdates-cover-images/section-4-verification.cjs | 0 / suite-7 |
| node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs | 0 / suite-8 |
| node docs/testing/universal-media-identity/section-3-persistence-verification.cjs | 0 / suite-9 |
| node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs | 0 / suite-10 |

Las suites SQLite usan fixtures/DBs exclusivamente externas; suite7 verifica dieciocho DBs aisladas, SQLite user_version5, backups6 e imports v1–v6. Tests de providers no consultan APIs ni activan artwork real. IDs: mil muestras de cada generador, longitud/charset/uniqueness, size0, rechazo negativo y >1024 del generador seguro; navegación real push/pop y paths query; history real push/back/replace/recarga con window simulado. Esto NO es Android/Hermes ni un navegador real. El smoke manual Web Buscar/Biblioteca/detalle/back/recarga y aceptación Android física quedan para cierre A3; por cambio runtime nanoid se conserva gate Android antes de cierre. No se declara iOS ni prebuild nativo probado; no cambian padres/plugins nativos. No se inicia A3 por registrar estos límites.

Incidencias de fixtures corregidas sin cambios al producto: primera conexión loopback falló EACCES del sandbox; repetición autorizada fuera de restricción de red pasó. Primer export L1 falló por global.css omitido de copia; se agregó blob HEAD y pasó. Primer check comparó {} y undefined en metadata (npm omite objetos vacíos); se normalizó la comparación según serializador de npm. Primer test plist usó build sobre namespace de @expo/plist; se adaptó a su default publicado. Resultados finales pasan sin debilitar contratos funcionales. Browserslist avisa datos antiguos: no se ejecutó su sugerencia de actualizar, pues C.2 está diferido. Baseline mapping registra error esperado de input inválido, capturado por assert. No tests live/arte ni datos personales.

### G.10 Audit real comparativo por advisory

Cada `npm audit --json` termina exit1 por residuales y JSON válido, no por fallo de red. Se auditó baseline original, L1 y L1+L2 reales, sin atribuir forecasts como resultados.

| Snapshot | Critical | High | Moderate | Low | Total entradas | GHSA únicos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| before | 2 | 17 | 16 | 2 | 37 | 100 |
| l1 | 0 | 14 | 16 | 2 | 32 | 75 |
| final | 0 | 7 | 14 | 2 | 23 | 15 |

**85 GHSA dejan de aplicar (25 L1, 60 adicionales L2), 15 permanecen, cero nuevos.** Las catorce entradas de paquetes aprobados desaparecen de audit; persisten nueve hojas y catorce propagaciones G.4. Shell-quote: API GitHub refrescada devuelve los mismos cinco advisories C.3, todos fuera del rango de1.11.0, incluido pqg4. Las versiones superiores rechazadas no se usaron. Counts no demuestran independencia ni exploitabilidad. Evidencia JSON íntegra: audit-before.stdout, audit-l1.stdout, audit-final.stdout, advisory-delta.json; re-auditar en cierre, pues el inventario externo puede cambiar.

Residuales: nueve grupos C.2/D/E (@babel/core, browserslist, decode-uri-component, deepmerge, glob, image-size, minimatch, postcss, uuid), con exposición/rangos/rutas previamente documentados. Decoder sigue siendo riesgo runtime de navegación bajo inputs controlados; otros son principalmente tooling y requieren configuración/assets/dependencias confiables, sin convertir esa mitigación en parche. Deepmerge continúa sin fix aceptable. P y O diferidos; aceptación temporal de residuales sigue pendiente en 2.5, no implícita por aprobar L1/L2. No migración automática SDK58.

Inventario advisory por advisory (rango/severidad detallados en G.3; estado real verificado por URL GHSA):

| GHSA | Paquete raíz del advisory | Estado |
| --- | --- | --- |
| [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | @babel/core | residual |
| [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) | @xmldom/xmldom | resuelto L2 |
| [GHSA-2v35-w6hq-6mfw](https://github.com/advisories/GHSA-2v35-w6hq-6mfw) | @xmldom/xmldom | resuelto L2 |
| [GHSA-f6ww-3ggp-fr8h](https://github.com/advisories/GHSA-f6ww-3ggp-fr8h) | @xmldom/xmldom | resuelto L2 |
| [GHSA-x6wf-f3px-wcqx](https://github.com/advisories/GHSA-x6wf-f3px-wcqx) | @xmldom/xmldom | resuelto L2 |
| [GHSA-j759-j44w-7fr8](https://github.com/advisories/GHSA-j759-j44w-7fr8) | @xmldom/xmldom | resuelto L2 |
| [GHSA-6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) | @xmldom/xmldom | resuelto L2 |
| [GHSA-w2rr-34g9-rvrj](https://github.com/advisories/GHSA-w2rr-34g9-rvrj) | @xmldom/xmldom | resuelto L2 |
| [GHSA-4w3w-2rp5-g8jm](https://github.com/advisories/GHSA-4w3w-2rp5-g8jm) | @xmldom/xmldom | resuelto L2 |
| [GHSA-c7q8-3ch8-vqpv](https://github.com/advisories/GHSA-c7q8-3ch8-vqpv) | @xmldom/xmldom | resuelto L2 |
| [GHSA-27p8-2357-5qqv](https://github.com/advisories/GHSA-27p8-2357-5qqv) | @xmldom/xmldom | resuelto L2 |
| [GHSA-6h8r-xr42-gp59](https://github.com/advisories/GHSA-6h8r-xr42-gp59) | @xmldom/xmldom | resuelto L2 |
| [GHSA-8344-3jmq-59r6](https://github.com/advisories/GHSA-8344-3jmq-59r6) | @xmldom/xmldom | resuelto L2 |
| [GHSA-x4fp-j954-r2f4](https://github.com/advisories/GHSA-x4fp-j954-r2f4) | @xmldom/xmldom | resuelto L2 |
| [GHSA-965w-775f-mr7g](https://github.com/advisories/GHSA-965w-775f-mr7g) | @xmldom/xmldom | resuelto L2 |
| [GHSA-93r5-fhx6-vmg9](https://github.com/advisories/GHSA-93r5-fhx6-vmg9) | @xmldom/xmldom | resuelto L2 |
| [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | baseline-browser-mapping | resuelto L2 |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | brace-expansion | resuelto L2 |
| [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2) | brace-expansion | resuelto L2 |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | brace-expansion | resuelto L2 |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | brace-expansion | resuelto L2 |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | brace-expansion | resuelto L2 |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion | resuelto L2 |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion | resuelto L2 |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion | resuelto L2 |
| [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | browserslist | residual |
| [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | browserslist | residual |
| [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95) | compression | resuelto L1 |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | decode-uri-component | residual |
| [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | decode-uri-component | residual |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | deepmerge | residual |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | glob | residual |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | image-size | residual |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | image-size | residual |
| [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) | js-yaml | resuelto L2 |
| [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | js-yaml | resuelto L2 |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | js-yaml | resuelto L2 |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml | resuelto L2 |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch | residual |
| [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | nanoid | resuelto L2 |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | nanoid | resuelto L2 |
| [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | nanoid | resuelto L2 |
| [GHSA-2328-f5f3-gj25](https://github.com/advisories/GHSA-2328-f5f3-gj25) | node-forge | resuelto L2 |
| [GHSA-q67f-28xg-22rw](https://github.com/advisories/GHSA-q67f-28xg-22rw) | node-forge | resuelto L2 |
| [GHSA-5m6q-g25r-mvwx](https://github.com/advisories/GHSA-5m6q-g25r-mvwx) | node-forge | resuelto L2 |
| [GHSA-ppp5-5v6c-4jwp](https://github.com/advisories/GHSA-ppp5-5v6c-4jwp) | node-forge | resuelto L2 |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | node-forge | resuelto L2 |
| [GHSA-4642-5mcj-2rqw](https://github.com/advisories/GHSA-4642-5mcj-2rqw) | node-forge | resuelto L2 |
| [GHSA-6wvx-3r32-xmcg](https://github.com/advisories/GHSA-6wvx-3r32-xmcg) | node-forge | resuelto L2 |
| [GHSA-525v-9gp9-w22h](https://github.com/advisories/GHSA-525v-9gp9-w22h) | node-forge | resuelto L2 |
| [GHSA-7wch-p9px-956x](https://github.com/advisories/GHSA-7wch-p9px-956x) | node-forge | resuelto L2 |
| [GHSA-h6cr-wjv9-3cpp](https://github.com/advisories/GHSA-h6cr-wjv9-3cpp) | node-forge | resuelto L2 |
| [GHSA-4487-j8r4-4g2f](https://github.com/advisories/GHSA-4487-j8r4-4g2f) | node-forge | resuelto L2 |
| [GHSA-5cwg-6vw7-rj6p](https://github.com/advisories/GHSA-5cwg-6vw7-rj6p) | node-forge | resuelto L2 |
| [GHSA-jc66-7q78-782g](https://github.com/advisories/GHSA-jc66-7q78-782g) | node-forge | resuelto L2 |
| [GHSA-8hrf-8g6f-7xwp](https://github.com/advisories/GHSA-8hrf-8g6f-7xwp) | node-forge | resuelto L2 |
| [GHSA-hqq3-7jhf-c5jx](https://github.com/advisories/GHSA-hqq3-7jhf-c5jx) | node-forge | resuelto L2 |
| [GHSA-5x38-2vff-x55p](https://github.com/advisories/GHSA-5x38-2vff-x55p) | node-forge | resuelto L2 |
| [GHSA-9wg5-mj3p-v49q](https://github.com/advisories/GHSA-9wg5-mj3p-v49q) | node-forge | resuelto L2 |
| [GHSA-2vgq-wchc-25w7](https://github.com/advisories/GHSA-2vgq-wchc-25w7) | node-forge | resuelto L2 |
| [GHSA-h46v-rmh6-fq4f](https://github.com/advisories/GHSA-h46v-rmh6-fq4f) | node-forge | resuelto L2 |
| [GHSA-rhr8-3pm8-cq29](https://github.com/advisories/GHSA-rhr8-3pm8-cq29) | node-forge | resuelto L2 |
| [GHSA-6qrw-m8cv-hcxf](https://github.com/advisories/GHSA-6qrw-m8cv-hcxf) | node-forge | resuelto L2 |
| [GHSA-6889-vf6x-f3g5](https://github.com/advisories/GHSA-6889-vf6x-f3g5) | node-forge | resuelto L2 |
| [GHSA-w4xr-hqv8-ch44](https://github.com/advisories/GHSA-w4xr-hqv8-ch44) | node-forge | resuelto L2 |
| [GHSA-6cv4-p8m7-4r25](https://github.com/advisories/GHSA-6cv4-p8m7-4r25) | node-forge | resuelto L2 |
| [GHSA-j8rw-jp99-435v](https://github.com/advisories/GHSA-j8rw-jp99-435v) | node-forge | resuelto L2 |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | picomatch | resuelto L2 |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | picomatch | resuelto L2 |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | postcss | residual |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | postcss | residual |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | postcss | residual |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | postcss | residual |
| [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) | shell-quote | resuelto L1 |
| [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | shell-quote | resuelto L1 |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | source-map-js | resuelto L2 |
| [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | tar | resuelto L1 |
| [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | tar | resuelto L1 |
| [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | tar | resuelto L1 |
| [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | tar | resuelto L1 |
| [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | tar | resuelto L1 |
| [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | tar | resuelto L1 |
| [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv) | undici | resuelto L1 |
| [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) | undici | resuelto L1 |
| [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | undici | resuelto L1 |
| [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | undici | resuelto L1 |
| [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | undici | resuelto L1 |
| [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) | undici | resuelto L1 |
| [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | undici | resuelto L1 |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | undici | resuelto L1 |
| [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | undici | resuelto L1 |
| [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | undici | resuelto L1 |
| [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | undici | resuelto L1 |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | undici | resuelto L1 |
| [GHSA-9fm3-97px-rjf6](https://github.com/advisories/GHSA-9fm3-97px-rjf6) | undici | resuelto L1 |
| [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) | undici | resuelto L1 |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | uuid | residual |
| [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) | ws | resuelto L1 |
| [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | ws | resuelto L1 |
| [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) | yaml | resuelto L2 |

### G.11 Cierre técnico ORIGINAL L1/L2 de 2.3/2.4 y entrega a revisión (sin checkpoint)

Todos los checks aislados requeridos pasaron antes de copiar el candidato final al checkout. Se inspeccionó el diff COMPLETO de lockfile (complete-lockfile.diff externo), además de la comparación de las 810 entradas y sus campos; ningún cambio ajeno a las 25 rutas aprobadas. El checkout recibe SOLO package-lock.json final, hash G.9; package.json byte-idéntico, sin instalaciones ni cambios de app/source/datos. Los node_modules personales siguen en versiones anteriores: cualquier versión instalada nueva citada en este documento pertenece a final-ci/l1-ci, no se atribuye al checkout personal.

Helper: ejecución actual completa `pwsh -NoProfile -File docs/testing/maintenance-stability/Test-ReviewBundle.ps1 -EvidenceDirectory ../helper-evidence` desde final-ci, exit0; **63 assertions, 0 fallos, 2 escenarios omitidos** (creación de enlaces filesystem entrada/salida denegada por host). Protección de symlink en índice sí probada. Captura concurrente, secretos/identidad, binarios, Unicode, capas Git y políticas package cubiertos. Solo fixtures externas; no se ejecutó helper contra datos del repo real. Resumen íntegro: helper-evidence/result.json. Sintaxis PowerShell del helper: cero errores. Límites originales del helper siguen vigentes (copias modificadas/fuentes secretas ignored/untracked requieren exclusiones manuales e inspección).

Evidencia de método y tests externos, SHA256 para revisión independiente:

| Archivo externo bajo raíz G.8 | SHA256 |
| --- | --- |
| prepare.cjs | `63b834667d27f653fd1fb5cf1395880f96847efeb677921f8ed0fea776576bb2` |
| verify.cjs | `77b299064e8854b72ad9099d1231c7647f5789938dbaf8129644baa4ecf41473` |
| inventory.cjs | `478c8476fe2424cccdd79e8fc017bd64aa2ed8f4ada3e544e4ff7dde9ef0d011` |
| l1-consumers.cjs | `d1f4d7cf82bf4b9e35a5a631b3870e2dbc270b89b9dcc6dae61ba0a0b43fef27` |
| l2-consumers.cjs | `b79bd906c2053accbb596748c13a389699f399c5c1cba12b4c540e6538decce4` |
| tls.cjs | `00e84b6053eea89458fe1b31aee28ecd8a25a210eb9cc1077597c8841a571f8d` |

2.3 y 2.4 completas por grafo exacto/reproducibilidad y evidencia pertinente, sin exigir cero advisories ni declarar aceptación humana de residuales. **2.5 permanece unchecked**; 3.1–3.5 no se comienzan. No stage/commit/push/archive. Checkpoint externo A2 todavía inexistente; no se inventa hash. Revisión real de sección: baseline a793d459c841814291c1e3c0887c8bf7b77ecc10, ScriptsCheckpoint el mismo. La revisión debe incluir lockfile, esta matriz nueva y tasks.md; package.json incorporado no debe excluirse silenciosamente. Android físico, iOS y smoke manual Web siguen no acreditados.

Validación final sobre artefactos entregados: OpenSpec estricto exit0; git diff --check exit0 (avisos de conversión LF/CRLF informativos), matriz nueva sin whitespace final. Comparación byte a byte confirma lockfile del checkout idéntico al instalado/validado externo y package.json idéntico al original; índice sin archivos staged, source sin diffs. Estado final: M package-lock.json; M tasks.md; ?? remediation-matrix.md. HEAD y branch G.7 sin cambios.

### G.12 Ampliación de especificación A2 — Babel/Browserslist (sin aprobación adicional)

Fecha2026-11-12. Se mantiene HEAD1131ddefeac97a7f3fd88735cccf320f2600c5d2, branch feat/maintenance-stability y ScriptsCheckpoint A1 a793d459c841814291c1e3c0887c8bf7b77ecc10. Se preservan íntegros la aprobación G.6 y resultados/método/hashes/limitaciones L1/L2 G.7–G.11. El usuario autorizó esta actualización de especificación, **NO** mutar los doce nodos. La aprobación original de25 nodos no se reabre ni revoca. Esta sección complementa/sustituye únicamente el estado de candidatos y exposición inferida de C.2/G.1; no reescribe evidencia pasada.

Fuente leída: [informe Explore externo](C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-extra-explore-20261112/report.md). Evidencia allí: closures.json (todos los padres/rangos/hijos por path), registry/ y version-metadata/ (npm), advisories/ (GitHub), browser-targets.json, decoder-bounded-check.json, decoder-interop.json y audit-comparison.json. Se incorporan abajo los datos esenciales para que el gate sea revisable aun sin acceso al directorio externo. La investigación comprobó metadata/semver/loadVirtual y audits hipotéticos, no npm ci, TypeScript ni builds de estos nuevos targets.

#### G.12.1 Cierre exacto candidato — doce paths existentes

| Grupo | Path | Locked actual | Target candidato | Padres/rangos relevantes | Engine Node |
| --- | --- | --- | --- | --- | --- |
| babel | `node_modules/@babel/core` | 7.28.6 | **7.29.6** | ^7.0.0; ^7.4.0 \|\| ^8.0.0-0 <8.0.0; ^7.0.0-0; ^7.12.0; ^7.20.0; ^7.11.6; *; ^7.8.0; ^7.0.0 \|\| ^8.0.0-0; ^7.12.3; ^7.25.2 | >=6.9.0 |
| babel | `node_modules/@babel/types` | 7.28.6 | **7.29.0** | ^7.29.0; ^7.27.3; ^7.28.5; ^7.28.6; ^7.27.1; ^7.20.7; ^7.0.0; ^7.28.2; ^7.3.3; ^7.26.0; ^7.25.2 | >=6.9.0 |
| babel | `node_modules/@babel/parser` | 7.28.6 | **7.29.3** | ^7.29.3; ^7.28.6; ^7.29.0; ^7.25.3; ^7.20.7; ^7.1.0; ^7.14.7 | >=6.0.0 |
| babel | `node_modules/@babel/helpers` | 7.28.6 | **7.29.2** | ^7.29.2 | >=6.9.0 |
| babel | `node_modules/@babel/traverse` | 7.28.6 | **7.29.0** | ^7.29.0; ^7.28.6; ^7.28.5; ^7.27.1; ^7.25.3 | >=6.9.0 |
| babel | `node_modules/@babel/generator` | 7.28.6 | **7.29.6** | ^7.29.6; ^7.29.0; ^7.28.6; ^7.20.5; ^7.25.0 | >=6.9.0 |
| babel | `node_modules/@babel/core/node_modules/@babel/code-frame` | 7.28.6 | **7.29.0** | ^7.29.0 | >=6.9.0 |
| babel | `node_modules/@babel/traverse/node_modules/@babel/code-frame` | 7.28.6 | **7.29.0** | ^7.29.0 | >=6.9.0 |
| browserslist | `node_modules/browserslist` | 4.28.1 | **4.28.7** | ^4.24.0; ^4.25.0; ^4.28.1; >= 4.21.0 | ^6 \|\| ^7 \|\| ^8 \|\| ^9 \|\| ^10 \|\| ^11 \|\| ^12 \|\| >=13.7 |
| browserslist | `node_modules/caniuse-lite` | 1.0.30001766 | **1.0.30001806** | ^1.0.30001806 | no declarado |
| browserslist | `node_modules/node-releases` | 2.0.27 | **2.0.51** | ^2.0.51 | >=18 |
| browserslist | `node_modules/electron-to-chromium` | 1.5.283 | **1.5.393** | ^1.5.393 | no declarado |

Todos los rangos actuales y del cierre propuesto fueron satisfechos en Explore; engines admiten Node22.18.0, incluido node-releases>=18. No peers nuevos conocidos en estos targets. Revalidar metadata íntegra y todos los padres/peers/engines al implementar: esta constatación no demuestra runtime. El core nuevo pide generator^7.29.6/parser^7.29.3/helpers^7.29.2/types/traverse/code-frame^7.29.0; las dos copias code-frame están bajo core y traverse. Conservar root code-frame7.10.4 y demás copias, template7.28.6, helpers de módulos/targets7.28.6, helper-globals7.28.0 y otros hijos ya compatibles. No closure abierto ni refresh genérico de Babel.

Browserslist nuevo requiere caniuse^1.0.30001806/electron^1.5.393/node-releases^2.0.51; **baseline-browser-mapping2.11.0** satisface^2.10.44 y **update-browserslist-db1.2.3** satisface^1.2.3: preservarlos. No nuevos nodos/borrados/movidos. Mantener padres externos a este cierre, Expo54.0.32/RN0.81.5/Router6.0.22/Metro0.83.3 y sus familias, package.json y los25 L1/L2; no overrides/directas. Si resolución o metadata requiere otro nodo/versión, parar para decisión, nunca usar latest ni falsificar integrity.

Advisory objetivo Babel: [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8), low, core<=7.29.0, parche7.29.6. Exige compilar source controlado por atacante y que éste lea output/conozca ruta del source map; no se demostró esa exposición en app. Supporting nodes se elevan por constraints; los advisories históricos helpers/traverse no afectan sus targets según consulta Explore, sin advisories propios aplicables encontrados en otros targets. Reconsultar todo el set al implementar.

Advisories objetivo Browserslist: [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) y [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g), high, <=4.28.6, parche4.28.7; queries/stats no confiables en tooling, no parser de stats servido por la app. Tres supporting data packages sin advisory aplicable encontrado. Cambiar datos puede cambiar compilación aunque semver sea válido.

#### G.12.2 Gate adicional2.2 — snapshot de decisiones pendientes ANTES de G.13

| Grupo | Decisión vigente | Condiciones que debe aprobar el usuario |
| --- | --- | --- |
| Babel, ocho paths G.12.1 | **CANDIDATO, sin autorización** | Ocho versiones/rutas exactas; plan de pruebas de transforms/source maps/Metro y Android-Hermes material |
| Browserslist, cuatro paths G.12.1 | **CANDIDATO, sin autorización** | Cuatro versiones/rutas exactas y soporte Web resultante, listas completas de targets añadidos/retirados y pruebas Web/CSS |
| L1+L2,25 nodos | **APROBADOS y completados originalmente** | G.6/G.8–G.11 conservados, no pedir otra vez aprobación de los mismos targets |
| Padres/overrides/opciones nativas separadas | **DIFERIDOS, no autorizados** | Fuera de la implementación adicional; no inferir autorización de esta actualización |
| Residuales | **Sin aceptación final** | Re-audit real del subset aprobado y aceptación explícita posterior en2.5 |

Registrar aprobar/rechazar/diferir por grupo. La aprobación de uno no habilita el otro; reabrir2.2 no convierte L1/L2 en no aprobados. Si se rechaza/difiere un grupo, conservar residual y decisión, sin imponer su implementación para cerrar. Si ambos se difieren, puede evaluarse vigencia de evidencia L1/L2 sin repetir instalaciones caras sin causa. No marcar gate completo solo por editar este documento.

#### G.12.3 Targets Web — aceptar cambios de compatibilidad explícitamente

Sin config Browserslist en repo/package.json, Explore comparó defaults y tres queries adicionales (evidencia externa completa). Expo Metro convierte el resultado con lightningcss. Para **defaults**, comparación aislada de paquetes publicados (no nuevo export/build):

| Inventario completo defaults | Versiones |
| --- | --- |
| Antes | and_chr 144; and_ff 147; and_qq 14.9; and_uc 15.5; android 144; chrome 144; chrome 143; chrome 142; chrome 141; chrome 139; chrome 126; chrome 125; chrome 112; chrome 109; edge 144; edge 143; edge 142; firefox 147; firefox 146; firefox 145; firefox 140; ios_saf 26.2; ios_saf 26.1; ios_saf 18.5-18.7; kaios 3.0-3.1; kaios 2.5; op_mini all; op_mob 80; opera 125; opera 124; safari 26.2; safari 26.1; samsung 29; samsung 28 |
| Después candidato | and_chr 150; and_ff 152; and_qq 14.9; and_uc 15.5; android 150; chrome 150; chrome 149; chrome 148; chrome 118; chrome 109; edge 150; edge 149; edge 148; firefox 152; firefox 151; firefox 140; ios_saf 26.5; ios_saf 26.4; ios_saf 26.3; ios_saf 18.5-18.7; kaios 3.0-3.1; kaios 2.5; op_mini all; op_mob 80; opera 131; opera 127; safari 26.5; safari 26.4; safari 26.3; samsung 30; samsung 29 |
| RETIRADAS | and_chr 144; and_ff 147; android 144; chrome 144; chrome 143; chrome 142; chrome 141; chrome 139; chrome 126; chrome 125; chrome 112; edge 144; edge 143; edge 142; firefox 147; firefox 146; firefox 145; ios_saf 26.2; ios_saf 26.1; opera 125; opera 124; safari 26.2; safari 26.1; samsung 28 |
| AÑADIDAS | and_chr 150; and_ff 152; android 150; chrome 150; chrome 149; chrome 148; chrome 118; edge 150; edge 149; edge 148; firefox 152; firefox 151; ios_saf 26.5; ios_saf 26.4; ios_saf 26.3; opera 131; opera 127; safari 26.5; safari 26.4; safari 26.3; samsung 30 |

Mínimos CSS observados: Edge142→148, Safari26.1→26.3, Samsung28→29; Chrome109/Firefox140/iOS18.5-18.7 conservados. Esto demuestra cambio de configuración efectiva, no un navegador roto ni output CSS ya validado. La lista retirada es consecuencia de la query candidata y NO una retirada de soporte ya aceptada para el producto. Antes de aprobar, mostrar estas diferencias; al validar, recalcular queries reales, entorno y targets efectivos completos. Si difieren de lo presentado para aceptación, solicitar nueva decisión ANTES de copiar al checkout. No añadir otra actualización de datos ni modificar config Browserslist para ocultar diferencias sin autorización específica.

#### G.12.4 Validación futura por grupo — nada ejecutado como implementación nueva

V0: solo después del gate, preparar un grupo a la vez en copia externa limpia del código aprobado y lock L1/L2 actual; verificar versión/path exactos, todos los nodos/campos del diff, metadata publicada/URL/integrity y tarballs auténticos, padres/peers/engines. npm ci independiente limpio sin datos/perfiles/env personales; registrar Node/npm/flags/lifecycle/exits/hashes y comparar manifest/lock antes/después. No install/ci en checkout personal. Tras cada grupo pasar checks pertinentes y verificar combinación final antes de copiar lockfile. Si npm requiere expansión, detenerse; no padres/overrides/directas/--force/audit fix.

Babel T1/T2/T4: TypeScript, Expo public config, TSX/JSX/Flow con presets Expo/RN actuales y transformaciones relevantes; source maps inline/externos sintéticos, permisos de lectura permitida/denegada sin archivos personales; Metro/Web export y assets/worker/WASM; suites existentes pertinentes de navegación/provider/SQLite/backup. Evaluar materialidad Android/Hermes y exigir build/bundle y aceptación física pertinente si material; Node/Web/semver no la sustituyen y evidencia material faltante queda pendiente.

Browserslist T1/T2: targets completos antes/después/retirados y aceptación expresa; TypeScript/config, export Web/CSS/prefijos/source maps y smoke funcional en navegadores/versiones documentados. Buscar/Biblioteca/detalle/back/recarga, navegación y SQLite Web/worker/WASM según impacto en fixtures externas. No declarar pruebas manuales/navegadores no ejecutados. Validar frente al soporte aceptado, no solo que export terminó.

Conservar V0/T1/T2/T3/T4 G.1 con alcance proporcional; no repetir suites caras por esta edición documental ni atribuir las pasadas L1/L2 a Babel/Browserslist. Audit por GHSA/rango/nuevos/resueltos/residuales tras mutación aprobada y OpenSpec estricto. Helper sigue sin ejecutar tests; regresión final y checkpoints originales no se debilitan. SQLitev5/backupv6/imports/providers/datos y MangaUpdates permanecen intactos.

#### G.12.5 Exposición residual corregida y opciones diferidas

**Corrección de inferencia decoder en G.1/G.10:** Router6.0.22 configura explícitamente su fork getStateFromPath, cuya parseQueryParams usa URL.searchParams. Seis strings sintéticos cortos válidos/malformados dieron0 llamadas instrumentadas al decoder. Query-string en sus forks de salida se usa para stringify; upstream @react-navigation/core conserva query-string.parse, cuya presencia no demuestra uso en esa ruta principal. No hay prueba universal de inalcanzabilidad ni aceptación residual. No extrapolar límite HTTP a Android intents/location Web. Un swap directo0.5.1 mostró namespace ESM y TypeError en query-string7 con Node22; Metro/Hermes no probados. Continúa residual con controles de exposición a evaluar; no se autoriza override ni mitigación de app.

Babel/Browserslist siguen afectados en lock real hasta implementación autorizada. El audit real actual permanece23 entradas/15 GHSA/0 críticas. El candidato hipotético externo de doce cambios dio21 entradas (0critical/6high/14moderate/1low),12 GHSA y cero nuevos; NO npm ci/build ni resultado aplicado. Si se autorizan ambos, se espera eliminar core1/Browserslist2 advisories; verificar de nuevo, no prometer conteos. Persisten decoder, deepmerge, glob, minimatch, PostCSS, image-size, uuid y propagaciones; aprobación de estos candidatos no acepta esos residuales.

Fuera de esta implementación: config-plugins54.0.6/xcode4.0.0, plist0.4.9/json-file10.0.16 y retiradauuid por ese cambio. Fueron evaluados separadamente (cuatro updates y una eliminación con riesgos prebuild/macOS), NO aprobados. Corrección histórica de C.2: sdk-runtime-versions1.0.0 YA existe y satisface el rango, no sería un nodo nuevo. Siguen diferidos override decoder, swaps forzados glob/minimatch/PostCSS/image-size/deepmerge, uuid11 y migraciones mayores Expo/RN/Router/Metro; no rescatar candidatos17 del Explore como permiso de implementación.

#### G.12.6 Trazabilidad de tareas y límites de esta revisión

Antes9/15 checked: A1 cinco +2.1–2.4. Después6/15: A1 y2.1 conservan check;2.2–2.4 se reabren únicamente para decisión/implementación/validación adicionales; G.6–G.11 siguen acreditando su cierre original L1/L2.2.5 permanece unchecked para revisión externa real A2 desde a793d45, aceptación residual y checkpoint MANUAL;3.1–3.5 no iniciadas. Sin nuevo checkpoint ni archivo/sync canónico. La revisión actual solo cambia proposal/design/tasks/delta y esta trazabilidad; package.json/lockfile no se modifican ni se instalan dependencias. Gate y revisión externa quedan pendientes, no se ejecuta APPLY automáticamente.

### G.13 Aprobación explícita de Babel y Browserslist (2026-11-12)

El usuario aprueba AMBOS grupos de G.12.1, independientemente: Babel ocho paths/versiones exactos y Browserslist cuatro paths/versiones exactos. Acepta CONDICIONALMENTE a compatibilidad satisfactoria los cambios defaults documentados en G.12.3 (34 antes,24 retirados,21 añadidos,10 sin cambios,31 después), sin aceptar regresiones ni pérdida inesperada de soporte requerido. Preservar los25 L1/L2 y baseline-browser-mapping2.11.0/update-browserslist-db1.2.3; no padres, otras versiones, overrides, directas ni migraciones. Babel se valida antes de Browserslist; si fallan gates materiales o difiere el soporte aprobado, detenerse. Primero copias externas limpias y npm ci independiente; no installs en checkout personal.

2.2 queda completa por esta decisión, sin aceptar residuales automáticamente. A2 acredita compatibilidad de dependencias/build con checks automatizados/aislados disponibles; A3 mantiene aceptación final en dispositivo real y regresión manual, especialmente nanoid. Ninguna prueba no ejecutada se marca pasada; los requisitos bloqueantes siguen bloqueando salvo resolución explícita. 2.5 y A3 permanecen pendientes. Estado inicial verificado: feat/maintenance-stability, HEAD1131ddefeac97a7f3fd88735cccf320f2600c5d2, solo artefactos esperados y lock L1/L2 modificado, sin staged. SHA256 inicial lock5d695f86534b1f2c7bc8d2700f49e4eb272c77e6013e86aaf6b96d2a3f91909d; manifestdc114766fa9db8cadb497bdc4a909ffd74dbc226384b6bcade8100509be46a9f.

### G.14 Ejecución aislada Babel/Browserslist — evidencia actual (2026-11-12)

Raíz de evidencia: `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-babel-browsers-apply-20261112`. Se partió del código aprobado HEAD1131dde y del lock L1/L2 actual (G.13); solo copias externas limpias, sin .git, env, DBs/backups/credenciales ni perfiles personales. Checkpoint A1 sigue a793d459c841814291c1e3c0887c8bf7b77ecc10; no checkpoint A2. Paquete raíz y padres Expo54.0.32/RN0.81.5/Router6.0.22/Metro0.83.3 preservados. Esta sección documenta checks ejecutados, no sustituye aceptación residual/externa/manual.

#### G.14.1 Resolución, metadata y grafo

Se reutilizó el método controlado G.8: `node prepare.cjs Babel babel` y, SOLO tras gates Babel pasados, `node prepare.cjs Browserslist combined`. Consultas de versión EXACTA al registry público, exigir name/version y URL HTTPS registry.npmjs.org, verificar tarball en memoria SHA512 contra dist.integrity y SHA1 contra dist.shasum; extracción pública con pacote/integrity/ignoreScripts para contrastar package.json real con dependencies/optional/peers/peerMeta/engines/os/cpu publicados. No hashes inventados ni registry sustitutivo. Serializador Shrinkwrap.metaFromNode/Node de npm10.9.3, flags transitivos conservados, sin root-only devDependencies/extraneous. Ningún npm update, audit fix, override ni directa nueva; npm ci posterior usa lock estándar sin preparador.

Babel-preparation.json y Browserslist-preparation.json registran cada URL/integrity/versión/hash verificado; metadata/ contiene respuestas completas. verify.cjs con Arborist comprueba todos los nodos/campos, cada rango entrante y saliente/peer, y engines. Inventario completo final:798 nodos instalados coinciden en versión y engine; once nodos opcionales de otras plataformas omitidos en Windows (inventory.json), ninguna ausencia requerida. npm ls --all --json exit0. El conjunto conserva exactamente810 entradas con raíz, ningún nodo añadido/eliminado/movido.

| Path exacto adicional | Original L1/L2 | Instalado y locked candidato final |
| --- | --- | --- |
| `node_modules/@babel/core` | 7.28.6 | **7.29.6** |
| `node_modules/@babel/core/node_modules/@babel/code-frame` | 7.28.6 | **7.29.0** |
| `node_modules/@babel/generator` | 7.28.6 | **7.29.6** |
| `node_modules/@babel/helpers` | 7.28.6 | **7.29.2** |
| `node_modules/@babel/parser` | 7.28.6 | **7.29.3** |
| `node_modules/@babel/traverse` | 7.28.6 | **7.29.0** |
| `node_modules/@babel/traverse/node_modules/@babel/code-frame` | 7.28.6 | **7.29.0** |
| `node_modules/@babel/types` | 7.28.6 | **7.29.0** |
| `node_modules/browserslist` | 4.28.1 | **4.28.7** |
| `node_modules/caniuse-lite` | 1.0.30001766 | **1.0.30001806** |
| `node_modules/electron-to-chromium` | 1.5.283 | **1.5.393** |
| `node_modules/node-releases` | 2.0.27 | **2.0.51** |

Full-graph-comparison.json: **37 paths existentes actualizados desde A1 =25 originales +12 nuevos**; los25 conservan valores/metadata exactamente iguales al lock L1/L2 de entrada. Todas las otras773 entradas permanecen iguales al original. baseline-browser-mapping2.11.0/update-browserslist-db1.2.3 y otras copias Babel no listadas permanecen idénticas. Los37 nodos físicos no son37 vulnerabilidades independientes ni el conteo de audit final.

Se inspeccionó el diff completo: complete-lockfile.diff (A1→final) y additional-lockfile.diff (L1/L2→final,300 líneas). Además de version/resolved/integrity, cambios semánticos auténticos: core/generator/parser/helpers/traverse elevan sus rangos internos a los targets aprobados; Browserslist eleva rangos de sus datos y mínimos baseline mapping/update-db ya satisfechos; node-releases añade Node>=18. Code-frame/funding de core/Browserslist/caniuse tienen orden de claves diferente sin cambio de valores. Licencias/peers/metadata requeridos se conservan. No cambio inesperado de grafo, padres, native optional peers ni manifest. `final-ci-verification.json` contiene todos los campos antes/después y aristas.

#### G.14.2 npm ci reproducible y entorno

Windows x64, Node22.18.0, npm10.9.3, PowerShell7.6.9. Dos copias de instalación independientes sin node_modules previo. Comando exacto base: `npm ci --no-audit --no-fund --foreground-scripts`, más `--userconfig=<raíz>/user.npmrc --globalconfig=<raíz>/global.npmrc --cache=<raíz>/cache --registry=https://registry.npmjs.org`. Npmrc vacíos; HOME/USERPROFILE/APPDATA/LOCALAPPDATA/TEMP/TMP/cache externos, CI=1, EXPO_NO_TELEMETRY=1, EXPO_OFFLINE=1; entorno de npm sin tokens/config personal. No --ignore-scripts/--legacy-peer-deps/--force. Único hasInstallScript es fsevents Darwin opcional, omitido en Windows; no lifecycle aplicable ejecutado. Avisos de deprecación rimraf3/inflight/glob7 existentes, sin EBADENGINE ni peer errors.

| Copia limpia | Exit / resultado | SHA256 lock antes=después |
| --- | --- | --- |
| babel-ci | 0,798 paquetes,19s | `18c0709ad4768575eff9b7e80a0993026351650999894010f9dfd99b906569ed` |
| final-ci | 0,798 paquetes,15s | `7580f469b8b41e44903a2cfcd9bb13c102c7a724b5b7ef8014d6b6de8e55d237` |

Manifest de ambas instalaciones byte-idéntico al original: SHA256 dc114766fa9db8cadb497bdc4a909ffd74dbc226384b6bcade8100509be46a9f. Cada path nuevo y los25 previos instalados contrastados contra lock. No install/ci en checkout personal; sus node_modules siguen versiones previas y no se atribuyen aquí como actualizados. Scripts A1 permanecen intactos.

#### G.14.3 Checks automatizados de build y contratos

Todos estos comandos se ejecutaron desde copias externas mediante run.cjs; *.result.json registra args/exits y *.stdout/*.stderr conserva salida completa.

| Comando/check | Babel aislado | Combinado |
| --- | --- | --- |
| node node_modules/typescript/bin/tsc --noEmit | exit0 | exit0 |
| node node_modules/expo/bin/cli config --type public --json | exit0 | exit0 |
| node ../babel-transforms.cjs | exit0,9 checks | exit0,9 checks |
| node node_modules/expo/bin/cli export --platform web --source-maps --output-dir <externo> | exit0 | retry exit0 |
| node node_modules/expo/bin/cli export --platform android --source-maps --output-dir <externo> | exit0 | exit0 |
| node ../browser-targets-css.cjs | baseline antes | retry exit0 |
| npm ls --all --json | grafo virtual/instalado validado | exit0 |

Los9 checks transforms usan babel-preset-expo real sobre TSX/JSX y Flow para web y android/hermes, parsean JS resultante, verifican sourcesContent y mapping de identificador al TS original; composición inline y externa permitida, y source map sintético fuera del paquete rechazado sin siquiera leerlo (contador0). No archivos personales. Los presets/deps de Babel no listados permanecen sin actualización.

Android: Expo export produjo bytecode Hermes REAL2,287,060 bytes con magic c61fbc03c103191f y versión96; compilador hermesc de RN instalado: release0.12.0/HBC96. SHA25625dc637922b1b997cd9c02230ff12ac973660f1eb38879eac6b0539a24212fa8. Esto valida compilación/bundle, NO APK/Gradle/build instalado/ejecución Hermes en dispositivo. No se ejecutaron Gradle, APK, adb/aceptación física ni iOS/macOS/Xcode. A3 conserva aceptación física, en especial nanoid, según aclaración explícita del usuario; no se marca pasada ni se inicia A3.

Bundle-comparison.json: tras Browserslist, JS Web1,848,803 bytes, worker138,862 bytes, CSS845 bytes y HBC Android son byte-idénticos a Babel solo. Export conserva source maps, assets y SQLite WASM. No afirmar igualdad universal de outputs futuros ni soporte de todos los browsers a partir de esa igualdad.

Suites deterministas relevantes: diez nombres distintos ejecutados tanto en Babel como final (20 ejecuciones exit0):

| Comando node | Evidencia Babel / final |
| --- | --- |
| docs/testing/provider-abstraction/section-3-buscar-verification.cjs | babel-suite-1 / final-suite-1, exit0 |
| docs/testing/expanded-media-domain/section-5-ui-verification.cjs | babel-suite-2 / final-suite-2, exit0 |
| docs/testing/expanded-media-domain/section-8-verification.cjs | babel-suite-3 / final-suite-3, exit0 |
| docs/testing/expanded-media-domain/section-8-ui-verification.cjs | babel-suite-4 / final-suite-4, exit0 |
| docs/testing/mangaupdates-cover-images/section-3-verification.cjs | babel-suite-5 / final-suite-5, exit0 |
| docs/testing/mangaupdates-cover-images/section-5-verification.cjs | babel-suite-6 / final-suite-6, exit0 |
| docs/testing/mangaupdates-cover-images/section-4-verification.cjs | babel-suite-7 / final-suite-7, exit0 |
| docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs | babel-suite-8 / final-suite-8, exit0 |
| docs/testing/universal-media-identity/section-3-persistence-verification.cjs | babel-suite-9 / final-suite-9, exit0 |
| docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs | babel-suite-10 / final-suite-10, exit0 |

Incluyen providers/gates/navegación/aislamiento, fallback UI simulado y SQLite/backup histórico en fixtures. La suite de persistencia4 de portadas usa18 DBs SQLite reales aisladas, user_version5/backup6, imports1–6, rollback y datos sintéticos. No se activó artwork MangaUpdates. Sus nombres no implican aceptación nativa ni pruebas de red real. Helper PowerShell no cambió ni depende de Babel/Browserslist: se conserva la evidencia63 checks G.11; no se presenta como nueva ejecución en este paso.

#### G.14.4 Browser targets/CSS y límites de soporte

browser-targets-css.json recalculó con los módulos realmente instalados de babel-ci y final-ci: **34 antes,24 retirados,21 añadidos,10 sin cambio,31 después**. Listas completas y orden coinciden EXACTAMENTE con G.12.3 aprobada; no ampliación de soporte fuera del gate. No config Browserslist encontrada por findConfig en ambas copias, ni campo en package.json ni archivo/config/política separada de mínimos de navegador encontrado en repo. Defaults se usan por Expo Metro; no se convierte esa query en una garantía de compatibilidad funcional de cada versión.

Los targets efectivos CSS cambian como documentado (Edge142→148, Safari26.1→26.3, Samsung28→29); salidas de lightningcss para global.css real y dos fixtures layout/CSS moderno fueron idénticas, source maps generados. También CSS/JS/worker exportados idénticos. **Retirada de defaults no prueba pérdida funcional**; lo observado es cambio de selección y checks ejecutados, sin declaración de que un browser retirado falle. No se ejecutó refresh genérico de datos para silenciar el warning de caniuse antiguo del baseline.

#### G.14.5 Audit real por snapshot y residuales no aceptados

Se consultaron los cuatro lockfiles reales aislados, npm audit --json exit1 por hallazgos (JSON válido, no error de red); no se usó forecast como resultado. audit-comparison.json guarda comparación por URL GHSA:

| Snapshot | Critical | High | Moderate | Low | Entradas | GHSA únicos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| original | 2 | 17 | 16 | 2 | 37 | 100 |
| l1l2 | 0 | 7 | 14 | 2 | 23 | 15 |
| babel | 0 | 7 | 14 | 1 | 22 | 14 |
| combined | 0 | 6 | 14 | 1 | 21 | 12 |

Desde L1/L2 se resuelven GHSA-4x5r-pxfx-6jf8 (Babel), GHSA-c83g-rgw3-j3cx y GHSA-73wf-gq98-2v4g (Browserslist); cero GHSA nuevos. Desde original,88 de100 dejan de aplicar y12 permanecen; no son88 exploits demostrados. Final21 entradas =7 hojas con advisories +14 propagaciones. Todas las siguientes continúan pendientes de aceptación explícita en2.5, sin aprobación residual automática:

| Advisory | Paquete | Severity | Rango actual vulnerable | Exposición/decisión |
| --- | --- | --- | --- | --- |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | decode-uri-component | moderate | `<=0.4.2` | URL/query inputs no confiables; fork Router URL.searchParams observado, alcance sintético limitado G.12.5, no inalcanzabilidad universal; sin override |
| [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | decode-uri-component | high | `<=0.5.0` | URL/query inputs no confiables; fork Router URL.searchParams observado, alcance sintético limitado G.12.5, no inalcanzabilidad universal; sin override |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | deepmerge | low | `>=4.2.0 <=4.3.1` | Merge de config Expo; objetos no confiables, sin fix aceptable publicado; mantener config confiable, residual |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | glob | moderate | `>=9.0.0 <=14.0.1` | Cancelación de traversal de tooling; no ruta13 limpia aceptada, sin major/override |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | image-size | high | `>=1.2.0 <=2.0.2` | Parsers ICNS/JXL/HEIF de assets de build; no uso de portadas remotas demostrado; sin reemplazo2 |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | image-size | high | `>=0.6.3 <=2.0.2` | Parsers ICNS/JXL/HEIF de assets de build; no uso de portadas remotas demostrado; sin reemplazo2 |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch | moderate | `>=7.0.0 <11.0.1` | Amplificación de patrones en tooling; ramas9/10 afectadas, sin override11 |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | postcss | moderate | `<8.5.10` | CSS/source maps no confiables pueden leer archivos/XSS; rango Metro8.4 no admite fix completo, controlar inputs no es parche |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | postcss | high | `<=8.5.11` | CSS/source maps no confiables pueden leer archivos/XSS; rango Metro8.4 no admite fix completo, controlar inputs no es parche |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | postcss | moderate | `<=8.5.22` | CSS/source maps no confiables pueden leer archivos/XSS; rango Metro8.4 no admite fix completo, controlar inputs no es parche |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | postcss | high | `<=8.5.17` | CSS/source maps no confiables pueden leer archivos/XSS; rango Metro8.4 no admite fix completo, controlar inputs no es parche |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | uuid | moderate | `<11.1.1` | Buffer APIs v3/v5/v6 en tooling xcode; path adversario no demostrado, padre4 y retiradauuid diferidos |

Siguen fuera config-plugins/xcode y auxiliares nativos/retiradauuid, overrides decoder o sustituciones forzadas de glob/minimatch/PostCSS/image-size/deepmerge, upgrades Expo/RN/Router/Metro. Re-auditar en cierre y revisar cualquier advisory nuevo; estos datos no son aceptación ni promesa de audit futuro.

#### G.14.6 Navegador real, SQLite Web y límites de aceptación

Chrome real headless157.0.8103.78, motorV815.7.112.43, perfiles NUEVOS externos e incognito contexts aislados, dos Metro locales propios (producción sin token/review sintético), **31 comprobaciones aprobadas, exit0**. Evidencia completa: browser-acceptance-evidence/result.json, network.json, console.json, screenshots y storage.json. Navegación Buscar/Series/Biblioteca, opciones grid/detalle, router.push real Ajustes→Acerca y back/forward del navegador, rutas remotas MangaUpdates bloqueadas,20 fixtures originales; SQLite Web REAL (WASM/worker/OPFS) inicializa DBs de prueba, guarda título, estado y nota, relee por navegación y conserva nota después de Page.reload. DB primaria/restore aisladas, origen producción vacío de perfil externo sin DB review; cero solicitudes o intentos MangaUpdates, cero excepciones de runtime o errores console inesperados.

Se reutilizó el runner existente section-5-browser-verification.cjs; adaptación SOLO en copia externa: conectar a Chrome propio lanzado por Start-Process -WindowStyle Hidden con --user-data-dir externo explícito, agregar back/forward de ruta router.push y reload con esperas de hydration. Archivo externo exacto final-ci/docs/testing/mangaupdates-cover-images/section-5-browser-reload.cjs; sin modificar runner/source del repo ni debilitar assertions de unicidad, storage, network o errores. Los procesos Chrome/Metro propios se cerraron al terminar; perfiles/evidencia pertenecen exclusivamente a fixtures.

Incidencias registradas, NO contadas como pasadas: Chrome/Edge desde entorno npm restringido no abrieron CDP (primer intento además mostró rutas demasiado largas); lanzador nativo Windows con perfil externo nuevo resolvió startup. Un primer export final falló EPERM al escribir salida y pasó en destino externo nuevo. El primer lector CSS intentó package.json por exports no expuesto de baseline mapping; se corrigió lectura filesystem del manifest publicado sin cambiar deps/expectativas y pasó. Extensión de navegación falló inicialmente al evaluar history.back durante navegación (contexto destruido), luego al asumir que un cambio de pestaña agregaba historial (volvió a about:blank, la pestaña reemplaza); se probó la ruta explícita router.push y se usó Page.navigateToHistoryEntry. Una espera insuficiente tras volver dejó control aún sin hidratar; se añadió espera por el MISMO control único, manteniendo assertion. Todos esos fallos y comandos quedan en *.result.json/stdout/stderr; la ejecución final31/31 pasó. El runner original también pasó26/26 antes de la extensión. No se corrigió código del producto ni se ocultó una regresión cambiando dependencias.

No browser manual humano ejecutado; no Safari/Firefox/Edge funcional ni versiones antiguas de defaults, WebKit/iOS o Android físico acreditados. Chrome disponible demuestra compatibilidad de este motor y flujos sintéticos, no todos los31 defaults. Retirar una versión de la query no prueba pérdida de compatibilidad; no se observó pérdida funcional en checks disponibles y no se encontró política separada de mínimos que contradiga los cambios aprobados. A3 conserva smoke manual final, navegadores/plataformas pertinentes y aceptación Android real (especialmente nanoid). Esos pendientes se mantienen explícitos según instrucción del usuario, sin convertirlos en tests pasados ni aceptación de residuales. Cualquier regresión/material bloqueante nueva sigue requiriendo solución explícita antes del cierre.

#### G.14.7 Incorporación del resultado y estado de tareas

Solo DESPUÉS de pasar los checks aislados se copió package-lock.json a checkout, byte-idéntico a final-ci validado: SHA2567580f469b8b41e44903a2cfcd9bb13c102c7a724b5b7ef8014d6b6de8e55d237. Manifest conserva hash G.13 y scripts A1. Se confirmó HEAD/branch reales, ancestro ScriptsCheckpoint y ausencia de paths inesperados antes de copiar. Diff completo contiene exactamente37 nodos existentes desde HEAD (25+12), sin entradas añadidas/borradas ni otros cambios de grafo; la metadata de los25 es idéntica al inicio. Node_modules personal no actualizado, no acceso a DBs/backups/credenciales/perfiles personales ni cambios app/schema/imports; ningún artwork real activado.

2.2 completada por aprobación G.13;2.3/2.4 completadas por versiones/metadata/grafo exactos, npm ci reproducible y compatibilidad automatizada/build/navegador real disponible en G.14. **9/15 tareas completas, 2.5 unchecked, A3 sin iniciar**. Acceptance manual/física A3 sigue pendiente; no bloqueante automatizado conocido pendiente. Residuales no aceptados, revisión externa y checkpoint A2 no ejecutados. Archivos de este paso: package-lock.json, remediation-matrix.md y artefactos OpenSpec proposal/design/tasks/delta para estado y aclaración A2 automatizado/A3 aceptación final. Sin stage/commit/push/archive/merge.

Pendientes concretos para aceptación final A3 (no ejecutados/no pasados): Android físico con build instalado y navegación/back/recarga/IDs nanoid, guardar/reabrir títulos, SQLite/backup/import histórico y providers/gates; smoke Web manual Buscar/Biblioteca/detalle/back/recarga y persistencia en navegadores/plataformas de soporte pertinentes, incluidos motores no comprobados aquí. iOS/macOS/Xcode no acreditados. Antes del checkpoint A2: revisión externa REAL y aceptación explícita de los12 GHSA residuales en2.5. Ningún pendiente humano/físico se convierte en aprobación por completar checks automatizados A2.

Validación final de entrega: `openspec validate improve-dependency-security-and-review-workflow --strict` exit0; `git diff --check` exit0 (avisos informativos LF/CRLF), cinco documentos editados incluida matriz nueva sin whitespace final. Consistencia: tres secciones/quince tareas/nueve checked;2.5 y todas A3 unchecked. Comparación byte a byte de lock contra final-ci y manifest contra entrada: idénticos; git diff app/src/scripts/package.json vacío, sin staged. No se generó bundle real automáticamente; generar desde a793d459c841814291c1e3c0887c8bf7b77ecc10 con política Incorporated y ese ScriptsCheckpoint para revisión A2.


### G.15 — Revisión externa y decisión de riesgos residuales (2026-11-12)

La revisión externa A2.5 aprobó el diff real desde el
checkpoint A1: 37 nodos físicos actualizados, sin cambios
fuera del alcance autorizado.

Resultado audit: 21 entradas (0 críticas, 6 altas,
14 moderadas, 1 baja), correspondientes a 12 GHSA.

El usuario acepta TEMPORALMENTE los 12 GHSA identificados
en G.14.5 para permitir continuar a A3.

Esta aceptación:
- No declara corregidas las vulnerabilidades.
- No se extiende a vulnerabilidades nuevas o desconocidas.
- No autoriza overrides ni upgrades adicionales.
- No presupone que decode-uri-component sea inalcanzable.
- Mantiene diferidos los cambios de config-plugins/xcode.
- Requiere repetir el audit y revisar los residuales en A3.
- Mantiene obligatorias las pruebas manuales y Android físico.
- Exige resolver cualquier regresión o bloqueante material
  detectado antes del cierre técnico.

La revisión externa del diff A2 está aprobada.
Checkpoint Git manual a realizar por el usuario.
El hash del checkpoint se registrará durante A3.
