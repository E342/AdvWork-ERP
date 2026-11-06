import { createFileRoute } from "@tanstack/react-router";
import { handleListar } from "@/backend/erp-dte/handlers";

// GET /api/erp/dte/transmisiones[?facturaId=FAC-0155]
export const Route = createFileRoute("/api/erp/dte/transmisiones/")({
  server: { handlers: { GET: ({ request }) => handleListar(request) } },
});
