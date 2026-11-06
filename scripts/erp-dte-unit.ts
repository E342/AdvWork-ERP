/**
 * Pruebas unitarias del lado ERP (sin servidor ni red: usan un Hacienda de pega).
 * Ejecutar:  npx tsx --test scripts/erp-dte-unit.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { signCompact } from "../src/backend/shared/hmac-jws";
import { validarEsquemaFactura } from "../src/backend/hacienda-sim/schema-validator";
import { aplicarReglas } from "../src/backend/hacienda-sim/reglas";
import { getSimConfig } from "../src/backend/hacienda-sim/config";
import { totalALetras } from "../src/backend/erp-dte/letras";
import {
  construirDte,
  type FacturaEntrada,
  type ClienteEntrada,
} from "../src/backend/erp-dte/dte-builder";
import { crearClienteHacienda, limpiarCacheTokens } from "../src/backend/erp-dte/hacienda-client";
import { getErpDteConfig, type ErpDteConfig } from "../src/backend/erp-dte/config";
import * as bitacora from "../src/backend/erp-dte/bitacora";
import { consultarEstado, transmitirFactura } from "../src/backend/erp-dte/transmitir";
import { validarUrlApi } from "../src/backend/erp-dte/config";
import { validarSolicitud } from "../src/backend/erp-dte/solicitud";
import { contexto, handleTransmitir } from "../src/backend/erp-dte/handlers";
import { simHabilitada } from "../src/backend/hacienda-sim/config";
import { mutarDb } from "../src/backend/hacienda-sim/store";
import {
  CuerpoDemasiadoGrande,
  esLoopback,
  hostPermitido,
  leerTextoLimitado,
  nombreDeHost,
  origenPermitido,
} from "../src/backend/shared/http-seguro";

// Los datos de bitácora de estas pruebas van a una carpeta temporal.
process.env["ERP_DTE_DATA_DIR"] = mkdtempSync(path.join(tmpdir(), "erp-dte-"));

// --- Utilidades -------------------------------------------------------------
type Paso = { status: number; body?: unknown } | "timeout" | "red";
const BASE = "http://hacienda.test/api/hacienda-sim";

const tokenValido = (): string =>
  `Bearer ${signCompact({ exp: Math.floor(Date.now() / 1000) + 3600 }, "x")}`;

const ACEPTADO = (extra: object = {}): Paso => ({
  status: 200,
  body: {
    estado: "PROCESADO",
    clasificaMsg: "10",
    codigoMsg: "001",
    descripcionMsg: "RECIBIDO",
    selloRecibido: "A".repeat(40),
    fhProcesamiento: "05/11/2026 10:00:00",
    observaciones: [],
    ...extra,
  },
});
const RECHAZO = (codigoMsg: string, clasificaMsg = "13"): Paso => ({
  status: 400,
  body: {
    estado: "RECHAZADO",
    clasificaMsg,
    codigoMsg,
    descripcionMsg: `[x] CODIGO ${codigoMsg}`,
    observaciones: ["detalle"],
  },
});
const CONSULTA_ENCONTRADA: Paso = ACEPTADO({
  descripcionMsg: "DTE RECIBIDO, VALIDADO Y PROCESADO",
});
const CONSULTA_NO_EXISTE: Paso = RECHAZO("014", "11");
const ERR = (status: number): Paso => ({ status, body: { status: "ERROR" } });

/** Hacienda de pega: cada ruta consume su guion; al agotarse repite el último paso. */
function fakeHacienda(guion: { auth?: Paso[]; envio?: Paso[]; consulta?: Paso[] }, retardoMs = 0) {
  const colas = {
    auth: [
      ...(guion.auth ?? [{ status: 200, body: { status: "OK", body: { token: tokenValido() } } }]),
    ],
    envio: [...(guion.envio ?? [ACEPTADO()])],
    consulta: [...(guion.consulta ?? [CONSULTA_NO_EXISTE])],
  };
  const llamadas = { auth: 0, envio: 0, consulta: 0 };

  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    const ruta = String(url).replace(BASE, "");
    const clave = ruta === "/auth" ? "auth" : ruta === "/fesv/recepciondte" ? "envio" : "consulta";
    llamadas[clave] += 1;
    const cola = colas[clave];
    const paso = cola.length > 1 ? cola.shift()! : cola[0]!;

    if (paso === "red") return Promise.reject(new TypeError("fetch failed"));
    if (paso === "timeout") {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    }
    return new Promise<Response>((resolver) =>
      setTimeout(
        () => resolver(new Response(JSON.stringify(paso.body ?? {}), { status: paso.status })),
        retardoMs,
      ),
    );
  }) as typeof fetch;

  return { fetchImpl, llamadas };
}

const cfgPrueba = (extra: Partial<ErpDteConfig> = {}): ErpDteConfig => ({
  ...getErpDteConfig(),
  timeoutMs: 40,
  maxReintentos: 2,
  ...extra,
});

let contador = 0;
const nuevaFactura = (): FacturaEntrada => {
  contador += 1;
  return {
    id: `FAC-T${contador}`,
    folio: String(1000 + contador),
    pedidoId: `PED-T${contador}`,
    items: [
      { codigo: "BK-T79U-50", nombre: "Bicicleta T79U", cantidad: 1, precio: 100, descuento: 0 },
      { codigo: "GL-H102-L", nombre: "Guantes", cantidad: 2, precio: 50, descuento: 10 },
    ],
  };
};
const CLIENTE: ClienteEntrada = {
  nombre: "María Fernanda Rivas",
  documento: "04512398-7",
  direccion: "Col. Escalón",
  telefono: "78451203",
  correo: "mf.rivas@correo.com",
};

const ejecutar = (
  guion: Parameters<typeof fakeHacienda>[0],
  cfg = cfgPrueba(),
  cliente = CLIENTE,
  retardoMs = 0,
) => {
  const hacienda = fakeHacienda(guion, retardoMs);
  limpiarCacheTokens();
  const factura = nuevaFactura();
  const correr = (f = factura, c = cliente) =>
    transmitirFactura(
      { factura: f, cliente: c },
      { baseUrl: BASE, cfg, fetchImpl: hacienda.fetchImpl },
    );
  return { hacienda, factura, correr };
};

// --- totalALetras -----------------------------------------------------------
test("totalALetras: casos representativos", () => {
  const casos: [number, string][] = [
    [0, "CERO 00/100 USD"],
    [0.5, "CERO 50/100 USD"],
    [1, "UNO 00/100 USD"],
    [21, "VEINTIUNO 00/100 USD"],
    [100, "CIEN 00/100 USD"],
    [101, "CIENTO UNO 00/100 USD"],
    [226, "DOSCIENTOS VEINTISEIS 00/100 USD"],
    [999.99, "NOVECIENTOS NOVENTA Y NUEVE 99/100 USD"],
    [1000, "MIL 00/100 USD"],
    [1001.5, "MIL UNO 50/100 USD"],
    [21000, "VEINTIUN MIL 00/100 USD"],
    [31000, "TREINTA Y UN MIL 00/100 USD"],
    [1_000_000, "UN MILLON 00/100 USD"],
    [2_000_000, "DOS MILLONES 00/100 USD"],
    [21_000_000, "VEINTIUN MILLONES 00/100 USD"],
    [1234.56, "MIL DOSCIENTOS TREINTA Y CUATRO 56/100 USD"],
  ];
  for (const [n, esperado] of casos) assert.equal(totalALetras(n), esperado, `n=${n}`);
  assert.throws(() => totalALetras(-1), RangeError);
});

// --- Constructor del DTE ----------------------------------------------------
test("construirDte: formato, totales y coherencia", () => {
  const f = nuevaFactura();
  const { dte, totales } = construirDte({
    factura: f,
    cliente: CLIENTE,
    codigoGeneracion: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
  });
  const id = dte["identificacion"] as Record<string, string>;
  assert.match(id["numeroControl"]!, /^DTE-01-M001P001-\d{15}$/);
  assert.equal(id["numeroControl"]!.length, 31);
  assert.match(id["fecEmi"]!, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(id["horEmi"]!, /^\d{2}:\d{2}:\d{2}$/);
  // 100*1.13 = 113 ; 2 * (50*1.13=56.5) = 113 - 10% = 101.70 ; total = 214.70
  assert.equal(totales.totalGravada, 214.7);
  assert.equal(totales.totalPagar, 214.7);
  assert.equal(totales.totalDescu, 11.3);
  assert.equal(totales.totalIva, 24.7);
  const r = dte["resumen"] as Record<string, unknown>;
  assert.equal(r["totalLetras"], totalALetras(214.7));
});

test("construirDte: receptor y apéndice", () => {
  const base = {
    factura: nuevaFactura(),
    codigoGeneracion: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
  };
  const tipo = (documento: string) =>
    (
      construirDte({ ...base, cliente: { ...CLIENTE, documento } }).dte["receptor"] as Record<
        string,
        unknown
      >
    )["tipoDocumento"];
  assert.equal(tipo("04512398-7"), "13"); // 9 dígitos
  assert.equal(tipo("0614-120589-102-3"), "36"); // 14 dígitos
  assert.equal(tipo("123"), "37");

  const corto = construirDte({
    ...base,
    cliente: { ...CLIENTE, telefono: "123", correo: "a@b" },
  }).dte;
  const rec = corto["receptor"] as Record<string, unknown>;
  assert.equal(rec["telefono"], null); // < 8 caracteres: el esquema lo exige o null
  assert.equal(rec["correo"], null); // < 6 caracteres
  const apendice = corto["apendice"] as { campo: string }[];
  assert.deepEqual(
    apendice.map((a) => a.campo),
    ["factura_erp", "pedido", "direccion"],
  );
});

test("construirDte: 300 facturas aleatorias nunca son rechazadas por el esquema ni por cálculo", () => {
  let semilla = 12345; // PRNG determinista (reproducible)
  const azar = () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const cfgSim = getSimConfig();
  const descuentos = [0, 0, 5, 10, 12.5, 15, 33.33, 50, 100];

  for (let i = 0; i < 300; i++) {
    const nItems = 1 + Math.floor(azar() * 12);
    const items = Array.from({ length: nItems }, (_, k) => ({
      codigo: `P-${k}`,
      nombre: `Producto ${k}`,
      cantidad: Math.round((1 + azar() * 20) * 2) / 2,
      precio: Math.round((0.5 + azar() * 2500) * 100) / 100,
      descuento: descuentos[Math.floor(azar() * descuentos.length)]!,
    }));
    const factura: FacturaEntrada = { id: `R${i}`, folio: String(1 + i), pedidoId: `P${i}`, items };
    const { dte } = construirDte({
      factura,
      cliente: CLIENTE,
      codigoGeneracion: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    });

    const esquema = validarEsquemaFactura(dte);
    assert.deepEqual(esquema, [], `esquema, caso ${i}: ${JSON.stringify(esquema)}`);
    const { errores, observaciones } = aplicarReglas(
      dte as never,
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      cfgSim,
    );
    assert.deepEqual(errores, [], `reglas, caso ${i}: ${JSON.stringify(errores)}`);
    assert.deepEqual(
      observaciones,
      [],
      `observaciones, caso ${i}: ${JSON.stringify(observaciones)}`,
    );
  }
});

// --- Cliente HTTP -----------------------------------------------------------
test("cliente: reutiliza el token (una sola autenticación para varios envíos)", async () => {
  const h = fakeHacienda({});
  limpiarCacheTokens();
  const c = crearClienteHacienda({ baseUrl: BASE, cfg: cfgPrueba(), fetchImpl: h.fetchImpl });
  await c.enviar({});
  await c.enviar({});
  await c.consultar({ nitEmisor: "1", tdte: "01", codigoGeneracion: "x" });
  assert.equal(h.llamadas.auth, 1);
  assert.equal(h.llamadas.envio, 2);
});

test("cliente: ante 401 renueva el token y repite una vez", async () => {
  const h = fakeHacienda({ envio: [{ status: 401, body: { status: "ERROR" } }, ACEPTADO()] });
  limpiarCacheTokens();
  const c = crearClienteHacienda({ baseUrl: BASE, cfg: cfgPrueba(), fetchImpl: h.fetchImpl });
  const r = await c.enviar({});
  assert.equal(r.tipo === "respuesta" && r.status, 200);
  assert.equal(h.llamadas.auth, 2);
  assert.equal(h.llamadas.envio, 2);
});

test("cliente: 401 persistente se devuelve tras un solo reintento", async () => {
  const h = fakeHacienda({ envio: [{ status: 401 }] });
  limpiarCacheTokens();
  const r = await crearClienteHacienda({
    baseUrl: BASE,
    cfg: cfgPrueba(),
    fetchImpl: h.fetchImpl,
  }).enviar({});
  assert.equal(r.tipo === "respuesta" && r.status, 401);
  assert.equal(h.llamadas.envio, 2); // no hay bucle infinito
});

test("cliente: clasifica credenciales inválidas, timeout y error de red", async () => {
  limpiarCacheTokens();
  let h = fakeHacienda({
    auth: [{ status: 200, body: { status: "ERROR", message: "Usuario no valido" } }],
  });
  let r = await crearClienteHacienda({
    baseUrl: BASE,
    cfg: cfgPrueba(),
    fetchImpl: h.fetchImpl,
  }).enviar({});
  assert.deepEqual(
    [r.tipo, r.tipo === "autenticacion" && r.mensaje],
    ["autenticacion", "Usuario no valido"],
  );

  limpiarCacheTokens();
  h = fakeHacienda({ envio: ["timeout"] });
  r = await crearClienteHacienda({
    baseUrl: BASE,
    cfg: cfgPrueba(),
    fetchImpl: h.fetchImpl,
  }).enviar({});
  assert.equal(r.tipo, "timeout");

  limpiarCacheTokens();
  h = fakeHacienda({ envio: ["red"] });
  r = await crearClienteHacienda({
    baseUrl: BASE,
    cfg: cfgPrueba(),
    fetchImpl: h.fetchImpl,
  }).enviar({});
  assert.equal(r.tipo, "red");
});

// --- Política de reintentos (transmitirFactura) ------------------------------
test("transmitir: aceptado al primer intento", async () => {
  const { hacienda, correr, factura } = ejecutar({});
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.facturaEstado, r.envios, r.consultas],
    [true, "aceptado", "Emitida", 1, 0],
  );
  assert.equal(r.selloRecibido, "A".repeat(40));
  assert.equal(hacienda.llamadas.envio, 1);
  const trx = (await bitacora.porFactura(factura.id))[0]!;
  assert.equal(trx.estadoProceso, "finalizada");
  assert.equal(trx.intentos.length, 1);
});

test("transmitir: aceptado con observaciones (002)", async () => {
  const { correr } = ejecutar({
    envio: [
      ACEPTADO({
        codigoMsg: "002",
        descripcionMsg: "RECIBIDO CON OBSERVACIONES",
        observaciones: ["[resumen.totalIva] CALCULO INCORRECTO"],
      }),
    ],
  });
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.facturaEstado],
    [true, "aceptado_con_observaciones", "Emitida"],
  );
  assert.equal(r.observaciones.length, 1);
});

test("transmitir: rechazo definitivo no se reintenta ni se consulta", async () => {
  const { hacienda, correr } = ejecutar({ envio: [RECHAZO("003")] });
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.facturaEstado, r.codigoMsg, r.envios, r.consultas],
    [false, "rechazado", "Rechazada", "003", 1, 0],
  );
  assert.equal(hacienda.llamadas.consulta, 0);
});

test("transmitir: servicio caído (503) -> 3 envíos, 3 consultas, pendiente", async () => {
  const { hacienda, correr } = ejecutar({ envio: [ERR(503)], consulta: [ERR(503)] });
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.facturaEstado, r.envios, r.consultas],
    [false, "servicio_no_disponible", "Pendiente de envío", 3, 3],
  );
  assert.equal(hacienda.llamadas.envio, 3); // 1 envío + 2 reintentos (máximo oficial)
});

test("transmitir: sin respuesta (timeout) agota los reintentos", async () => {
  const { correr } = ejecutar({ envio: ["timeout"] });
  const r = await correr();
  assert.deepEqual(
    [r.resultado, r.facturaEstado, r.envios],
    ["sin_respuesta", "Pendiente de envío", 3],
  );
});

test("transmitir: timeout pero Hacienda sí lo recibió -> se recupera por consulta, sin reenviar", async () => {
  const { hacienda, correr } = ejecutar({ envio: ["timeout"], consulta: [CONSULTA_ENCONTRADA] });
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.envios, r.consultas, r.recuperadoPorConsulta],
    [true, "aceptado", 1, 1, true],
  );
  assert.equal(hacienda.llamadas.envio, 1); // NO se duplicó el envío
  assert.match(r.mensaje, /recuper/); // el mensaje explica que se recuperó por consulta
});

test("transmitir: se recupera en el segundo reenvío tras dos 503", async () => {
  const { correr } = ejecutar({
    envio: [ERR(503), ERR(503), ACEPTADO()],
    consulta: [CONSULTA_NO_EXISTE],
  });
  const r = await correr();
  assert.deepEqual([r.ok, r.envios, r.consultas, r.recuperadoPorConsulta], [true, 3, 2, false]);
});

test("transmitir: error 500 se trata como falla de comunicación (se reintenta)", async () => {
  const { correr } = ejecutar({
    envio: [{ status: 500, body: { estado: "RECHAZADO", codigoMsg: "099" } }],
  });
  const r = await correr();
  assert.deepEqual([r.resultado, r.envios], ["error_servicio", 3]);
});

test("transmitir: duplicado (004) + consulta encontrada -> aceptado recuperado", async () => {
  const { correr } = ejecutar({ envio: [RECHAZO("004", "11")], consulta: [CONSULTA_ENCONTRADA] });
  const r = await correr();
  assert.deepEqual(
    [r.ok, r.resultado, r.recuperadoPorConsulta, r.envios, r.consultas],
    [true, "aceptado", true, 1, 1],
  );
});

test("transmitir: duplicado (004) pero la consulta no lo encuentra -> rechazado", async () => {
  const { correr } = ejecutar({ envio: [RECHAZO("004", "11")], consulta: [CONSULTA_NO_EXISTE] });
  const r = await correr();
  assert.deepEqual([r.ok, r.resultado, r.codigoMsg], [false, "rechazado", "004"]);
});

test("transmitir: credenciales inválidas -> error_autenticacion, sin enviar", async () => {
  const { hacienda, correr } = ejecutar({
    auth: [{ status: 200, body: { status: "ERROR", message: "Usuario no valido" } }],
  });
  const r = await correr();
  assert.deepEqual(
    [r.resultado, r.facturaEstado, r.envios],
    ["error_autenticacion", "Pendiente de envío", 1],
  );
  assert.equal(hacienda.llamadas.envio, 0);
});

test("transmitir: 401 persistente -> error_autenticacion sin reintentar envíos", async () => {
  const { r } = await (async () => {
    const e = ejecutar({ envio: [{ status: 401 }] });
    return { r: await e.correr() };
  })();
  assert.deepEqual([r.resultado, r.envios], ["error_autenticacion", 1]);
});

test("transmitir: respuesta inesperada (404) no se reintenta", async () => {
  const { hacienda, correr } = ejecutar({ envio: [{ status: 404 }] });
  const r = await correr();
  assert.deepEqual(
    [r.resultado, r.facturaEstado, r.envios],
    ["respuesta_inesperada", "Pendiente de envío", 1],
  );
  assert.equal(hacienda.llamadas.envio, 1);
});

test("transmitir: respeta ERP_DTE_MAX_REINTENTOS=0 (un solo envío)", async () => {
  const { hacienda, correr } = ejecutar({ envio: [ERR(503)] }, cfgPrueba({ maxReintentos: 0 }));
  const r = await correr();
  assert.deepEqual([r.envios, r.consultas], [1, 1]);
  assert.equal(hacienda.llamadas.envio, 1);
});

test("transmitir: factura ya emitida no se reenvía (devuelve lo registrado)", async () => {
  const { hacienda, correr } = ejecutar({});
  const primera = await correr();
  const segunda = await correr();
  assert.equal(segunda.yaEmitida, true);
  assert.deepEqual([segunda.envios, segunda.consultas], [0, 0]);
  assert.equal(segunda.selloRecibido, primera.selloRecibido);
  assert.equal(segunda.transmisionId, primera.transmisionId);
  assert.equal(hacienda.llamadas.envio, 1); // Hacienda recibió UNA sola llamada de envío
});

test("transmitir: tras un rechazo, la corrección conserva el codigoGeneracion", async () => {
  const { correr, factura } = ejecutar({ envio: [RECHAZO("003"), ACEPTADO()] });
  const mala = await correr(factura, { ...CLIENTE, documento: "123" });
  const corregida = await correr(factura, CLIENTE);
  assert.equal(mala.resultado, "rechazado");
  assert.equal(corregida.ok, true);
  assert.equal(corregida.codigoGeneracion, mala.codigoGeneracion);
  assert.notEqual(corregida.transmisionId, mala.transmisionId);
});

test("transmitir: el DTE firmado enviado trae firma verificable y esquema válido", async () => {
  let enviado: { documento?: string } | null = null;
  const base = fakeHacienda({});
  const fetchImpl = ((url: string | URL, init?: RequestInit) => {
    if (String(url).endsWith("/fesv/recepciondte")) enviado = JSON.parse(String(init?.body));
    return base.fetchImpl(url, init);
  }) as typeof fetch;
  limpiarCacheTokens();
  const f = nuevaFactura();
  await transmitirFactura(
    { factura: f, cliente: CLIENTE },
    { baseUrl: BASE, cfg: cfgPrueba(), fetchImpl },
  );
  assert.ok(enviado, "no se envió nada");
  const { verifyCompact } = await import("../src/backend/shared/hmac-jws");
  const v = verifyCompact<Record<string, unknown>>(
    (enviado as { documento: string }).documento,
    getErpDteConfig().firmaSecret,
  );
  assert.equal(v.ok, true);
  if (v.ok) assert.deepEqual(validarEsquemaFactura(v.payload), []);
});

// --- Consulta y conciliación -------------------------------------------------
test("consultarEstado: concilia una factura que quedó pendiente pero Hacienda sí recibió", async () => {
  const { correr, factura } = ejecutar({ envio: [ERR(503)], consulta: [CONSULTA_NO_EXISTE] });
  const pendiente = await correr();
  assert.equal(pendiente.facturaEstado, "Pendiente de envío");

  const h2 = fakeHacienda({ consulta: [CONSULTA_ENCONTRADA] });
  limpiarCacheTokens();
  const c = await consultarEstado(
    { facturaId: factura.id },
    { baseUrl: BASE, cfg: cfgPrueba(), fetchImpl: h2.fetchImpl },
  );
  assert.ok(c.ok && c.encontrado && c.conciliada);

  const todas = await bitacora.porFactura(factura.id);
  assert.equal(todas.at(-1)!.origen, "consulta_manual");
  // Después de conciliar, un nuevo "enviar" no reenvía.
  const h3 = fakeHacienda({});
  limpiarCacheTokens();
  const otra = await transmitirFactura(
    { factura, cliente: CLIENTE },
    { baseUrl: BASE, cfg: cfgPrueba(), fetchImpl: h3.fetchImpl },
  );
  assert.equal(otra.yaEmitida, true);
  assert.equal(h3.llamadas.envio, 0);
});

test("consultarEstado: factura desconocida y documento inexistente", async () => {
  const h = fakeHacienda({ consulta: [CONSULTA_NO_EXISTE] });
  limpiarCacheTokens();
  const ctx = { baseUrl: BASE, cfg: cfgPrueba(), fetchImpl: h.fetchImpl };
  const desconocida = await consultarEstado({ facturaId: "NO-EXISTE" }, ctx);
  assert.deepEqual([desconocida.ok, !desconocida.ok && desconocida.motivo], [false, "desconocida"]);

  const { correr, factura } = ejecutar({ envio: [ERR(503)] });
  await correr();
  const r = await consultarEstado({ facturaId: factura.id }, ctx);
  assert.ok(r.ok && !r.encontrado && !r.conciliada);
});

// --- Concurrencia (doble clic) ------------------------------------------------
test("transmitir: 5 solicitudes simultáneas de la misma factura se unen a UNA sola emisión", async () => {
  const { hacienda, correr, factura } = ejecutar({}, cfgPrueba({ timeoutMs: 500 }), CLIENTE, 30);
  const rs = await Promise.all(Array.from({ length: 5 }, () => correr()));

  assert.equal(hacienda.llamadas.envio, 1, "Hacienda debe recibir UN solo envío");
  assert.equal(new Set(rs.map((r) => r.transmisionId)).size, 1);
  assert.equal(new Set(rs.map((r) => r.codigoGeneracion)).size, 1);
  assert.equal(new Set(rs.map((r) => r.selloRecibido)).size, 1);
  assert.ok(rs.every((r) => r.ok));
  assert.equal(rs.filter((r) => r.compartida).length, 4); // 1 emite, 4 se unen
  assert.equal((await bitacora.porFactura(factura.id)).length, 1);

  // Terminada la emisión, la siguiente solicitud ya no se "une": ve la factura emitida.
  const despues = await correr();
  assert.deepEqual([despues.yaEmitida, despues.compartida, despues.envios], [true, false, 0]);
});

test("transmitir: facturas distintas simultáneas no se bloquean entre sí", async () => {
  const hacienda = fakeHacienda({}, 30);
  limpiarCacheTokens();
  const ctx = { baseUrl: BASE, cfg: cfgPrueba({ timeoutMs: 500 }), fetchImpl: hacienda.fetchImpl };
  const [a, b] = await Promise.all([
    transmitirFactura({ factura: nuevaFactura(), cliente: CLIENTE }, ctx),
    transmitirFactura({ factura: nuevaFactura(), cliente: CLIENTE }, ctx),
  ]);
  assert.equal(hacienda.llamadas.envio, 2);
  assert.deepEqual([a.compartida, b.compartida], [false, false]);
  assert.notEqual(a.codigoGeneracion, b.codigoGeneracion);
});

test("transmitir: si la emisión en curso falla, quienes se unieron reciben el mismo fallo y luego se puede reintentar", async () => {
  const { correr, hacienda } = ejecutar(
    { envio: [ERR(503), ACEPTADO()], consulta: [CONSULTA_NO_EXISTE] },
    cfgPrueba({ maxReintentos: 0, timeoutMs: 500 }),
    CLIENTE,
    20,
  );
  const rs = await Promise.all([correr(), correr(), correr()]);
  assert.ok(rs.every((r) => r.resultado === "servicio_no_disponible"));
  assert.equal(hacienda.llamadas.envio, 1);
  const reintento = await correr(); // la marca "en curso" se liberó
  assert.deepEqual([reintento.ok, reintento.compartida], [true, false]);
});

test("consultarEstado: dos consultas simultáneas concilian UNA sola vez", async () => {
  const { correr, factura } = ejecutar({ envio: [ERR(503)], consulta: [CONSULTA_NO_EXISTE] });
  await correr(); // queda pendiente

  const h2 = fakeHacienda({ consulta: [CONSULTA_ENCONTRADA] }, 25);
  limpiarCacheTokens();
  const ctx = { baseUrl: BASE, cfg: cfgPrueba({ timeoutMs: 500 }), fetchImpl: h2.fetchImpl };
  const rs = await Promise.all([
    consultarEstado({ facturaId: factura.id }, ctx),
    consultarEstado({ facturaId: factura.id }, ctx),
    consultarEstado({ facturaId: factura.id }, ctx),
  ]);
  assert.equal(rs.filter((r) => r.ok && r.conciliada).length, 1);
  const manuales = (await bitacora.porFactura(factura.id)).filter(
    (t) => t.origen === "consulta_manual",
  );
  assert.equal(manuales.length, 1);
});

// --- Seguridad ------------------------------------------------------------------
/** Ejecuta `fn` con variables de entorno temporales y las restaura siempre. */
async function conEntorno<T>(
  vars: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const previo: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) previo[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(previo)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("seguridad: la URL de la API debe ser HTTPS (http solo en localhost)", () => {
  for (const ok of [
    "https://api.hacienda.example/fesv",
    "https://x.example/",
    "http://localhost:8080/api/hacienda-sim",
    "http://127.0.0.1:3000/x",
    "http://[::1]:8080/x",
  ]) {
    assert.doesNotThrow(() => validarUrlApi(ok), ok);
  }
  for (const mal of [
    "http://api.hacienda.example/fesv",
    "http://192.168.1.50:8080/x",
    "ftp://x.example",
    "no-es-url",
    "",
  ]) {
    assert.throws(() => validarUrlApi(mal), Error, mal);
  }
  assert.equal(validarUrlApi("https://x.example/a///"), "https://x.example/a"); // normaliza barras finales
});

test("seguridad: en producción faltan variables -> el ERP y la simulación se niegan a arrancar", async () => {
  await conEntorno(
    {
      NODE_ENV: "production",
      ERP_DTE_USER: undefined,
      ERP_DTE_PWD: undefined,
      ERP_DTE_FIRMA_SECRET: undefined,
      ERP_DTE_API_URL: undefined,
    },
    () => {
      assert.throws(() => getErpDteConfig(), /ERP_DTE_API_URL|ERP_DTE_USER/);
    },
  );
  // Con todo definido pero la URL en http:// (no local) tampoco arranca.
  await conEntorno(
    {
      NODE_ENV: "production",
      ERP_DTE_USER: "u",
      ERP_DTE_PWD: "p",
      ERP_DTE_FIRMA_SECRET: "f",
      ERP_DTE_API_URL: "http://api.hacienda.example",
    },
    () => {
      assert.throws(() => getErpDteConfig(), /https/);
    },
  );
  await conEntorno(
    {
      NODE_ENV: "production",
      ERP_DTE_USER: "u",
      ERP_DTE_PWD: "p",
      ERP_DTE_FIRMA_SECRET: "f",
      ERP_DTE_API_URL: "https://api.hacienda.example/",
    },
    () => {
      const c = getErpDteConfig();
      assert.equal(c.apiUrl, "https://api.hacienda.example");
    },
  );
  // Las claves por defecto de desarrollo NO se aceptan en producción.
  await conEntorno(
    {
      NODE_ENV: "production",
      HACIENDA_SIM_USER: undefined,
      HACIENDA_SIM_PWD: undefined,
      HACIENDA_SIM_JWT_SECRET: undefined,
      HACIENDA_SIM_FIRMA_SECRET: undefined,
    },
    () => {
      assert.throws(() => getSimConfig(), /HACIENDA_SIM_/);
    },
  );
});

test("seguridad: la simulación solo está habilitada fuera de producción (o si se fuerza)", async () => {
  const casos: [Record<string, string | undefined>, boolean][] = [
    [{ NODE_ENV: undefined, HACIENDA_SIM_ENABLED: undefined }, true],
    [{ NODE_ENV: "development", HACIENDA_SIM_ENABLED: undefined }, true],
    [{ NODE_ENV: "production", HACIENDA_SIM_ENABLED: undefined }, false],
    [{ NODE_ENV: "production", HACIENDA_SIM_ENABLED: "true" }, true],
    [{ NODE_ENV: "production", HACIENDA_SIM_ENABLED: "TRUE" }, true],
    [{ NODE_ENV: "development", HACIENDA_SIM_ENABLED: "false" }, false],
    [{ NODE_ENV: "production", HACIENDA_SIM_ENABLED: "cualquier-cosa" }, false],
  ];
  for (const [vars, esperado] of casos) {
    await conEntorno(vars, () => assert.equal(simHabilitada(), esperado, JSON.stringify(vars)));
  }
});

test("seguridad: origenPermitido (anti-CSRF)", () => {
  const peticion = (h: Record<string, string>) =>
    new Request("http://127.0.0.1:8080/api/erp/dte/transmitir", { method: "POST", headers: h });
  const casos: [string, Record<string, string>, boolean, string[]?][] = [
    ["sin cabeceras (Postman/curl)", {}, true],
    ["Sec-Fetch-Site same-origin", { "Sec-Fetch-Site": "same-origin" }, true],
    ["Sec-Fetch-Site none", { "Sec-Fetch-Site": "none" }, true],
    ["Sec-Fetch-Site same-site", { "Sec-Fetch-Site": "same-site" }, false],
    ["Sec-Fetch-Site cross-site", { "Sec-Fetch-Site": "cross-site" }, false],
    ["Origin igual al del servidor", { Origin: "http://127.0.0.1:8080" }, true],
    ["Origin de otro sitio", { Origin: "http://evil.example" }, false],
    ["Origin: null", { Origin: "null" }, false],
    [
      "Origin extra permitido",
      { Origin: "https://erp.midominio.com" },
      true,
      ["https://erp.midominio.com"],
    ],
    [
      "Sec-Fetch-Site manda sobre un Origin que coincidiría",
      { "Sec-Fetch-Site": "cross-site", Origin: "http://127.0.0.1:8080" },
      false,
    ],
  ];
  for (const [nombre, cab, esperado, extras] of casos) {
    assert.equal(origenPermitido(peticion(cab), extras ?? []), esperado, nombre);
  }
});

test("seguridad: esLoopback", () => {
  for (const h of ["localhost", "127.0.0.1", "[::1]", "LOCALHOST"])
    assert.equal(esLoopback(h), true, h);
  for (const h of [
    "evil.example",
    "192.168.1.50",
    "127.0.0.1.evil.example",
    "localhost.evil.example",
    "10.0.0.1",
  ])
    assert.equal(esLoopback(h), false, h);
});

test("seguridad: contexto() no deduce la URL de Hacienda desde un Host no local (anti-SSRF)", async () => {
  await conEntorno({ ERP_DTE_API_URL: undefined, NODE_ENV: undefined }, () => {
    const local = contexto(new Request("http://127.0.0.1:8080/x"));
    assert.ok(local.ok && local.baseUrl === "http://127.0.0.1:8080/api/hacienda-sim");
    for (const host of [
      "evil.example",
      "192.168.1.50:8080",
      "localhost.evil.example",
      "10.0.0.5",
    ]) {
      const r = contexto(new Request(`http://${host}/x`));
      assert.equal(r.ok, false, host);
      assert.equal(!r.ok && r.respuesta.status, 400, host);
    }
  });
  // Con ERP_DTE_API_URL configurada, el Host de la petición es irrelevante.
  await conEntorno({ ERP_DTE_API_URL: "https://api.hacienda.example/fesv" }, () => {
    const r = contexto(new Request("http://evil.example/x"));
    assert.ok(r.ok && r.baseUrl === "https://api.hacienda.example/fesv");
  });
});

test("seguridad: con Host falsificado el handler responde 403 y NO realiza ninguna llamada de red", async () => {
  const original = globalThis.fetch;
  let llamadas = 0;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    llamadas += 1;
    return original(...args);
  }) as typeof fetch;
  const cuerpo = JSON.stringify({
    factura: {
      id: "FAC-SSRF",
      folio: "1",
      pedidoId: "P",
      items: [{ codigo: "X", nombre: "N", cantidad: 1, precio: 10, descuento: 0 }],
    },
    cliente: { nombre: "A", documento: "04512398-7" },
  });
  try {
    for (const apiUrl of [undefined, "https://api.hacienda.example/fesv"]) {
      // Con o sin ERP_DTE_API_URL fijada, un Host ajeno se rechaza antes de hacer nada.
      await conEntorno({ ERP_DTE_API_URL: apiUrl, NODE_ENV: undefined }, async () => {
        for (const host of ["192.168.1.50:8080", "evil.example", "localhost.evil.example"]) {
          const r = await handleTransmitir(
            new Request(`http://${host}/api/erp/dte/transmitir`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: cuerpo,
            }),
          );
          assert.equal(r.status, 403, `${host} (apiUrl=${apiUrl})`);
          assert.equal(((await r.json()) as { error: string }).error, "host_no_permitido");
        }
      });
    }
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(llamadas, 0, "no debió salir ninguna petición hacia el host falsificado");
});

test("seguridad: hostPermitido / nombreDeHost (anti DNS-rebinding)", () => {
  const con = (url: string, host?: string) => new Request(url, host ? { headers: { host } } : {});
  // El nombre sale de la cabecera Host y se ignora el puerto.
  assert.equal(nombreDeHost(con("http://127.0.0.1:8080/x")), "127.0.0.1");
  assert.equal(nombreDeHost(con("http://x/", "LocalHost:3000")), "localhost");
  assert.equal(nombreDeHost(con("http://x/", "[::1]:8080")), "[::1]");
  assert.equal(nombreDeHost(con("http://x/", "erp.midominio.com")), "erp.midominio.com");

  assert.equal(hostPermitido(con("http://127.0.0.1:8080/x")), true);
  assert.equal(hostPermitido(con("http://localhost/x")), true);
  assert.equal(hostPermitido(con("http://evil.example/x")), false);
  assert.equal(hostPermitido(con("http://192.168.1.50:8080/x")), false);
  assert.equal(hostPermitido(con("http://localhost.evil.example/x")), false);
  // Un host declarado por el operador se acepta (sin distinguir mayúsculas)…
  assert.equal(hostPermitido(con("http://ERP.Midominio.com/x"), ["erp.midominio.com"]), true);
  // …pero uno no declarado, no.
  assert.equal(hostPermitido(con("http://otro.midominio.com/x"), ["erp.midominio.com"]), false);
  // Si la cabecera Host y la URL discrepan, deben estar permitidas AMBAS.
  assert.equal(hostPermitido(con("http://127.0.0.1/x", "evil.example")), false);
  assert.equal(hostPermitido(con("http://evil.example/x", "127.0.0.1")), false);
});

test("seguridad: ERP_DTE_ALLOWED_HOSTS y ERP_DTE_ALLOWED_ORIGINS definen los hosts aceptados", async () => {
  await conEntorno(
    {
      ERP_DTE_ALLOWED_HOSTS: " Erp.Midominio.com , 10.0.0.5 ",
      ERP_DTE_ALLOWED_ORIGINS: "https://portal.midominio.com, no-es-url",
    },
    () => {
      const c = getErpDteConfig();
      assert.deepEqual(c.hostsPermitidos.sort(), [
        "10.0.0.5",
        "erp.midominio.com",
        "portal.midominio.com",
      ]);
      assert.deepEqual(c.origenesPermitidos, ["https://portal.midominio.com", "no-es-url"]);
    },
  );
  await conEntorno({ ERP_DTE_ALLOWED_HOSTS: undefined, ERP_DTE_ALLOWED_ORIGINS: undefined }, () => {
    assert.deepEqual(getErpDteConfig().hostsPermitidos, []); // seguro por defecto: solo localhost
  });
});

test("seguridad: leerTextoLimitado corta en streaming y no lee todo el cuerpo", async () => {
  // Cuerpo "infinito" de trozos de 64 KB: el límite debe cortarlo tras pocos trozos.
  let trozos = 0;
  const infinito = new ReadableStream<Uint8Array>({
    pull(controlador) {
      trozos += 1;
      controlador.enqueue(new Uint8Array(64 * 1024));
    },
  });
  const req = new Request("http://x/", {
    method: "POST",
    body: infinito,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(leerTextoLimitado(req, 256 * 1024), CuerpoDemasiadoGrande);
  assert.ok(trozos < 20, `se leyeron ${trozos} trozos de un cuerpo infinito: no se cortó a tiempo`);

  // Content-Length declarado mayor al límite: se rechaza sin leer nada.
  const declarado = new Request("http://x/", {
    method: "POST",
    headers: { "Content-Length": "999999999" },
    body: "x",
  });
  await assert.rejects(leerTextoLimitado(declarado, 1024), CuerpoDemasiadoGrande);

  // En el límite exacto pasa; un byte más no.
  const justo = new Request("http://x/", { method: "POST", body: "a".repeat(1024) });
  assert.equal((await leerTextoLimitado(justo, 1024)).length, 1024);
  await assert.rejects(
    leerTextoLimitado(new Request("http://x/", { method: "POST", body: "a".repeat(1025) }), 1024),
    CuerpoDemasiadoGrande,
  );

  // UTF-8 multibyte se decodifica bien y se cuenta en BYTES, no en caracteres.
  assert.equal(
    await leerTextoLimitado(new Request("http://x/", { method: "POST", body: "ñandú" }), 1024),
    "ñandú",
  );
  await assert.rejects(
    leerTextoLimitado(new Request("http://x/", { method: "POST", body: "ñ".repeat(600) }), 1024),
    CuerpoDemasiadoGrande,
  ); // 1200 bytes
  assert.equal(await leerTextoLimitado(new Request("http://x/", { method: "POST" }), 1024), ""); // sin cuerpo
});

test("seguridad: validarSolicitud rechaza importes que desbordan el máximo soportado", () => {
  const sol = (cantidad: number, precio: number, descuento = 0) => ({
    factura: {
      id: "F",
      folio: "1",
      pedidoId: "P",
      items: [{ codigo: "X", nombre: "N", cantidad, precio, descuento }],
    },
    cliente: { nombre: "A", documento: "04512398-7" },
  });
  assert.equal(validarSolicitud(sol(1, 100)).ok, true);
  assert.equal(validarSolicitud(sol(1_000_000, 1_000_000)).ok, false); // 1e12
  const r = validarSolicitud(sol(1_000_000, 1_000_000));
  assert.ok(!r.ok && /máximo soportado/.test(r.detalles.join()));
  assert.equal(validarSolicitud(sol(1_000_000, 1_000_000, 100)).ok, true); // 100 % de descuento: total 0
  // Borde del total, con cada campo dentro de su propio límite (cantidad y precio <= 1 000 000):
  assert.equal(validarSolicitud(sol(1000, 880_000)).ok, true); // 880M * 1.13 = 994.4M < 999 999 999.99
  const sobre = validarSolicitud(sol(1000, 890_000)); // 890M * 1.13 = 1005.7M > máximo
  assert.ok(
    !sobre.ok && /máximo soportado/.test(sobre.detalles.join()),
    "debe rechazarse por el TOTAL, no por el esquema",
  );
  // Un valor fuera del límite de un campo se rechaza por el esquema (otra causa distinta):
  const esquema = validarSolicitud(sol(1, 880_000_000));
  assert.ok(!esquema.ok && !/máximo soportado/.test(esquema.detalles.join()));
});

test(
  "seguridad: los archivos de datos se crean con permisos restrictivos (0700 / 0600)",
  { skip: process.platform === "win32" },
  async () => {
    const base = mkdtempSync(path.join(tmpdir(), "erp-perm-"));
    const carpeta = path.join(base, "nuevo", "datos");
    await conEntorno({ ERP_DTE_DATA_DIR: carpeta }, async () => {
      await bitacora.iniciar({
        origen: "envio",
        facturaId: "F-PERM",
        codigoGeneracion: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        numeroControl: "DTE-01-M001P001-000000000000001",
        dte: {},
        totales: { totalGravada: 1, totalIva: 0, totalDescu: 0, totalPagar: 1 },
      });
    });
    assert.equal(statSync(carpeta).mode & 0o777, 0o700, "la carpeta de datos debe ser 0700");
    assert.equal(
      statSync(path.join(carpeta, "erp-transmisiones.json")).mode & 0o777,
      0o600,
      "el archivo debe ser 0600",
    );
  },
);

test(
  "seguridad: el almacén de la simulación también usa permisos restrictivos (0700 / 0600)",
  { skip: process.platform === "win32" },
  async () => {
    const base = mkdtempSync(path.join(tmpdir(), "sim-perm-"));
    const carpeta = path.join(base, "nuevo", "sim");
    await conEntorno({ HACIENDA_SIM_DATA_DIR: carpeta }, async () => {
      await mutarDb((db) => {
        db.escenario.modo = "normal";
      });
    });
    assert.equal(
      statSync(carpeta).mode & 0o777,
      0o700,
      "la carpeta de datos de la simulación debe ser 0700",
    );
    assert.equal(
      statSync(path.join(carpeta, "hacienda-sim.json")).mode & 0o777,
      0o600,
      "el archivo debe ser 0600",
    );
  },
);

test("trazabilidad: el esquema oficial de Factura se conserva SIN modificar (huella SHA-256)", () => {
  // Es el archivo fe-f-v2.json descargado del portal factura.gob.sv. No debe reformatearse
  // (p. ej. con `prettier --write src/`) ni editarse: la validación se apoya en él.
  const ruta = path.join(process.cwd(), "src/backend/hacienda-sim/schemas/fe-f-v2.json");
  const huella = createHash("sha256").update(readFileSync(ruta)).digest("hex");
  assert.equal(
    huella,
    "2887ff3ccf5594eb1f49dcec1ce8bba134a86462f900069de1365d18ff997aff",
    "el esquema oficial fue modificado (¿lo reformateó Prettier?)",
  );
});
