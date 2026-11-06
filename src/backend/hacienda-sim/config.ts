/// <reference types="node" />
/**
 * Configuración de la API SIMULADA de Hacienda.
 *
 * Todas las credenciales y claves son FICTICIAS (no existen credenciales reales
 * del Ministerio de Hacienda en este proyecto). Los valores por defecto solo se
 * aceptan fuera de producción; con NODE_ENV=production las variables son
 * obligatorias para evitar desplegar claves de desarrollo por accidente.
 */
export type SimConfig = {
  user: string;
  pwd: string;
  jwtSecret: string;
  firmaSecret: string;
  tokenTtlHours: number;
  dataDir: string;
  timeoutMs: number;
  /** Tolerancias (USD) para reglas de cálculo. ACADÉMICAS, no oficiales. */
  tolerancia: { ok: number; observacion: number };
};

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

const numero = (name: string, def: number): number => {
  const raw = env(name);
  const n = raw === undefined ? def : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/**
 * ¿Está habilitada la API simulada? Por defecto SOLO fuera de producción: así un despliegue
 * de producción no expone por accidente un "Hacienda falso" ni el endpoint de control de
 * escenarios. Se puede forzar con HACIENDA_SIM_ENABLED=true|false.
 */
export function simHabilitada(): boolean {
  const explicito = env("HACIENDA_SIM_ENABLED")?.toLowerCase();
  if (explicito === "true") return true;
  if (explicito === "false") return false;
  return env("NODE_ENV") !== "production";
}

export function getSimConfig(): SimConfig {
  const produccion = env("NODE_ENV") === "production";
  const requerida = (name: string, valorDev: string): string => {
    const v = env(name);
    if (v) return v;
    if (produccion) throw new Error(`Falta la variable de entorno obligatoria ${name}`);
    return valorDev;
  };

  return {
    user: requerida("HACIENDA_SIM_USER", "SIM-FACTURADOR-01"),
    pwd: requerida("HACIENDA_SIM_PWD", "SIM-NO-REAL-Pwd#2026"),
    jwtSecret: requerida("HACIENDA_SIM_JWT_SECRET", "dev-only-jwt-secret-NOT-REAL"),
    firmaSecret: requerida("HACIENDA_SIM_FIRMA_SECRET", "dev-only-firma-secret-NOT-REAL"),
    tokenTtlHours: numero("HACIENDA_SIM_TOKEN_TTL_HOURS", 12),
    dataDir: env("HACIENDA_SIM_DATA_DIR") ?? "data",
    timeoutMs: numero("HACIENDA_SIM_TIMEOUT_MS", 6000),
    tolerancia: { ok: 0.02, observacion: 0.1 },
  };
}
