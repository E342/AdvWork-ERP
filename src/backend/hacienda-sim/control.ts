/**
 * Control de escenarios (ACADÉMICO): GET consulta el modo activo, PUT lo cambia.
 * Requiere el mismo Bearer que el resto de servicios.
 */
import { LIMITE_CUERPO_PEQUENO } from "../shared/http-seguro";
import { jsonSim, leerCuerpoSim, verificarBearer } from "./auth";
import { esEscenario, fijarEscenario } from "./escenarios";
import { ESCENARIOS, leerDb } from "./store";

export async function handleControl(request: Request): Promise<Response> {
  const denegado = verificarBearer(request);
  if (denegado) return denegado;

  if (request.method === "PUT") {
    const leido = await leerCuerpoSim(request, LIMITE_CUERPO_PEQUENO);
    if (!leido.ok) return leido.respuesta;
    let cuerpo: { modo?: unknown } | null = null;
    try {
      cuerpo = JSON.parse(leido.texto);
    } catch {
      /* se responde abajo */
    }
    if (!cuerpo || !esEscenario(cuerpo.modo)) {
      return jsonSim(
        { status: "ERROR", message: `modo debe ser uno de: ${ESCENARIOS.join(", ")}` },
        400,
      );
    }
    return jsonSim({ modo: await fijarEscenario(cuerpo.modo), disponibles: ESCENARIOS });
  }

  return jsonSim({ modo: (await leerDb()).escenario.modo, disponibles: ESCENARIOS });
}
