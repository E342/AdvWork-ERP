import { createFileRoute } from "@tanstack/react-router";
import { enviarCorreo } from "@/backend/erp-correo/enviar";
import { correoDteEmitido } from "@/backend/erp-correo/plantillas";
import { contenidoEsJson, leerTextoLimitado, origenPermitido, CABECERAS_SEGURAS } from "@/backend/shared/http-seguro";
import { getErpDteConfig } from "@/backend/erp-dte/config";

// POST /api/erp/correo/dte  — envía el DTE emitido al cliente
export const Route = createFileRoute("/api/erp/correo/dte")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = getErpDteConfig();
        if (!origenPermitido(request, cfg.origenesPermitidos) || !contenidoEsJson(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Prohibido" }), { status: 403, headers: CABECERAS_SEGURAS });
        }
        try {
          const texto = await leerTextoLimitado(request, 64 * 1024);
          const datos = JSON.parse(texto);
          const plantilla = correoDteEmitido(datos);
          const resultado = await enviarCorreo({ to: datos.cliente.correo, ...plantilla });
          return new Response(JSON.stringify(resultado), {
            status: resultado.ok ? 200 : 207,
            headers: { "Content-Type": "application/json", ...CABECERAS_SEGURAS },
          });
        } catch (err) {
          console.error("[api.erp.correo.dte]", err);
          return new Response(JSON.stringify({ ok: false, error: "Error interno" }), { status: 500, headers: CABECERAS_SEGURAS });
        }
      },
    },
  },
});
