# Pruebas con Postman — AdvWork-ERP (simulación de la API de Hacienda)

> **Alcance.** Estas pruebas ejercitan una **simulación académica**: no hay credenciales, certificados ni
> endpoints reales de Hacienda, todos los usuarios y claves son **ficticios**, y la firma del DTE es un JWS
> simulado (HMAC-SHA512) con una clave de prueba. Los resultados reales de cada caso están en
> [`evidencia-postman.md`](evidencia-postman.md), generado automáticamente a partir de una ejecución.

## 1. Qué contiene

| Archivo                                                    | Para qué sirve                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json` | Colección: 54 requests (40 casos de prueba y 14 pasos de preparación), 200 aserciones automáticas |
| `postman/AdvWork-ERP-local.postman_environment.json`       | Entorno con las variables (URL, credenciales y clave de firma **ficticias**)                      |
| `postman/helpers.js`                                       | Código compartido por los scripts (armar y firmar un DTE). Va embebido en la colección            |
| `postman/construir.mjs`                                    | **Genera** la colección y el entorno; los casos están definidos aquí como datos                   |
| `scripts/postman-evidencia.mjs`                            | Convierte el reporte de Newman en el documento de evidencia                                       |
| `docs/evidencia-postman.md`                                | Evidencia de la ejecución contra el servidor de desarrollo                                        |
| `docs/evidencia-postman-produccion.md`                     | Evidencia de la ejecución contra la compilación de producción                                     |

Si cambias un caso, edita `postman/construir.mjs` y ejecuta `node postman/construir.mjs`; no edites el JSON a mano.

## 2. Cómo usarla en Postman

1. **Importa** la colección y el entorno (_File → Import_) y **selecciona** el entorno `AdvWork-ERP local`.
2. **Arranca el proyecto** (`bun dev`). La URL por defecto es `http://127.0.0.1:8080`; si tu puerto es otro, cambia `base_url`.
3. Ejecuta la colección completa con el **Runner** (_Run collection_), en el orden en que está. Dura unos 30 s
   porque tres casos esperan el umbral oficial de 5 s por intento (≈6 s, ≈5 s y ≈15 s).
4. Resultado esperado: **200 aserciones, 0 fallidas**.

**Token automático.** Antes de cada request, un script de colección se autentica si no hay un token vigente; por
eso cualquier request puede ejecutarse por separado.

**Dependencias entre casos.** Para poder reenviar o consultar, algunos casos reutilizan datos guardados por otro:

| Caso                  | Necesita haber ejecutado antes |
| --------------------- | ------------------------------ |
| 1.2, 1.3, 1.13c       | 1.1                            |
| 3.2, 3.10, 3.12, 3.13 | 3.1                            |
| 3.4                   | 3.3                            |
| 3.7d                  | 3.7b                           |
| 3.8d                  | 3.8b                           |
| 3.9d                  | 3.9b                           |

Los demás son independientes. Cada grupo de escenarios (indisponible, error interno, timeout…) **restablece** la
simulación a `normal` al terminar; `4.1` lo garantiza al final.

**Si cambias las credenciales** en tu `.env` (variables `HACIENDA_SIM_*` / `ERP_DTE_*`), cambia también
`hacienda_user`, `hacienda_pwd` y `firma_secret` del entorno de Postman: deben coincidir.

## 3. Casos mínimos de la consigna

| Caso                         | Resultado esperado                      | Requests de la colección                                                                                                              |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DTE válido                   | Aceptación simulada                     | **1.1** (API) y **3.1** (a través del ERP)                                                                                            |
| DTE sin campos obligatorios  | Rechazo simulado                        | **1.4**                                                                                                                               |
| DTE con datos inconsistentes | Rechazo simulado                        | **1.5** (y **1.6**: diferencia pequeña, aceptado con observaciones)                                                                   |
| Solicitud mal estructurada   | Error de validación                     | **1.7**, **1.8**, **1.9** (API) y **3.5**, **3.6** (ERP)                                                                              |
| Servicio indisponible        | Error de comunicación                   | **1.13b**, **1.13c** (503 en la API) y **3.7b** (502 y _Pendiente de envío_ en el ERP)                                                |
| Reenvío de un documento      | Comportamiento controlado y documentado | **1.2** (rechazo 004 por duplicado), **3.2** (no se reenvía), **3.4** (corrección tras rechazo) y **3.7d** (reintento tras una falla) |

**Comportamiento del reenvío (documentado).** (a) En la API, reenviar un documento ya aceptado devuelve `004 YA
EXISTE UN REGISTRO CON ESE VALOR` y no genera un segundo sello. (b) En el ERP, una factura ya emitida **no se
vuelve a enviar** (`yaEmitida: true`, 0 envíos). (c) Una factura rechazada puede corregirse y reenviarse conservando
su `codigoGeneracion`. (d) Una factura pendiente por una falla se emite al reintentar, también con el mismo
`codigoGeneracion`. Estas reglas son **académicas**; la guía oficial no especifica el reenvío de forma
detallada.

## 4. Los 40 casos de prueba

Generada leyendo la colección. El HTTP indicado es el esperado; cada caso trae además aserciones sobre el cuerpo.

| Caso  | Descripción                                                                 | Método | HTTP esperado |
| ----- | --------------------------------------------------------------------------- | ------ | ------------- |
| 0.1   | Autenticación correcta (obtener token)                                      | POST   | 200           |
| 1.1   | DTE válido → aceptación                                                     | POST   | 200           |
| 1.2   | Reenvío del mismo documento → rechazo por duplicado                         | POST   | 400           |
| 1.3   | Consulta del documento aceptado → mismo sello                               | POST   | 200           |
| 1.4   | DTE sin campos obligatorios → rechazo                                       | POST   | 400           |
| 1.5   | DTE con datos inconsistentes → rechazo                                      | POST   | 400           |
| 1.6   | Diferencia de cálculo pequeña → aceptado con observaciones                  | POST   | 200           |
| 1.7   | Solicitud mal estructurada (JSON mal formado) → error de validación         | POST   | 400           |
| 1.8   | Solicitud mal estructurada (falta `documento`) → error de validación        | POST   | 400           |
| 1.9   | Cuerpo vacío → error de validación                                          | POST   | 400           |
| 1.10  | Firma inválida → rechazo                                                    | POST   | 400           |
| 1.11  | Ambiente de producción ("01") → rechazado                                   | POST   | 400           |
| 1.12  | Importe con centavos ($1,234.56) → aceptado                                 | POST   | 200           |
| 1.13b | Servicio indisponible: enviar DTE → error de comunicación (503)             | POST   | 503           |
| 1.13c | Servicio indisponible: consultar estado → 503                               | POST   | 503           |
| 1.14b | Error interno simulado → 500 con código 099                                 | POST   | 500           |
| 1.15b | Sin respuesta a tiempo → 504 tras ≈6 s                                      | POST   | 504           |
| 2.1   | Recepción sin token → 401                                                   | POST   | 401           |
| 2.2   | Token inválido → 401                                                        | POST   | 401           |
| 2.3   | Token con algoritmo "none" → 401                                            | POST   | 401           |
| 2.4   | Cambiar el escenario sin token → 401                                        | PUT    | 401           |
| 3.1   | Emitir una factura válida → Emitida                                         | POST   | 200           |
| 3.2   | Reenviar la misma factura (ya emitida) → no se vuelve a enviar              | POST   | 200           |
| 3.3   | Cliente con documento inválido → Rechazada                                  | POST   | 422           |
| 3.4   | Corregir el dato y reenviar → Emitida con el mismo código de generación     | POST   | 200           |
| 3.5   | Solicitud inválida (factura sin ítems) → 400                                | POST   | 400           |
| 3.6   | Solicitud mal estructurada (JSON mal formado) → 400                         | POST   | 400           |
| 3.7b  | Servicio indisponible: emitir → Pendiente de envío (3 envíos y 3 consultas) | POST   | 502           |
| 3.7d  | Restablecido el servicio, reintentar la misma factura → Emitida             | POST   | 200           |
| 3.8b  | Hacienda recibió pero respondió tarde → se recupera por consulta (≈5 s)     | POST   | 200           |
| 3.8d  | Volver a emitir esa factura no genera un duplicado                          | POST   | 200           |
| 3.9b  | Sin respuesta: emitir → Pendiente tras ≈15 s (3 envíos de 5 s)              | POST   | 504           |
| 3.9d  | Consultar estado: Hacienda no tiene ese documento                           | POST   | 200           |
| 3.10  | Consultar estado de una factura emitida                                     | POST   | 200           |
| 3.11  | Consultar una factura desconocida → 404                                     | POST   | 404           |
| 3.12  | Historial de envíos de una factura                                          | GET    | 200           |
| 3.13  | Detalle de una transmisión (DTE enviado e intentos)                         | GET    | 200           |
| 3.14  | Detalle de una transmisión inexistente → 404                                | GET    | 404           |
| 3.15  | Petición desde otro sitio (CSRF) → 403                                      | POST   | 403           |
| 3.16  | Cuerpo que no es JSON (text/plain) → 415                                    | POST   | 415           |

Los pasos de preparación (`0.2`, `1.13a`, `1.13d`, `1.14a`, `1.14c`, `1.15a`, `1.15c`, `3.7a`, `3.7c`, `3.8a`,
`3.8c`, `3.9a`, `3.9c`, `4.1`) cambian el escenario de la simulación y verifican que el cambio se aplicó.

## 5. Probar desde la propia aplicación

La carpeta **3** de la colección ejercita los mismos endpoints que usa la pantalla de facturación. Para
**verlo en la aplicación** (y tomar las capturas del informe):

1. Menú **Portal del cliente**. Arriba, el selector _Sesión: …_ elige el cliente. Agrega productos con los botones
   _Agregar …_ y pulsa **Confirmar pedido y pagar**. Esto crea una venta directa ya confirmada.
2. Menú **Pedidos**. En la fila de ese pedido, pulsa **Generar DTE**. Se crea la factura en estado _Borrador_.
3. Menú **Documentos DTE**. En la fila de la factura, pulsa **Enviar** y luego **Ver** para el detalle.

> **No recargues la página (F5) entre pasos.** Los datos del prototipo viven en la memoria del navegador y se
> reinician al recargar; el menú lateral navega sin recargar.

| Para demostrar…           | Cómo prepararlo                                                 | Qué se ve en _Documentos DTE_                                                                                                  |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Aceptación**            | Cliente normal; escenario `normal`                              | _Enviar_ → **Emitida**, con sello, código de generación y número de control                                                    |
| **Rechazo**               | En el Portal, sesión **Cliente de prueba (documento inválido)** | **Rechazada**, código `003` con `[receptor.numDocumento]`                                                                      |
| **Servicio indisponible** | En Postman ejecuta **1.13a** (escenario `indisponible`)         | **Pendiente de envío** con _3 envíos, 3 consultas_. Ejecuta **0.2** y pulsa **Reenviar** → **Emitida**                         |
| **Respuesta tardía**      | Ejecuta **3.8a** (`timeout_procesado`)                          | Unos 5 s en _Enviando…_ y luego **Emitida** con _recuperado por consulta de estado_                                            |
| **Sin respuesta**         | Ejecuta **3.9a** (`timeout`)                                    | Unos 15 s y luego **Pendiente de envío**. Ejecuta **0.2** y _Consultar estado_ → «Hacienda no tiene registrado este documento» |
| **Reenvío**               | Con una factura ya **Emitida**                                  | El botón de reenviar queda bloqueado; _Consultar estado_ confirma el sello                                                     |

Después de cada demostración con escenarios, ejecuta **0.2** (escenario `normal`).

Las pruebas automatizadas de interfaz (`scripts/erp-ui-test.tsx`, 11 casos) cubren estos mismos flujos con la
pantalla real contra el servidor real; ver `docs/seguridad-y-comunicacion.md`, sección 6.

## 6. Capturas sugeridas para el informe

Las capturas **tienes que tomarlas tú** (yo no puedo operar tu pantalla). Se propone esta lista mínima:

| #   | Captura                                                      | Qué demuestra                          |
| --- | ------------------------------------------------------------ | -------------------------------------- |
| 1   | Resumen del _Runner_ de Postman (200 aserciones, 0 fallidas) | Visión global                          |
| 2   | Request **1.1** (cuerpo enviado y respuesta 200 con sello)   | DTE válido aceptado                    |
| 3   | Request **1.4** (respuesta 400 con `005` y `[emisor.nit]`)   | Rechazo por campo faltante             |
| 4   | Request **1.5** (respuesta 400 con `020`)                    | Rechazo por datos inconsistentes       |
| 5   | Request **1.7** o **1.8** (respuesta 400 con `098` / `096`)  | Solicitud mal estructurada             |
| 6   | Request **1.13b** (respuesta 503)                            | Servicio indisponible                  |
| 7   | Request **1.2** (respuesta 400 con `004`)                    | Reenvío controlado                     |
| 8   | Request **3.8b** (≈5 s, `recuperadoPorConsulta: true`)       | Política de reintentos                 |
| 9   | _Documentos DTE_: factura **Emitida** con el detalle abierto | Resultado en la aplicación             |
| 10  | _Documentos DTE_: factura **Rechazada** con su código        | Rechazo en la aplicación               |
| 11  | _Documentos DTE_: **Pendiente de envío** y su historial      | Error de comunicación en la aplicación |

## 7. Regenerar la evidencia y ejecutar con Newman

```bash
npx newman run postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json \
  -e postman/AdvWork-ERP-local.postman_environment.json \
  --reporters cli,json --reporter-json-export reporte.json --timeout-request 60000
node scripts/postman-evidencia.mjs reporte.json docs/evidencia-postman.md
```

Contra la compilación de producción hay que pasar sus credenciales (las que definiste en su `.env`), por ejemplo:

```bash
npx newman run postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json \
  -e postman/AdvWork-ERP-local.postman_environment.json \
  --env-var base_url=http://127.0.0.1:3001 --env-var hacienda_user=... \
  --env-var hacienda_pwd=... --env-var firma_secret=...
```

El generador termina con código distinto de cero si algún caso falla, así que sirve también en una automatización.

## 8. Resultados de la última ejecución documentada

| Servidor                                                       | Requests | Aserciones | Fallidas | Casos exitosos |
| -------------------------------------------------------------- | -------- | ---------- | -------- | -------------- |
| Desarrollo (`http://127.0.0.1:8080`)                           | 54       | 200        | 0        | 40 de 40       |
| Producción local (`http://127.0.0.1:3001`, secretos distintos) | 54       | 200        | 0        | 40 de 40       |

Además, la colección se ejecutó **dos veces seguidas** contra desarrollo con el mismo resultado (es repetible: los
identificadores se generan únicos en cada corrida).

**Control negativo.** Con la clave de firma del entorno alterada a propósito, Newman terminó con código 1 y
27 aserciones fallidas en 7 casos (1.1–1.6 y 1.12, los que dependen de un DTE bien firmado), mientras seguían
pasando los que no dependen de la firma. Es decir, las aserciones sí detectan una falla real.

## 9. Lo que NO está verificado

- **Postman de escritorio:** todo se ejecutó con **Newman** (el ejecutor de Postman en línea de comandos), no abrí
  la colección en la aplicación de escritorio. Los scripts usan `eval`, `CryptoJS` y `pm.sendRequest`, que Postman
  admite, pero no lo comprobé allí. El caso **3.15** además necesita que Postman permita fijar el encabezado `Origin`.
- **Hora de las pruebas:** el sandbox de Postman/Newman no dispone de `Intl`, así que la fecha del DTE se calcula con
  UTC−6 fijo (El Salvador no usa horario de verano).
- **Lo que Postman no puede probar:** el encabezado `Host` falsificado (DNS rebinding) y otros ataques de red se
  cubren con `scripts/erp-security-test.mjs`, no con esta colección.
- **Los tiempos** de los casos 1.15b, 3.8b y 3.9b se comprueban con **cotas inferiores** (el servidor tarda _al menos_
  eso), por lo que no fallan si el equipo está lento.
- **Docker, Cloudflare y `bun`:** no se probaron aquí.
- Las capturas de pantalla no las genero yo: ver la sección 6.
