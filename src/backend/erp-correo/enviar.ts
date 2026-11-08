/// <reference types="node" />
/**
 * Servicio de envío de correos con Resend.
 *
 * Si RESEND_API_KEY no está definida, registra el correo en la consola
 * del servidor (modo "preview" sin envío real) para que el flujo funcione
 * aunque no haya configuración. Con la clave definida, envía de verdad.
 */
import { getCorreoConfig } from "./config";

export type ResultadoEnvio =
  | { ok: true; id: string; destinatario: string }
  | { ok: false; error: string; preview: boolean };

export async function enviarCorreo(params: {
  to: string;
  asunto: string;
  html: string;
}): Promise<ResultadoEnvio> {
  const cfg = getCorreoConfig();
  const destinatario = cfg.toOverride ?? params.to;

  if (!cfg.habilitado) {
    // Sin API key: imprime en consola del servidor (útil durante desarrollo)
    console.log(
      `[erp-correo] PREVIEW (sin RESEND_API_KEY)\n` +
        `  Para: ${destinatario}\n  Asunto: ${params.asunto}\n` +
        `  (El HTML del correo no se imprime para no saturar los logs)`,
    );
    return { ok: false, error: "RESEND_API_KEY no configurada", preview: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(cfg.apiKey);

    const { data, error } = await resend.emails.send({
      from: cfg.from,
      to: [destinatario],
      subject: params.asunto,
      html: params.html,
    });

    if (error || !data) {
      const msg = error?.message ?? "Error desconocido de Resend";
      console.error("[erp-correo] Error al enviar:", msg);
      return { ok: false, error: msg, preview: false };
    }

    console.log(`[erp-correo] Enviado a ${destinatario} · id=${data.id}`);
    return { ok: true, id: data.id, destinatario };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[erp-correo] Excepción:", msg);
    return { ok: false, error: msg, preview: false };
  }
}
