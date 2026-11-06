import { createFileRoute } from "@tanstack/react-router";
import { handleAuth } from "@/backend/hacienda-sim/auth";
import { protegido } from "@/backend/hacienda-sim/seguro";

const auth = protegido(handleAuth);

// API SIMULADA de Hacienda (no es el servicio real). POST /api/hacienda-sim/auth
export const Route = createFileRoute("/api/hacienda-sim/auth")({
  server: { handlers: { POST: ({ request }) => auth(request) } },
});
