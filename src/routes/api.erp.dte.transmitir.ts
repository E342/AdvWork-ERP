import { createFileRoute } from "@tanstack/react-router";
import { handleTransmitir } from "@/backend/erp-dte/handlers";

// Backend del ERP: emite una factura hacia la API SIMULADA de Hacienda.
// POST /api/erp/dte/transmitir  { factura, cliente }
export const Route = createFileRoute("/api/erp/dte/transmitir")({
  server: { handlers: { POST: ({ request }) => handleTransmitir(request) } },
});
