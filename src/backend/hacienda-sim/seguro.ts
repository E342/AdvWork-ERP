/**
 * Envoltorio común de los handlers de la API simulada:
 *  1. Si la simulación no está habilitada (p. ej. producción), responde 404: el servicio no existe.
 *  2. Convierte cualquier excepción en un 500 JSON GENÉRICO. Sin esto, el framework devuelve su
 *     página de error HTML; el detalle real solo se escribe en el log del servidor.
 */
import { jsonSim } from "./auth";
import { simHabilitada } from "./config";

export function protegido(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      if (!simHabilitada()) {
        return jsonSim(
          { status: "ERROR", error: "Not Found", message: "Recurso no disponible." },
          404,
        );
      }
      return await handler(request);
    } catch (err) {
      // Nunca se devuelve err.message: puede contener rutas del servidor.
      console.error(
        "[hacienda-sim] error interno:",
        err instanceof Error ? err.message : "desconocido",
      );
      return jsonSim(
        {
          status: "ERROR",
          error: "Internal Server Error",
          message: "Error interno del servicio simulado.",
        },
        500,
      );
    }
  };
}
