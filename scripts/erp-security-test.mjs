#!/usr/bin/env node
/**
 * Pruebas de SEGURIDAD de la API (backend del ERP + API simulada de Hacienda).
 * Requiere el servidor en marcha y ejecutarse desde la raíz del repo (toca data/).
 *
 * Uso:  node scripts/erp-security-test.mjs               (http://127.0.0.1:8080)
 *       BASE_URL=http://localhost:5173 node scripts/erp-security-test.mjs
 *
 * Cada caso es un ATAQUE o una mala entrada; "PASS" significa que el sistema se defendió.
 */
import { mkdir, rename, rm, stat } from "node:fs/promises";
import nodeHttp from "node:http";

const ORIGEN = process.env.BASE_URL ?? "http://127.0.0.1:8080";
const ERP = `${ORIGEN}/api/erp/dte`;
const SIM = `${ORIGEN}/api/hacienda-sim`;
const USER = process.env.ERP_DTE_USER ?? process.env.HACIENDA_SIM_USER ?? "SIM-FACTURADOR-01";
const PWD = process.env.ERP_DTE_PWD ?? process.env.HACIENDA_SIM_PWD ?? "SIM-NO-REAL-Pwd#2026";
const MB = 1024 * 1024;

let seq = 0;
const ZONA = Date.now() % 100000;
const factura = (items) => {
  seq += 1;
  return {
    id: `FAC-S${ZONA}-${seq}`,
    folio: String(ZONA * 100 + seq),
    pedidoId: `PED-S${seq}`,
    items: items ?? [
      { codigo: "BK-1", nombre: "Bicicleta", cantidad: 1, precio: 100, descuento: 0 },
    ],
  };
};
const cliente = { nombre: "Cliente Prueba", documento: "04512398-7" };
const cuerpoValido = (f = factura()) => JSON.stringify({ factura: f, cliente });
const JSON_CT = { "Content-Type": "application/json" };

async function http(url, { metodo = "POST", headers = {}, cuerpo } = {}) {
  const r = await fetch(url, { method: metodo, headers, body: cuerpo });
  const txt = await r.text();
  let json = null;
  try {
    json = JSON.parse(txt);
  } catch {
    /* no json */
  }
  return { status: r.status, json, txt, headers: r.headers };
}

const resultados = [];
function caso(id, nombre, r, verificar) {
  const fallo = verificar(r);
  const ok = fallo === true;
  resultados.push({ id, ok });
  const ev = `HTTP ${r.status}${r.json?.error ? ` ${r.json.error}` : ""}${r.json?.resultado ? ` ${r.json.resultado}` : ""}`;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${id}  ${nombre}\n        ${ev}${ok ? "" : `\n        >> ${fallo}`}`,
  );
}
const es =
  (...estados) =>
  (r) =>
    estados.includes(r.status) || `se esperaba HTTP ${estados.join("/")}, llegó ${r.status}`;

async function tokenSim() {
  const r = await fetch(`${SIM}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ user: USER, pwd: PWD }),
  });
  return (await r.json())?.body?.token ?? "";
}

console.log(`\nSeguridad de la API: ${ORIGEN}\n`);
const token = await tokenSim();
if (!token)
  throw new Error(
    "No se pudo autenticar contra la API simulada (¿credenciales distintas? use node --env-file=.env)",
  );

// --- CSRF: el backend del ERP no tiene login, así que no debe aceptar peticiones de otros sitios ---
caso(
  "S01",
  "CSRF: cuerpo enviado como text/plain (formulario de otro sitio) -> 415",
  await http(`${ERP}/transmitir`, {
    headers: { "Content-Type": "text/plain" },
    cuerpo: cuerpoValido(),
  }),
  es(415),
);
caso(
  "S02",
  "CSRF: encabezado Origin de otro sitio -> 403",
  await http(`${ERP}/transmitir`, {
    headers: { ...JSON_CT, Origin: "http://evil.example" },
    cuerpo: cuerpoValido(),
  }),
  es(403),
);
caso(
  "S03",
  "CSRF: Sec-Fetch-Site: cross-site -> 403",
  await http(`${ERP}/transmitir`, {
    headers: { ...JSON_CT, "Sec-Fetch-Site": "cross-site" },
    cuerpo: cuerpoValido(),
  }),
  es(403),
);
caso(
  "S04",
  "CSRF también en 'consultar' (Origin de otro sitio) -> 403",
  await http(`${ERP}/consultar`, {
    headers: { ...JSON_CT, Origin: "http://evil.example" },
    cuerpo: JSON.stringify({ facturaId: "FAC-0155" }),
  }),
  es(403),
);
caso(
  "S05",
  "Uso legítimo: mismo origen -> permitido",
  await http(`${ERP}/transmitir`, {
    headers: { ...JSON_CT, Origin: ORIGEN, "Sec-Fetch-Site": "same-origin" },
    cuerpo: cuerpoValido(),
  }),
  es(200),
);
caso(
  "S06",
  "Uso legítimo: sin Origin (Postman/curl) -> permitido",
  await http(`${ERP}/transmitir`, { headers: JSON_CT, cuerpo: cuerpoValido() }),
  es(200),
);

// --- Tamaño de cuerpo (denegación de servicio por memoria) -----------------------------------------------------
const gigante = JSON.stringify({
  factura: factura([
    { codigo: "X", nombre: "A".repeat(12 * MB), cantidad: 1, precio: 1, descuento: 0 },
  ]),
  cliente,
});
caso(
  "S07",
  "Cuerpo de 12 MB al ERP -> 413 sin procesarlo",
  await http(`${ERP}/transmitir`, { headers: JSON_CT, cuerpo: gigante }),
  es(413),
);
caso(
  "S08",
  "Cuerpo de 12 MB a la recepción simulada -> 413",
  await http(`${SIM}/fesv/recepciondte`, {
    headers: { ...JSON_CT, Authorization: token },
    cuerpo: "x".repeat(12 * MB),
  }),
  es(413),
);

// --- Validación de entrada ----------------------------------------------------------------------------------------
{
  const r = await http(`${ERP}/transmitir`, {
    headers: JSON_CT,
    cuerpo: cuerpoValido(
      factura([
        { codigo: "X", nombre: "Producto", cantidad: 1_000_000, precio: 1_000_000, descuento: 0 },
      ]),
    ),
  });
  caso(
    "S09",
    "Importe que desborda el máximo soportado -> 400 (no un 500)",
    r,
    (x) =>
      (x.status === 400 && x.json?.error === "solicitud_invalida") ||
      `HTTP ${x.status}, error=${x.json?.error}`,
  );
}
caso(
  "S10",
  "Cabecera 'Sec-Fetch-Site: same-site' (otro subdominio) tampoco se acepta",
  await http(`${ERP}/transmitir`, {
    headers: { ...JSON_CT, "Sec-Fetch-Site": "same-site" },
    cuerpo: cuerpoValido(),
  }),
  es(403),
);

// --- Cabeceras de las respuestas (contienen tokens y datos personales) -------------------------------------------------
{
  const a = await http(`${SIM}/auth`, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cuerpo: new URLSearchParams({ user: USER, pwd: PWD }),
  });
  const b = await http(`${ERP}/transmisiones`, { metodo: "GET" });
  const revisar = (r) =>
    (r.headers.get("cache-control")?.includes("no-store") &&
      r.headers.get("x-content-type-options") === "nosniff") ||
    `cache-control=${r.headers.get("cache-control")} nosniff=${r.headers.get("x-content-type-options")}`;
  caso("S11", "La respuesta con el token (/auth) no se cachea y lleva nosniff", a, revisar);
  caso("S12", "El historial (datos personales) no se cachea y lleva nosniff", b, revisar);
}

// --- Control de acceso de la simulación -------------------------------------------------------------------------------------------------
caso(
  "S13",
  "Cambiar el escenario de la simulación sin token -> 401",
  await http(`${SIM}/control/escenario`, {
    metodo: "PUT",
    headers: JSON_CT,
    cuerpo: JSON.stringify({ modo: "indisponible" }),
  }),
  es(401),
);
caso(
  "S14",
  "Token manipulado (firma alterada) -> 401",
  await http(`${SIM}/fesv/recepciondte`, {
    headers: { ...JSON_CT, Authorization: token.slice(0, -4) + "AAAA" },
    cuerpo: "{}",
  }),
  es(401),
);
caso(
  "S15",
  "Token con algoritmo 'none' -> 401",
  await (async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const falso = `Bearer ${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "x", exp: 9999999999 })}.`;
    return http(`${SIM}/fesv/recepciondte`, {
      headers: { ...JSON_CT, Authorization: falso },
      cuerpo: "{}",
    });
  })(),
  es(401),
);

// --- Host falsificado (DNS rebinding / SSRF): el ERP no debe enviar credenciales a destinos arbitrarios ---
function conHost(
  hostFalso,
  { metodo = "POST", ruta = "/api/erp/dte/transmitir", conCuerpo = true } = {},
) {
  const cuerpo = conCuerpo ? cuerpoValido() : null;
  const u = new URL(ORIGEN);
  return new Promise((resolve) => {
    const cabeceras = {
      Host: hostFalso,
      Origin: `http://${hostFalso}`,
      "Sec-Fetch-Site": "same-origin",
    };
    if (cuerpo) Object.assign(cabeceras, JSON_CT, { "Content-Length": Buffer.byteLength(cuerpo) });
    const req = nodeHttp.request(
      { host: u.hostname, port: u.port, path: ruta, method: metodo, headers: cabeceras },
      (res) => {
        let txt = "";
        res.on("data", (d) => (txt += d));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(txt);
          } catch {
            /* no json */
          }
          resolve({ status: res.statusCode, json, txt, headers: new Headers() });
        });
      },
    );
    req.on("error", (e) =>
      resolve({ status: 0, json: null, txt: e.message, headers: new Headers() }),
    );
    req.end(cuerpo ?? undefined);
  });
}
caso(
  "S18",
  "Host de un dominio ajeno (DNS rebinding) -> rechazado (4xx)",
  await conHost("evil.example"),
  (r) => (r.status >= 400 && r.status < 500) || `HTTP ${r.status}`,
);
caso(
  "S19",
  "Host con una IP no local -> rechazado (host_no_permitido), sin enviar credenciales a esa IP",
  await conHost("192.168.1.50:8080"),
  (r) =>
    ([400, 403].includes(r.status) && r.json?.error === "host_no_permitido") ||
    `HTTP ${r.status} ${r.json?.error ?? ""}`,
);
caso(
  "S20",
  "LECTURA del historial (datos personales) con Host ajeno -> rechazada (el rebinding no puede leer)",
  await conHost("evil.example", {
    metodo: "GET",
    ruta: "/api/erp/dte/transmisiones",
    conCuerpo: false,
  }),
  (r) =>
    (r.status >= 400 && r.status < 500 && !/"transmisiones"/.test(r.txt)) ||
    `HTTP ${r.status}; ¿devolvió datos? ${/"transmisiones"/.test(r.txt)}`,
);
caso(
  "S21",
  "Host legítimo (el del propio servidor) sigue permitido",
  await conHost(new URL(ORIGEN).host),
  (r) => r.status === 200 || `HTTP ${r.status}`,
);

// --- Errores internos: no deben revelar rutas ni detalles del servidor ------------------------------------------------------------------
const FUGAS =
  /EISDIR|ENOENT|ENOTDIR|\/home\/|\\Users\\|node_modules|at .*\(.*:\d+:\d+\)|AdvWork-ERP\/data/;
async function conArchivoRoto(archivo, fn) {
  const roto = `${archivo}.respaldo`;
  try {
    await stat(archivo);
  } catch {
    return fn(false); // el archivo aún no existe: no se puede romper
  }
  await rename(archivo, roto);
  await mkdir(archivo); // un directorio donde se espera un archivo -> EISDIR al leer
  try {
    return await fn(true);
  } finally {
    await rm(archivo, { recursive: true, force: true });
    await rename(roto, archivo);
  }
}
await conArchivoRoto("data/erp-transmisiones.json", async (roto) => {
  const r = await http(`${ERP}/transmisiones`, { metodo: "GET" });
  caso("S16", "Error interno en el ERP: 500 genérico, sin rutas ni detalles", r, (x) =>
    !roto
      ? "no se pudo provocar el error (falta data/erp-transmisiones.json)"
      : (x.status === 500 && x.json?.error === "error_interno" && !FUGAS.test(x.txt)) ||
        `HTTP ${x.status}; fuga=${FUGAS.exec(x.txt)?.[0] ?? "no"}`,
  );
});
await conArchivoRoto("data/hacienda-sim.json", async (roto) => {
  const r = await http(`${SIM}/fesv/recepcion/consultadte`, {
    headers: { ...JSON_CT, Authorization: token },
    cuerpo: JSON.stringify({
      nitEmisor: "06140000000001",
      tdte: "01",
      codigoGeneracion: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    }),
  });
  caso("S17", "Error interno en la simulación: 500 JSON genérico, sin rutas ni detalles", r, (x) =>
    !roto
      ? "no se pudo provocar el error (falta data/hacienda-sim.json)"
      : (x.status === 500 && x.json?.status === "ERROR" && !FUGAS.test(x.txt)) ||
        `HTTP ${x.status}; fuga=${FUGAS.exec(x.txt)?.[0] ?? "no"}; cuerpo=${x.txt.slice(0, 90).replace(/\n/g, " ")}`,
  );
});

const fallidos = resultados.filter((x) => !x.ok);
console.log(
  `\nResumen: ${resultados.length - fallidos.length}/${resultados.length} defensas funcionaron${fallidos.length ? ` — FALLARON: ${fallidos.map((f) => f.id).join(", ")}` : ""}\n`,
);
process.exit(fallidos.length ? 1 : 0);
