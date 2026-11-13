# B3 — Kitsu: evaluación de elegibilidad

Fecha de consulta del proyecto: 2026-11-12 (America/Buenos_Aires). Plataforma investigada: **Kitsu**, tracker de anime/manga `https://kitsu.app`, proyecto `hummingbird-me`. No es kitsu.cloud.

## Evidencia oficial

| Fuente | Hecho observado y límite |
| --- | --- |
| [Repositorio oficial de documentación](https://github.com/hummingbird-me/api-docs) | La documentación está en conversión de API Blueprint a OpenAPI; remite a Apiary y ReDoc. No acredita por sí sola derechos de datos. |
| [Documentación oficial ReDoc](https://hummingbird-me.github.io/api-docs/) | Describe JSON:API, búsqueda textual de anime, detalle, sparse fieldsets, limit/offset, máximo ordinario de 20, y GET públicos mayormente sin autenticación. La documentación enlaza términos y muestra host histórico kitsu.io. No se usa OAuth, Algolia ni sus claves. |
| [Blueprint oficial histórico](https://raw.githubusercontent.com/hummingbird-me/api-docs/master/apiary.apib) | Confirma el contrato REST de anime y exclusión de contenido adulto para consultas no autenticadas. La documentación histórica no prueba el host vivo ni permiso de retención. |
| [Servidor oficial](https://github.com/hummingbird-me/kitsu-server) | Proyecto Rails API de Kitsu, licencia de software Apache-2.0, enlace kitsu.app. No se interpreta esa licencia como licencia de metadata o imágenes de catálogo. |
| [Términos kitsu.app](https://kitsu.app/terms) | 403 en el lector Web y en HTTP de escritorio; no se pudieron verificar cláusulas materiales. |
| [Términos históricos enlazados](https://kitsu.io/terms) | El lector Web recibió solo un shell que pide JavaScript. No se verificaron términos aplicables a clientes independientes, snapshots, retención ni backups. |

Se buscaron fuentes oficiales adicionales de límites y términos. Las rutas supuestas de código `config/initializers/rack_attack.rb`, `config/initializers/cors.rb`, plantilla `terms.hbs` y `api/index.yml` devolvieron 404; **no se afirma que esos archivos o políticas existan**. No se usaron condiciones de la plataforma kitsu.cloud ni conclusiones de terceros. No se contactó a mantenedores ni se solicitaron credenciales.

## Diagnóstico HTTP actual (escritorio)

Se ejecutaron cuatro GET públicos secuenciales con separación de 1 segundo y timeout de 15 segundos, sin credenciales, cookies personales ni imágenes. Para endpoints se solicitaron solo canonicalTitle/subtype/startDate mediante sparse fieldsets. Header diagnóstico: Accept `application/vnd.api+json`, Origin `http://localhost:8143`. Se registraron únicamente estado, URL final y headers seleccionados; no se guardaron snapshots de catálogo real en fixtures/backups.

| Solicitud | Resultado |
| --- | --- |
| `https://kitsu.io/api/edge/anime/1?fields[anime]=canonicalTitle,subtype,startDate` | Timeout 15 s. No se pudo establecer la cadena de redirects desde el host histórico. |
| `https://kitsu.app/api/edge/anime/1?fields[anime]=canonicalTitle,subtype,startDate` | 200, URL final igual a la pedida, Content-Type JSON:API, Access-Control-Allow-Origin `*`. X-RateLimit-Limit ausente. |
| `https://kitsu.app/api/edge/anime?filter[text]=cowboy bebop&page[limit]=1&fields[anime]=canonicalTitle,subtype,startDate` | 200, URL final igual a la pedida, JSON:API, CORS `*`; X-RateLimit-Limit ausente. Los brackets/texto se enviaron percent-encoded. |
| `https://kitsu.app/terms` | 403. |

El cliente preparado usa **kitsu.app/api/edge** como endpoint candidato, no sigue redirects y no usa proxy ni fallback hacia kitsu.io. Una futura activación deberá verificar de nuevo los endpoints, fields/categories y errores con los headers exactos del cliente. Los diagnósticos anteriores no prueban ejecución en Android, navegador, preflight, cuotas ni permiso de persistencia.

## Decisión M/T/A

- **M — metadata: PENDIENTE / activación bloqueada.** GET público y documentación para clientes son evidencia técnica. No hay evidencia suficiente verificada para el uso concreto de tracker independiente con snapshots locales, retención indefinida y export/import/backups. No se afirma prohibición ni autorización. Falta obtener términos oficiales accesibles o autorización suficiente y revisar sus límites, obligaciones de atribución y uso/retención/cache/backups. La aprobación del usuario no sustituye esos derechos.
- **T Android: PENDIENTE.** No se probó HTTP Kitsu en runtime nativo. Aceptación B2 en BlueStacks no se hereda a B3. Primero resolver M; después comprobar Android con el build exacto, errores, timeout/cancelación/redirects y aceptación registrada.
- **T Web: PENDIENTE.** Un GET de escritorio con Origin y ACAO `*` no equivale a navegador. Primero resolver M; después comprobar origen/headers reales, GET y preflight si corresponde, redirects/errores y aceptación en navegador.
- **A — arte: PENDIENTE / omit.** No se verificaron derechos de display/hotlink, redirects, cache del renderer, retención/exportación de URLs ni atribución de imágenes. No se solicitaron imágenes reales. No se implementa activación de arte.
- **Cuotas/restricciones: no establecidas.** No se identificó una cuota numérica oficial vigente; la ausencia del header no implica unlimited. Una solicitud en vuelo, 1 s entre inicios, timeout 15 s y cola acotada son límites propios de ingeniería, sujetos a revisión antes de activar. No hay retries automáticos. Retry-After válido no se acorta; ausente/inválido bloquea el cliente sin inventar una espera. Sin cache, TTL ni retención remota hasta M.

**Estado productivo:** ninguna plataforma Kitsu activada, incluida iOS. Sin toggle de entorno para habilitarlo. Categoría no visible en producción; búsqueda/detalle y ruta directa se rechazan antes de fetch/cache/lectura personal/guardado. Los saved snapshots sintéticos/importados conservan detalle local offline y procedencia Kitsu, sin consulta remota automática. El entorno TEST opt-in usa registros originales, transporte inyectado que nunca llama fetch y DBs separadas; no satisface M/T/A.

Se permite completar preparación aislada 3.1–3.4 según la autorización expresa del usuario. **3.5 permanece incompleta** por M/T. **3.6 permanece incompleta** por revisión externa/checkpoint y cierre de sección pendientes. No se declara catálogo activo ni B3 íntegramente cerrado; no se inicia B4.
