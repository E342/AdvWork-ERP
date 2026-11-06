import { createFileRoute } from "@tanstack/react-router";
import { handleConsulta } from "@/backend/hacienda-sim/recepcion";
import { protegido } from "@/backend/hacienda-sim/seguro";

const consulta = protegido(handleConsulta);

// API SIMULADA de Hacienda. POST /api/hacienda-sim/fesv/recepcion/consultadte
export const Route = createFileRoute("/api/hacienda-sim/fesv/recepcion/consultadte")({
  server: { handlers: { POST: ({ request }) => consulta(request) } },
});
