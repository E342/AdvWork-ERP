/**
 * Cliente (navegador) del backend del ERP para facturación electrónica.
 *
 * El navegador SOLO habla con /api/erp/dte/*; nunca con la API simulada de
 * Hacienda (esa comunicación externa la hace el servidor del ERP).
 *
 * Los `import type` se borran al compilar: no llevan código de servidor al
 * bundle del navegador. No importes aquí valores de `@/backend/*`.
 */
import type { Transmision } from "@/backend/erp-dte/bitacora";
import type { RespuestaTransmision } from "@/backend/erp-dte/transmitir";
import type { Cliente, Factura } from "./erp-data";

const BASE = "/api/erp/dte";

/**
 * El servidor puede tardar hasta ~15 s (3 envíos x 5 s) cuando Hacienda no
 * responde, o más si además falla la consulta de estado. Pasado este límite el
 * navegador deja de esperar, pero el servidor sigue y el resultado queda en la bitácora.
 */
export const ESPERA_MAXIMA_MS = 60_000;

export type ErrorSolicitud = {
  ok: false;
  error: string;
  mensaje: string;
  detalles?: string[];
};

export type RespuestaConsulta =
  | {
      ok: true;
      encontrado: boolean;
      facturaId: string | null;
      codigoGeneracion: string;
      estado: string | null;
      selloRecibido: string | null;
      fhProcesamiento: string | null;
      descripcionMsg: string | null;
      facturaEstado: "Emitida" | null;
      conciliada: boolean;
      mensaje: string;
    }
  | { ok: false; motivo?: "desconocida" | "comunicacion"; mensaje: string; error?: string };

export type ResumenTransmision = {
  id: string;
  origen: Transmision["origen"];
  facturaId: string;
  codigoGeneracion: string;
  numeroControl: string;
  iniciadaEn: string;
  finalizadaEn: string | null;
  estadoProceso: Transmision["estadoProceso"];
  resultado: string | null;
  facturaEstado: string | null;
  codigoMsg: string | null;
  selloRecibido: string | null;
  envios: number;
  consultas: number;
};

/** Resultado de una llamada: o hubo respuesta HTTP (con o sin JSON) o no hubo. */
export type Llamada<T> =
  | { tipo: "respuesta"; status: number; datos: T | null }
  | { tipo: "timeout" }
  | { tipo: "sin_conexion"; mensaje: string };

async function llamar<T>(ruta: string, init?: RequestInit): Promise<Llamada<T>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ESPERA_MAXIMA_MS);
  try {
    const r = await fetch(`${BASE}${ruta}`, { ...init, signal: ctl.signal });
    let datos: T | null = null;
    try {
      datos = (await r.json()) as T;
    } catch {
      /* cuerpo vacío o no JSON (p. ej. una página de error): datos = null */
    }
    return { tipo: "respuesta", status: r.status, datos };
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return { tipo: "timeout" };
    return { tipo: "sin_conexion", mensaje: (err as Error).message ?? "Sin conexión" };
  } finally {
    clearTimeout(timer);
  }
}

const json = (cuerpo: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

/** Arma el cuerpo que espera el backend (solo los campos necesarios, sin undefined). */
export function cuerpoTransmision(f: Factura, c: Cliente) {
  return {
    factura: {
      id: f.id,
      folio: f.folio,
      serie: f.serie,
      pedidoId: f.pedidoId,
      items: f.items.map((i) => ({
        codigo: i.codigo,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
        descuento: i.descuento,
      })),
    },
    cliente: {
      nombre: c.nombre,
      documento: c.documento,
      ...(c.direccion ? { direccion: c.direccion } : {}),
      ...(c.telefono ? { telefono: c.telefono } : {}),
      ...(c.correo ? { correo: c.correo } : {}),
    },
  };
}

export const transmitirDte = (f: Factura, c: Cliente) =>
  llamar<RespuestaTransmision | ErrorSolicitud>("/transmitir", json(cuerpoTransmision(f, c)));

export const consultarEstadoDte = (facturaId: string) =>
  llamar<RespuestaConsulta>("/consultar", json({ facturaId }));

export const listarTransmisiones = (facturaId: string) =>
  llamar<{ total: number; transmisiones: ResumenTransmision[] }>(
    `/transmisiones?facturaId=${encodeURIComponent(facturaId)}`,
  );

export const detalleTransmision = (id: string) =>
  llamar<Transmision>(`/transmisiones/${encodeURIComponent(id)}`);

/** ¿La respuesta es un resultado de negocio (aceptado/rechazado/pendiente) y no un error de solicitud? */
export const esResultadoTransmision = (
  d: RespuestaTransmision | ErrorSolicitud | null,
): d is RespuestaTransmision => !!d && typeof d === "object" && "facturaEstado" in d;

export type { RespuestaTransmision, Transmision };
