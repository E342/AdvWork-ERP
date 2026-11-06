/**
 * Orquestación de la emisión de un DTE (HU-07 + HU-08 + HU-09).
 *
 * Política de reintentos (OFICIAL, Guía de Integración v8.0):
 *   1. Si Hacienda no responde en 5 s -> consultar el estado del documento.
 *   2. Si no fue recibido -> reenviar. Máximo 2 reenvíos.
 *   3. Si tras la política no se logra -> modo contingencia. Aquí (ACADÉMICO) la
 *      factura queda "Pendiente de envío" y el evento de contingencia oficial
 *      queda fuera de alcance.
 *
 * Reglas propias del ERP (ACADÉMICAS):
 *   - Una factura ya aceptada no se reenvía: se devuelve el resultado registrado.
 *   - Cada factura conserva su `codigoGeneracion` entre intentos (reenvíos y
 *     correcciones tras un rechazo).
 *   - Un rechazo definitivo (400) no se reintenta: hay que corregir el dato.
 *   - Un rechazo 004 (duplicado) significa que Hacienda ya lo tiene: se consulta
 *     el estado y, si existe, se toma como aceptado.
 */
import { newUuid, signCompact } from "../shared/hmac-jws";
import * as bitacora from "./bitacora";
import type { FacturaEstado, Intento, Resultado, ResultadoFinal } from "./bitacora";
import type { ErpDteConfig } from "./config";
import { construirDte, type TotalesDte } from "./dte-builder";
import { EMISOR_FICTICIO } from "./emisor";
import { crearClienteHacienda, type RespuestaHttp } from "./hacienda-client";
import type { SolicitudTransmision } from "./solicitud";

export type RespuestaTransmision = ResultadoFinal & {
  transmisionId: string;
  codigoGeneracion: string;
  numeroControl: string;
  yaEmitida: boolean;
  /** true si esta solicitud se unió a una emisión que ya estaba en curso para la factura. */
  compartida: boolean;
  totales: TotalesDte | null;
};

const ESTADO_POR_RESULTADO: Record<Resultado, FacturaEstado> = {
  aceptado: "Emitida",
  aceptado_con_observaciones: "Emitida",
  rechazado: "Rechazada",
  sin_respuesta: "Pendiente de envío",
  servicio_no_disponible: "Pendiente de envío",
  error_servicio: "Pendiente de envío",
  error_autenticacion: "Pendiente de envío",
  respuesta_inesperada: "Pendiente de envío",
};

const texto = (v: unknown): string | null => (typeof v === "string" ? v : null);
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];

type Falla =
  { tipo: "timeout" } | { tipo: "red"; mensaje?: string } | { tipo: "http"; status: number };

function resultadoPorFalla(f: Falla): Resultado {
  if (f.tipo === "timeout") return "sin_respuesta";
  if (f.tipo === "red") return "servicio_no_disponible";
  if (f.status === 504) return "sin_respuesta";
  if (f.status === 500) return "error_servicio";
  return "servicio_no_disponible"; // 502 / 503
}

function mensajeFinal(
  r: Resultado,
  d: { descripcion: string | null; envios: number; extra?: string; recuperado?: boolean },
): string {
  if (d.recuperado && (r === "aceptado" || r === "aceptado_con_observaciones")) {
    return "Hacienda ya había recibido el documento (la respuesta se demoró o se perdió); el sello se recuperó consultando el estado, sin reenviar.";
  }
  switch (r) {
    case "aceptado":
      return "Comprobante recibido y sellado por el servicio simulado de Hacienda.";
    case "aceptado_con_observaciones":
      return "Comprobante recibido con observaciones (no afectan su validez en la simulación).";
    case "rechazado":
      return `Comprobante rechazado: ${d.descripcion ?? "sin detalle"}.`;
    case "sin_respuesta":
      return `El servicio no respondió tras ${d.envios} envío(s). La factura queda pendiente de envío.`;
    case "servicio_no_disponible":
      return `El servicio no está disponible (${d.envios} envío(s) intentados). La factura queda pendiente de envío.`;
    case "error_servicio":
      return `El servicio respondió con un error interno (${d.envios} envío(s) intentados). La factura queda pendiente de envío.`;
    case "error_autenticacion":
      return `No fue posible autenticarse ante el servicio: ${d.extra ?? "credenciales no válidas"}. La factura queda pendiente de envío.`;
    case "respuesta_inesperada":
      return `Respuesta inesperada del servicio${d.extra ? ` (${d.extra})` : ""}. La factura queda pendiente de envío.`;
  }
}

async function emitir(
  solicitud: SolicitudTransmision,
  ctx: { baseUrl: string; cfg: ErpDteConfig; fetchImpl?: typeof fetch },
): Promise<RespuestaTransmision> {
  const { factura, cliente } = solicitud;
  const { cfg } = ctx;

  // 1. ¿Ya fue aceptada? No se reenvía; se devuelve lo registrado ---------------
  const previas = await bitacora.porFactura(factura.id);
  const aceptada = previas.find((t) => t.resultado?.ok);
  if (aceptada?.resultado) {
    return {
      ...aceptada.resultado,
      mensaje: "La factura ya fue emitida; se devuelve el resultado registrado, sin reenviar.",
      envios: 0,
      consultas: 0,
      transmisionId: aceptada.id,
      codigoGeneracion: aceptada.codigoGeneracion,
      numeroControl: aceptada.numeroControl,
      yaEmitida: true,
      compartida: false,
      totales: aceptada.totales,
    };
  }

  // 2. Construir y firmar el DTE (el codigoGeneracion se conserva por factura) -----
  const codigoGeneracion = previas.at(-1)?.codigoGeneracion ?? newUuid();
  const { dte, totales } = construirDte({ factura, cliente, codigoGeneracion });
  const numeroControl = dte.identificacion.numeroControl;
  const peticion = {
    ambiente: "00",
    idEnvio: newUuid(),
    version: 2,
    tipoDte: "01",
    codigoGeneracion,
    documento: signCompact(dte, cfg.firmaSecret), // JWS SIMULADO (HMAC), no es firma real
  };

  const trx = await bitacora.iniciar({
    origen: "envio",
    facturaId: factura.id,
    codigoGeneracion,
    numeroControl,
    dte,
    totales,
  });

  const hacienda = crearClienteHacienda({ baseUrl: ctx.baseUrl, cfg, fetchImpl: ctx.fetchImpl });
  let envios = 0;
  let consultas = 0;
  let n = 0;

  const registrar = async (
    tipo: Intento["tipo"],
    inicio: Date,
    r: RespuestaHttp,
  ): Promise<void> => {
    n += 1;
    const json = r.tipo === "respuesta" ? r.json : null;
    await bitacora.agregarIntento(trx.id, {
      n,
      tipo,
      inicio: inicio.toISOString(),
      duracionMs: r.ms,
      resultado: r.tipo,
      httpStatus: r.tipo === "respuesta" ? r.status : null,
      codigoMsg: texto(json?.["codigoMsg"]),
      descripcionMsg: texto(json?.["descripcionMsg"]) ?? texto(json?.["message"]),
      error: r.tipo === "red" || r.tipo === "autenticacion" ? r.mensaje : null,
    });
  };

  const cerrar = async (
    resultado: Resultado,
    d: Partial<ResultadoFinal> & { extra?: string; recuperado?: boolean } = {},
  ): Promise<RespuestaTransmision> => {
    const final: ResultadoFinal = {
      ok: resultado === "aceptado" || resultado === "aceptado_con_observaciones",
      resultado,
      facturaEstado: ESTADO_POR_RESULTADO[resultado],
      mensaje: mensajeFinal(resultado, {
        descripcion: d.descripcionMsg ?? null,
        envios,
        extra: d.extra,
        recuperado: d.recuperado,
      }),
      codigoMsg: d.codigoMsg ?? null,
      clasificaMsg: d.clasificaMsg ?? null,
      descripcionMsg: d.descripcionMsg ?? null,
      selloRecibido: d.selloRecibido ?? null,
      fhProcesamiento: d.fhProcesamiento ?? null,
      observaciones: d.observaciones ?? [],
      envios,
      consultas,
      recuperadoPorConsulta: d.recuperado ?? false,
    };
    await bitacora.finalizar(trx.id, final);
    return {
      ...final,
      transmisionId: trx.id,
      codigoGeneracion,
      numeroControl,
      yaEmitida: false,
      compartida: false,
      totales,
    };
  };

  /** Consulta en Hacienda si el documento ya fue recibido. */
  const consultar = async (): Promise<Record<string, unknown> | null> => {
    consultas += 1;
    const inicio = new Date();
    const r = await hacienda.consultar({
      nitEmisor: EMISOR_FICTICIO.nit,
      tdte: "01",
      codigoGeneracion,
    });
    await registrar("consulta", inicio, r);
    return r.tipo === "respuesta" && r.status === 200 && r.json?.["estado"] === "PROCESADO"
      ? r.json
      : null;
  };

  const aceptado = (
    j: Record<string, unknown>,
    recuperado: boolean,
  ): Promise<RespuestaTransmision> => {
    const observaciones = lista(j["observaciones"]);
    return cerrar(observaciones.length > 0 ? "aceptado_con_observaciones" : "aceptado", {
      codigoMsg: texto(j["codigoMsg"]),
      clasificaMsg: texto(j["clasificaMsg"]),
      descripcionMsg: texto(j["descripcionMsg"]),
      selloRecibido: texto(j["selloRecibido"]),
      fhProcesamiento: texto(j["fhProcesamiento"]),
      observaciones,
      recuperado,
    });
  };

  // 3. Envío con la política de reintentos ------------------------------------------
  let ultimaFalla: Falla = { tipo: "timeout" };

  for (let vuelta = 0; vuelta <= cfg.maxReintentos; vuelta++) {
    envios += 1;
    const inicio = new Date();
    const r = await hacienda.enviar(peticion);
    await registrar("envio", inicio, r);

    if (r.tipo === "autenticacion") {
      return cerrar("error_autenticacion", { extra: r.mensaje });
    }

    if (r.tipo === "respuesta") {
      const j = r.json ?? {};

      if (r.status === 200 && j["estado"] === "PROCESADO") return aceptado(j, false);

      if (r.status === 400 && j["estado"] === "RECHAZADO") {
        if (j["codigoMsg"] === "004") {
          // Duplicado: Hacienda ya lo tiene (p. ej. respondió tarde en un intento anterior).
          const existente = await consultar();
          if (existente) return aceptado(existente, true);
        }
        return cerrar("rechazado", {
          codigoMsg: texto(j["codigoMsg"]),
          clasificaMsg: texto(j["clasificaMsg"]),
          descripcionMsg: texto(j["descripcionMsg"]),
          observaciones: lista(j["observaciones"]),
        });
      }

      if (r.status === 401)
        return cerrar("error_autenticacion", { extra: "token rechazado tras renovarlo" });

      if (![500, 502, 503, 504].includes(r.status)) {
        return cerrar("respuesta_inesperada", { extra: `HTTP ${r.status}` });
      }
      ultimaFalla = { tipo: "http", status: r.status };
    } else {
      ultimaFalla =
        r.tipo === "timeout" ? { tipo: "timeout" } : { tipo: "red", mensaje: r.mensaje };
    }

    // Falla de comunicación: antes de reenviar, ¿Hacienda ya lo recibió?
    const existente = await consultar();
    if (existente) return aceptado(existente, true);
  }

  // 4. Sin éxito tras la política: contingencia (la factura queda pendiente) ----------
  return cerrar(resultadoPorFalla(ultimaFalla));
}

/**
 * Emisiones en curso por factura (single-flight). Si llegan varias solicitudes
 * simultáneas para la misma factura (p. ej. doble clic), solo la primera emite;
 * las demás se UNEN a esa emisión y reciben su mismo resultado. Sin esto, cada una
 * generaba su propio codigoGeneracion y Hacienda aceptaba N documentos distintos.
 */
const emisionesEnCurso = new Map<string, Promise<RespuestaTransmision>>();

export function transmitirFactura(
  solicitud: SolicitudTransmision,
  ctx: { baseUrl: string; cfg: ErpDteConfig; fetchImpl?: typeof fetch },
): Promise<RespuestaTransmision> {
  const id = solicitud.factura.id;
  const enCurso = emisionesEnCurso.get(id);
  if (enCurso) return enCurso.then((r) => ({ ...r, compartida: true }));

  const emision = emitir(solicitud, ctx).finally(() => emisionesEnCurso.delete(id));
  emisionesEnCurso.set(id, emision);
  return emision;
}

/**
 * Consulta manual del estado (botón "Consultar estado"). Si Hacienda ya tiene el
 * documento y el ERP no lo tenía como aceptado, lo concilia registrándolo.
 */
export async function consultarEstado(
  datos: { facturaId?: string; codigoGeneracion?: string },
  ctx: { baseUrl: string; cfg: ErpDteConfig; fetchImpl?: typeof fetch },
): Promise<
  | { ok: false; motivo: "desconocida"; mensaje: string }
  | {
      ok: true;
      encontrado: boolean;
      facturaId: string | null;
      codigoGeneracion: string;
      estado: string | null;
      selloRecibido: string | null;
      fhProcesamiento: string | null;
      descripcionMsg: string | null;
      facturaEstado: FacturaEstado | null;
      conciliada: boolean;
      mensaje: string;
    }
  | { ok: false; motivo: "comunicacion"; mensaje: string }
> {
  let facturaId = datos.facturaId ?? null;
  let codigoGeneracion = datos.codigoGeneracion ?? null;
  const previas = facturaId ? await bitacora.porFactura(facturaId) : [];
  if (!codigoGeneracion) codigoGeneracion = previas.at(-1)?.codigoGeneracion ?? null;
  if (!codigoGeneracion) {
    return {
      ok: false,
      motivo: "desconocida",
      mensaje: "No hay transmisiones registradas para esa factura.",
    };
  }
  if (!facturaId) {
    facturaId = (await bitacora.buscarPorCodigo(codigoGeneracion)).at(-1)?.facturaId ?? null;
  }

  const hacienda = crearClienteHacienda({
    baseUrl: ctx.baseUrl,
    cfg: ctx.cfg,
    fetchImpl: ctx.fetchImpl,
  });
  const inicio = new Date();
  const r = await hacienda.consultar({
    nitEmisor: EMISOR_FICTICIO.nit,
    tdte: "01",
    codigoGeneracion,
  });

  if (r.tipo !== "respuesta" || (r.status !== 200 && r.status !== 400)) {
    return {
      ok: false,
      motivo: "comunicacion",
      mensaje: "No fue posible consultar el estado en este momento.",
    };
  }
  const j = r.json ?? {};
  const encontrado = r.status === 200 && j["estado"] === "PROCESADO";

  if (!encontrado) {
    return {
      ok: true,
      encontrado: false,
      facturaId,
      codigoGeneracion,
      estado: texto(j["estado"]),
      selloRecibido: null,
      fhProcesamiento: null,
      descripcionMsg: texto(j["descripcionMsg"]),
      facturaEstado: null,
      conciliada: false,
      mensaje: "Hacienda no tiene registrado este documento.",
    };
  }

  // Conciliación: Hacienda lo tiene pero el ERP no lo tenía como aceptado.
  const previo = (await bitacora.buscarPorCodigo(codigoGeneracion)).at(-1);
  let conciliada = false;
  if (previo && facturaId) {
    const observaciones = lista(j["observaciones"]);
    // Atómico: si dos consultas llegan a la vez, solo una registra la conciliación.
    conciliada = await bitacora.registrarConciliacion({
      facturaId,
      codigoGeneracion,
      numeroControl: previo.numeroControl,
      dte: previo.dte,
      totales: previo.totales,
      intento: {
        n: 1,
        tipo: "consulta",
        inicio: inicio.toISOString(),
        duracionMs: r.ms,
        resultado: "respuesta",
        httpStatus: r.status,
        codigoMsg: texto(j["codigoMsg"]),
        descripcionMsg: texto(j["descripcionMsg"]),
        error: null,
      },
      resultado: {
        ok: true,
        resultado: observaciones.length > 0 ? "aceptado_con_observaciones" : "aceptado",
        facturaEstado: "Emitida",
        mensaje: "Conciliada por consulta de estado: Hacienda ya había recibido el documento.",
        codigoMsg: texto(j["codigoMsg"]),
        clasificaMsg: texto(j["clasificaMsg"]),
        descripcionMsg: texto(j["descripcionMsg"]),
        selloRecibido: texto(j["selloRecibido"]),
        fhProcesamiento: texto(j["fhProcesamiento"]),
        observaciones,
        envios: 0,
        consultas: 1,
        recuperadoPorConsulta: true,
      },
    });
  }

  return {
    ok: true,
    encontrado: true,
    facturaId,
    codigoGeneracion,
    estado: "PROCESADO",
    selloRecibido: texto(j["selloRecibido"]),
    fhProcesamiento: texto(j["fhProcesamiento"]),
    descripcionMsg: texto(j["descripcionMsg"]),
    facturaEstado: "Emitida",
    conciliada,
    mensaje: conciliada
      ? "Hacienda ya tenía el documento: la factura se concilió como emitida."
      : "Hacienda tiene registrado el documento.",
  };
}
