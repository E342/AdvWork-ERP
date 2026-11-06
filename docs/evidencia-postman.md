# Evidencia de las pruebas con Postman

> **Documento generado automáticamente** por `scripts/postman-evidencia.mjs` a partir del reporte de una
> ejecución real de la colección con Newman. Las respuestas y los resultados **no se escriben a mano**: salen
> del reporte. Un caso figura como exitoso solo si **todas** sus aserciones pasaron.
> Todo corresponde a una **simulación académica**; no se usó ningún servicio, credencial ni certificado reales.

| Dato | Valor |
|---|---|
| Fecha de ejecución | 6 de noviembre de 2026 a las 12:00:28 p. m. (hora de El Salvador) |
| Herramienta | Newman 6.2.3 (ejecutor de línea de comandos de Postman) |
| Servidor probado | `http://127.0.0.1:8080` |
| Duración total | 28 s |
| Requests ejecutados | 54 (40 casos de prueba y 14 pasos de preparación) |
| Aserciones | 200 ejecutadas, **0 fallidas** |
| Casos exitosos | **40 de 40** |

## Casos mínimos de la consigna

| Caso | Resultado esperado | Requests que lo prueban | Resultado |
|---|---|---|---|
| DTE válido | Aceptación simulada | 1.1 ✅, 3.1 ✅ | ✅ Exitoso |
| DTE sin campos obligatorios | Rechazo simulado | 1.4 ✅ | ✅ Exitoso |
| DTE con datos inconsistentes | Rechazo simulado | 1.5 ✅, 1.6 ✅ | ✅ Exitoso |
| Solicitud mal estructurada | Error de validación | 1.7 ✅, 1.8 ✅, 1.9 ✅, 3.5 ✅, 3.6 ✅ | ✅ Exitoso |
| Servicio indisponible | Error de comunicación | 1.13b ✅, 1.13c ✅, 3.7b ✅ | ✅ Exitoso |
| Reenvío de un documento | Comportamiento controlado y documentado | 1.2 ✅, 3.2 ✅, 3.4 ✅, 3.7d ✅ | ✅ Exitoso |

## Resumen por carpeta

| Carpeta | Casos | Exitosos | Aserciones | Fallidas |
|---|---|---|---|---|
| 0. Preparación | 1 | 1 | 5 | 0 |
| 1. API simulada de Hacienda — casos mínimos | 16 | 16 | 80 | 0 |
| 2. Control de acceso (API simulada) | 4 | 4 | 7 | 0 |
| 3. Backend del ERP (navegador → ERP → Hacienda) | 19 | 19 | 106 | 0 |
| 4. Cierre | 0 | 0 | 2 | 0 |

## Detalle de cada caso

### 0. Preparación

#### 0.1 — Autenticación correcta (obtener token)

- **Objetivo:** Verificar que la API simulada autentica con usuario y contraseña de prueba y entrega un token JWT.
- **Datos de entrada:** POST form-urlencoded con `user` y `pwd` (variables del entorno; credenciales FICTICIAS).
- **Endpoint:** `/api/hacienda-sim/auth`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200 con `status: OK` y `body.token` = `Bearer <jwt>`.
- **Criterio de éxito:** Código 200, `status` igual a `OK`, el token empieza con `Bearer ` y se guarda para las demás peticiones.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 200 OK · 29 ms

```json
{
  "status": "OK",
  "body": {
    "user": "SIM-FACTURADOR-01",
    "token": "Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJTSU0tRkFDVFVSQURPUi0wMSIsImF1dGhvcml0aWVzIjoiVXN1YXJpbyIsImlhdCI6MTc5Mzk4ODAyOCwiZXhwIjoxNzk0MDMxMjI4fQ.CGsjTAM34LgSjHzJ-g-Z6p53y9O3KkZ3iUratUWB0gjPTpW6B8MNTylSL80GkLewWizIwUitsgDmyBGn0zTR6Q",
    "rol": {
      "nombre": "Usuario",
      "codigo": "ROLE_USER",
      "descripcion": null,
      "rolSuperior": null,
      "nivel": null,
      "activo": null,
      "permisos": null
    },
    "roles": [
      "ROLE_USER"
    ],
    "tokenType": "Bearer"
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ status = OK
- ✔ token con formato Bearer <jwt>

**Resultado: ✅ EXITOSA**

### 1. API simulada de Hacienda — casos mínimos

#### 1.1 — DTE válido → aceptación

- **Objetivo:** Demostrar que un DTE de Factura válido y firmado es recibido, sellado y aceptado.
- **Datos de entrada:** POST con una petición cuyo `documento` es el DTE (esquema oficial fe-f-v2, total $226.00, ambiente `00`) firmado con JWS simulado. `codigoGeneracion` UUID v4 nuevo.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `estado: PROCESADO`, `codigoMsg: 001` (RECIBIDO), `selloRecibido` de 40 caracteres y fecha de procesamiento.
- **Criterio de éxito:** Código 200; `estado`, `codigoMsg` y `clasificaMsg` (10) como se indica; sello alfanumérico de 40 caracteres; fecha `dd/MM/yyyy HH:mm:ss`; cabecera `X-AdvWork-Simulacion: true`.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "636F06DB-E59B-4FB6-A209-F7761E092166",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028511",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699",
  "selloRecibido": "OWZVEHHL1U2B9A6APWFYMPI3S6HU241WXF378LCG",
  "fhProcesamiento": "06/11/2026 12:00:28",
  "clasificaMsg": "10",
  "codigoMsg": "001",
  "descripcionMsg": "RECIBIDO",
  "observaciones": []
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ estado = PROCESADO
- ✔ codigoMsg = 001
- ✔ clasificaMsg = 10
- ✔ selloRecibido: 40 caracteres alfanuméricos
- ✔ fhProcesamiento con formato dd/MM/yyyy HH:mm:ss
- ✔ la respuesta se identifica como simulada

**Resultado: ✅ EXITOSA**

#### 1.2 — Reenvío del mismo documento → rechazo por duplicado

- **Objetivo:** Documentar el comportamiento controlado ante un REENVÍO: el mismo documento ya aceptado no se vuelve a registrar.
- **Datos de entrada:** La misma petición exacta del caso 1.1 (mismo `codigoGeneracion`).
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 004` (YA EXISTE UN REGISTRO CON ESE VALOR), `clasificaMsg: 11`.
- **Criterio de éxito:** Código 400 y código de mensaje 004; no se genera un segundo sello (ver 1.3, donde el sello original sigue siendo el mismo).

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "636F06DB-E59B-4FB6-A209-F7761E092166",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028511",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "11",
  "codigoMsg": "004",
  "descripcionMsg": "[identificacion.codigoGeneracion] YA EXISTE UN REGISTRO CON ESE VALOR",
  "observaciones": [
    "[identificacion.codigoGeneracion] YA EXISTE UN REGISTRO CON ESE VALOR"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 004
- ✔ clasificaMsg = 11
- ✔ el mensaje menciona "YA EXISTE UN REGISTRO CON ESE VALOR"

**Resultado: ✅ EXITOSA**

#### 1.3 — Consulta del documento aceptado → mismo sello

- **Objetivo:** Comprobar que la consulta de estado devuelve el documento aceptado, con el sello original (no uno nuevo).
- **Datos de entrada:** POST con `nitEmisor`, `tdte: 01` y el `codigoGeneracion` del caso 1.1.
- **Endpoint:** `/api/hacienda-sim/fesv/recepcion/consultadte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `estado: PROCESADO`, `codigoMsg: 001` y el MISMO `selloRecibido` del caso 1.1.
- **Criterio de éxito:** Código 200 y `selloRecibido` idéntico al guardado en 1.1.

Cuerpo enviado (resumen):

```json
{
  "nitEmisor": "06140000000001",
  "tdte": "01",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699"
}
```

**Respuesta obtenida:** HTTP 200 OK · 105 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699",
  "selloRecibido": "OWZVEHHL1U2B9A6APWFYMPI3S6HU241WXF378LCG",
  "fhProcesamiento": "06/11/2026 12:00:28",
  "clasificaMsg": "10",
  "codigoMsg": "001",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "observaciones": []
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ estado = PROCESADO
- ✔ codigoMsg = 001
- ✔ el sello coincide con el del caso 1.1

**Resultado: ✅ EXITOSA**

#### 1.4 — DTE sin campos obligatorios → rechazo

- **Objetivo:** Demostrar el rechazo de un DTE al que le falta un campo obligatorio del esquema oficial.
- **Datos de entrada:** DTE válido al que se le elimina `emisor.nit`, firmado y enviado.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 005` (DEBE PROPORCIONAR UN VALOR), `clasificaMsg: 12` (datos del emisor), mensaje con `[emisor.nit]`.
- **Criterio de éxito:** Código 400, código 005, clasificación 12 y el campo faltante nombrado en el mensaje.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "B806FD7F-0ADC-4301-B0EC-E242629AAB24",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A8A5E0FF-C5FB-46C5-BEE0-AB061AAA508F",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028512",
    "ambiente": "00",
    "emisor.nit": "(AUSENTE)",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "A8A5E0FF-C5FB-46C5-BEE0-AB061AAA508F",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "12",
  "codigoMsg": "005",
  "descripcionMsg": "[emisor.nit] DEBE PROPORCIONAR UN VALOR",
  "observaciones": [
    "[emisor.nit] DEBE PROPORCIONAR UN VALOR"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 005
- ✔ clasificaMsg = 12
- ✔ el mensaje menciona "[emisor.nit]"

**Resultado: ✅ EXITOSA**

#### 1.5 — DTE con datos inconsistentes → rechazo

- **Objetivo:** Demostrar el rechazo de un DTE cuyos totales no cuadran con sus ítems.
- **Datos de entrada:** DTE válido con `resumen.totalPagar` alterado a 276.00 (los ítems suman 226.00), firmado y enviado.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 020` (CALCULO INCORRECTO), `clasificaMsg: 16` (resumen).
- **Criterio de éxito:** Código 400, código 020, clasificación 16 y el campo `resumen.totalPagar` nombrado en el mensaje.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "D3DF1E81-CBFE-4170-93DD-5A48A2745762",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "14B3BB9F-DD91-40C0-91A0-25861D955DBE",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028513",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 276
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "14B3BB9F-DD91-40C0-91A0-25861D955DBE",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "16",
  "codigoMsg": "020",
  "descripcionMsg": "[resumen.totalPagar] CALCULO INCORRECTO",
  "observaciones": [
    "[resumen.totalPagar] CALCULO INCORRECTO"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 020
- ✔ clasificaMsg = 16
- ✔ el mensaje menciona "totalPagar"

**Resultado: ✅ EXITOSA**

#### 1.6 — Diferencia de cálculo pequeña → aceptado con observaciones

- **Objetivo:** Mostrar que una diferencia de cálculo menor no rechaza el documento: se acepta con observaciones (como en el ejemplo oficial).
- **Datos de entrada:** DTE válido con `resumen.totalIva` = 26.06 en lugar de 26.00.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `estado: PROCESADO`, `codigoMsg: 002` (RECIBIDO CON OBSERVACIONES) y una observación sobre `resumen.totalIva`.
- **Criterio de éxito:** Código 200, código 002 y la observación presente en `observaciones`.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "7AE8AEAB-0F02-4443-A153-9227D9DC0A7C",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "4A1592C3-C8A0-4D1A-8A44-9F5D8AC15BB7",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028514",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26.06,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 10 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "4A1592C3-C8A0-4D1A-8A44-9F5D8AC15BB7",
  "selloRecibido": "LJB064UQKIK2BQ3YX38PG566LIXM2VQUK1GPT49B",
  "fhProcesamiento": "06/11/2026 12:00:28",
  "clasificaMsg": "10",
  "codigoMsg": "002",
  "descripcionMsg": "RECIBIDO CON OBSERVACIONES",
  "observaciones": [
    "[resumen.totalIva] CALCULO INCORRECTO"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ estado = PROCESADO
- ✔ codigoMsg = 002
- ✔ clasificaMsg = 10
- ✔ observaciones menciona resumen.totalIva

**Resultado: ✅ EXITOSA**

#### 1.7 — Solicitud mal estructurada (JSON mal formado) → error de validación

- **Objetivo:** Demostrar el error de validación ante un cuerpo que no es JSON válido.
- **Datos de entrada:** Cuerpo `{esto no es json`, con token válido.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 098` (DATOS NO CUMPLEN ESTANDAR JSON), `clasificaMsg: 98`.
- **Criterio de éxito:** Código 400 y código de mensaje 098.

Cuerpo enviado (resumen):

```json
"{esto no es json"
```

**Respuesta obtenida:** HTTP 400 Bad Request · 6 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": null,
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "98",
  "codigoMsg": "098",
  "descripcionMsg": "DATOS NO CUMPLEN ESTANDAR JSON",
  "observaciones": []
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 098
- ✔ clasificaMsg = 98

**Resultado: ✅ EXITOSA**

#### 1.8 — Solicitud mal estructurada (falta `documento`) → error de validación

- **Objetivo:** Demostrar el error de validación cuando la petición no trae el campo obligatorio `documento`.
- **Datos de entrada:** Petición con `ambiente`, `idEnvio`, `version`, `tipoDte` y `codigoGeneracion`, pero SIN `documento`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 096` (DOCUMENTO NO CUMPLE ESQUEMA JSON), `clasificaMsg: 98`; el detalle nombra `documento`.
- **Criterio de éxito:** Código 400, código 096 y `documento` mencionado en las observaciones.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "B532BDBC-71A0-4A85-BE84-4B1F67711471",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "E24352CA-FFC9-4A20-80A2-A18C18CBD181"
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "E24352CA-FFC9-4A20-80A2-A18C18CBD181",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "98",
  "codigoMsg": "096",
  "descripcionMsg": "DOCUMENTO NO CUMPLE ESQUEMA JSON",
  "observaciones": [
    "peticion must have required property 'documento'"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 096
- ✔ clasificaMsg = 98
- ✔ el mensaje menciona "documento"

**Resultado: ✅ EXITOSA**

#### 1.9 — Cuerpo vacío → error de validación

- **Objetivo:** Demostrar el error ante una solicitud sin datos para validar.
- **Datos de entrada:** Cuerpo vacío, con token válido.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 097` (NO SE HA PROPORCIONADO DATOS PARA VALIDAR).
- **Criterio de éxito:** Código 400 y código de mensaje 097.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 400 Bad Request · 5 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": null,
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "98",
  "codigoMsg": "097",
  "descripcionMsg": "NO SE HA PROPORCIONADO DATOS PARA VALIDAR",
  "observaciones": []
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 097
- ✔ clasificaMsg = 98

**Resultado: ✅ EXITOSA**

#### 1.10 — Firma inválida → rechazo

- **Objetivo:** Demostrar que un documento firmado con otra clave (firma que no se puede verificar) es rechazado.
- **Datos de entrada:** DTE válido firmado con una clave distinta a la configurada.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 003` (VALOR NO VALIDO), `clasificaMsg: 20` (firma electrónica), mensaje con `[firma]`.
- **Criterio de éxito:** Código 400, código 003, clasificación 20 y `[firma]` en el mensaje.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "D26B3505-EE49-4047-9701-D19F11860BB9",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "0097C949-B53D-4032-8C48-794B20AD47DF",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028516",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 5 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "0097C949-B53D-4032-8C48-794B20AD47DF",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "20",
  "codigoMsg": "003",
  "descripcionMsg": "[firma] VALOR NO VALIDO",
  "observaciones": [
    "[firma] VALOR NO VALIDO"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 003
- ✔ clasificaMsg = 20
- ✔ el mensaje menciona "[firma]"

**Resultado: ✅ EXITOSA**

#### 1.11 — Ambiente de producción ("01") → rechazado

- **Objetivo:** Comprobar que la simulación NUNCA acepta el ambiente de producción, para que no pueda confundirse con el servicio real.
- **Datos de entrada:** Petición con `ambiente: 01`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `estado: RECHAZADO`, `codigoMsg: 007` (VALOR NO ES PERMITIDO), `clasificaMsg: 19`.
- **Criterio de éxito:** Código 400 y código de mensaje 007 mencionando `[ambiente]`.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "01",
  "idEnvio": "CBB3CE93-4EDE-4877-887E-CC8BDD724F58",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "4784C969-6625-43BE-81EC-587DC8BE454C",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028517",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 6 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "4784C969-6625-43BE-81EC-587DC8BE454C",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "19",
  "codigoMsg": "007",
  "descripcionMsg": "[ambiente] VALOR NO ES PERMITIDO",
  "observaciones": [
    "[ambiente] VALOR NO ES PERMITIDO"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 007
- ✔ clasificaMsg = 19
- ✔ el mensaje menciona "[ambiente]"

**Resultado: ✅ EXITOSA**

#### 1.12 — Importe con centavos ($1,234.56) → aceptado

- **Objetivo:** Regresión: un importe con centavos (que el validador rechazó por error en una versión anterior) debe aceptarse.
- **Datos de entrada:** DTE de una sola línea por $1,234.56 con totales coherentes (IVA 13 % incluido).
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `estado: PROCESADO`, `codigoMsg: 001`.
- **Criterio de éxito:** Código 200 y código 001.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "7386E754-E93D-40B1-832A-546BC8927D1B",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "81A2B4F7-2710-49B7-AA13-103B0166F135",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028518",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 1,
    "resumen.totalGravada": 1234.56,
    "resumen.totalIva": 142.03,
    "resumen.totalPagar": 1234.56
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 7 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "81A2B4F7-2710-49B7-AA13-103B0166F135",
  "selloRecibido": "5JZEE5M2EROMLY4WOVB1DT6THGU2MPG6GQXTZ7DI",
  "fhProcesamiento": "06/11/2026 12:00:29",
  "clasificaMsg": "10",
  "codigoMsg": "001",
  "descripcionMsg": "RECIBIDO",
  "observaciones": []
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ estado = PROCESADO
- ✔ codigoMsg = 001
- ✔ clasificaMsg = 10

**Resultado: ✅ EXITOSA**

#### 1.13b — Servicio indisponible: enviar DTE → error de comunicación (503)

- **Objetivo:** Demostrar el error de comunicación cuando el servicio no está disponible (recepción).
- **Datos de entrada:** DTE válido enviado con la simulación en modo `indisponible`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 503 con `status: ERROR` y `error: Service Unavailable`; el documento NO se procesa.
- **Criterio de éxito:** Código 503 y cuerpo con `error` = `Service Unavailable`.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "80CF2481-592C-4266-AC68-2851FAF87FB2",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "BC4A6475-C8B0-4675-9BF0-FF71B3A0CA28",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028519",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 503 Service Unavailable · 4 ms

```json
{
  "status": "ERROR",
  "error": "Service Unavailable",
  "message": "Servicio simulado no disponible (escenario de prueba)."
}
```

Aserciones automáticas:

- ✔ HTTP 503
- ✔ error = Service Unavailable
- ✔ status = ERROR

**Resultado: ✅ EXITOSA**

#### 1.13c — Servicio indisponible: consultar estado → 503

- **Objetivo:** Demostrar que la consulta de estado también falla con 503 mientras el servicio está caído.
- **Datos de entrada:** Consulta del `codigoGeneracion` del caso 1.1 con la simulación en modo `indisponible`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepcion/consultadte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 503.
- **Criterio de éxito:** Código 503.

Cuerpo enviado (resumen):

```json
{
  "nitEmisor": "06140000000001",
  "tdte": "01",
  "codigoGeneracion": "5C41FD3A-2D0A-4E61-A063-46A8403B6699"
}
```

**Respuesta obtenida:** HTTP 503 Service Unavailable · 4 ms

```json
{
  "status": "ERROR",
  "error": "Service Unavailable",
  "message": "Servicio simulado no disponible (escenario de prueba)."
}
```

Aserciones automáticas:

- ✔ HTTP 503

**Resultado: ✅ EXITOSA**

#### 1.14b — Error interno simulado → 500 con código 099

- **Objetivo:** Demostrar la respuesta ante un error interno del servicio.
- **Datos de entrada:** DTE válido enviado con la simulación en modo `error_interno`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 500, `codigoMsg: 099` (ERROR NO CATALOGADO), `clasificaMsg: 99`; el documento NO se procesa.
- **Criterio de éxito:** Código 500, código 099 y clasificación 99.

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "7BB3A5E0-93CE-48C7-ABF2-B7F0890097C1",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A971ABA9-B00C-4D66-BE4D-CDF6D7FED1C9",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028520",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 500 Internal Server Error · 6 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": null,
  "selloRecibido": null,
  "fhProcesamiento": null,
  "clasificaMsg": "99",
  "codigoMsg": "099",
  "descripcionMsg": "ERROR NO CATALOGADO",
  "observaciones": [
    "Error interno simulado (escenario de prueba)."
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 500
- ✔ estado = RECHAZADO
- ✔ codigoMsg = 099
- ✔ clasificaMsg = 99

**Resultado: ✅ EXITOSA**

#### 1.15b — Sin respuesta a tiempo → 504 tras ≈6 s

- **Objetivo:** Demostrar el comportamiento cuando el servicio tarda más que el umbral de espera (5 s).
- **Datos de entrada:** DTE válido enviado con la simulación en modo `timeout`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** Tras ≈6 s responde HTTP 504 (`Gateway Timeout`); el documento NO se procesa.
- **Criterio de éxito:** Código 504 y tiempo de respuesta de al menos 5.5 s (mayor que el umbral de 5 s).

Cuerpo enviado (resumen):

```json
{
  "ambiente": "00",
  "idEnvio": "64EFB968-F41E-47DE-A9AD-2C5854C0CE3D",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A6E1CEE7-A7F4-4F29-978E-CBECAF6DA6B7",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000988028521",
    "ambiente": "00",
    "emisor.nit": "06140000000001",
    "receptor.numDocumento": "04512398-7",
    "ítems": 2,
    "resumen.totalGravada": 226,
    "resumen.totalIva": 26,
    "resumen.totalPagar": 226
  }
}
```

**Respuesta obtenida:** HTTP 504 Gateway Timeout · 6006 ms

```json
{
  "status": "ERROR",
  "error": "Gateway Timeout",
  "message": "Tiempo de espera agotado (escenario de prueba)."
}
```

Aserciones automáticas:

- ✔ HTTP 504
- ✔ tardó más que el umbral de 5 s

**Resultado: ✅ EXITOSA**

### 2. Control de acceso (API simulada)

#### 2.1 — Recepción sin token → 401

- **Objetivo:** Comprobar que la recepción exige autenticación.
- **Datos de entrada:** POST sin encabezado `Authorization`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 401, mensaje `Token no proporcionado`.
- **Criterio de éxito:** Código 401 y el mensaje indicado.

Cuerpo enviado (resumen):

```json
{}
```

**Respuesta obtenida:** HTTP 401 Unauthorized · 4 ms

```json
{
  "status": "ERROR",
  "error": "Unauthorized",
  "message": "Token no proporcionado"
}
```

Aserciones automáticas:

- ✔ HTTP 401
- ✔ mensaje: Token no proporcionado

**Resultado: ✅ EXITOSA**

#### 2.2 — Token inválido → 401

- **Objetivo:** Comprobar que un token con formato JWT pero sin firma válida se rechaza.
- **Datos de entrada:** `Authorization: Bearer abc.def.ghi`.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 401, mensaje `Token no valido`.
- **Criterio de éxito:** Código 401 y el mensaje indicado.

Cuerpo enviado (resumen):

```json
{}
```

**Respuesta obtenida:** HTTP 401 Unauthorized · 12 ms

```json
{
  "status": "ERROR",
  "error": "Unauthorized",
  "message": "Token no valido"
}
```

Aserciones automáticas:

- ✔ HTTP 401
- ✔ mensaje: Token no valido

**Resultado: ✅ EXITOSA**

#### 2.3 — Token con algoritmo "none" → 401

- **Objetivo:** Comprobar que no se acepta un token sin firma (ataque clásico de algoritmo `none`).
- **Datos de entrada:** Token cuya cabecera declara `alg: none` y sin firma.
- **Endpoint:** `/api/hacienda-sim/fesv/recepciondte`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 401, mensaje `Token no valido`.
- **Criterio de éxito:** Código 401 y el mensaje indicado.

Cuerpo enviado (resumen):

```json
{}
```

**Respuesta obtenida:** HTTP 401 Unauthorized · 5 ms

```json
{
  "status": "ERROR",
  "error": "Unauthorized",
  "message": "Token no valido"
}
```

Aserciones automáticas:

- ✔ HTTP 401
- ✔ mensaje: Token no valido

**Resultado: ✅ EXITOSA**

#### 2.4 — Cambiar el escenario sin token → 401

- **Objetivo:** Comprobar que el control de escenarios de falla está protegido.
- **Datos de entrada:** PUT con `{"modo":"indisponible"}` y sin `Authorization`.
- **Endpoint:** `/api/hacienda-sim/control/escenario`
- **Método HTTP:** `PUT`
- **Resultado esperado:** HTTP 401; el escenario NO cambia.
- **Criterio de éxito:** Código 401.

Cuerpo enviado (resumen):

```json
{
  "modo": "indisponible"
}
```

**Respuesta obtenida:** HTTP 401 Unauthorized · 7 ms

```json
{
  "status": "ERROR",
  "error": "Unauthorized",
  "message": "Token no proporcionado"
}
```

Aserciones automáticas:

- ✔ HTTP 401

**Resultado: ✅ EXITOSA**

### 3. Backend del ERP (navegador → ERP → Hacienda)

#### 3.1 — Emitir una factura válida → Emitida

- **Objetivo:** Demostrar el ciclo completo desde el ERP: construir el DTE, firmarlo, enviarlo y registrar la respuesta.
- **Datos de entrada:** POST `{ factura, cliente }` con 2 ítems (Bicicleta ×1 a $100; Guantes ×2 a $50 con 10 % de descuento), cliente con documento válido.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `ok: true`, `resultado: aceptado`, `facturaEstado: Emitida`, 1 envío y 0 consultas; sello de 40 caracteres; total del DTE $214.70.
- **Criterio de éxito:** Código 200; resultado y estado como se indica; sello, `codigoGeneracion` y `numeroControl` con formato válido; `totales.totalPagar` = 214.7.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NG3-1",
    "folio": "988035572",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 28 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "FABA86YBKRZVZL844AS4N0IYA5LECXG5LJFH5N3Y",
  "fhProcesamiento": "06/11/2026 12:00:35",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0022",
  "codigoGeneracion": "2259EB0F-E9A9-4BDC-A760-3960E4DB8101",
  "numeroControl": "DTE-01-M001P001-000000988035572",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ resultado = aceptado
- ✔ facturaEstado = Emitida
- ✔ envios = 1
- ✔ consultas = 0
- ✔ yaEmitida = false
- ✔ selloRecibido: 40 caracteres alfanuméricos
- ✔ codigoGeneracion: UUID v4 en mayúsculas
- ✔ numeroControl con formato DTE-01-M001P001-<15 dígitos>
- ✔ total del DTE = 214.70

**Resultado: ✅ EXITOSA**

#### 3.2 — Reenviar la misma factura (ya emitida) → no se vuelve a enviar

- **Objetivo:** Documentar el comportamiento controlado del REENVÍO desde el ERP: una factura ya emitida no se envía otra vez.
- **Datos de entrada:** El mismo cuerpo exacto del caso 3.1.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `yaEmitida: true`, 0 envíos y 0 consultas, la MISMA transmisión y el MISMO sello del caso 3.1.
- **Criterio de éxito:** Código 200, `yaEmitida` verdadero, `envios` 0, y `transmisionId` y `selloRecibido` idénticos a los de 3.1.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NG3-1",
    "folio": "988035572",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 21 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "La factura ya fue emitida; se devuelve el resultado registrado, sin reenviar.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "FABA86YBKRZVZL844AS4N0IYA5LECXG5LJFH5N3Y",
  "fhProcesamiento": "06/11/2026 12:00:35",
  "observaciones": [],
  "envios": 0,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0022",
  "codigoGeneracion": "2259EB0F-E9A9-4BDC-A760-3960E4DB8101",
  "numeroControl": "DTE-01-M001P001-000000988035572",
  "yaEmitida": true,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ envios = 0
- ✔ consultas = 0
- ✔ yaEmitida = true
- ✔ misma transmisión que en 3.1
- ✔ mismo sello que en 3.1

**Resultado: ✅ EXITOSA**

#### 3.3 — Cliente con documento inválido → Rechazada

- **Objetivo:** Demostrar el rechazo de Hacienda reflejado en el ERP, sin reintentos (un rechazo no se reintenta).
- **Datos de entrada:** Factura cuyo cliente tiene el documento `1234` (menos de 8 dígitos).
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 422, `ok: false`, `resultado: rechazado`, `facturaEstado: Rechazada`, `codigoMsg: 003`, `clasificaMsg: 13` (receptor), 1 envío y 0 consultas.
- **Criterio de éxito:** Código 422; resultado, estado, código y clasificación como se indica; sin reintentos (1 envío).

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NK0-2",
    "folio": "988035714",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "1234"
  }
}
```

**Respuesta obtenida:** HTTP 422 Unprocessable Entity (WebDAV) (RFC 4918) · 20 ms

```json
{
  "ok": false,
  "resultado": "rechazado",
  "facturaEstado": "Rechazada",
  "mensaje": "Comprobante rechazado: [receptor.numDocumento] VALOR NO VALIDO.",
  "codigoMsg": "003",
  "clasificaMsg": "13",
  "descripcionMsg": "[receptor.numDocumento] VALOR NO VALIDO",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "observaciones": [
    "[receptor.numDocumento] VALOR NO VALIDO"
  ],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0023",
  "codigoGeneracion": "7BAE93AA-B07D-43A5-82E9-676CFA01C071",
  "numeroControl": "DTE-01-M001P001-000000988035714",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 422
- ✔ ok = false
- ✔ resultado = rechazado
- ✔ facturaEstado = Rechazada
- ✔ envios = 1
- ✔ consultas = 0
- ✔ codigoMsg = 003
- ✔ clasificaMsg = 13

**Resultado: ✅ EXITOSA**

#### 3.4 — Corregir el dato y reenviar → Emitida con el mismo código de generación

- **Objetivo:** Demostrar que tras un rechazo se puede corregir el dato y reenviar, conservando el `codigoGeneracion` de la factura.
- **Datos de entrada:** La misma factura del caso 3.3 con el documento del cliente corregido a `04512398-7`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `resultado: aceptado`, `facturaEstado: Emitida` y el MISMO `codigoGeneracion` del caso 3.3.
- **Criterio de éxito:** Código 200, estado Emitida y `codigoGeneracion` igual al de 3.3.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NK0-2",
    "folio": "988035714",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 33 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "QFSSI71RZZZP57PV2VYDK85NTJK46YOBL2N7OR3T",
  "fhProcesamiento": "06/11/2026 12:00:35",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0024",
  "codigoGeneracion": "7BAE93AA-B07D-43A5-82E9-676CFA01C071",
  "numeroControl": "DTE-01-M001P001-000000988035714",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ resultado = aceptado
- ✔ facturaEstado = Emitida
- ✔ conserva el codigoGeneracion del caso 3.3

**Resultado: ✅ EXITOSA**

#### 3.5 — Solicitud inválida (factura sin ítems) → 400

- **Objetivo:** Demostrar el error de validación del ERP ante una solicitud que incumple el formato (sin ítems).
- **Datos de entrada:** Factura con `items: []`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `error: solicitud_invalida` y una lista de `detalles`.
- **Criterio de éxito:** Código 400, `error` igual a `solicitud_invalida` y al menos un detalle.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NO3-3",
    "folio": "988035862",
    "ítems": 0
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 4 ms

```json
{
  "ok": false,
  "error": "solicitud_invalida",
  "mensaje": "La solicitud no cumple el formato esperado.",
  "detalles": [
    "/factura/items must NOT have fewer than 1 items"
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ ok = false
- ✔ error = solicitud_invalida
- ✔ incluye detalles de validación

**Resultado: ✅ EXITOSA**

#### 3.6 — Solicitud mal estructurada (JSON mal formado) → 400

- **Objetivo:** Demostrar el error de validación del ERP ante un cuerpo que no es JSON.
- **Datos de entrada:** Cuerpo `{no es json`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 400, `error: cuerpo_invalido`.
- **Criterio de éxito:** Código 400 y `error` igual a `cuerpo_invalido`.

Cuerpo enviado (resumen):

```json
"{no es json"
```

**Respuesta obtenida:** HTTP 400 Bad Request · 3 ms

```json
{
  "ok": false,
  "error": "cuerpo_invalido",
  "mensaje": "El cuerpo de la solicitud no es JSON válido."
}
```

Aserciones automáticas:

- ✔ HTTP 400
- ✔ ok = false
- ✔ error = cuerpo_invalido

**Resultado: ✅ EXITOSA**

#### 3.7b — Servicio indisponible: emitir → Pendiente de envío (3 envíos y 3 consultas)

- **Objetivo:** Demostrar el error de comunicación visto desde el ERP y la política oficial de reintentos (consultar estado, reenviar hasta 2 veces, dejar pendiente).
- **Datos de entrada:** Factura válida emitida con la simulación en modo `indisponible`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 502, `ok: false`, `resultado: servicio_no_disponible`, `facturaEstado: Pendiente de envío`, 3 envíos y 3 consultas.
- **Criterio de éxito:** Código 502; resultado y estado como se indica; exactamente 3 envíos (1 + 2 reintentos) y 3 consultas.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NQA-4",
    "folio": "988035942",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 502 Bad Gateway · 75 ms

```json
{
  "ok": false,
  "resultado": "servicio_no_disponible",
  "facturaEstado": "Pendiente de envío",
  "mensaje": "El servicio no está disponible (3 envío(s) intentados). La factura queda pendiente de envío.",
  "codigoMsg": null,
  "clasificaMsg": null,
  "descripcionMsg": null,
  "selloRecibido": null,
  "fhProcesamiento": null,
  "observaciones": [],
  "envios": 3,
  "consultas": 3,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0025",
  "codigoGeneracion": "A6642827-BA18-4E5B-94EB-275A8ED69325",
  "numeroControl": "DTE-01-M001P001-000000988035942",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 502
- ✔ ok = false
- ✔ resultado = servicio_no_disponible
- ✔ facturaEstado = Pendiente de envío
- ✔ envios = 3
- ✔ consultas = 3

**Resultado: ✅ EXITOSA**

#### 3.7d — Restablecido el servicio, reintentar la misma factura → Emitida

- **Objetivo:** Demostrar que una factura pendiente se emite al reintentar cuando el servicio vuelve, conservando su `codigoGeneracion`.
- **Datos de entrada:** El mismo cuerpo exacto del caso 3.7b.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `resultado: aceptado`, `facturaEstado: Emitida`, 1 envío y el MISMO `codigoGeneracion` del caso 3.7b.
- **Criterio de éxito:** Código 200, estado Emitida, 1 envío y `codigoGeneracion` igual al de 3.7b.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NQA-4",
    "folio": "988035942",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 22 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "7XQAZDIJJGODUON311YA0608OVS49ZG6H2IRJ5A7",
  "fhProcesamiento": "06/11/2026 12:00:36",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0026",
  "codigoGeneracion": "A6642827-BA18-4E5B-94EB-275A8ED69325",
  "numeroControl": "DTE-01-M001P001-000000988035942",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ resultado = aceptado
- ✔ facturaEstado = Emitida
- ✔ envios = 1
- ✔ consultas = 0
- ✔ conserva el codigoGeneracion del intento fallido

**Resultado: ✅ EXITOSA**

#### 3.8b — Hacienda recibió pero respondió tarde → se recupera por consulta (≈5 s)

- **Objetivo:** Demostrar la política oficial: si no hay respuesta en 5 s, primero se CONSULTA el estado antes de reenviar, evitando un documento duplicado.
- **Datos de entrada:** Factura válida con la simulación en modo `timeout_procesado` (procesa y guarda el documento, pero responde después del umbral).
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `resultado: aceptado`, `recuperadoPorConsulta: true`, 1 envío y 1 consulta, tras ≈5 s de espera.
- **Criterio de éxito:** Código 200, `recuperadoPorConsulta` verdadero, exactamente 1 envío (no se reenvió) y 1 consulta; tiempo de respuesta de al menos 4.8 s.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NVR-5",
    "folio": "988036140",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 5030 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Hacienda ya había recibido el documento (la respuesta se demoró o se perdió); el sello se recuperó consultando el estado, sin reenviar.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "selloRecibido": "AYWDC4RA3HQHOEAGV7TAI1TBTPK4N1HP8T1KHZWD",
  "fhProcesamiento": "06/11/2026 12:00:36",
  "observaciones": [],
  "envios": 1,
  "consultas": 1,
  "recuperadoPorConsulta": true,
  "transmisionId": "TRX-0027",
  "codigoGeneracion": "BE581788-E26C-4267-B78D-A58F6A5D65BE",
  "numeroControl": "DTE-01-M001P001-000000988036140",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ resultado = aceptado
- ✔ facturaEstado = Emitida
- ✔ envios = 1
- ✔ consultas = 1
- ✔ recuperadoPorConsulta = true
- ✔ esperó el umbral de 5 s antes de consultar

**Resultado: ✅ EXITOSA**

#### 3.8d — Volver a emitir esa factura no genera un duplicado

- **Objetivo:** Comprobar que, tras recuperarla por consulta, volver a emitir la factura no la envía otra vez.
- **Datos de entrada:** El mismo cuerpo exacto del caso 3.8b.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `yaEmitida: true` y 0 envíos.
- **Criterio de éxito:** Código 200, `yaEmitida` verdadero y `envios` 0.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5NVR-5",
    "folio": "988036140",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 11 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "La factura ya fue emitida; se devuelve el resultado registrado, sin reenviar.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "selloRecibido": "AYWDC4RA3HQHOEAGV7TAI1TBTPK4N1HP8T1KHZWD",
  "fhProcesamiento": "06/11/2026 12:00:36",
  "observaciones": [],
  "envios": 0,
  "consultas": 0,
  "recuperadoPorConsulta": true,
  "transmisionId": "TRX-0027",
  "codigoGeneracion": "BE581788-E26C-4267-B78D-A58F6A5D65BE",
  "numeroControl": "DTE-01-M001P001-000000988036140",
  "yaEmitida": true,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ envios = 0
- ✔ yaEmitida = true

**Resultado: ✅ EXITOSA**

#### 3.9b — Sin respuesta: emitir → Pendiente tras ≈15 s (3 envíos de 5 s)

- **Objetivo:** Demostrar el agotamiento de la política de reintentos cuando el servicio nunca responde.
- **Datos de entrada:** Factura válida con la simulación en modo `timeout`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 504, `ok: false`, `resultado: sin_respuesta`, `facturaEstado: Pendiente de envío`, 3 envíos y 3 consultas, tras ≈15 s.
- **Criterio de éxito:** Código 504; resultado y estado como se indica; 3 envíos y 3 consultas; tiempo de respuesta de al menos 14 s.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A5RV4-6",
    "folio": "988041302",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 504 Gateway Timeout · 15081 ms

```json
{
  "ok": false,
  "resultado": "sin_respuesta",
  "facturaEstado": "Pendiente de envío",
  "mensaje": "El servicio no respondió tras 3 envío(s). La factura queda pendiente de envío.",
  "codigoMsg": null,
  "clasificaMsg": null,
  "descripcionMsg": null,
  "selloRecibido": null,
  "fhProcesamiento": null,
  "observaciones": [],
  "envios": 3,
  "consultas": 3,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0028",
  "codigoGeneracion": "EDC409EF-7819-4B1D-913C-27CE0DB2556C",
  "numeroControl": "DTE-01-M001P001-000000988041302",
  "yaEmitida": false,
  "compartida": false,
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  }
}
```

Aserciones automáticas:

- ✔ HTTP 504
- ✔ ok = false
- ✔ resultado = sin_respuesta
- ✔ facturaEstado = Pendiente de envío
- ✔ envios = 3
- ✔ consultas = 3
- ✔ esperó 3 umbrales de 5 s

**Resultado: ✅ EXITOSA**

#### 3.9d — Consultar estado: Hacienda no tiene ese documento

- **Objetivo:** Comprobar que la consulta de estado confirma que un documento que nunca llegó a Hacienda no existe allí.
- **Datos de entrada:** `{ facturaId }` de la factura del caso 3.9b.
- **Endpoint:** `/api/erp/dte/consultar`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `ok: true` y `encontrado: false`.
- **Criterio de éxito:** Código 200 y `encontrado` falso.

Cuerpo enviado (resumen):

```json
{
  "facturaId": "FAC-PM-MW5A5RV4-6"
}
```

**Respuesta obtenida:** HTTP 200 OK · 11 ms

```json
{
  "ok": true,
  "encontrado": false,
  "facturaId": "FAC-PM-MW5A5RV4-6",
  "codigoGeneracion": "EDC409EF-7819-4B1D-913C-27CE0DB2556C",
  "estado": "RECHAZADO",
  "selloRecibido": null,
  "fhProcesamiento": null,
  "descripcionMsg": "[codigoGeneracion] NO EXISTE UN REGISTRO CON ESTE DATO",
  "facturaEstado": null,
  "conciliada": false,
  "mensaje": "Hacienda no tiene registrado este documento."
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ ok = true
- ✔ encontrado = false

**Resultado: ✅ EXITOSA**

#### 3.10 — Consultar estado de una factura emitida

- **Objetivo:** Demostrar la consulta posterior del resultado de una factura ya emitida.
- **Datos de entrada:** `{ facturaId }` de la factura del caso 3.1.
- **Endpoint:** `/api/erp/dte/consultar`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 200, `encontrado: true`, `estado: PROCESADO` y el mismo sello del caso 3.1.
- **Criterio de éxito:** Código 200, documento encontrado y `selloRecibido` igual al de 3.1.

Cuerpo enviado (resumen):

```json
{
  "facturaId": "FAC-PM-MW5A5NG3-1"
}
```

**Respuesta obtenida:** HTTP 200 OK · 13 ms

```json
{
  "ok": true,
  "encontrado": true,
  "facturaId": "FAC-PM-MW5A5NG3-1",
  "codigoGeneracion": "2259EB0F-E9A9-4BDC-A760-3960E4DB8101",
  "estado": "PROCESADO",
  "selloRecibido": "FABA86YBKRZVZL844AS4N0IYA5LECXG5LJFH5N3Y",
  "fhProcesamiento": "06/11/2026 12:00:35",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "facturaEstado": "Emitida",
  "conciliada": false,
  "mensaje": "Hacienda tiene registrado el documento."
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ encontrado = true
- ✔ estado = PROCESADO
- ✔ mismo sello que en 3.1

**Resultado: ✅ EXITOSA**

#### 3.11 — Consultar una factura desconocida → 404

- **Objetivo:** Demostrar la respuesta ante una factura sin ninguna transmisión registrada.
- **Datos de entrada:** `{ facturaId: "FAC-NO-EXISTE" }`.
- **Endpoint:** `/api/erp/dte/consultar`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 404 con `motivo: desconocida`.
- **Criterio de éxito:** Código 404 y `motivo` igual a `desconocida`.

Cuerpo enviado (resumen):

```json
{
  "facturaId": "FAC-NO-EXISTE"
}
```

**Respuesta obtenida:** HTTP 404 Not Found · 4 ms

```json
{
  "ok": false,
  "motivo": "desconocida",
  "mensaje": "No hay transmisiones registradas para esa factura."
}
```

Aserciones automáticas:

- ✔ HTTP 404
- ✔ motivo = desconocida

**Resultado: ✅ EXITOSA**

#### 3.12 — Historial de envíos de una factura

- **Objetivo:** Demostrar el registro y la consulta del historial de envíos.
- **Datos de entrada:** GET con `facturaId` de la factura del caso 3.1.
- **Endpoint:** `/api/erp/dte/transmisiones?facturaId=FAC-PM-MW5A5NG3-1`
- **Método HTTP:** `GET`
- **Resultado esperado:** HTTP 200 con una transmisión: la del caso 3.1, resultado `aceptado`.
- **Criterio de éxito:** Código 200, `total` 1, el `id` de la transmisión coincide con el de 3.1.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 200 OK · 12 ms

```json
{
  "total": 1,
  "transmisiones": [
    {
      "id": "TRX-0022",
      "origen": "envio",
      "facturaId": "FAC-PM-MW5A5NG3-1",
      "codigoGeneracion": "2259EB0F-E9A9-4BDC-A760-3960E4DB8101",
      "numeroControl": "DTE-01-M001P001-000000988035572",
      "iniciadaEn": "2026-11-06T18:00:35.582Z",
      "finalizadaEn": "2026-11-06T18:00:35.600Z",
      "estadoProceso": "finalizada",
      "resultado": "aceptado",
      "facturaEstado": "Emitida",
      "codigoMsg": "001",
      "selloRecibido": "FABA86YBKRZVZL844AS4N0IYA5LECXG5LJFH5N3Y",
      "envios": 1,
      "consultas": 0
    }
  ]
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ una sola transmisión
- ✔ es la transmisión del caso 3.1
- ✔ resultado = aceptado

**Resultado: ✅ EXITOSA**

#### 3.13 — Detalle de una transmisión (DTE enviado e intentos)

- **Objetivo:** Demostrar que se conserva el DTE enviado y cada intento (fecha, estado HTTP, respuesta).
- **Datos de entrada:** GET de la transmisión del caso 3.1.
- **Endpoint:** `/api/erp/dte/transmisiones/TRX-0022`
- **Método HTTP:** `GET`
- **Resultado esperado:** HTTP 200, `estadoProceso: finalizada`, el DTE con el mismo `codigoGeneracion` y 1 intento.
- **Criterio de éxito:** Código 200, estado finalizada, `codigoGeneracion` del DTE igual al de 3.1 y 1 intento con HTTP 200.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 200 OK · 8 ms

```json
{
  "id": "TRX-0022",
  "origen": "envio",
  "facturaId": "FAC-PM-MW5A5NG3-1",
  "codigoGeneracion": "2259EB0F-E9A9-4BDC-A760-3960E4DB8101",
  "numeroControl": "DTE-01-M001P001-000000988035572",
  "dte": "[DTE completo omitido en esta evidencia]",
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  },
  "iniciadaEn": "2026-11-06T18:00:35.582Z",
  "finalizadaEn": "2026-11-06T18:00:35.600Z",
  "estadoProceso": "finalizada",
  "intentos": [
    {
      "n": 1,
      "tipo": "envio",
      "inicio": "2026-11-06T18:00:35.585Z",
      "duracionMs": 10,
      "resultado": "respuesta",
      "httpStatus": 200,
      "codigoMsg": "001",
      "descripcionMsg": "RECIBIDO",
      "error": null
    }
  ],
  "resultado": {
    "ok": true,
    "resultado": "aceptado",
    "facturaEstado": "Emitida",
    "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
    "codigoMsg": "001",
    "clasificaMsg": "10",
    "descripcionMsg": "RECIBIDO",
    "selloRecibido": "FABA86YBKRZVZL844AS4N0IYA5LECXG5LJFH5N3Y",
    "fhProcesamiento": "06/11/2026 12:00:35",
    "observaciones": [],
    "envios": 1,
    "consultas": 0,
    "recuperadoPorConsulta": false
  }
}
```

Aserciones automáticas:

- ✔ HTTP 200
- ✔ estadoProceso = finalizada
- ✔ el DTE guardado tiene el codigoGeneracion de 3.1
- ✔ un intento, con HTTP 200

**Resultado: ✅ EXITOSA**

#### 3.14 — Detalle de una transmisión inexistente → 404

- **Objetivo:** Demostrar la respuesta ante un identificador de transmisión que no existe.
- **Datos de entrada:** GET de `TRX-9999`.
- **Endpoint:** `/api/erp/dte/transmisiones/TRX-9999`
- **Método HTTP:** `GET`
- **Resultado esperado:** HTTP 404.
- **Criterio de éxito:** Código 404.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 404 Not Found · 7 ms

```json
{
  "ok": false,
  "error": "no_encontrada",
  "mensaje": "No existe la transmisión TRX-9999."
}
```

Aserciones automáticas:

- ✔ HTTP 404

**Resultado: ✅ EXITOSA**

#### 3.15 — Petición desde otro sitio (CSRF) → 403

- **Objetivo:** Comprobar que el ERP rechaza peticiones que un navegador envía desde otro sitio web.
- **Datos de entrada:** Factura válida con el encabezado `Origin: http://evil.example`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 403, `error: origen_no_permitido`; la factura NO se procesa.
- **Criterio de éxito:** Código 403 y `error` igual a `origen_no_permitido`.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A63PZ-7",
    "folio": "988056670",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 403 Forbidden · 3 ms

```json
{
  "ok": false,
  "error": "origen_no_permitido",
  "mensaje": "La solicitud proviene de un origen no permitido."
}
```

Aserciones automáticas:

- ✔ HTTP 403
- ✔ ok = false
- ✔ error = origen_no_permitido

**Resultado: ✅ EXITOSA**

#### 3.16 — Cuerpo que no es JSON (text/plain) → 415

- **Objetivo:** Comprobar que el ERP exige `application/json` (un formulario de otro sitio solo puede enviar `text/plain`).
- **Datos de entrada:** Factura válida enviada con `Content-Type: text/plain`.
- **Endpoint:** `/api/erp/dte/transmitir`
- **Método HTTP:** `POST`
- **Resultado esperado:** HTTP 415, `error: tipo_contenido_invalido`.
- **Criterio de éxito:** Código 415 y `error` igual a `tipo_contenido_invalido`.

Cuerpo enviado (resumen):

```json
{
  "factura": {
    "id": "FAC-PM-MW5A63QS-8",
    "folio": "988056700",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 415 Unsupported Media Type · 4 ms

```json
{
  "ok": false,
  "error": "tipo_contenido_invalido",
  "mensaje": "El cuerpo debe enviarse como application/json."
}
```

Aserciones automáticas:

- ✔ HTTP 415
- ✔ ok = false
- ✔ error = tipo_contenido_invalido

**Resultado: ✅ EXITOSA**

## Pasos de preparación

Cambian el escenario de la simulación entre casos y lo restablecen al terminar.

| Paso | Acción | HTTP | Resultado |
|---|---|---|---|
| 0.2 | Escenario: normal | 200 | ✅ |
| 1.13a | Escenario: indisponible | 200 | ✅ |
| 1.13d | Escenario: normal | 200 | ✅ |
| 1.14a | Escenario: error_interno | 200 | ✅ |
| 1.14c | Escenario: normal | 200 | ✅ |
| 1.15a | Escenario: timeout | 200 | ✅ |
| 1.15c | Escenario: normal | 200 | ✅ |
| 3.7a | Escenario: indisponible | 200 | ✅ |
| 3.7c | Escenario: normal | 200 | ✅ |
| 3.8a | Escenario: timeout_procesado | 200 | ✅ |
| 3.8c | Escenario: normal | 200 | ✅ |
| 3.9a | Escenario: timeout | 200 | ✅ |
| 3.9c | Escenario: normal | 200 | ✅ |
| 4.1 | Escenario: normal | 200 | ✅ |

## Cómo reproducir

```bash
bun dev                                   # servidor en http://127.0.0.1:8080
npx newman run postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json \
  -e postman/AdvWork-ERP-local.postman_environment.json \
  --reporters cli,json --reporter-json-export reporte.json --timeout-request 60000
node scripts/postman-evidencia.mjs reporte.json docs/evidencia-postman.md
```
