/// <reference types="node" />
/**
 * Configuración del cliente ERP -> API SIMULADA de Hacienda.
 *
 * Todas las credenciales y claves son FICTICIAS. Los valores por defecto solo se
 * aceptan fuera de producción y COINCIDEN con los de la API simulada para que
 * todo funcione sin configurar nada. Si cambias los de un lado en el `.env`,
 * cambia también los del otro (HACIENDA_SIM_* <-> ERP_DTE_*).
 */
export type ErpDteConfig = {
  /** URL base de la API. Si no se define, se usa el propio origen + /api/hacienda-sim. */
  apiUrl: string | undefined;
  user: string;
  pwd: string;
  /** Clave de PRUEBA para el JWS simulado (debe coincidir con la de la API simulada). */
  firmaSecret: string;
  /** Umbral de espera por respuesta. 5 s según la política de reintentos oficial. */
  timeoutMs: number;
  /** Reintentos de envío tras el primero (máximo 2 según la política oficial). */
  maxReintentos: number;
  dataDir: string;
  /** Orígenes extra aceptados por la verificación anti-CSRF (detrás de un proxy con otro host/esquema). */
  origenesPermitidos: string[];
  /**
   * Hosts (sin puerto) aceptados además de localhost. Seguro por defecto: si el ERP se publica
   * en un dominio o se abre por IP desde otra máquina, hay que declararlo (ERP_DTE_ALLOWED_HOSTS).
   */
  hostsPermitidos: string[];
};

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

const entero = (name: string, def: number, min: number): number => {
  const raw = env(name);
  const n = raw === undefined ? def : Number(raw);
  return Number.isInteger(n) && n >= min ? n : def;
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * La URL de la API debe ser HTTPS. Única excepción: un host local (loopback), pensado para
 * desarrollo y para la simulación en la misma máquina. Así las credenciales y el DTE nunca
 * viajan en claro por una red.
 */
export function validarUrlApi(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("ERP_DTE_API_URL no es una URL válida");
  }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && LOOPBACK.has(u.hostname))) {
    throw new Error("ERP_DTE_API_URL debe usar https:// (http:// solo se admite en localhost)");
  }
  return url.replace(/\/+$/, "");
}

export function getErpDteConfig(): ErpDteConfig {
  const produccion = env("NODE_ENV") === "production";
  const requerida = (name: string, valorDev: string): string => {
    const v = env(name);
    if (v) return v;
    if (produccion) throw new Error(`Falta la variable de entorno obligatoria ${name}`);
    return valorDev;
  };

  // En producción la URL debe configurarse explícitamente: no se deduce de la petición entrante.
  const apiUrlCruda = env("ERP_DTE_API_URL");
  if (produccion && !apiUrlCruda) {
    throw new Error("Falta la variable de entorno obligatoria ERP_DTE_API_URL");
  }
  const apiUrl = apiUrlCruda ? validarUrlApi(apiUrlCruda) : undefined;

  const origenesPermitidos = (env("ERP_DTE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    apiUrl,
    user: requerida("ERP_DTE_USER", "SIM-FACTURADOR-01"),
    pwd: requerida("ERP_DTE_PWD", "SIM-NO-REAL-Pwd#2026"),
    firmaSecret: requerida("ERP_DTE_FIRMA_SECRET", "dev-only-firma-secret-NOT-REAL"),
    timeoutMs: entero("ERP_DTE_TIMEOUT_MS", 5000, 100),
    maxReintentos: entero("ERP_DTE_MAX_REINTENTOS", 2, 0),
    dataDir: env("ERP_DTE_DATA_DIR") ?? "data",
    origenesPermitidos,
    hostsPermitidos: [
      ...(env("ERP_DTE_ALLOWED_HOSTS") ?? "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
      // El host de cada origen declarado también es un host aceptado.
      ...origenesPermitidos.map((o) => {
        try {
          return new URL(o).hostname.toLowerCase();
        } catch {
          return "";
        }
      }),
    ].filter(Boolean),
  };
}
