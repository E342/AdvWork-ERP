# Seguridad y comunicación — AdvWork-ERP (facturación electrónica simulada)

> **Alcance y advertencia.** Todo lo descrito aquí corresponde a una **simulación académica** de la
> comunicación con el Ministerio de Hacienda. No existen credenciales, certificados ni endpoints
> reales de Hacienda en el proyecto; la simulación solo opera en ambiente de pruebas (`"00"`) y
> rechaza el ambiente de producción (`"01"`). La firma del DTE es un **JWS simulado (HMAC-SHA512)**
> con una clave de prueba: no es una firma electrónica certificada ni tiene validez legal.

Cada control indica **con qué prueba se verificó**. Lo que no pudo verificarse está marcado como
tal en la sección 7.

---

## 1. Arquitectura de la comunicación

```
Navegador ──(1)──► Backend del ERP ──(2)──► API SIMULADA de Hacienda
 (React)   /api/erp/dte/*   (Node)      /api/hacienda-sim/*
                               │                 │
                               ▼                 ▼
                    data/erp-transmisiones.json   data/hacienda-sim.json
```

| Enlace              | Protocolo                          | Autenticación                                         | Notas                                                           |
| ------------------- | ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| (1) Navegador → ERP | HTTP(S)                            | **Ninguna** (el prototipo no tiene login)             | Mitigado con anti-CSRF, anti-rebinding y límites; ver sección 2 |
| (2) ERP → Hacienda  | **HTTPS** (http solo en localhost) | JWT (HS512) obtenido con usuario/contraseña de prueba | El token se guarda en memoria y se renueva ante un 401          |

El navegador **nunca** habla con la API de Hacienda: esa comunicación externa la hace el servidor.

**Trazabilidad del esquema oficial.** `src/backend/hacienda-sim/schemas/fe-f-v2.json` es el archivo
descargado del portal factura.gob.sv, **sin modificar** (SHA-256 `2887ff3c…ff997aff`). Una prueba
unitaria fija esa huella: no lo reformatees (por ejemplo con `prettier --write src/`), porque la
validación de los DTE se apoya en él. Esto ya ocurrió una vez durante el desarrollo y la prueba lo detecta.

---

## 2. Amenazas y controles

| #   | Amenaza                                                                                                                     | Control implementado                                                                                                   | Dónde                                           | Verificado con                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **CSRF**: una página ajena hace que el navegador de un usuario emita facturas                                               | Los endpoints de escritura exigen `application/json` y rechazan peticiones de otro origen (`Sec-Fetch-Site`, `Origin`) | `shared/http-seguro.ts`, `erp-dte/handlers.ts`  | Ataques S01–S04, S10; unitaria `origenPermitido`                                   |
| 2   | **SSRF / fuga de credenciales**: la URL de Hacienda se deducía del encabezado `Host` (controlado por el cliente)            | La URL se fija con `ERP_DTE_API_URL`; solo se deduce si el host es local; HTTPS obligatorio salvo localhost            | `erp-dte/config.ts`, `handlers.ts`              | Ataque S19; unitarias `contexto()` y "Host falsificado… 0 llamadas de red"         |
| 3   | **DNS rebinding**: un sitio ajeno, que el navegador considera "mismo origen", lee el historial (datos personales) o escribe | Lista de hosts permitidos en **todos** los endpoints del ERP, lecturas incluidas                                       | `shared/http-seguro.ts` (`hostPermitido`)       | Ataques S18, S20, S21 **sobre la compilación de producción**                       |
| 4   | **Denegación de servicio por cuerpos enormes**                                                                              | Límite aplicado mientras se lee el cuerpo: 8 MB (DTE) y 64 KB (resto)                                                  | `shared/http-seguro.ts`                         | Ataques S07, S08; unitaria con un cuerpo "infinito" (se corta tras pocos trozos)   |
| 5   | **Importes que desbordan** (provocaban un 500)                                                                              | Validación del total máximo soportado (999 999 999.99) → 400 con detalle                                               | `erp-dte/solicitud.ts`                          | Ataque S09; unitaria del borde exacto                                              |
| 6   | **Fuga de información en errores internos**                                                                                 | Errores → 500 JSON genérico; el detalle solo va al log del servidor                                                    | `erp-dte/handlers.ts`, `hacienda-sim/seguro.ts` | Ataques S16, S17 (se provoca un error real)                                        |
| 7   | **Caché de respuestas con tokens/datos personales**                                                                         | `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`                                                          | `shared/http-seguro.ts`                         | Ataques S11, S12                                                                   |
| 8   | **Falsificación de token** (firma alterada, algoritmo `none`)                                                               | Algoritmo fijado a HS512, comparación en tiempo constante, expiración                                                  | `shared/hmac-jws.ts`, `hacienda-sim/auth.ts`    | Ataques S13, S14, S15                                                              |
| 9   | **Claves de desarrollo en producción**                                                                                      | Con `NODE_ENV=production` las variables son obligatorias y las claves por defecto **no se aceptan**                    | `*/config.ts`                                   | Unitarias; **compilación real de producción** (B: falla cerrado)                   |
| 10  | **Simulación expuesta en producción**                                                                                       | Desactivada por defecto (404) salvo `HACIENDA_SIM_ENABLED=true`                                                        | `hacienda-sim/config.ts`, `seguro.ts`           | Compilación real de producción (A1, A2)                                            |
| 11  | **Datos personales legibles por otros usuarios del equipo**                                                                 | Carpeta de datos `0700` y archivos `0600`                                                                              | `shared/json-store.ts`, `hacienda-sim/store.ts` | Unitarias; permisos reales en producción: `700 / 600 / 600`                        |
| 12  | **Credenciales o datos personales en el log**                                                                               | No se registran cuerpos, tokens ni contraseñas; solo `err.message`                                                     | Todo `src/backend`                              | Auditoría del log de producción tras ~80 operaciones y 21 ataques: 0 coincidencias |
| 13  | **Certificado TLS falso / de otro host**                                                                                    | Verificación de certificado siempre activa; ninguna línea de código la desactiva                                       | `erp-dte/hacienda-client.ts`                    | `scripts/erp-tls-test.ts` (sección 5)                                              |

---

## 3. Variables de entorno

Se leen **solo al arrancar** (hay que reiniciar). Si un valor contiene `#`, va entre comillas. Plantilla
completa: `.env.example`. `.env` está en `.gitignore`.

| Variable                       | Lado       | Obligatoria en producción | Por defecto (solo desarrollo)                     | Descripción                                                |
| ------------------------------ | ---------- | ------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `NODE_ENV`                     | ambos      | —                         | —                                                 | `production` activa las reglas estrictas                   |
| `HACIENDA_SIM_ENABLED`         | simulación | —                         | `true` fuera de producción, `false` en producción | Habilita la API simulada                                   |
| `HACIENDA_SIM_USER` / `_PWD`   | simulación | **Sí**                    | valores ficticios                                 | Credenciales de prueba                                     |
| `HACIENDA_SIM_JWT_SECRET`      | simulación | **Sí**                    | ficticio                                          | Clave del token                                            |
| `HACIENDA_SIM_FIRMA_SECRET`    | simulación | **Sí**                    | ficticio                                          | Clave del JWS simulado                                     |
| `HACIENDA_SIM_TOKEN_TTL_HOURS` | simulación | No                        | `12`                                              | Vigencia del token                                         |
| `HACIENDA_SIM_DATA_DIR`        | simulación | No                        | `data`                                            | Carpeta del JSON                                           |
| `HACIENDA_SIM_TIMEOUT_MS`      | simulación | No                        | `6000`                                            | Demora de los escenarios de timeout                        |
| `ERP_DTE_USER` / `_PWD`        | ERP        | **Sí**                    | ficticios                                         | Deben coincidir con los de la simulación                   |
| `ERP_DTE_FIRMA_SECRET`         | ERP        | **Sí**                    | ficticio                                          | Debe coincidir con el de la simulación                     |
| `ERP_DTE_API_URL`              | ERP        | **Sí**                    | se deduce (solo localhost)                        | `https://…`; `http://` solo en localhost                   |
| `ERP_DTE_TIMEOUT_MS`           | ERP        | No                        | `5000`                                            | Umbral oficial de espera                                   |
| `ERP_DTE_MAX_REINTENTOS`       | ERP        | No                        | `2`                                               | Máximo oficial de reenvíos                                 |
| `ERP_DTE_DATA_DIR`             | ERP        | No                        | `data`                                            | Carpeta de la bitácora                                     |
| `ERP_DTE_ALLOWED_HOSTS`        | ERP        | Si se publica             | vacío (solo localhost)                            | Hosts adicionales aceptados                                |
| `ERP_DTE_ALLOWED_ORIGINS`      | ERP        | Si hay proxy              | vacío                                             | Orígenes adicionales aceptados (su host también se acepta) |

Los límites de cuerpo (8 MB / 64 KB) son constantes en `shared/http-seguro.ts`, no variables.

> **Atención al usar la app desde otra máquina.** Por defecto solo se atiende a `localhost`. Abrir la
> app por IP (por ejemplo para proyectarla) devuelve **403 `host_no_permitido`** hasta declarar ese
> host en `ERP_DTE_ALLOWED_HOSTS`.

---

## 4. Desarrollo frente a producción

Verificado ejecutando la compilación real (`NITRO_PRESET=node-server`, `NODE_ENV=production`).

| Aspecto            | Desarrollo                                               | Producción                                                                 |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Claves             | Se aceptan las ficticias por defecto                     | Obligatorias; las de desarrollo **no** se aceptan (500 + motivo en el log) |
| API simulada       | Habilitada                                               | **404** salvo `HACIENDA_SIM_ENABLED=true`                                  |
| URL de Hacienda    | Puede deducirse si el host es local                      | `ERP_DTE_API_URL` obligatoria                                              |
| Esquema de la URL  | `https://`, o `http://` en localhost                     | Igual                                                                      |
| Hosts aceptados    | localhost y declarados; además Vite bloquea hosts ajenos | localhost y declarados (lo valida el ERP: Vite ya no está)                 |
| Errores al cliente | JSON genérico                                            | Igual                                                                      |
| Persistencia       | JSON local                                               | Igual (**solo Node en local**; no sirve en Cloudflare Workers)             |

> **Hallazgo que justifica probar en producción:** el _DNS rebinding_ no se reproducía en desarrollo
> porque Vite bloquea hosts desconocidos por su cuenta. Solo la compilación de producción lo expuso.

---

## 5. HTTPS / TLS

### Qué protege (y qué no)

| TLS protege                                                                                              | TLS **no** protege                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Confidencialidad** en tránsito: usuario, contraseña, token y DTE no viajan en claro                    | Los datos **en disco** (`data/*.json`): ver permisos y riesgos residuales                              |
| **Integridad** en tránsito: nadie modifica el mensaje sin que se detecte                                 | **Autorización**: TLS no decide quién puede emitir una factura                                         |
| **Autenticidad del servidor**: el certificado prueba que hablamos con Hacienda y no con un intermediario | **La autoría del documento** a largo plazo: eso lo da la **firma electrónica**, que es distinta de TLS |

### Qué se verificó (`npx tsx --test scripts/erp-tls-test.ts`)

Con un servidor HTTPS real y un certificado autofirmado generado con `openssl`:

1. **Certificado no confiable → se rechaza.** El servidor ni siquiera recibe las credenciales: el
   handshake falla antes.
2. **Con la CA en la que se confía → funciona** y viaja cifrado.
3. **Certificado válido pero emitido para otro nombre de host → se rechaza** (verificación de identidad).
4. **El código nunca desactiva la verificación.** Una prueba recorre `src/` y `scripts/` buscando
   `rejectUnauthorized: false` y `NODE_TLS_REJECT_UNAUTHORIZED`; se comprobó que detecta una línea
   prohibida inyectada a propósito.

En el código, `validarUrlApi()` obliga a que `ERP_DTE_API_URL` sea `https://` (salvo localhost).
**Nunca** uses `NODE_TLS_REJECT_UNAUTHORIZED=0` para "arreglar" un error de certificado: con un
certificado autofirmado de pruebas se confía en él explícitamente con `NODE_EXTRA_CA_CERTS=ruta/cert.pem`.

### Configuración con Docker — PROPUESTA, NO PROBADA

> **No pude ejecutar Docker en el entorno donde preparé esto, y el repositorio no contiene ningún
> `Dockerfile`.** Lo siguiente es un punto de partida razonable, **sin ejecutar**; puede requerir ajustes.
> Sí se verificó lo que sustenta la propuesta: la compilación `NITRO_PRESET=node-server` arranca con
> `node .output/server/index.mjs` y respeta `PORT`, `HOST` y las variables de entorno.
> (El proyecto compila por defecto para Cloudflare, que no sirve para persistir en JSON.)

`Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN NITRO_PRESET=node-server npx vite build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/.output ./.output
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

`docker-compose.yml` (TLS en un proxy inverso; el contenedor del ERP no se publica directamente):

```yaml
services:
  erp:
    build: .
    env_file: .env # ver la sección 3; NODE_ENV ya lo fija la imagen
    volumes: ["erp-data:/app/data"]
    expose: ["3000"]
  caddy:
    image: caddy:2
    ports: ["443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile:ro", "caddy-data:/data"]
volumes: { erp-data: {}, caddy-data: {} }
```

`Caddyfile` (para demo local; Caddy emite un certificado de una CA local):

```
localhost {
    reverse_proxy erp:3000
}
```

Valores sugeridos en `.env` para ese despliegue:

```
HACIENDA_SIM_ENABLED=true
ERP_DTE_API_URL="http://127.0.0.1:3000/api/hacienda-sim"   # llamada interna dentro del contenedor (localhost)
# Con un dominio real: ERP_DTE_ALLOWED_HOSTS="erp.midominio.com"  y  ERP_DTE_ALLOWED_ORIGINS="https://erp.midominio.com"
```

Con TLS en el proxy, el tramo navegador → proxy va cifrado; el tramo proxy → ERP viaja dentro de la red
del contenedor. El enlace ERP → Hacienda **real** exigiría `https://` hacia un certificado emitido por una
CA pública.

---

## 6. Cómo ejecutar las pruebas

Desde la raíz del repo, con el servidor en marcha (`bun dev`, puerto 8080):

```bash
node scripts/sim-smoke.mjs          # 36 casos: simulación de Hacienda
node scripts/erp-dte-smoke.mjs      # 26 casos: backend del ERP de extremo a extremo (~25 s)
node scripts/erp-security-test.mjs  # 21 ataques (cada PASS = el sistema se defendió)
npx tsx --test scripts/erp-dte-unit.ts   # 45 unitarias
npx tsx --test scripts/erp-tls-test.ts   # 4 de TLS (requiere openssl)
npx tsx --test scripts/erp-ui-test.tsx   # 11 de interfaz (requiere los 4 paquetes de prueba; ver 3C)
```

Contra la **compilación de producción**:

```bash
NITRO_PRESET=node-server npx vite build
NODE_ENV=production PORT=3001 HOST=127.0.0.1 node --env-file=prod.env .output/server/index.mjs
BASE_URL=http://127.0.0.1:3001 node --env-file=prod.env scripts/erp-security-test.mjs
```

(`prod.env` define las variables obligatorias de la sección 3, con `ERP_DTE_API_URL=http://127.0.0.1:3001/api/hacienda-sim`.)

**Resultados de la última corrida:** desarrollo, 143 verificaciones en verde (36 + 26 + 21 + 11 + 45 + 4);
producción, 83 en verde (21 ataques + 36 simulación + 26 ERP).

---

## 7. Lo que NO está resuelto o NO se verificó

**Riesgos residuales (no implementados):**

- **El backend del ERP no tiene autenticación ni autorización.** El prototipo no tiene login y el
  selector de rol es solo del navegador. Las defensas de la sección 2 reducen el riesgo (CSRF, rebinding,
  límites) pero **no sustituyen a un login**. No expongas estos endpoints a una red no confiable.
- **Sin límite de intentos** (rate limiting) ni bloqueo ante fuerza bruta contra `/auth` de la simulación.
- **Sin cifrado en reposo** de `data/*.json`: contienen datos personales (los de la demo son ficticios).
  Solo hay permisos de archivo, que no rigen en Windows.
- **Sin firma electrónica real**: la firma es un HMAC con clave de prueba.
- **Sin cabeceras de seguridad para las páginas HTML** (CSP, etc.): solo se endurecieron las respuestas de la API.
- **Persistencia en JSON**: pensada para un único proceso Node local; no es apta para varios procesos ni para Cloudflare.
- **`npm audit`:** 1 vulnerabilidad _alta_ en `zod` (dependencia preexistente de la plantilla; rango
  afectado `<4.6.6`, instalada `3.25.76`). Ningún archivo de `src/` la importa y la corrección exige un
  salto de versión mayor, por lo que **no se aplicó**. La dependencia que se agregó (`ajv8`) no tiene hallazgos.

**No verificado:**

- **Docker**: el Dockerfile y el compose de la sección 5 son una propuesta sin ejecutar.
- **Cloudflare** (destino por defecto del build): no se probó el despliegue.
- **Un navegador real**: los encabezados `Origin` y `Sec-Fetch-Site` se probaron enviándolos a mano, no con
  un navegador. Tampoco se verificó la apariencia visual de la interfaz.
- **`bun`**: todas las pruebas se corrieron con `npm`/`node`.
- **Pruebas de penetración exhaustivas**: se cubrieron los casos de la sección 2, no un análisis completo.

---

## 8. Lista de verificación antes de usar fuera de una demo local

1. Definir **todas** las variables obligatorias con secretos nuevos y distintos para cada entorno.
2. `ERP_DTE_API_URL` con `https://` y un certificado de una CA pública.
3. Declarar los hosts/orígenes reales (`ERP_DTE_ALLOWED_HOSTS` / `_ORIGINS`).
4. Añadir **autenticación y autorización** al backend del ERP (lo más importante).
5. Sustituir el JWS simulado por la firma real con el certificado emitido por el Ministerio.
6. Cifrar o mover a una base de datos con control de acceso los datos de `data/`.
7. Añadir límite de intentos y registro de auditoría de accesos.
8. Actualizar `zod` (o eliminarla si sigue sin usarse) y repetir `npm audit`.
9. Repetir `scripts/erp-security-test.mjs` contra el despliegue real.
