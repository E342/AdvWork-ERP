/**
 * Defensas HTTP reutilizables (backend del ERP y API simulada de Hacienda).
 *
 *  - Límite de tamaño del cuerpo, aplicado EN STREAMING: se corta en cuanto se
 *    supera el máximo, sin cargar en memoria un cuerpo de cientos de MB.
 *  - Verificación de origen (anti-CSRF) para endpoints sin autenticación.
 *  - Cabeceras seguras para respuestas que llevan tokens o datos personales.
 */

/** Cabeceras para respuestas de API: sin caché (llevan tokens y datos personales) y sin "sniffing". */
export const CABECERAS_SEGURAS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** Cuerpos pequeños (autenticación, consultas, control): 64 KB. */
export const LIMITE_CUERPO_PEQUENO = 64 * 1024;
/**
 * Cuerpos con un DTE: 8 MB. El esquema oficial admite hasta 2000 ítems con descripciones de
 * hasta 1500 caracteres (~3 MB) y el DTE firmado crece ~33 % al codificarse en base64.
 */
export const LIMITE_CUERPO_DTE = 8 * 1024 * 1024;

export class CuerpoDemasiadoGrande extends Error {
  constructor(readonly maxBytes: number) {
    super(`El cuerpo de la solicitud excede ${maxBytes} bytes`);
    this.name = "CuerpoDemasiadoGrande";
  }
}

/** Lee el cuerpo como texto UTF-8 sin permitir que supere `maxBytes`. */
export async function leerTextoLimitado(request: Request, maxBytes: number): Promise<string> {
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new CuerpoDemasiadoGrande(maxBytes);
  if (!request.body) return "";

  const lector = request.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => undefined);
      throw new CuerpoDemasiadoGrande(maxBytes);
    }
    trozos.push(value);
  }
  const unido = new Uint8Array(total);
  let posicion = 0;
  for (const t of trozos) {
    unido.set(t, posicion);
    posicion += t.byteLength;
  }
  return new TextDecoder("utf-8").decode(unido);
}

/**
 * Anti-CSRF para endpoints SIN login: ¿la petición viene de nuestro propio sitio?
 *
 * - Si el navegador envía `Sec-Fetch-Site` (todos los modernos), solo se aceptan
 *   `same-origin` (y `none`: acción directa del usuario). `same-site` y `cross-site` se rechazan.
 * - Si no existe (clientes antiguos), se compara `Origin` con el origen de la petición o con la
 *   lista explícita `extras` (necesaria detrás de un proxy que cambia el esquema/host).
 * - Si no hay ninguno de los dos, no es un navegador (Postman, curl, scripts): se acepta. Un
 *   atacante en un navegador siempre envía al menos uno de ellos.
 */
export function origenPermitido(request: Request, extras: readonly string[] = []): boolean {
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio) return sitio === "same-origin" || sitio === "none";

  const origen = request.headers.get("origin");
  if (!origen) return true;
  if (origen === new URL(request.url).origin) return true;
  return extras.includes(origen);
}

/**
 * ¿El cuerpo declara ser JSON? Un formulario HTML de otro sitio solo puede enviar
 * `text/plain`, `multipart/form-data` o `application/x-www-form-urlencoded` sin pedir permiso
 * (preflight CORS); exigir `application/json` cierra ese camino.
 */
export const contenidoEsJson = (request: Request): boolean =>
  (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const esLoopback = (hostname: string): boolean => LOOPBACK.has(hostname.toLowerCase());

/** Nombre de host (sin puerto) con el que el cliente dice haber llegado: cabecera Host o, si falta, la URL. */
export function nombreDeHost(request: Request): string {
  const h = (request.headers.get("host") ?? new URL(request.url).host).trim().toLowerCase();
  if (h.startsWith("[")) {
    const fin = h.indexOf("]");
    return fin === -1 ? h : h.slice(0, fin + 1);
  }
  return h.split(":")[0] ?? "";
}

/**
 * Anti DNS-rebinding: solo se atienden peticiones dirigidas a un host conocido (local o declarado
 * por el operador). Con rebinding, el navegador de la víctima cree que `evil.example` es "su mismo
 * origen" (el chequeo de origen pasa) mientras el nombre resuelve a nuestro servidor; la única
 * señal es el `Host`. Se comprueban a la vez la cabecera Host y el host de la URL de la petición.
 */
export function hostPermitido(request: Request, extras: readonly string[] = []): boolean {
  const permitidos = new Set(extras.map((e) => e.toLowerCase()));
  const nombres = [nombreDeHost(request), new URL(request.url).hostname.toLowerCase()];
  return nombres.every((n) => esLoopback(n) || permitidos.has(n));
}
