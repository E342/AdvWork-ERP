# Evidencia de las pruebas con Postman

> **Documento generado automáticamente** por `scripts/postman-evidencia.mjs` a partir del reporte de una
> ejecución real de la colección con Newman. Las respuestas y los resultados **no se escriben a mano**: salen
> del reporte. Un caso figura como exitoso solo si **todas** sus aserciones pasaron.
> Todo corresponde a una **simulación académica**; no se usó ningún servicio, credencial ni certificado reales.

| Dato | Valor |
|---|---|
| Fecha de ejecución | 6 de noviembre de 2026 a las 4:51:04 p. m. (hora de El Salvador) |
| Herramienta | Newman 6.2.3 (ejecutor de línea de comandos de Postman) |
| Servidor probado | `http://127.0.0.1:3001` |
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

**Respuesta obtenida:** HTTP 200 OK · 35 ms

```json
{
  "status": "OK",
  "body": {
    "user": "PROD-SIM-USER",
    "token": "Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJQUk9ELVNJTS1VU0VSIiwiYXV0aG9yaXRpZXMiOiJVc3VhcmlvIiwiaWF0IjoxNzk0MDA1NDY0LCJleHAiOjE3OTQwNDg2NjR9.KM1-kaZ59056nyBnx3bdcUVPryDZuDa8gbVsPX3dwVhJoPM9R7_WWDqxiSnJagD370_YQcJHJoclVO1DbChxeA",
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
  "idEnvio": "8D3C9C86-CBF3-4CF5-B6F7-763F2F916BED",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464608",
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

**Respuesta obtenida:** HTTP 200 OK · 19 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337",
  "selloRecibido": "LWT4FGZGSUPVKTPBCC8FLCA5ZKLF66ZLALS0GSS8",
  "fhProcesamiento": "06/11/2026 16:51:04",
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
  "idEnvio": "8D3C9C86-CBF3-4CF5-B6F7-763F2F916BED",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464608",
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

**Respuesta obtenida:** HTTP 400 Bad Request · 8 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337",
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
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337"
}
```

**Respuesta obtenida:** HTTP 200 OK · 9 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337",
  "selloRecibido": "LWT4FGZGSUPVKTPBCC8FLCA5ZKLF66ZLALS0GSS8",
  "fhProcesamiento": "06/11/2026 16:51:04",
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
  "idEnvio": "A1FB440B-072A-44D0-99C5-6514DA55B1EC",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "D968B731-CDB5-48EE-A341-BF2FF89C887A",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464609",
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

**Respuesta obtenida:** HTTP 400 Bad Request · 4 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "D968B731-CDB5-48EE-A341-BF2FF89C887A",
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
  "idEnvio": "49CF4BDE-9410-47D4-92CD-9E11892490B1",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "0A036B3C-4C6A-472E-A703-0DF99A276952",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464610",
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

**Respuesta obtenida:** HTTP 400 Bad Request · 5 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "0A036B3C-4C6A-472E-A703-0DF99A276952",
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
  "idEnvio": "FB77C283-5BCC-43EF-A29C-00EE1319CB5A",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "CFC8D984-17A8-43DE-9B9B-0052D45465DB",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464611",
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

**Respuesta obtenida:** HTTP 200 OK · 12 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "CFC8D984-17A8-43DE-9B9B-0052D45465DB",
  "selloRecibido": "N5RZ1WL4RGE8XFVSVXI45HAQ3PP4XXPMVGHBPC8J",
  "fhProcesamiento": "06/11/2026 16:51:04",
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
  "idEnvio": "08515A0B-66FD-4FE7-9D27-D5F378DC177D",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "B028806E-33C3-499C-95FD-7AB14561F38C"
}
```

**Respuesta obtenida:** HTTP 400 Bad Request · 4 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "RECHAZADO",
  "codigoGeneracion": "B028806E-33C3-499C-95FD-7AB14561F38C",
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

**Respuesta obtenida:** HTTP 400 Bad Request · 3 ms

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
  "idEnvio": "E741BDF6-7777-4AE1-820B-D860903BDDDA",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A5FDA573-EC29-420D-850A-220AC812F107",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464613",
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
  "codigoGeneracion": "A5FDA573-EC29-420D-850A-220AC812F107",
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
  "idEnvio": "EE247991-8250-4D9E-9BD4-CC393CE7DE71",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "8C92073F-286E-47DC-94CF-75BE06F1EC37",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464614",
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
  "codigoGeneracion": "8C92073F-286E-47DC-94CF-75BE06F1EC37",
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
  "idEnvio": "16E3CBC0-15B3-4A2A-9ECA-6C544F6DBC5C",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "EF41D816-8C89-46FE-ADED-9C3A21688763",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464615",
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

**Respuesta obtenida:** HTTP 200 OK · 5 ms

```json
{
  "version": 2,
  "ambiente": "00",
  "versionApp": 2,
  "estado": "PROCESADO",
  "codigoGeneracion": "EF41D816-8C89-46FE-ADED-9C3A21688763",
  "selloRecibido": "CIP2VDVUWWFTKOC8RJYAHFDTODPDB4AS4D9632ZH",
  "fhProcesamiento": "06/11/2026 16:51:05",
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
  "idEnvio": "D9372D41-3AD4-4B7A-A315-AF00507D094F",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "A7514FB0-D5D0-4239-B479-F6B749AB85EE",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464616",
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

**Respuesta obtenida:** HTTP 503 Service Unavailable · 5 ms

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
  "codigoGeneracion": "A456E15D-A7D9-40DD-A5A8-38EA34A9F337"
}
```

**Respuesta obtenida:** HTTP 503 Service Unavailable · 3 ms

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
  "idEnvio": "840C5745-C637-4601-A400-2D089C668BC6",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "F74747E3-DF53-44AF-8848-217286EF88DF",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464617",
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

**Respuesta obtenida:** HTTP 500 Internal Server Error · 5 ms

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
  "idEnvio": "92B9C794-EF7C-43C2-A011-91A0B606AA1C",
  "version": 2,
  "tipoDte": "01",
  "codigoGeneracion": "034C4FFF-AB68-4DEE-930A-7EE23541C240",
  "documento": "<JWS firmado; contiene el DTE de abajo>",
  "DTE (decodificado)": {
    "numeroControl": "DTE-01-M001P001-000000005464618",
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

**Respuesta obtenida:** HTTP 504 Gateway Timeout · 6007 ms

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

**Respuesta obtenida:** HTTP 401 Unauthorized · 5 ms

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

**Respuesta obtenida:** HTTP 401 Unauthorized · 3 ms

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

**Respuesta obtenida:** HTTP 401 Unauthorized · 7 ms

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

**Respuesta obtenida:** HTTP 401 Unauthorized · 11 ms

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
    "id": "FAC-PM-MW5KJD3P-1",
    "folio": "5471510",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 52 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "2WE6Q049O4TVNUVXHKTISRD1XNMHSNIV517OTQAZ",
  "fhProcesamiento": "06/11/2026 16:51:11",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0001",
  "codigoGeneracion": "34AC5EA9-207D-48CB-9F18-E227C93660E8",
  "numeroControl": "DTE-01-M001P001-000000005471510",
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
    "id": "FAC-PM-MW5KJD3P-1",
    "folio": "5471510",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 19 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "La factura ya fue emitida.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "2WE6Q049O4TVNUVXHKTISRD1XNMHSNIV517OTQAZ",
  "fhProcesamiento": "06/11/2026 16:51:11",
  "observaciones": [],
  "envios": 0,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0001",
  "codigoGeneracion": "34AC5EA9-207D-48CB-9F18-E227C93660E8",
  "numeroControl": "DTE-01-M001P001-000000005471510",
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
    "id": "FAC-PM-MW5KJD87-2",
    "folio": "5471673",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "1234"
  }
}
```

**Respuesta obtenida:** HTTP 422 Unprocessable Entity (WebDAV) (RFC 4918) · 35 ms

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
  "transmisionId": "TRX-0002",
  "codigoGeneracion": "61B2BB0E-0EA3-46EB-B1F9-A54CC87B61A7",
  "numeroControl": "DTE-01-M001P001-000000005471673",
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
    "id": "FAC-PM-MW5KJD87-2",
    "folio": "5471673",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 46 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "9XAR05JX85E6MAXR80FJGB5PGOI15QR875LM6O8K",
  "fhProcesamiento": "06/11/2026 16:51:11",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0003",
  "codigoGeneracion": "61B2BB0E-0EA3-46EB-B1F9-A54CC87B61A7",
  "numeroControl": "DTE-01-M001P001-000000005471673",
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
    "id": "FAC-PM-MW5KJDCT-3",
    "folio": "5471840",
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
    "id": "FAC-PM-MW5KJDET-4",
    "folio": "5471913",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 502 Bad Gateway · 32 ms

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
  "transmisionId": "TRX-0004",
  "codigoGeneracion": "2BBA6FDD-8A79-435F-A5FA-0842FE17B70E",
  "numeroControl": "DTE-01-M001P001-000000005471913",
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
    "id": "FAC-PM-MW5KJDET-4",
    "folio": "5471913",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 12 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Comprobante recibido y sellado por el servicio simulado de Hacienda.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "RECIBIDO",
  "selloRecibido": "3EE2CRFPSB10A993RGCDVFXQCZD55KI1UX8649DD",
  "fhProcesamiento": "06/11/2026 16:51:12",
  "observaciones": [],
  "envios": 1,
  "consultas": 0,
  "recuperadoPorConsulta": false,
  "transmisionId": "TRX-0005",
  "codigoGeneracion": "2BBA6FDD-8A79-435F-A5FA-0842FE17B70E",
  "numeroControl": "DTE-01-M001P001-000000005471913",
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
    "id": "FAC-PM-MW5KJDIL-5",
    "folio": "5472050",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 5021 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "Hacienda ya había recibido el documento (la respuesta se demoró o se perdió); el sello se recuperó consultando el estado, sin reenviar.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "selloRecibido": "2EPB163KMZE7G76ELKPKAL12KF1677TCSQQ300V6",
  "fhProcesamiento": "06/11/2026 16:51:12",
  "observaciones": [],
  "envios": 1,
  "consultas": 1,
  "recuperadoPorConsulta": true,
  "transmisionId": "TRX-0006",
  "codigoGeneracion": "2DFC08BD-75AC-49AA-91FD-C87722F043A1",
  "numeroControl": "DTE-01-M001P001-000000005472050",
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
    "id": "FAC-PM-MW5KJDIL-5",
    "folio": "5472050",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 200 OK · 4 ms

```json
{
  "ok": true,
  "resultado": "aceptado",
  "facturaEstado": "Emitida",
  "mensaje": "La factura ya fue emitida; se devuelve el resultado registrado, sin reenviar.",
  "codigoMsg": "001",
  "clasificaMsg": "10",
  "descripcionMsg": "DTE RECIBIDO, VALIDADO Y PROCESADO",
  "selloRecibido": "2EPB163KMZE7G76ELKPKAL12KF1677TCSQQ300V6",
  "fhProcesamiento": "06/11/2026 16:51:12",
  "observaciones": [],
  "envios": 0,
  "consultas": 0,
  "recuperadoPorConsulta": true,
  "transmisionId": "TRX-0006",
  "codigoGeneracion": "2DFC08BD-75AC-49AA-91FD-C87722F043A1",
  "numeroControl": "DTE-01-M001P001-000000005472050",
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
    "id": "FAC-PM-MW5KJHH7-6",
    "folio": "5477185",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 504 Gateway Timeout · 15057 ms

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
  "transmisionId": "TRX-0007",
  "codigoGeneracion": "675B2F57-C973-4443-8570-010FAE6567E8",
  "numeroControl": "DTE-01-M001P001-000000005477185",
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
  "facturaId": "FAC-PM-MW5KJHH7-6"
}
```

**Respuesta obtenida:** HTTP 200 OK · 6 ms

```json
{
  "ok": true,
  "encontrado": false,
  "facturaId": "FAC-PM-MW5KJHH7-6",
  "codigoGeneracion": "675B2F57-C973-4443-8570-010FAE6567E8",
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
  "facturaId": "FAC-PM-MW5KJD3P-1"
}
```

**Respuesta obtenida:** HTTP 200 OK · 9 ms

```json
{
  "ok": true,
  "encontrado": true,
  "facturaId": "FAC-PM-MW5KJD3P-1",
  "codigoGeneracion": "34AC5EA9-207D-48CB-9F18-E227C93660E8",
  "estado": "PROCESADO",
  "selloRecibido": "2WE6Q049O4TVNUVXHKTISRD1XNMHSNIV517OTQAZ",
  "fhProcesamiento": "06/11/2026 16:51:11",
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
- **Endpoint:** `/api/erp/dte/transmisiones?facturaId=FAC-PM-MW5KJD3P-1`
- **Método HTTP:** `GET`
- **Resultado esperado:** HTTP 200 con una transmisión: la del caso 3.1, resultado `aceptado`.
- **Criterio de éxito:** Código 200, `total` 1, el `id` de la transmisión coincide con el de 3.1.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 200 OK · 5 ms

```json
{
  "total": 1,
  "transmisiones": [
    {
      "id": "TRX-0001",
      "origen": "envio",
      "facturaId": "FAC-PM-MW5KJD3P-1",
      "codigoGeneracion": "34AC5EA9-207D-48CB-9F18-E227C93660E8",
      "numeroControl": "DTE-01-M001P001-000000005471510",
      "iniciadaEn": "2026-11-06T22:51:11.526Z",
      "finalizadaEn": "2026-11-06T22:51:11.564Z",
      "estadoProceso": "finalizada",
      "resultado": "aceptado",
      "facturaEstado": "Emitida",
      "codigoMsg": "001",
      "selloRecibido": "2WE6Q049O4TVNUVXHKTISRD1XNMHSNIV517OTQAZ",
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
- **Endpoint:** `/api/erp/dte/transmisiones/TRX-0001`
- **Método HTTP:** `GET`
- **Resultado esperado:** HTTP 200, `estadoProceso: finalizada`, el DTE con el mismo `codigoGeneracion` y 1 intento.
- **Criterio de éxito:** Código 200, estado finalizada, `codigoGeneracion` del DTE igual al de 3.1 y 1 intento con HTTP 200.

Cuerpo enviado (resumen):

```json
(sin cuerpo)
```

**Respuesta obtenida:** HTTP 200 OK · 3 ms

```json
{
  "id": "TRX-0001",
  "origen": "envio",
  "facturaId": "FAC-PM-MW5KJD3P-1",
  "codigoGeneracion": "34AC5EA9-207D-48CB-9F18-E227C93660E8",
  "numeroControl": "DTE-01-M001P001-000000005471510",
  "dte": "[DTE completo omitido en esta evidencia]",
  "totales": {
    "totalGravada": 214.7,
    "totalIva": 24.7,
    "totalDescu": 11.3,
    "totalPagar": 214.7
  },
  "iniciadaEn": "2026-11-06T22:51:11.526Z",
  "finalizadaEn": "2026-11-06T22:51:11.564Z",
  "estadoProceso": "finalizada",
  "intentos": [
    {
      "n": 1,
      "tipo": "envio",
      "inicio": "2026-11-06T22:51:11.527Z",
      "duracionMs": 18,
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
    "selloRecibido": "2WE6Q049O4TVNUVXHKTISRD1XNMHSNIV517OTQAZ",
    "fhProcesamiento": "06/11/2026 16:51:11",
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

**Respuesta obtenida:** HTTP 404 Not Found · 3 ms

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
    "id": "FAC-PM-MW5KJTAE-7",
    "folio": "5492493",
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
    "id": "FAC-PM-MW5KJTB7-8",
    "folio": "5492523",
    "ítems": 2
  },
  "cliente": {
    "nombre": "Maria Fernanda Rivas",
    "documento": "04512398-7"
  }
}
```

**Respuesta obtenida:** HTTP 415 Unsupported Media Type · 5 ms

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
