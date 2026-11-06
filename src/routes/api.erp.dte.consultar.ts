import { createFileRoute } from "@tanstack/react-router";
import { handleConsultar } from "@/backend/erp-dte/handlers";

// POST /api/erp/dte/consultar  { facturaId } | { codigoGeneracion }
export const Route = createFileRoute("/api/erp/dte/consultar")({
  server: { handlers: { POST: ({ request }) => handleConsultar(request) } },
});
