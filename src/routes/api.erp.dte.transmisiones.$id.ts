import { createFileRoute } from "@tanstack/react-router";
import { handleDetalle } from "@/backend/erp-dte/handlers";

// GET /api/erp/dte/transmisiones/TRX-0001
export const Route = createFileRoute("/api/erp/dte/transmisiones/$id")({
  server: { handlers: { GET: ({ request, params }) => handleDetalle(request, params.id) } },
});
