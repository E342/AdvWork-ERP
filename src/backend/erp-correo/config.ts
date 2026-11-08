/// <reference types="node" />
/**
 * Configuración del servicio de correo (Resend).
 *
 * Con RESEND_TO_OVERRIDE definido, TODOS los correos llegan a esa dirección
 * sin importar el correo del cliente. Útil en desarrollo sin dominio propio.
 * En producción con dominio verificado, retira esa variable.
 */
const env = (k: string) => { const v = process.env[k]; return v && v.trim() !== "" ? v.trim() : undefined; };

export type CorreoConfig = { apiKey: string | undefined; from: string; toOverride: string | undefined; habilitado: boolean; };

export function getCorreoConfig(): CorreoConfig {
  const apiKey = env("RESEND_API_KEY");
  return { apiKey, from: env("RESEND_FROM") ?? "onboarding@resend.dev", toOverride: env("RESEND_TO_OVERRIDE"), habilitado: !!apiKey };
}
