/**
 * Handlers HTTP del backend del ERP para facturación electrónica.
 *
 *  POST /api/erp/dte/transmitir            emite una factura (HU-07 + HU-08)
 *  POST /api/erp/dte/consultar             consulta/concilia el estado en Hacienda
 *  GET  /api/erp/dte/transmisiones         historial (filtro opcional ?facturaId=)
 *  GET  /api/erp/dte/transmisiones/:id     detalle de una transmisión
 *
 * Códigos HTTP de /transmitir:
 *   200 aceptado (o ya emitida)        422 rechazado por Hacienda
 *   400 solicitud inválida             502 servicio caído / error / sin autenticar
 *   403 origen no permitido (CSRF)     504 el servicio no respondió
 *   413 cuerpo demasiado grande        500 error interno del ERP
 *   415 el cuerpo no es application/json
 *
 * SEGURIDAD: estos endpoints NO tienen autenticación (el prototipo no tiene login), por lo que
 * las escrituras exigen JSON, rechazan peticiones de otros sitios y limitan el tamaño del cuerpo.
 * No deben exponerse a una red no confiable sin añadir autenticación.
 */
import {
  CABECERAS_SEGURAS,
  CuerpoDemasiadoGrande,
  LIMITE_CUERPO_DTE,
  LIMITE_CUERPO_PEQUENO,
  contenidoEsJson,
  esLoopback,
  hostPermitido,
  leerTextoLimitado,
  origenPermitido,
} from "../shared/http-seguro";
import * as bitacora from "./bitacora";
import { getErpDteConfig, type ErpDteConfig } from "./config";
import { consultarEstado, transmitirFactura, type RespuestaTransmision } from "./transmitir";
import { validarSolicitud } from "./solicitud";

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CABECERAS_SEGURAS },
  });

const error = (status: number, codigo: string, mensaje: string, extra: object = {}): Response =>
  json({ ok: false, error: codigo, mensaje, ...extra }, status);

/**
 * URL de la API de Hacienda. Se toma de ERP_DTE_API_URL (validada: HTTPS, salvo localhost).
 *
 * Solo si NO está configurada (desarrollo) se deduce de la petición, y únicamente cuando el host
 * es local. Deducirla de cualquier host permitiría a quien falsifique la cabecera `Host` hacer
 * que el servidor envíe las credenciales de Hacienda a un destino arbitrario (SSRF).
 */
export function contexto(
  request: Request,
): { ok: true; cfg: ErpDteConfig; baseUrl: string } | { ok: false; respuesta: Response } {
  const cfg = getErpDteConfig();
  if (cfg.apiUrl) return { ok: true, cfg, baseUrl: cfg.apiUrl };

  const url = new URL(request.url);
  if (!esLoopback(url.hostname)) {
    return {
      ok: false,
      respuesta: error(
        400,
        "host_no_permitido",
        "La URL de Hacienda solo se deduce en hosts locales; configure ERP_DTE_API_URL.",
      ),
    };
  }
  return { ok: true, cfg, baseUrl: `${url.origin}/api/hacienda-sim` };
}

/**
 * Controles de acceso comunes a TODOS los endpoints del ERP:
 *  - Host permitido (anti DNS-rebinding): también en lecturas, porque con rebinding un sitio
 *    ajeno podría LEER el historial (datos personales), no solo escribir.
 * y, para las operaciones que modifican estado (`escritura`):
 *  - Origen permitido (anti-CSRF) y cuerpo application/json.
 */
export function protegerAcceso(request: Request, escritura: boolean): Response | null {
  const cfg = getErpDteConfig();
  if (!hostPermitido(request, cfg.hostsPermitidos)) {
    return error(403, "host_no_permitido", "El host de la solicitud no está permitido.");
  }
  if (!escritura) return null;
  if (!origenPermitido(request, cfg.origenesPermitidos)) {
    return error(403, "origen_no_permitido", "La solicitud proviene de un origen no permitido.");
  }
  if (!contenidoEsJson(request)) {
    return error(415, "tipo_contenido_invalido", "El cuerpo debe enviarse como application/json.");
  }
  return null;
}

type Lectura = { ok: true; cuerpo: unknown } | { ok: false; motivo: "grande" | "invalido" };

async function leerJson(request: Request, maxBytes: number): Promise<Lectura> {
  try {
    return { ok: true, cuerpo: JSON.parse(await leerTextoLimitado(request, maxBytes)) };
  } catch (err) {
    return { ok: false, motivo: err instanceof CuerpoDemasiadoGrande ? "grande" : "invalido" };
  }
}

const rechazoLectura = (motivo: "grande" | "invalido"): Response =>
  motivo === "grande"
    ? error(413, "cuerpo_demasiado_grande", "El cuerpo de la solicitud excede el tamaño permitido.")
    : error(400, "cuerpo_invalido", "El cuerpo de la solicitud no es JSON válido.");

const internoSeguro = (donde: string, err: unknown): Response => {
  // No se devuelve el detalle al cliente: puede contener rutas y datos internos.
  console.error(`[erp-dte] ${donde}:`, err instanceof Error ? err.message : "error desconocido");
  return error(500, "error_interno", "Error interno del ERP. Revise el registro del servidor.");
};

function statusDe(r: RespuestaTransmision): number {
  if (r.ok) return 200;
  switch (r.resultado) {
    case "rechazado":
      return 422;
    case "sin_respuesta":
      return 504;
    default:
      return 502;
  }
}

export async function handleTransmitir(request: Request): Promise<Response> {
  try {
    const bloqueo = protegerAcceso(request, true);
    if (bloqueo) return bloqueo;

    const leido = await leerJson(request, LIMITE_CUERPO_DTE);
    if (!leido.ok) return rechazoLectura(leido.motivo);

    const valida = validarSolicitud(leido.cuerpo);
    if (!valida.ok) {
      return error(400, "solicitud_invalida", "La solicitud no cumple el formato esperado.", {
        detalles: valida.detalles,
      });
    }

    const ctx = contexto(request);
    if (!ctx.ok) return ctx.respuesta;

    const respuesta = await transmitirFactura(valida.solicitud, {
      baseUrl: ctx.baseUrl,
      cfg: ctx.cfg,
    });
    return json({ ...respuesta }, statusDe(respuesta));
  } catch (err) {
    return internoSeguro("transmitir", err);
  }
}

export async function handleConsultar(request: Request): Promise<Response> {
  try {
    const bloqueo = protegerAcceso(request, true);
    if (bloqueo) return bloqueo;

    const leido = await leerJson(request, LIMITE_CUERPO_PEQUENO);
    if (!leido.ok && leido.motivo === "grande") return rechazoLectura("grande");

    const c =
      leido.ok && leido.cuerpo && typeof leido.cuerpo === "object"
        ? (leido.cuerpo as Record<string, unknown>)
        : null;
    const facturaId = typeof c?.["facturaId"] === "string" ? c["facturaId"] : undefined;
    const codigoGeneracion =
      typeof c?.["codigoGeneracion"] === "string" ? c["codigoGeneracion"] : undefined;
    if (!facturaId && !codigoGeneracion) {
      return error(400, "solicitud_invalida", "Indique facturaId o codigoGeneracion.");
    }

    const ctx = contexto(request);
    if (!ctx.ok) return ctx.respuesta;

    const r = await consultarEstado(
      { facturaId, codigoGeneracion },
      { baseUrl: ctx.baseUrl, cfg: ctx.cfg },
    );
    if (r.ok) return json(r);
    return json(r, r.motivo === "desconocida" ? 404 : 502);
  } catch (err) {
    return internoSeguro("consultar", err);
  }
}

export async function handleListar(request: Request): Promise<Response> {
  try {
    const bloqueo = protegerAcceso(request, false);
    if (bloqueo) return bloqueo;

    const facturaId = new URL(request.url).searchParams.get("facturaId");
    const todas = facturaId ? await bitacora.porFactura(facturaId) : await bitacora.listar();
    return json({
      total: todas.length,
      transmisiones: todas.map((t) => ({
        id: t.id,
        origen: t.origen,
        facturaId: t.facturaId,
        codigoGeneracion: t.codigoGeneracion,
        numeroControl: t.numeroControl,
        iniciadaEn: t.iniciadaEn,
        finalizadaEn: t.finalizadaEn,
        estadoProceso: t.estadoProceso,
        resultado: t.resultado?.resultado ?? null,
        facturaEstado: t.resultado?.facturaEstado ?? null,
        codigoMsg: t.resultado?.codigoMsg ?? null,
        selloRecibido: t.resultado?.selloRecibido ?? null,
        envios: t.resultado?.envios ?? 0,
        consultas: t.resultado?.consultas ?? 0,
      })),
    });
  } catch (err) {
    return internoSeguro("listar", err);
  }
}

export async function handleDetalle(request: Request, id: string): Promise<Response> {
  try {
    const bloqueo = protegerAcceso(request, false);
    if (bloqueo) return bloqueo;

    const t = await bitacora.porId(id);
    return t ? json(t) : error(404, "no_encontrada", `No existe la transmisión ${id}.`);
  } catch (err) {
    return internoSeguro("detalle", err);
  }
}
