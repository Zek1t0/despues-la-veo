# Section 1: credencial TMDB

Ejecutar:

```powershell
node docs\testing\tmdb-user-credential\section-1-verification.cjs
```

El harness usa stores, validator y fetch doubles; no importa los módulos nuevos desde el runtime de producción. Cubre normalización, errores, initialization/retry, mutations serializadas, ambas carreras delete/request, transporte con token explícito, override A/B, zero-fetch y no-leakage.

La comprobación de seguridad busca el token canario íntegro y los fingerprints, prefijos, sufijos y substrings que el propio harness extrae deliberadamente, además de Authorization, URL/query y body remoto. No pretende demostrar la ausencia matemática de coincidencias accidentales arbitrarias.
