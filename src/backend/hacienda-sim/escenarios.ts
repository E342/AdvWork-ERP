/**
 * Escenarios de falla CONTROLADOS (ACADÉMICOS, no existen en el servicio real).
 * Permiten demostrar el manejo de errores del ERP de forma reproducible.
 *
 *  normal            funcionamiento normal.
 *  indisponible      HTTP 503; el documento NO se procesa.
 *  timeout           demora > umbral y luego 504; el documento NO se procesa.
 *  timeout_procesado el documento SÍ se procesa y guarda, pero la respuesta se
 *                    demora (> 5 s): el cliente expira aunque Hacienda lo recibió.
 *                    Es el caso que justifica "consultar estado antes de reintentar"
 *                    (política de reintentos de la guía oficial).
 *  error_interno     HTTP 500 con código 099; el documento NO se procesa.
 *
 * Se fija globalmente (PUT /control/escenario) o por solicitud con el
 * encabezado X-Sim-Escenario (útil en Postman).
 */
import { ESCENARIOS, leerDb, mutarDb, type Escenario } from "./store";

export const esEscenario = (v: unknown): v is Escenario =>
  typeof v === "string" && (ESCENARIOS as readonly string[]).includes(v);

export async function escenarioActivo(request: Request): Promise<Escenario> {
  const porCabecera = request.headers.get("x-sim-escenario");
  if (esEscenario(porCabecera)) return porCabecera;
  return (await leerDb()).escenario.modo;
}

export const fijarEscenario = (modo: Escenario): Promise<Escenario> =>
  mutarDb((db) => {
    db.escenario.modo = modo;
    return modo;
  });

export const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
