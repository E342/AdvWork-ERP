import { createFileRoute } from "@tanstack/react-router";
import { handleControl } from "@/backend/hacienda-sim/control";
import { protegido } from "@/backend/hacienda-sim/seguro";

const control = protegido(handleControl);

// Control de escenarios de falla (ACADÉMICO, no existe en Hacienda).
// GET /api/hacienda-sim/control/escenario  |  PUT { "modo": "normal" | ... }
export const Route = createFileRoute("/api/hacienda-sim/control/escenario")({
  server: {
    handlers: {
      GET: ({ request }) => control(request),
      PUT: ({ request }) => control(request),
    },
  },
});
