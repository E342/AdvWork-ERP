/**
 * Bitácora de transmisiones del ERP (data/erp-transmisiones.json).
 * Registra, por cada solicitud de emisión: el DTE enviado, cada intento (envío o
 * consulta) con su fecha, duración y respuesta, y el resultado final.
 * Es el "lado ERP"; la API simulada guarda aparte lo que ella recibió.
 */
import path from "node:path";
import { crearJsonStore } from "../shared/json-store";
import { getErpDteConfig } from "./config";
import type { TotalesDte } from "./dte-builder";

export type Resultado =
  | "aceptado"
  | "aceptado_con_observaciones"
  | "rechazado"
  | "sin_respuesta"
  | "servicio_no_disponible"
  | "error_servicio"
  | "error_autenticacion"
  | "respuesta_inesperada";

export type FacturaEstado = "Emitida" | "Rechazada" | "Pendiente de envío";

export type ResultadoFinal = {
  ok: boolean;
  resultado: Resultado;
  facturaEstado: FacturaEstado;
  mensaje: string;
  codigoMsg: string | null;
  clasificaMsg: string | null;
  descripcionMsg: string | null;
  selloRecibido: string | null;
  fhProcesamiento: string | null;
  observaciones: string[];
  envios: number;
  consultas: number;
  recuperadoPorConsulta: boolean;
};

export type Intento = {
  n: number;
  tipo: "envio" | "consulta";
  inicio: string; // ISO-8601
  duracionMs: number;
  resultado: "respuesta" | "timeout" | "red" | "autenticacion";
  httpStatus: number | null;
  codigoMsg: string | null;
  descripcionMsg: string | null;
  error: string | null;
};

export type Transmision = {
  id: string;
  origen: "envio" | "consulta_manual";
  facturaId: string;
  codigoGeneracion: string;
  numeroControl: string;
  iniciadaEn: string;
  finalizadaEn: string | null;
  estadoProceso: "en_proceso" | "finalizada";
  dte: unknown;
  totales: TotalesDte;
  intentos: Intento[];
  resultado: ResultadoFinal | null;
};

type Datos = { contador: number; transmisiones: Transmision[] };

const store = crearJsonStore<Datos>({
  archivo: () => path.resolve(process.cwd(), getErpDteConfig().dataDir, "erp-transmisiones.json"),
  vacio: () => ({ contador: 0, transmisiones: [] }),
});

export const listar = async (): Promise<Transmision[]> => (await store.leer()).transmisiones;

export const porFactura = async (facturaId: string): Promise<Transmision[]> =>
  (await listar()).filter((t) => t.facturaId === facturaId);

export const porId = async (id: string): Promise<Transmision | undefined> =>
  (await listar()).find((t) => t.id === id);

export const buscarPorCodigo = async (codigoGeneracion: string): Promise<Transmision[]> =>
  (await listar()).filter((t) => t.codigoGeneracion === codigoGeneracion);

export function iniciar(datos: {
  origen: Transmision["origen"];
  facturaId: string;
  codigoGeneracion: string;
  numeroControl: string;
  dte: unknown;
  totales: TotalesDte;
}): Promise<Transmision> {
  return store.mutar((d) => {
    d.contador += 1;
    const t: Transmision = {
      id: `TRX-${String(d.contador).padStart(4, "0")}`,
      ...datos,
      iniciadaEn: new Date().toISOString(),
      finalizadaEn: null,
      estadoProceso: "en_proceso",
      intentos: [],
      resultado: null,
    };
    d.transmisiones.push(t);
    return t;
  });
}

export function agregarIntento(id: string, intento: Intento): Promise<void> {
  return store.mutar((d) => {
    d.transmisiones.find((t) => t.id === id)?.intentos.push(intento);
  });
}

export function finalizar(id: string, resultado: ResultadoFinal): Promise<void> {
  return store.mutar((d) => {
    const t = d.transmisiones.find((x) => x.id === id);
    if (t) {
      t.resultado = resultado;
      t.estadoProceso = "finalizada";
      t.finalizadaEn = new Date().toISOString();
    }
  });
}

/**
 * Registra, de forma ATÓMICA, la conciliación de un documento que Hacienda ya tenía
 * pero el ERP no tenía como aceptado. Si dos consultas llegan a la vez, solo una
 * registra (devuelve true); la otra encuentra el documento ya aceptado (false).
 */
export function registrarConciliacion(datos: {
  facturaId: string;
  codigoGeneracion: string;
  numeroControl: string;
  dte: unknown;
  totales: TotalesDte;
  intento: Intento;
  resultado: ResultadoFinal;
}): Promise<boolean> {
  return store.mutar((d) => {
    const yaAceptado = d.transmisiones.some(
      (t) => t.codigoGeneracion === datos.codigoGeneracion && t.resultado?.ok,
    );
    if (yaAceptado) return false;
    d.contador += 1;
    const ahora = new Date().toISOString();
    d.transmisiones.push({
      id: `TRX-${String(d.contador).padStart(4, "0")}`,
      origen: "consulta_manual",
      facturaId: datos.facturaId,
      codigoGeneracion: datos.codigoGeneracion,
      numeroControl: datos.numeroControl,
      iniciadaEn: ahora,
      finalizadaEn: ahora,
      estadoProceso: "finalizada",
      dte: datos.dte,
      totales: datos.totales,
      intentos: [datos.intento],
      resultado: datos.resultado,
    });
    return true;
  });
}
