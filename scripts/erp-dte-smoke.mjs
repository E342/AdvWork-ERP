#!/usr/bin/env node
/**
 * Pruebas de extremo a extremo del backend del ERP (navegador -> ERP -> Hacienda
 * simulado -> bitácora). Requiere el servidor en marcha.
 *
 * Uso:  node scripts/erp-dte-smoke.mjs                 (http://127.0.0.1:8080)
 *       BASE_URL=http://localhost:5173 node scripts/erp-dte-smoke.mjs
 * Ejecutar desde la raíz del repo (lee data/erp-transmisiones.json).
 * Tarda ~25 s: los escenarios de timeout esperan el umbral oficial de 5 s.
 */
import { readFile } from "node:fs/promises";

const ORIGEN = process.env.BASE_URL ?? "http://127.0.0.1:8080";
const ERP = `${ORIGEN}/api/erp/dte`;
const SIM = `${ORIGEN}/api/hacienda-sim`;
const USER = process.env.ERP_DTE_USER ?? process.env.HACIENDA_SIM_USER ?? "SIM-FACTURADOR-01";
const PWD = process.env.ERP_DTE_PWD ?? process.env.HACIENDA_SIM_PWD ?? "SIM-NO-REAL-Pwd#2026";
const NIT = "06140000000001";
const ZONA = (() => Date.now() % 100000)();

let seq = 0;
const nuevaFactura = () => {
  seq += 1;
  return {
    id: `FAC-E${ZONA}-${seq}`,
    folio: String(ZONA * 100 + seq),
    serie: "DTE-01",
    pedidoId: `PED-E${seq}`,
    clienteId: 11002,
    fecha: "2026-11-05",
    estado: "Borrador",
    items: [
      { codigo: "BK-T79U-50", nombre: "Bicicleta T79U", cantidad: 1, precio: 100, descuento: 0 },
      { codigo: "GL-H102-L", nombre: "Guantes H102", cantidad: 2, precio: 50, descuento: 10 },
    ],
  };
};
const CLIENTE = {
  id: 11002,
  nombre: "María Fernanda Rivas",
  documento: "04512398-7",
  direccion: "Col. Escalón, San Salvador",
  telefono: "78451203",
  correo: "mf.rivas@correo.com",
};

async function http(url, { metodo = "GET", cuerpo, headers = {}, crudo = false } = {}) {
  const r = await fetch(url, {
    method: metodo,
    headers: crudo ? headers : { "Content-Type": "application/json", ...headers },
    body: cuerpo === undefined ? undefined : crudo ? cuerpo : JSON.stringify(cuerpo),
  });
  const txt = await r.text();
  let json = null;
  try {
    json = JSON.parse(txt);
  } catch {
    /* no json */
  }
  return { status: r.status, json };
}
const transmitir = (factura, cliente = CLIENTE) =>
  http(`${ERP}/transmitir`, { metodo: "POST", cuerpo: { factura, cliente } });

let tokenSim = "";
async function autenticarSim() {
  const r = await fetch(`${SIM}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ user: USER, pwd: PWD }),
  });
  tokenSim = (await r.json())?.body?.token ?? "";
  if (!tokenSim)
    throw new Error(
      "No se pudo autenticar contra la API simulada (¿credenciales distintas? use node --env-file=.env)",
    );
}
const modo = (m) =>
  http(`${SIM}/control/escenario`, {
    metodo: "PUT",
    cuerpo: { modo: m },
    headers: { Authorization: tokenSim },
  });

const resultados = [];
function caso(id, nombre, r, esperado = {}, extra = () => true) {
  const j = r.json ?? {};
  const fallos = [];
  for (const [campo, valor] of Object.entries(esperado)) {
    const real = campo === "http" ? r.status : j[campo];
    if (real !== valor)
      fallos.push(`${campo}: ${JSON.stringify(real)} != ${JSON.stringify(valor)}`);
  }
  const adicional = extra(r);
  if (adicional !== true) fallos.push(adicional || "verificación adicional falló");
  const ok = fallos.length === 0;
  resultados.push({ id, ok });
  const ev = `HTTP ${r.status}${typeof j.resultado === "string" ? ` ${j.resultado}` : ""}${j.facturaEstado ? ` -> ${j.facturaEstado}` : ""}${j.envios !== undefined ? ` envíos=${j.envios} consultas=${j.consultas}` : ""}${j.codigoMsg ? ` cod=${j.codigoMsg}` : ""}${j.error ? ` ${j.error}` : ""}`;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${id}  ${nombre}\n        ${ev}${ok ? "" : `\n        >> ${fallos.join("; ")}`}`,
  );
}

console.log(`\nBackend ERP: ${ERP}\n`);
await autenticarSim();
await modo("normal");

try {
  // --- Flujo feliz ------------------------------------------------------------
  const f1 = nuevaFactura();
  let r = await transmitir(f1);
  const a = r.json ?? {};
  caso(
    "E01",
    "Factura válida -> emitida con sello",
    r,
    {
      http: 200,
      ok: true,
      resultado: "aceptado",
      facturaEstado: "Emitida",
      envios: 1,
      consultas: 0,
      yaEmitida: false,
    },
    (x) =>
      (/^[A-Z0-9]{40}$/.test(x.json.selloRecibido) &&
        /^[0-9A-F-]{36}$/.test(x.json.codigoGeneracion) &&
        /^DTE-01-M001P001-\d{15}$/.test(x.json.numeroControl) &&
        x.json.totales.totalPagar === 214.7) ||
      "sello/codigo/numeroControl/total",
  );

  r = await http(`${ERP}/transmisiones?facturaId=${f1.id}`);
  caso(
    "E02",
    "Bitácora: la transmisión quedó registrada",
    r,
    { http: 200, total: 1 },
    (x) =>
      (x.json.transmisiones[0].resultado === "aceptado" &&
        x.json.transmisiones[0].selloRecibido === a.selloRecibido) ||
      "no coincide con la respuesta",
  );
  const detalle = await http(`${ERP}/transmisiones/${a.transmisionId}`);
  caso(
    "E03",
    "Detalle: incluye el DTE enviado y el intento",
    detalle,
    { http: 200, estadoProceso: "finalizada" },
    (x) =>
      (x.json.dte.identificacion.codigoGeneracion === a.codigoGeneracion &&
        x.json.intentos.length === 1 &&
        x.json.intentos[0].httpStatus === 200) ||
      "DTE o intentos incorrectos",
  );

  r = await transmitir(f1);
  caso(
    "E04",
    "Reenviar una factura ya emitida NO vuelve a enviar",
    r,
    {
      http: 200,
      ok: true,
      yaEmitida: true,
      envios: 0,
      consultas: 0,
      transmisionId: a.transmisionId,
    },
    (x) => x.json.selloRecibido === a.selloRecibido || "el sello cambió",
  );
  r = await http(`${ERP}/transmisiones?facturaId=${f1.id}`);
  caso("E05", "...y no se creó una transmisión nueva", r, { http: 200, total: 1 });

  // Coherencia entre la bitácora del ERP y lo que Hacienda registró.
  r = await http(`${SIM}/fesv/recepcion/consultadte`, {
    metodo: "POST",
    headers: { Authorization: tokenSim },
    cuerpo: { nitEmisor: NIT, tdte: "01", codigoGeneracion: a.codigoGeneracion },
  });
  caso(
    "E06",
    "Hacienda simulado tiene el mismo documento y sello que el ERP",
    r,
    { http: 200, codigoMsg: "001" },
    (x) => x.json.selloRecibido === a.selloRecibido || "sellos distintos",
  );

  // --- Rechazo y corrección ------------------------------------------------------
  const f2 = nuevaFactura();
  r = await transmitir(f2, { ...CLIENTE, documento: "123" });
  const mala = r.json ?? {};
  caso("E07", "Documento de cliente corto -> rechazada (sin reintentos)", r, {
    http: 422,
    ok: false,
    resultado: "rechazado",
    facturaEstado: "Rechazada",
    codigoMsg: "003",
    clasificaMsg: "13",
    envios: 1,
    consultas: 0,
  });
  r = await transmitir(f2, CLIENTE);
  caso(
    "E08",
    "Corregido el dato -> emitida con el MISMO codigoGeneracion",
    r,
    { http: 200, ok: true, facturaEstado: "Emitida" },
    (x) => x.json.codigoGeneracion === mala.codigoGeneracion || "cambió el codigoGeneracion",
  );
  r = await http(`${ERP}/transmisiones?facturaId=${f2.id}`);
  caso("E09", "Historial conserva el rechazo y la corrección (2 transmisiones)", r, {
    http: 200,
    total: 2,
  });

  // --- Validación de la solicitud ------------------------------------------------------
  r = await transmitir({ ...nuevaFactura(), items: [] });
  caso(
    "E10",
    "Factura sin ítems -> 400 con detalle",
    r,
    { http: 400, error: "solicitud_invalida" },
    (x) => x.json.detalles.length > 0 || "sin detalles",
  );
  r = await transmitir({ ...nuevaFactura(), folio: "ABC" });
  caso("E11", "Folio no numérico -> 400", r, { http: 400, error: "solicitud_invalida" });
  r = await http(`${ERP}/transmitir`, {
    metodo: "POST",
    crudo: true,
    headers: { "Content-Type": "application/json" },
    cuerpo: "{no es json",
  });
  caso("E12", "JSON mal formado -> 400", r, { http: 400, error: "cuerpo_invalido" });
  r = await transmitir(nuevaFactura(), { documento: "04512398-7" });
  caso("E13", "Cliente sin nombre -> 400", r, { http: 400, error: "solicitud_invalida" });

  // --- Consulta -------------------------------------------------------------------------------
  r = await http(`${ERP}/consultar`, { metodo: "POST", cuerpo: { facturaId: f1.id } });
  caso(
    "E14",
    "Consultar estado de una factura emitida",
    r,
    { http: 200, encontrado: true, estado: "PROCESADO", conciliada: false },
    (x) => x.json.selloRecibido === a.selloRecibido || "sello distinto",
  );
  r = await http(`${ERP}/consultar`, { metodo: "POST", cuerpo: { facturaId: "NO-EXISTE" } });
  caso("E15", "Consultar una factura desconocida -> 404", r, { http: 404 });
  r = await http(`${ERP}/consultar`, { metodo: "POST", cuerpo: {} });
  caso("E16", "Consultar sin identificador -> 400", r, { http: 400 });
  r = await http(`${ERP}/transmisiones/TRX-9999`);
  caso("E17", "Detalle de transmisión inexistente -> 404", r, { http: 404 });

  // --- Escenarios de falla ------------------------------------------------------------------
  await modo("indisponible");
  const f3 = nuevaFactura();
  r = await transmitir(f3);
  const caida = r.json ?? {};
  caso("E18", "Servicio caído (503): 3 envíos + 3 consultas -> pendiente de envío", r, {
    http: 502,
    ok: false,
    resultado: "servicio_no_disponible",
    facturaEstado: "Pendiente de envío",
    envios: 3,
    consultas: 3,
  });
  await modo("normal");
  r = await transmitir(f3);
  caso(
    "E19",
    "Restablecido el servicio, reintentar la misma factura -> emitida",
    r,
    { http: 200, ok: true, facturaEstado: "Emitida", envios: 1 },
    (x) => x.json.codigoGeneracion === caida.codigoGeneracion || "cambió el codigoGeneracion",
  );

  await modo("error_interno");
  r = await transmitir(nuevaFactura());
  caso("E20", "Error interno (500): se reintenta y queda pendiente", r, {
    http: 502,
    resultado: "error_servicio",
    facturaEstado: "Pendiente de envío",
    envios: 3,
  });

  console.log("\n   (los dos casos siguientes esperan el umbral oficial de 5 s por intento)\n");
  await modo("timeout_procesado");
  const f4 = nuevaFactura();
  r = await transmitir(f4);
  caso(
    "E21",
    "Hacienda lo recibió pero respondió tarde: se recupera por consulta SIN reenviar",
    r,
    {
      http: 200,
      ok: true,
      resultado: "aceptado",
      facturaEstado: "Emitida",
      envios: 1,
      consultas: 1,
      recuperadoPorConsulta: true,
    },
  );
  await modo("normal");
  r = await transmitir(f4);
  caso("E22", "...y volver a emitirla no genera un duplicado", r, {
    http: 200,
    yaEmitida: true,
    envios: 0,
  });

  await modo("timeout");
  const f5 = nuevaFactura();
  r = await transmitir(f5);
  caso("E23", "Sin respuesta (timeout): 3 envíos, 3 consultas -> pendiente", r, {
    http: 504,
    ok: false,
    resultado: "sin_respuesta",
    facturaEstado: "Pendiente de envío",
    envios: 3,
    consultas: 3,
  });
  await modo("normal");
  r = await http(`${ERP}/consultar`, { metodo: "POST", cuerpo: { facturaId: f5.id } });
  caso("E24", "Consulta manual: Hacienda no tiene ese documento", r, {
    http: 200,
    encontrado: false,
  });

  // --- Doble clic: solicitudes simultáneas para la MISMA factura ---------------------
  const fdc = nuevaFactura();
  const simultaneas = await Promise.all(Array.from({ length: 5 }, () => transmitir(fdc)));
  const lista = await http(`${ERP}/transmisiones?facturaId=${fdc.id}`);
  caso(
    "E25",
    "Doble clic (5 solicitudes simultáneas): UNA sola emisión, un solo sello",
    { status: 200, json: lista.json },
    { total: 1 },
    () =>
      (simultaneas.every((x) => x.status === 200 && x.json.ok) &&
        new Set(simultaneas.map((x) => x.json.selloRecibido)).size === 1 &&
        new Set(simultaneas.map((x) => x.json.codigoGeneracion)).size === 1 &&
        simultaneas.filter((x) => x.json.compartida).length === 4) ||
      `sellos=${new Set(simultaneas.map((x) => x.json.selloRecibido)).size} codigos=${new Set(simultaneas.map((x) => x.json.codigoGeneracion)).size}`,
  );

  // --- Persistencia ---------------------------------------------------------------------------
  try {
    const bit = JSON.parse(await readFile("data/erp-transmisiones.json", "utf8"));
    const ok =
      bit.contador === bit.transmisiones.length &&
      bit.transmisiones.some((t) => t.id === a.transmisionId) &&
      bit.transmisiones.every((t) => t.estadoProceso === "finalizada");
    caso(
      "E26",
      "data/erp-transmisiones.json es consistente (contador, ids, todas finalizadas)",
      { status: 200, json: {} },
      {},
      () => ok || "contador/ids/estado inconsistentes",
    );
  } catch (e) {
    caso(
      "E26",
      "data/erp-transmisiones.json es consistente",
      { status: 0, json: {} },
      {},
      () => `no se pudo leer el archivo (¿se ejecutó desde la raíz del repo?): ${e.message}`,
    );
  }
} finally {
  await modo("normal").catch(() => {});
}

const fallidos = resultados.filter((x) => !x.ok);
console.log(
  `\nResumen: ${resultados.length - fallidos.length}/${resultados.length} casos exitosos${fallidos.length ? ` — FALLARON: ${fallidos.map((f) => f.id).join(", ")}` : ""}\n`,
);
process.exit(fallidos.length ? 1 : 0);
