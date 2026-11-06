/// <reference types="node" />
/**
 * Utilidades de firma COMPARTIDAS entre el ERP y la API simulada de Hacienda.
 *
 * ⚠️ SIMULACIÓN ACADÉMICA: el servicio real de Hacienda firma los DTE como JWS
 * con certificados RSA emitidos por el Ministerio (Guía de Integración v8.0,
 * sección "Firma Electrónica"). Aquí se usa HMAC-SHA512 con una clave de PRUEBA
 * solo para poder demostrar el flujo "firmar → verificar → aceptar/rechazar".
 * No tiene validez legal ni equivale a una firma electrónica certificada.
 *
 * El formato compacto (header.payload.firma en base64url) y el algoritmo HS512
 * coinciden con el JWT de ejemplo que muestra la guía oficial para autenticación.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const b64url = (data: Buffer | string): string => Buffer.from(data).toString("base64url");

export function signCompact(
  payload: unknown,
  secret: string,
  header: Record<string, unknown> = {},
): string {
  const h = b64url(JSON.stringify({ alg: "HS512", typ: "JWT", ...header }));
  const p = b64url(JSON.stringify(payload));
  const sig = createHmac("sha512", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

export type VerifyResult<T> =
  { ok: true; payload: T } | { ok: false; reason: "formato" | "algoritmo" | "firma" | "payload" };

export function verifyCompact<T = unknown>(token: string, secret: string): VerifyResult<T> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    return { ok: false, reason: "formato" };
  }
  const [h, p, s] = parts as [string, string, string];

  let header: { alg?: string } | null;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "formato" };
  }
  if (!header || header.alg !== "HS512") return { ok: false, reason: "algoritmo" };

  const esperada = createHmac("sha512", secret).update(`${h}.${p}`).digest();
  const recibida = Buffer.from(s, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    return { ok: false, reason: "firma" };
  }

  try {
    return { ok: true, payload: JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as T };
  } catch {
    return { ok: false, reason: "payload" };
  }
}

/** UUID v4 en MAYÚSCULAS: formato exigido para `codigoGeneracion` e `idEnvio`. */
export const newUuid = (): string => randomUUID().toUpperCase();

/**
 * Sello de recepción simulado: 40 caracteres alfanuméricos aleatorios.
 * La guía oficial indica que el sello es alfanumérico y NO se genera con
 * información sensible del documento; por eso es aleatorio y no deriva del DTE.
 */
export function newSello(longitud = 40): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(randomBytes(longitud), (b) => alfabeto[b % alfabeto.length]).join("");
}

/** Fecha-hora en zona de El Salvador con el formato oficial dd/MM/yyyy HH:mm:ss. */
export function fechaHoraSV(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const g = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${g("day")}/${g("month")}/${g("year")} ${hh}:${g("minute")}:${g("second")}`;
}
