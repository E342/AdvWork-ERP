import { createFileRoute } from "@tanstack/react-router";
import { handleRecepcion } from "@/backend/hacienda-sim/recepcion";
import { protegido } from "@/backend/hacienda-sim/seguro";

const recepcion = protegido(handleRecepcion);

// API SIMULADA de Hacienda. POST /api/hacienda-sim/fesv/recepciondte
export const Route = createFileRoute("/api/hacienda-sim/fesv/recepciondte")({
  server: { handlers: { POST: ({ request }) => recepcion(request) } },
});
