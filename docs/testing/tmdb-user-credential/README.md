# Section 1: credencial TMDB

Ejecutar:

```powershell
node docs\testing\tmdb-user-credential\section-1-verification.cjs
```

El harness usa stores, validator y fetch doubles; no importa los módulos nuevos desde el runtime de producción. Cubre normalización, errores, initialization/retry, mutations serializadas, ambas carreras delete/request, transporte con token explícito, override A/B, zero-fetch y no-leakage.

La comprobación de seguridad busca el token canario íntegro y los fingerprints, prefijos, sufijos y substrings que el propio harness extrae deliberadamente, además de Authorization, URL/query y body remoto. No pretende demostrar la ausencia matemática de coincidencias accidentales arbitrarias.

## Section 3: Ajustes y configuración

Ejecutar:

```powershell
node docs\testing\tmdb-user-credential\section-3-verification.cjs
```

El harness cubre conductualmente las presentaciones de snapshot, retry compartido, preservación de la credencial anterior, save/delete fallidos y errores amistosos. Como el proyecto no incluye un renderer React Native ejecutable desde Node, navegación, propiedades accesibles, secure input, confirmación por plataforma y copy condicional usan source inspection focalizada. Esas expresiones regulares no sustituyen la revisión visual/manual en web y dispositivos.
