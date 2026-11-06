/**
 * Servicio de autenticación SIMULADO (POST /api/hacienda-sim/auth).
 *
 * OFICIAL (Guía v8.0): ruta /auth, body form-urlencoded con `user` y `pwd`,
 * respuesta { status, body: { user, token: "Bearer <jwt>", rol, roles, tokenType } }
 * y, ante credenciales inválidas, { status: "ERROR", error, message } con HTTP 200.
 * ACADÉMICO: credenciales y clave de firma ficticias; vigencia configurable
 * (la guía indica 12 h en una sección y 48 h en otra para pruebas).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { signCompact, verifyCompact } from "../shared/hmac-jws";
import {
  CABECERAS_SEGURAS,
  CuerpoDemasiadoGrande,
  LIMITE_CUERPO_PEQUENO,
  leerTextoLimitado,
} from "../shared/http-seguro";
import { getSimConfig } from "./config";

export const jsonSim = (body: unknown, status = 200, extra: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Identifica la respuesta como simulada (no es el servicio real de Hacienda).
      "X-AdvWork-Simulacion": "true",
      ...CABECERAS_SEGURAS,
      ...extra,
    },
  });

/** Lee el cuerpo con límite de tamaño; si lo supera devuelve la respuesta 413 lista. */
export async function leerCuerpoSim(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; texto: string } | { ok: false; respuesta: Response }> {
  try {
    return { ok: true, texto: await leerTextoLimitado(request, maxBytes) };
  } catch (err) {
    if (err instanceof CuerpoDemasiadoGrande) {
      return {
        ok: false,
        respuesta: jsonSim(
          {
            status: "ERROR",
            error: "Payload Too Large",
            message: "El cuerpo de la solicitud excede el tamaño permitido.",
          },
          413,
        ),
      };
    }
    throw err;
  }
}

const hash = (s: string): Buffer => createHash("sha256").update(s).digest();
const iguales = (a: string, b: string): boolean => timingSafeEqual(hash(a), hash(b));

export async function handleAuth(request: Request): Promise<Response> {
  const cfg = getSimConfig();
  const cuerpo = await leerCuerpoSim(request, LIMITE_CUERPO_PEQUENO);
  if (!cuerpo.ok) return cuerpo.respuesta;
  const params = new URLSearchParams(cuerpo.texto);
  const user = params.get("user") ?? "";
  const pwd = params.get("pwd") ?? "";

  if (!iguales(user, cfg.user) || !iguales(pwd, cfg.pwd)) {
    return jsonSim({ status: "ERROR", error: "Unauthorized", message: "Usuario no valido" });
  }

  const ahora = Math.floor(Date.now() / 1000);
  const jwt = signCompact(
    { sub: user, authorities: "Usuario", iat: ahora, exp: ahora + cfg.tokenTtlHours * 3600 },
    cfg.jwtSecret,
  );
  return jsonSim({
    status: "OK",
    body: {
      user,
      token: `Bearer ${jwt}`,
      rol: {
        nombre: "Usuario",
        codigo: "ROLE_USER",
        descripcion: null,
        rolSuperior: null,
        nivel: null,
        activo: null,
        permisos: null,
      },
      roles: ["ROLE_USER"],
      tokenType: "Bearer",
    },
  });
}

/** Valida el encabezado Authorization. Devuelve null si es válido. */
export function verificarBearer(request: Request): Response | null {
  const cfg = getSimConfig();
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
  const denegado = (message: string): Response =>
    jsonSim({ status: "ERROR", error: "Unauthorized", message }, 401);

  if (!token) return denegado("Token no proporcionado");
  const v = verifyCompact<{ exp?: number }>(token, cfg.jwtSecret);
  if (!v.ok) return denegado("Token no valido");
  if (typeof v.payload.exp !== "number" || v.payload.exp < Math.floor(Date.now() / 1000)) {
    return denegado("Token expirado");
  }
  return null;
}
