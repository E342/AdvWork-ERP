/**
 * Cliente HTTP del ERP hacia la API (simulada) de Hacienda.
 *
 * - Autentica con user/pwd (form-urlencoded) y guarda el token en memoria
 *   mientras sea válido (la guía recomienda autenticarse una vez por vigencia
 *   del token, no en cada envío).
 * - Ante un 401 descarta el token, se autentica de nuevo y repite UNA vez.
 * - Cada llamada tiene un umbral de espera (5 s por defecto, como la política
 *   de reintentos oficial). La política de reintentos en sí (consultar estado,
 *   reenviar, contingencia) vive en transmitir.ts.
 * - `fetchImpl` es inyectable para poder probar sin red.
 *
 * El token y las credenciales nunca se escriben en logs ni en la bitácora.
 */
import type { ErpDteConfig } from "./config";

export type RespuestaHttp =
  | { tipo: "respuesta"; status: number; json: Record<string, unknown> | null; ms: number }
  | { tipo: "timeout"; ms: number }
  | { tipo: "red"; mensaje: string; ms: number }
  | { tipo: "autenticacion"; mensaje: string; ms: number };

type TokenCache = { token: string; expiraMs: number };
// Compartido entre solicitudes (módulo) y separado por URL+usuario.
const cacheTokens = new Map<string, TokenCache>();

/** Limpia el caché (útil en pruebas). */
export const limpiarCacheTokens = (): void => cacheTokens.clear();

const MARGEN_MS = 60_000;

function expiracionDelToken(bearer: string, ahora: number): number {
  try {
    const jwt = bearer.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as {
      exp?: number;
    };
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    /* se usa el valor por defecto */
  }
  return ahora + 10 * 60_000;
}

export function crearClienteHacienda(opciones: {
  baseUrl: string;
  cfg: ErpDteConfig;
  fetchImpl?: typeof fetch;
  reloj?: () => number;
}) {
  const { baseUrl, cfg } = opciones;
  const llamar = opciones.fetchImpl ?? fetch;
  const ahora = opciones.reloj ?? Date.now;
  const clave = `${baseUrl}|${cfg.user}`;

  async function http(ruta: string, init: RequestInit): Promise<RespuestaHttp> {
    const t0 = ahora();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
    try {
      const r = await llamar(`${baseUrl}${ruta}`, { ...init, signal: ctl.signal });
      const texto = await r.text();
      let json: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = JSON.parse(texto);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          json = parsed as Record<string, unknown>;
        }
      } catch {
        /* cuerpo no JSON: json queda en null */
      }
      return { tipo: "respuesta", status: r.status, json, ms: ahora() - t0 };
    } catch (err) {
      const ms = ahora() - t0;
      if ((err as { name?: string }).name === "AbortError") return { tipo: "timeout", ms };
      return { tipo: "red", mensaje: (err as Error).message ?? "Error de red", ms };
    } finally {
      clearTimeout(timer);
    }
  }

  async function obtenerToken(
    forzar: boolean,
  ): Promise<{ ok: true; token: string } | { ok: false; fallo: RespuestaHttp }> {
    const guardado = cacheTokens.get(clave);
    if (!forzar && guardado && guardado.expiraMs - MARGEN_MS > ahora()) {
      return { ok: true, token: guardado.token };
    }

    const r = await http("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ user: cfg.user, pwd: cfg.pwd }).toString(),
    });
    if (r.tipo !== "respuesta") return { ok: false, fallo: r };

    const body = (r.json?.["body"] ?? null) as { token?: unknown } | null;
    if (r.status === 200 && r.json?.["status"] === "OK" && typeof body?.token === "string") {
      cacheTokens.set(clave, {
        token: body.token,
        expiraMs: expiracionDelToken(body.token, ahora()),
      });
      return { ok: true, token: body.token };
    }
    const mensaje =
      typeof r.json?.["message"] === "string" ? r.json["message"] : `HTTP ${r.status}`;
    return { ok: false, fallo: { tipo: "autenticacion", mensaje, ms: r.ms } };
  }

  /** POST con token. Si recibe 401, renueva el token y repite una sola vez. */
  async function postConToken(ruta: string, cuerpo: unknown): Promise<RespuestaHttp> {
    for (let vez = 0; vez < 2; vez++) {
      const aut = await obtenerToken(vez === 1);
      if (!aut.ok) return aut.fallo;
      const r = await http(ruta, {
        method: "POST",
        headers: { Authorization: aut.token, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (r.tipo === "respuesta" && r.status === 401 && vez === 0) {
        cacheTokens.delete(clave);
        continue;
      }
      return r;
    }
    /* inalcanzable: el bucle siempre retorna */
    return { tipo: "red", mensaje: "Estado inesperado del cliente", ms: 0 };
  }

  return {
    enviar: (peticion: unknown) => postConToken("/fesv/recepciondte", peticion),
    consultar: (q: { nitEmisor: string; tdte: string; codigoGeneracion: string }) =>
      postConToken("/fesv/recepcion/consultadte", q),
  };
}
