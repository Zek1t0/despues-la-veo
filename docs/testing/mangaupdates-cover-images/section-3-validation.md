# Sección 3: fallbacks y reciclado

Alcance terminado: 3.1 y 3.2; progreso 6/14. Se detiene antes de Sección 4. Requiere revisión externa del diff real y checkpoint manual antes de continuar. No se ejecutó Git mutable, archive ni sync.

## Archivos exactos

Modificados:
- app/(tabs)/buscar.tsx
- app/(tabs)/libreria.tsx
- app/mangaupdates/series/[id].tsx
- app/title/[id].tsx
- src/components/browsing/TitleGridCard.tsx
- src/components/browsing/TagCollage.tsx
- docs/testing/mangaupdates-cover-images/section-2-verification.cjs (solo extensión de cobertura; assertions anteriores conservadas)
- openspec/changes/enable-mangaupdates-cover-images/tasks.md (solo 3.1 y 3.2)

Creados:
- src/components/browsing/DetailPoster.tsx
- src/components/browsing/usePosterImageError.ts
- docs/testing/mangaupdates-cover-images/section-3-verification.cjs
- docs/testing/mangaupdates-cover-images/fixtures/developer-poster.svg
- docs/testing/mangaupdates-cover-images/section-3-validation.md

## Hallazgos y cambios

Buscar/Biblioteca Detalle carecían de onError: solo cubrían URL ausente. Ahora comparten la adaptación mínima del patrón de póster existente, con PosterPlaceholder, conservando 80x120/radio10 y 70x105/radio12. Detalle remoto carecía de onError para URL no nula; ahora vuelve al placeholder 96x144/radio12. No hay sondeos, descargas ni cascada de candidatos tras error.

Grid, LocalPoster y CollageCell ya cubrían errores. Sus resets por efecto podían aceptar callbacks anteriores después de cambiar URL; grid/local solo reseteaban por URL. Ahora todos usan un hook pequeño de estado visual. Cada transición identidad/URL tiene un token nuevo memoizado; el estado se ajusta durante render, antes de presentar la nueva imagen. El updater funcional de onError solo acepta el token vigente. Cubre A→B→A, errores tardíos y cambio de identidad con URL igual. No se usa un error global ni se cambia el dato persistido.

FlatList Buscar conserva key por referencia completa proveedor/namespace/externalId; Biblioteca conserva key por ID local. Cambiar modalidad conserva las keys de layout existentes. Se pasan esas identidades al póster y al grid. Collage ya remonta celdas por ID/URL; conserva esas keys y añade protección al cambiar props. LocalPoster recibe ID local; remoto usa ID de ruta y URL presentada. Se conservan controles, foco, navegación, estilos/crop cover, atribución y datos TMDB. Los pósteres decorativos no agregan etiquetas ni anuncios de error. PosterPlaceholder sigue siendo el existente y no se modificó.

## Pruebas y comandos

Cada comando de la lista siguiente terminó con exit 0. Sin fallos finales. Ejecutados desde D:/dev/despues-la-veo:

```text
node docs/testing/mangaupdates-cover-images/section-3-verification.cjs
node docs/testing/mangaupdates-cover-images/section-1-verification.cjs
node docs/testing/mangaupdates-cover-images/section-2-verification.cjs
node docs/testing/provider-abstraction/section-3-buscar-verification.cjs
node docs/testing/provider-abstraction/section-5-detail-verification.cjs
node docs/testing/expanded-media-domain/section-3-ui-verification.cjs
node docs/testing/expanded-media-domain/section-4-verification.cjs
node docs/testing/expanded-media-domain/section-5-ui-verification.cjs
node docs/testing/expanded-media-domain/section-8-ui-verification.cjs
node docs/testing/personal-title-rating/section-1-badge-verification.cjs
node docs/testing/global-appearance-themes/section-8-verification.cjs
node docs/testing/expanded-media-domain/section-6-verification.cjs
node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs
node docs/testing/global-appearance-themes/section-7-verification.cjs
node docs/testing/global-appearance-themes/section-5-verification.cjs
npx tsc --noEmit
git diff --check
```

Sección 3 usa módulos reales con hook-host determinista y Image stub. Simula ausencia, éxito como Image elegible con URI/crop correctos, onError HTTP/red/decode/offline, reset URL/identidad, callbacks anteriores y ABA; también comprueba dimensiones, foco, etiqueta única y activación grid. Collage ejercita su celda real y las keys de remount. Las filas comprueban integración por código y usan el componente probado. La cobertura previa ejecuta las pantallas Buscar/Biblioteca/local reales mediante stubs, las rutas y los contratos de puntuación/TMDB/review. El fallo de imagen no importa repositorios/SQLite en los componentes de póster; los callbacks solo actualizan estado visual.

La extensión de Sección 2 inyecta una URL propia .invalid directamente en el materializador solo en el proceso de test, dispara onError sobre el Image real del árbol remoto, comprueba placeholder y después guarda: se conserva URL en input y navegación. No modifica la composición productiva. La prueba previa de detalle local dispara onError sobre LocalPoster real. Las suites originales de Secciones 1 y 2 conservan assertions de políticas, host y gates Web/iOS sin red. La selección URL-policy permanece separada de la composición con URL propia; no se amplió allowlist.

El SVG es original geométrico del desarrollador, leído por el test; las URLs .invalid son identificadores de stub, no hosts autorizados ni endpoints reales. No se descargó ni renderizó arte MangaUpdates. Los stubs no decodifican SVG ni prueban un HTTP real: HTTP/red/decode se representan por eventos de error del renderer. No hay prueba física Android, iOS, renderizado nativo, inspección manual de navegador ni garantía de caché offline. No hay Playwright instalado en el proyecto; no se agregaron dependencias. Los checks visuales/runtime completos de Sección 5 siguen pendientes y no se marcan completos.

Fallos intermedios corregidos: primer script Python falló por codificación cp1252 al escribir un comentario Unicode (UnicodeEncodeError; el comando compuesto devolvió 0 porque después ejecutó tsc, que pasó sobre código aún sin aplicar). Se reejecutó con PYTHONUTF8=1. Primer TypeScript sobre la implementación devolvió 1: TS2769 por StyleProp<ViewStyle> demasiado amplio para Image. Se restringió a ViewStyle & ImageStyle y las ejecuciones posteriores de npx tsc --noEmit devolvieron 0 sin diagnósticos. Node imprimió únicamente avisos ExperimentalWarning de SQLite en suites existentes, sin fallos.

## Invariantes y límites

Producción MangaUpdates sigue omit explícito en búsqueda y ambas materializaciones del detalle; no cambian cliente API, disponibilidad, allowlist ni política. Web/iOS continúan sin llamadas API MangaUpdates nuevas según suites de gates. No se afirma ausencia de GET de URLs históricas importadas por lectores genéricos.

No hay cambios de SQLite v5/backup v6, repositorios, posterUrl persistido, dependencias, lockfiles, canonical specs, archivos archivados ni providers nuevos. El cambio personal previo en package.json quedó intacto; era la única modificación inicial en git status. Solo lecturas de Git; sin stage, commit o push.

Pendientes sin marcar: 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2. La revisión externa y checkpoint manual quedan a cargo del usuario; no se continúa automáticamente.
