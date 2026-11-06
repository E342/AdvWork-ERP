#!/usr/bin/env node
/**
 * Pruebas de humo de la API SIMULADA de Hacienda.
 * Uso:  node scripts/sim-smoke.mjs            (servidor en http://127.0.0.1:8080)
 *       BASE_URL=http://localhost:3000 node scripts/sim-smoke.mjs
 *
 * Firma DTE reales con la clave de PRUEBA y verifica cada resultado esperado.
 * Cada caso imprime PASS/FAIL con la evidencia (HTTP, código, clasificación).
 */
import { createHmac, randomUUID } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080") + "/api/hacienda-sim";
const USER = process.env.HACIENDA_SIM_USER ?? "SIM-FACTURADOR-01";
const PWD = process.env.HACIENDA_SIM_PWD ?? "SIM-NO-REAL-Pwd#2026";
const FIRMA = process.env.HACIENDA_SIM_FIRMA_SECRET ?? "dev-only-firma-secret-NOT-REAL";
const NIT = "06140000000001"; // NIT ficticio

const b64 = (x) => Buffer.from(x).toString("base64url");
const firmar = (obj, secret = FIRMA) => {
  const h = b64(JSON.stringify({ alg: "HS512", typ: "JWT" }));
  const p = b64(JSON.stringify(obj));
  return `${h}.${p}.${createHmac("sha512", secret).update(`${h}.${p}`).digest("base64url")}`;
};
const uuid = () => randomUUID().toUpperCase();
const clon = (o) => JSON.parse(JSON.stringify(o));

const hoySV = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador" }).format(new Date());

let correlativo = Date.now() % 1e9;
function dteValido() {
  const cg = uuid();
  correlativo += 1;
  return {
    identificacion: {
      version: 2,
      ambiente: "00",
      tipoDte: "01",
      numeroControl: `DTE-01-M001P001-${String(correlativo).padStart(15, "0")}`,
      codigoGeneracion: cg,
      tipoModelo: 1,
      tipoOperacion: 1,
      fecEmi: hoySV(),
      horEmi: "10:30:00",
      tipoMoneda: "USD",
      tipoContingencia: null,
      motivoContin: null,
    },
    documentoRelacionado: null,
    emisor: {
      nit: NIT,
      nrc: "1234567",
      nombre: "Adventure Works S.A. de C.V. (SIMULADO)",
      codActividad: "46900",
      descActividad: "Venta de bicicletas y accesorios (simulado)",
      nombreComercial: "AdvWork",
      telefono: "22000000",
      correo: "facturacion@advwork.example",
      codEstable: "M001",
      codPuntoVenta: "P001",
      direccion: {
        departamento: "06",
        municipio: "14",
        distrito: "01",
        complemento: "San Salvador",
      },
    },
    receptor: {
      tipoDocumento: "13",
      numDocumento: "04512398-7",
      nrc: null,
      nombre: "Maria Fernanda Rivas",
      codActividad: null,
      descActividad: null,
      telefono: "78451203",
      correo: "mf.rivas@correo.com",
      direccion: {
        departamento: "06",
        municipio: "14",
        distrito: "01",
        complemento: "Col. Escalon",
      },
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: [
      {
        numItem: 1,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: "BK-T79U-50",
        codTributo: null,
        descripcion: "Bicicleta de montana T79U 50",
        cantidad: 1,
        uniMedida: 59,
        precioUni: 113,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: 113,
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem: 13,
      },
      {
        numItem: 2,
        tipoItem: 1,
        numeroDocumento: null,
        codigo: "GL-H102-L",
        codTributo: null,
        descripcion: "Guantes H102 L",
        cantidad: 2,
        uniMedida: 59,
        precioUni: 56.5,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: 113,
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem: 13,
      },
    ],
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada: 226,
      subTotalVentas: 226,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: 0,
      porcentajeDescuento: 0,
      totalDescu: 0,
      tributos: null,
      subTotal: 226,
      ivaRete: 0,
      montoTotalOperacion: 226,
      totalNoGravado: 0,
      totalPagar: 226,
      totalLetras: "DOSCIENTOS VEINTISEIS 00/100 USD",
      totalIva: 26,
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: null,
      numPagoElectronico: null,
      observaciones: null,
    },
    apendice: null,
  };
}

const peticion = (dte, over = {}) => ({
  ambiente: "00",
  idEnvio: uuid(),
  version: 2,
  tipoDte: "01",
  codigoGeneracion: dte.identificacion?.codigoGeneracion,
  documento: firmar(dte),
  ...over,
});

let token = "";
async function http(
  ruta,
  { metodo = "POST", cuerpo, headers = {}, auth = true, crudo = false, abortMs } = {},
) {
  const ctl = new AbortController();
  const timer = abortMs ? setTimeout(() => ctl.abort(), abortMs) : null;
  try {
    const r = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(crudo ? {} : { "Content-Type": "application/json" }),
        ...(auth && token ? { Authorization: token } : {}),
        ...headers,
      },
      body: cuerpo === undefined ? undefined : crudo ? cuerpo : JSON.stringify(cuerpo),
      signal: ctl.signal,
    });
    const txt = await r.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      json = null;
    }
    return { status: r.status, json, txt, sim: r.headers.get("x-advwork-simulacion") };
  } catch (e) {
    return { status: 0, abortado: e.name === "AbortError", error: e.message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const enviar = (dte, over, opts) =>
  http("/fesv/recepciondte", { cuerpo: peticion(dte, over), ...opts });
const consultar = (cg) =>
  http("/fesv/recepcion/consultadte", {
    cuerpo: { nitEmisor: NIT, tdte: "01", codigoGeneracion: cg },
  });
const modo = (m) => http("/control/escenario", { metodo: "PUT", cuerpo: { modo: m } });

const resultados = [];
function caso(id, nombre, r, esperado, extra = () => true) {
  const j = r.json ?? {};
  const fallos = [];
  if (esperado.http !== undefined && r.status !== esperado.http)
    fallos.push(`HTTP ${r.status} != ${esperado.http}`);
  if (esperado.codigoMsg && j.codigoMsg !== esperado.codigoMsg)
    fallos.push(`codigoMsg ${j.codigoMsg} != ${esperado.codigoMsg}`);
  if (esperado.clasificaMsg && j.clasificaMsg !== esperado.clasificaMsg)
    fallos.push(`clasificaMsg ${j.clasificaMsg} != ${esperado.clasificaMsg}`);
  if (esperado.estado && j.estado !== esperado.estado)
    fallos.push(`estado ${j.estado} != ${esperado.estado}`);
  const adicional = extra(r);
  if (adicional !== true) fallos.push(adicional || "verificación adicional falló");
  const ok = fallos.length === 0;
  resultados.push({ id, ok });
  const evidencia = r.abortado
    ? "sin respuesta (abortado por el cliente)"
    : `HTTP ${r.status}${j.estado ? ` ${j.estado}` : ""}${j.codigoMsg ? ` cod=${j.codigoMsg}` : ""}${j.clasificaMsg ? ` cl=${j.clasificaMsg}` : ""}${j.descripcionMsg ? ` "${j.descripcionMsg}"` : j.message ? ` "${j.message}"` : ""}`;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${id}  ${nombre}\n        ${evidencia}${ok ? "" : `\n        >> ${fallos.join("; ")}`}`,
  );
}

// ---------------------------------------------------------------------------
console.log(`\nAPI simulada: ${BASE}\n`);
await modo("normal").catch(() => {});

// Auth
let r = await http("/auth", {
  auth: false,
  crudo: true,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  cuerpo: `user=${encodeURIComponent(USER)}&pwd=${encodeURIComponent(PWD)}`,
});
token = r.json?.body?.token ?? "";
caso(
  "T01",
  "Autenticación correcta devuelve 'Bearer <jwt>'",
  r,
  { http: 200 },
  (x) =>
    (x.json?.status === "OK" && token.startsWith("Bearer ey") && x.sim === "true") ||
    "token/status/cabecera simulada",
);
r = await http("/auth", {
  auth: false,
  crudo: true,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  cuerpo: `user=${USER}&pwd=incorrecta`,
});
caso(
  "T02",
  "Credenciales inválidas -> status ERROR (200, como la guía)",
  r,
  { http: 200 },
  (x) => x.json?.status === "ERROR" || "status != ERROR",
);
r = await enviar(dteValido(), {}, { auth: false });
caso("T03", "Recepción sin token -> 401", r, { http: 401 });

// DTE válido y duplicado
const d1 = dteValido();
r = await enviar(d1);
const sello1 = r.json?.selloRecibido;
caso(
  "T04",
  "DTE válido -> aceptado (PROCESADO / 001)",
  r,
  { http: 200, estado: "PROCESADO", codigoMsg: "001", clasificaMsg: "10" },
  (x) =>
    (/^[A-Z0-9]{40}$/.test(x.json.selloRecibido) &&
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(x.json.fhProcesamiento) &&
      x.json.codigoGeneracion === d1.identificacion.codigoGeneracion) ||
    "sello/fecha/codigoGeneracion con formato incorrecto",
);
r = await enviar(d1);
caso("T05", "Reenvío del mismo codigoGeneracion -> rechazo 004 (duplicado)", r, {
  http: 400,
  estado: "RECHAZADO",
  codigoMsg: "004",
  clasificaMsg: "11",
});
r = await consultar(d1.identificacion.codigoGeneracion);
caso(
  "T06",
  "Consulta de documento aceptado -> mismo sello",
  r,
  { http: 200, codigoMsg: "001" },
  (x) => x.json.selloRecibido === sello1 || "el sello no coincide",
);
r = await consultar(uuid());
caso("T07", "Consulta de documento inexistente -> 014", r, { http: 400, codigoMsg: "014" });

// Rechazos por datos
let d = dteValido();
delete d.emisor.nit;
r = await enviar(d);
caso(
  "T08",
  "Falta campo obligatorio emisor.nit -> 005 (clasif. 12)",
  r,
  { http: 400, codigoMsg: "005", clasificaMsg: "12" },
  (x) => x.json.descripcionMsg.includes("emisor.nit") || "no menciona emisor.nit",
);
d = dteValido();
d.identificacion.numeroControl = "XYZ";
r = await enviar(d);
caso("T09", "numeroControl con formato inválido -> 006 (clasif. 11)", r, {
  http: 400,
  codigoMsg: "006",
  clasificaMsg: "11",
});
d = dteValido();
d.resumen.totalPagar = 276;
r = await enviar(d);
caso("T10", "Datos inconsistentes (totalPagar) -> rechazo 020 (clasif. 16)", r, {
  http: 400,
  codigoMsg: "020",
  clasificaMsg: "16",
});
d = dteValido();
d.cuerpoDocumento[0].ivaItem = 20;
r = await enviar(d);
caso("T11", "IVA de línea incorrecto -> rechazo 020 (clasif. 15)", r, {
  http: 400,
  codigoMsg: "020",
  clasificaMsg: "15",
});
d = dteValido();
d.receptor.numDocumento = "1234";
r = await enviar(d);
caso("T12", "Documento del receptor corto -> 003 (clasif. 13)", r, {
  http: 400,
  codigoMsg: "003",
  clasificaMsg: "13",
});
d = dteValido();
d.identificacion.ambiente = "01";
r = await enviar(d);
caso("T13", "DTE con ambiente de producción '01' -> 007", r, { http: 400, codigoMsg: "007" });
d = dteValido();
d.emisor.codPuntoVenta = "P999";
r = await enviar(d);
caso("T14", "numeroControl no coincide con emisor -> 019", r, { http: 400, codigoMsg: "019" });
d = dteValido();
d.campoInventado = 1;
r = await enviar(d);
caso("T15", "Campo no definido en el esquema -> 007", r, { http: 400, codigoMsg: "007" });
d = dteValido();
r = await enviar(d, { codigoGeneracion: uuid() });
caso("T16", "codigoGeneracion de la petición != el del DTE -> 003", r, {
  http: 400,
  codigoMsg: "003",
});

// Aceptación con observaciones / tolerancia
d = dteValido();
d.resumen.totalIva = 26.06;
r = await enviar(d);
caso(
  "T17",
  "Diferencia de cálculo pequeña -> aceptado CON observaciones (002)",
  r,
  { http: 200, estado: "PROCESADO", codigoMsg: "002" },
  (x) => x.json.observaciones.some((o) => o.includes("resumen.totalIva")) || "falta la observación",
);
d = dteValido();
d.resumen.totalIva = 26.01;
r = await enviar(d);
caso(
  "T18",
  "Diferencia por redondeo (<=0.02) -> aceptado sin observaciones",
  r,
  { http: 200, codigoMsg: "001" },
  (x) => x.json.observaciones.length === 0 || "no debería tener observaciones",
);

// Firma y estructura
d = dteValido();
r = await enviar(d, { documento: firmar(d, "otra-clave-incorrecta") });
caso("T19", "Firma inválida (otra clave) -> 003 (clasif. 20)", r, {
  http: 400,
  codigoMsg: "003",
  clasificaMsg: "20",
});
d = dteValido();
r = await enviar(d, { documento: "esto-no-es-un-jws" });
caso("T20", "Documento no es un JWS -> 003 (clasif. 20)", r, {
  http: 400,
  codigoMsg: "003",
  clasificaMsg: "20",
});
r = await http("/fesv/recepciondte", { crudo: true, cuerpo: "{esto no es json" });
caso("T21", "Cuerpo con JSON mal formado -> 098", r, { http: 400, codigoMsg: "098" });
r = await http("/fesv/recepciondte", { crudo: true, cuerpo: "" });
caso("T22", "Cuerpo vacío -> 097", r, { http: 400, codigoMsg: "097" });
d = dteValido();
const pet = peticion(d);
delete pet.documento;
r = await http("/fesv/recepciondte", { cuerpo: pet });
caso("T23", "Petición sin 'documento' -> 096", r, { http: 400, codigoMsg: "096" });
d = dteValido();
r = await enviar(d, { ambiente: "01" });
caso("T24", "Petición con ambiente '01' -> 007 (clasif. 19)", r, {
  http: 400,
  codigoMsg: "007",
  clasificaMsg: "19",
});

// Escenarios de falla
r = await modo("indisponible");
d = dteValido();
const rI = await enviar(d);
const rIc = await consultar(d.identificacion.codigoGeneracion);
caso("T25", "Escenario 'indisponible' -> recepción 503", rI, { http: 503 });
caso("T26", "Escenario 'indisponible' -> consulta 503", rIc, { http: 503 });
await modo("error_interno");
r = await enviar(dteValido());
caso("T27", "Escenario 'error_interno' -> 500 con código 099", r, {
  http: 500,
  codigoMsg: "099",
  clasificaMsg: "99",
});
await modo("normal");
r = await enviar(dteValido(), {}, { headers: { "X-Sim-Escenario": "indisponible" } });
caso("T28", "Encabezado X-Sim-Escenario fuerza 503 solo en esa solicitud", r, { http: 503 });
r = await enviar(dteValido());
caso("T29", "Siguiente solicitud sin encabezado vuelve a la normalidad", r, {
  http: 200,
  codigoMsg: "001",
});
r = await modo("inexistente");
caso("T30", "Control rechaza un modo inválido -> 400", r, { http: 400 });

console.log(
  "\n   (los dos casos siguientes esperan 5 s cada uno: umbral de la política oficial)\n",
);
await modo("timeout");
d = dteValido();
r = await enviar(d, {}, { abortMs: 5000 });
await modo("normal");
const rT = await consultar(d.identificacion.codigoGeneracion);
caso(
  "T31",
  "Escenario 'timeout': el cliente expira a los 5 s",
  r,
  {},
  (x) => x.abortado || "debió expirar",
);
caso("T32", "  ...y el documento NO quedó registrado (consulta -> 014)", rT, {
  http: 400,
  codigoMsg: "014",
});
await modo("timeout_procesado");
d = dteValido();
r = await enviar(d, {}, { abortMs: 5000 });
await modo("normal");
const rP = await consultar(d.identificacion.codigoGeneracion);
caso(
  "T33",
  "Escenario 'timeout_procesado': el cliente expira a los 5 s",
  r,
  {},
  (x) => x.abortado || "debió expirar",
);
caso(
  "T34",
  "  ...pero Hacienda SÍ lo recibió (consulta -> 001): por eso se consulta antes de reintentar",
  rP,
  { http: 200, codigoMsg: "001" },
);

// Regresión: el esquema oficial usa multipleOf 1e-8 y con coma flotante Ajv rechazaba importes
// válidos con centavos (p. ej. 1234.56). Se verifica con importes "no redondos".
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
for (const [id, importe] of [
  ["T35", 1234.56],
  ["T36", 98765.43],
]) {
  d = dteValido();
  const iva = r2((importe / 1.13) * 0.13);
  d.cuerpoDocumento = [
    {
      ...d.cuerpoDocumento[0],
      cantidad: 1,
      precioUni: importe,
      ventaGravada: importe,
      ivaItem: iva,
    },
  ];
  Object.assign(d.resumen, {
    totalGravada: importe,
    subTotalVentas: importe,
    subTotal: importe,
    montoTotalOperacion: importe,
    totalPagar: importe,
    totalIva: iva,
  });
  r = await enviar(d);
  caso(id, `Importe con centavos (${importe}) -> aceptado (regresión multipleOf)`, r, {
    http: 200,
    codigoMsg: "001",
  });
}

const fallidos = resultados.filter((x) => !x.ok);
console.log(
  `\nResumen: ${resultados.length - fallidos.length}/${resultados.length} casos exitosos${fallidos.length ? ` — FALLARON: ${fallidos.map((f) => f.id).join(", ")}` : ""}\n`,
);
process.exit(fallidos.length ? 1 : 0);
