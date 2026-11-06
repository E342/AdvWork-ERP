/**
 * Pruebas de la INTERFAZ de facturación (HU-07/08/09/10) contra el servidor REAL.
 *
 * Renderiza la pantalla real (con el store real) en un DOM simulado (jsdom) y la maneja
 * como lo haría un usuario. Las llamadas /api/... van al servidor en marcha (backend del
 * ERP + API simulada de Hacienda + bitácora).
 *
 * Qué verifica: comportamiento (estados, textos, botones, flujos, mensajes, descargas).
 * Qué NO verifica: apariencia visual (colores, espaciado, responsive): eso hay que
 * revisarlo en un navegador real.
 *
 * Requisitos (solo para ejecutar esta prueba; no se guardan en package.json):
 *   npm i --no-save jsdom @types/jsdom @testing-library/react @testing-library/dom
 * Ejecutar con el servidor en marcha (bun dev), desde la raíz del repo:
 *   npx tsx --test scripts/erp-ui-test.tsx
 * Tarda ~35 s: los escenarios de timeout esperan el umbral oficial de 5 s por intento.
 */
import assert from "node:assert/strict";
// tsx compila este archivo (fuera de `include` del tsconfig) con el JSX clásico: necesita React en alcance.
import React from "react";
import test, { after } from "node:test";
import { JSDOM } from "jsdom";

const ORIGEN = process.env["BASE_URL"] ?? "http://127.0.0.1:8080";
const USER = process.env["ERP_DTE_USER"] ?? "SIM-FACTURADOR-01";
const PWD = process.env["ERP_DTE_PWD"] ?? "SIM-NO-REAL-Pwd#2026";

// --- DOM simulado (debe existir ANTES de importar React/Testing Library) -------------
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: `${ORIGEN}/`,
  pretendToBeVisual: true,
});
for (const clave of Object.getOwnPropertyNames(dom.window)) {
  if (clave in globalThis) continue; // no se pisa lo que ya aporta Node (fetch, URL, Blob...)
  Object.defineProperty(globalThis, clave, {
    configurable: true,
    get: () => (dom.window as unknown as Record<string, unknown>)[clave],
  });
}
(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

// fetch: las rutas relativas (/api/...) se resuelven contra el servidor real.
const fetchReal = globalThis.fetch;
let simularSinConexion = false;
globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof entrada === "string" && entrada.startsWith("/") ? ORIGEN + entrada : entrada;
  if (simularSinConexion && String(url).includes("/api/erp/dte/transmitir")) {
    return Promise.reject(new TypeError("fetch failed"));
  }
  return fetchReal(url, init);
}) as typeof fetch;

// Descargas: se capturan los archivos que la interfaz intenta guardar.
const blobs = new Map<string, Blob>();
const descargas: { nombre: string; href: string }[] = [];
const crearUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = (b: Blob | MediaSource) => {
  const u = crearUrl(b);
  blobs.set(u, b as Blob);
  return u;
};
dom.window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  descargas.push({ nombre: this.download, href: this.href });
};
const textoDescargado = async (d: { href: string } | undefined) => {
  assert.ok(d, "no se descargó ningún archivo");
  return blobs.get(d.href)!.text();
};

// --- Módulos de la aplicación (ya con DOM disponible) ---------------------------------
const { render, screen, within, waitFor, act, cleanup, fireEvent } =
  await import("@testing-library/react");
const { toast } = await import("sonner");
const { ErpProvider, useErp } = await import("../src/lib/erp-store");
const { Route } = await import("../src/routes/facturacion.index");

// Avisos (toasts) capturados
const avisos: { nivel: string; mensaje: string }[] = [];
const registrar = (nivel: string) => (m: unknown) => {
  avisos.push({ nivel, mensaje: String(m) });
  return 0;
};
Object.assign(toast, {
  success: registrar("exito"),
  warning: registrar("aviso"),
  error: registrar("error"),
  info: registrar("info"),
});
const ultimoAviso = () => avisos.at(-1);

// Sonda para manejar el store desde la prueba (equivale a usar otras pantallas)
let erp!: ReturnType<typeof useErp>;
function Sonda() {
  erp = useErp();
  return null;
}
void React;
const Facturacion = Route.options.component as () => React.JSX.Element;

const montar = () =>
  render(
    <ErpProvider>
      <Sonda />
      <Facturacion />
    </ErpProvider>,
  );

// --- Utilidades --------------------------------------------------------------------
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function modo(m: string) {
  const a = await fetchReal(`${ORIGEN}/api/hacienda-sim/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ user: USER, pwd: PWD }),
  });
  const token = ((await a.json()) as { body: { token: string } }).body.token;
  await fetchReal(`${ORIGEN}/api/hacienda-sim/control/escenario`, {
    method: "PUT",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ modo: m }),
  });
}

/** Crea una venta y su factura (Borrador) como lo haría un usuario en Ventas y Facturación. */
async function crearFactura(clienteId: number): Promise<string> {
  let m1 = "";
  await act(async () => {
    m1 = erp.registrarVentaDirecta(
      clienteId,
      [
        {
          codigo: "WB-H098",
          nombre: "Water Bottle - 30 oz.",
          cantidad: 2,
          precio: 4.99,
          descuento: 0,
        },
      ],
      "Tienda física",
      "Efectivo",
    ).mensaje;
  });
  const pedido = /PED-[\w-]+/.exec(m1)?.[0];
  assert.ok(pedido, `no se creó el pedido: ${m1}`);
  let m2 = "";
  await act(async () => {
    m2 = erp.generarFactura(pedido).mensaje;
  });
  const factura = /FAC-[\w-]+/.exec(m2)?.[0];
  assert.ok(factura, `no se creó la factura: ${m2}`);
  return factura;
}

const fila = (id: string) => screen.getByText(id).closest("tr") as HTMLElement;
const botonEnviar = (id: string) =>
  within(fila(id)).getByRole("button", {
    name: /^(enviar|reenviar|enviando)/i,
  }) as HTMLButtonElement;
const estadoDe = (id: string) =>
  within(fila(id)).queryByText(/^(Borrador|Emitida|Rechazada|Pendiente de envío)$/)?.textContent;
const dato = (etiqueta: string) =>
  (screen.getByText(etiqueta).parentElement!.querySelector("dd") as HTMLElement).textContent ?? "";
const esperar = (cond: () => void, timeout = 20000) => waitFor(cond, { timeout, interval: 100 });

const EMITIDA = (id: string) => () => assert.equal(estadoDe(id), "Emitida");

test.beforeEach(async () => {
  avisos.length = 0;
  descargas.length = 0;
  simularSinConexion = false;
  await modo("normal");
});
test.afterEach(() => cleanup());
after(async () => {
  await modo("normal");
});

// --- Pruebas ------------------------------------------------------------------------
test("pantalla: muestra las facturas semilla y bloquea el reenvío de una emitida", () => {
  montar();
  assert.ok(screen.getByText("Facturación electrónica (DTE)"));
  assert.equal(estadoDe("FAC-0154"), "Emitida");
  assert.equal(estadoDe("FAC-0155"), "Pendiente de envío");
  assert.equal(botonEnviar("FAC-0154").disabled, true); // ya emitida
  assert.equal(botonEnviar("FAC-0155").disabled, false);
  assert.match(botonEnviar("FAC-0155").textContent ?? "", /Reenviar/); // no es Borrador
});

test("ids de factura nuevos llevan sufijo de sesión (no colisionan tras recargar)", async () => {
  montar();
  const id = await crearFactura(11002);
  assert.match(id, /^FAC-\d+-[A-Z0-9]{4}$/);
});

test("flujo feliz: Enviar -> estado de carga -> Emitida con sello y detalle", async () => {
  montar();
  const id = await crearFactura(11002);
  assert.equal(estadoDe(id), "Borrador");

  fireEvent.click(botonEnviar(id));
  // Mientras espera: botón bloqueado, texto "Enviando…" y aviso de comunicación en curso
  await esperar(() => assert.match(botonEnviar(id).textContent ?? "", /Enviando/));
  assert.equal(botonEnviar(id).disabled, true);
  assert.equal(fila(id).getAttribute("aria-busy"), "true");
  assert.ok(within(fila(id)).getByText(/Comunicando con Hacienda/));

  await esperar(EMITIDA(id));
  assert.equal(fila(id).getAttribute("aria-busy"), "false");
  assert.equal(botonEnviar(id).disabled, true);

  // El detalle se abre solo y muestra el resultado
  assert.ok(screen.getByText(/Servicio simulado/));
  assert.match(dato("Sello de recepción"), /^[A-Z0-9]{40}$/);
  assert.match(dato("Código de generación"), /^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/);
  assert.match(dato("Número de control"), /^DTE-01-M001P001-\d{15}$/);
  assert.match(dato("Código de respuesta"), /^001/);
  assert.match(dato("Procesado"), /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  assert.match(dato("Intentos"), /^1 envío\(s\), 0 consulta\(s\)$/);
  assert.equal(ultimoAviso()?.nivel, "exito");
  assert.match(ultimoAviso()!.mensaje, /^DTE emitido\. Sello: [A-Z0-9]{40}$/);

  // Historial del servidor
  await esperar(() => assert.ok(screen.getByText("Aceptado")));
  assert.match(screen.getByText(/^TRX-\d{4}$/).textContent ?? "", /^TRX-\d{4}$/);
});

test("rechazo: documento inválido -> Rechazada con código y detalle; se puede reenviar", async () => {
  montar();
  const id = await crearFactura(11006); // cliente de prueba con documento "1234"
  fireEvent.click(botonEnviar(id));
  await esperar(() => assert.equal(estadoDe(id), "Rechazada"));

  assert.equal(ultimoAviso()?.nivel, "error");
  assert.match(ultimoAviso()!.mensaje, /rechazado/i);
  assert.match(dato("Código de respuesta"), /^003/);
  assert.match(dato("Mensaje"), /numDocumento/);
  assert.match(dato("Intentos"), /^1 envío\(s\), 0 consulta\(s\)$/); // un rechazo no se reintenta
  assert.equal(dato("Sello de recepción"), "— sin sellar —");
  assert.match(botonEnviar(id).textContent ?? "", /Reenviar/);
  assert.equal(botonEnviar(id).disabled, false);
  await esperar(() => assert.ok(screen.getByText("Rechazado")));
});

test("doble clic: un solo envío (el botón se bloquea y el store lo protege)", async () => {
  montar();
  const id = await crearFactura(11002);
  const boton = botonEnviar(id);
  fireEvent.click(boton);
  fireEvent.click(boton); // segundo clic inmediato
  await esperar(EMITIDA(id));
  await esperar(() => assert.equal(screen.getAllByText(/^TRX-\d{4}$/).length, 1));

  // Y llamando directamente a la función dos veces a la vez (otra pantalla, otra pestaña...)
  const id2 = await crearFactura(11002);
  let r1!: Awaited<ReturnType<typeof erp.enviarFacturaHacienda>>;
  let r2!: Awaited<ReturnType<typeof erp.enviarFacturaHacienda>>;
  await act(async () => {
    [r1, r2] = await Promise.all([erp.enviarFacturaHacienda(id2), erp.enviarFacturaHacienda(id2)]);
  });
  assert.equal(r1.ok, true);
  assert.deepEqual([r2.ok, r2.nivel], [false, "aviso"]);
  assert.match(r2.mensaje, /envío en curso/);
});

test("servicio caído: Pendiente de envío tras 3 envíos; al restablecerse se reenvía con el mismo código", async () => {
  montar();
  const id = await crearFactura(11002);
  await modo("indisponible");
  fireEvent.click(botonEnviar(id));
  await esperar(() => assert.equal(estadoDe(id), "Pendiente de envío"));
  assert.equal(ultimoAviso()?.nivel, "aviso");
  assert.match(ultimoAviso()!.mensaje, /no está disponible/);
  assert.match(dato("Intentos"), /^3 envío\(s\), 3 consulta\(s\)$/);
  const codigo = dato("Código de generación");

  await modo("normal");
  fireEvent.click(botonEnviar(id));
  await esperar(EMITIDA(id));
  assert.equal(dato("Código de generación"), codigo, "el codigoGeneracion debe conservarse");
  await esperar(() => assert.equal(screen.getAllByText(/^TRX-\d{4}$/).length, 2)); // intento fallido + éxito
});

test("sin conexión con el servidor del ERP: avisa y la factura conserva su estado", async () => {
  montar();
  const id = await crearFactura(11002);
  simularSinConexion = true;
  fireEvent.click(botonEnviar(id));
  await esperar(() => assert.equal(ultimoAviso()?.nivel, "error"));
  assert.match(ultimoAviso()!.mensaje, /No fue posible comunicarse/);
  assert.equal(estadoDe(id), "Borrador"); // sin cambios
  assert.equal(botonEnviar(id).disabled, false); // se puede reintentar
});

test("Hacienda recibió pero respondió tarde: se ve 'Enviando…' ~5 s y se recupera por consulta", async () => {
  montar();
  const id = await crearFactura(11002);
  await modo("timeout_procesado");
  fireEvent.click(botonEnviar(id));
  await act(async () => dormir(1500));
  assert.match(botonEnviar(id).textContent ?? "", /Enviando/); // sigue esperando
  assert.equal(estadoDe(id), "Borrador");

  await esperar(EMITIDA(id), 15000);
  assert.match(
    dato("Intentos"),
    /^1 envío\(s\), 1 consulta\(s\) — recuperado por consulta de estado$/,
  );
  assert.match(ultimoAviso()!.mensaje, /recuperado por consulta/);
});

test("sin respuesta (timeout): Pendiente tras ~15 s; 'Consultar estado' confirma que Hacienda no lo tiene", async () => {
  montar();
  const id = await crearFactura(11002);
  await modo("timeout");
  fireEvent.click(botonEnviar(id));
  await esperar(() => assert.equal(estadoDe(id), "Pendiente de envío"), 40000);
  assert.match(dato("Intentos"), /^3 envío\(s\), 3 consulta\(s\)$/);
  assert.match(ultimoAviso()!.mensaje, /no respondió/);

  await modo("normal");
  fireEvent.click(screen.getByRole("button", { name: /consultar estado/i }));
  await esperar(() => assert.match(ultimoAviso()!.mensaje, /no tiene registrado/));
  assert.equal(estadoDe(id), "Pendiente de envío"); // no cambia
});

test("tras 'recargar': una factura ya emitida en el servidor se concilia con 'Consultar estado' y no se reenvía", async () => {
  // 1) Se emite la factura semilla FAC-0155.
  montar();
  fireEvent.click(botonEnviar("FAC-0155"));
  await esperar(EMITIDA("FAC-0155"));
  const sello = dato("Sello de recepción");
  cleanup();

  // 2) "Recarga": estado limpio. La semilla vuelve a 'Pendiente', pero el servidor la recuerda.
  montar();
  assert.equal(estadoDe("FAC-0155"), "Pendiente de envío");
  fireEvent.click(within(fila("FAC-0155")).getByRole("button", { name: /^ver$/i }));
  fireEvent.click(await screen.findByRole("button", { name: /consultar estado/i }));
  await esperar(EMITIDA("FAC-0155"));
  assert.equal(dato("Sello de recepción"), sello);
  assert.equal(ultimoAviso()?.nivel, "aviso");
  assert.match(ultimoAviso()!.mensaje, /tiene registrado/);
  cleanup();

  // 3) Otra "recarga": 'Reenviar' devuelve lo registrado sin volver a enviar.
  montar();
  fireEvent.click(botonEnviar("FAC-0155"));
  await esperar(EMITIDA("FAC-0155"));
  assert.match(ultimoAviso()!.mensaje, /ya fue emitida/);
  assert.equal(dato("Sello de recepción"), sello);
});

test("descargas: DTE en JSON y comprobante de texto con los datos del envío", async () => {
  montar();
  const id = await crearFactura(11002);
  fireEvent.click(botonEnviar(id));
  await esperar(EMITIDA(id));
  const codigo = dato("Código de generación");
  const sello = dato("Sello de recepción");

  fireEvent.click(await screen.findByRole("button", { name: /descargar dte \(json\)/i }));
  await esperar(() => assert.equal(descargas.length, 1));
  const dte = JSON.parse(await textoDescargado(descargas[0]));
  assert.equal(dte.identificacion.codigoGeneracion, codigo);
  assert.equal(dte.identificacion.tipoDte, "01");
  assert.match(descargas[0]!.nombre, /^DTE-01-M001P001-\d{15}\.json$/);

  fireEvent.click(within(fila(id)).getByRole("button", { name: /descargar/i }));
  await esperar(() => assert.equal(descargas.length, 2));
  const txt = await textoDescargado(descargas[1]);
  assert.match(txt, new RegExp(`Código de generación: ${codigo}`));
  assert.match(txt, new RegExp(`Sello electrónico: ${sello}`));
});
