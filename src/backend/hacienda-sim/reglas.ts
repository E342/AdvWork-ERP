/**
 * Reglas de negocio de la SIMULACIÓN (ACADÉMICAS).
 *
 * Estas reglas NO son las validaciones oficiales de Hacienda: la guía indica que
 * el detalle oficial está en anexos Excel por tipo de documento (no incluidos en
 * este proyecto). Sirven para demostrar aceptación, observación y rechazo.
 * Los códigos usados sí provienen del catálogo oficial.
 */
import { hallazgo, type Hallazgo } from "./catalogo";
import type { SimConfig } from "./config";

type Num = number;
type Item = { ventaGravada?: Num; ivaItem?: Num };
type DteFactura = {
  identificacion?: { ambiente?: string; codigoGeneracion?: string; numeroControl?: string };
  emisor?: { codEstable?: string | null; codPuntoVenta?: string | null };
  receptor?: { numDocumento?: string | null } | null;
  cuerpoDocumento?: Item[];
  resumen?: {
    totalGravada?: Num;
    totalIva?: Num;
    totalPagar?: Num;
    montoTotalOperacion?: Num;
    totalNoGravado?: Num;
    ivaRete?: Num;
  };
};

export type ResultadoReglas = { errores: Hallazgo[]; observaciones: Hallazgo[] };

const IVA = 0.13;
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function aplicarReglas(
  dte: DteFactura,
  codigoGeneracionPeticion: string,
  cfg: SimConfig,
): ResultadoReglas {
  const errores: Hallazgo[] = [];
  const observaciones: Hallazgo[] = [];
  const id = dte.identificacion ?? {};

  // --- Identificación -------------------------------------------------------
  if (id.ambiente !== "00") {
    // La simulación solo opera en ambiente de pruebas "00": nunca simula producción.
    errores.push(hallazgo("11", "007", "identificacion.ambiente"));
  }
  if (id.codigoGeneracion !== codigoGeneracionPeticion) {
    errores.push(hallazgo("11", "003", "identificacion.codigoGeneracion"));
  }
  // numeroControl = DTE-01-{codEstable}{codPuntoVenta}-{correlativo de 15 dígitos}
  const e = dte.emisor ?? {};
  if (id.numeroControl && e.codEstable && e.codPuntoVenta) {
    if (id.numeroControl.slice(7, 15) !== `${e.codEstable}${e.codPuntoVenta}`) {
      errores.push(hallazgo("11", "019", "identificacion.numeroControl"));
    }
  }

  // --- Receptor (regla heredada del prototipo: documento de al menos 8 dígitos) -
  const doc = dte.receptor?.numDocumento;
  if (typeof doc === "string" && doc.replace(/\D/g, "").length < 8) {
    errores.push(hallazgo("13", "003", "receptor.numDocumento"));
  }

  // --- Cálculos --------------------------------------------------------------
  const clasificarDiferencia = (diff: number, clasifica: string, campo: string): void => {
    if (diff <= cfg.tolerancia.ok) return;
    if (diff <= cfg.tolerancia.observacion) {
      observaciones.push(hallazgo(clasifica, "020", campo)); // no rechaza (como en la guía)
    } else {
      errores.push(hallazgo(clasifica, "020", campo)); // la simulación lo eleva a rechazo
    }
  };

  const items = dte.cuerpoDocumento ?? [];
  const r = dte.resumen ?? {};

  items.forEach((it, i) => {
    if (typeof it.ventaGravada === "number" && typeof it.ivaItem === "number") {
      // Regla académica (factura al consumidor): el precio INCLUYE el 13 % de IVA.
      const esperado = (it.ventaGravada / (1 + IVA)) * IVA;
      clasificarDiferencia(Math.abs(esperado - it.ivaItem), "15", `cuerpoDocumento[${i}].ivaItem`);
    }
  });

  const sum = (f: (x: Item) => number | undefined): number =>
    r2(items.reduce((a, x) => a + (f(x) ?? 0), 0));

  if (typeof r.totalGravada === "number") {
    clasificarDiferencia(
      Math.abs(sum((x) => x.ventaGravada) - r.totalGravada),
      "16",
      "resumen.totalGravada",
    );
  }
  if (typeof r.totalIva === "number") {
    clasificarDiferencia(Math.abs(sum((x) => x.ivaItem) - r.totalIva), "16", "resumen.totalIva");
  }
  if (typeof r.totalPagar === "number" && typeof r.montoTotalOperacion === "number") {
    const esperado = r.montoTotalOperacion + (r.totalNoGravado ?? 0) - (r.ivaRete ?? 0);
    clasificarDiferencia(Math.abs(esperado - r.totalPagar), "16", "resumen.totalPagar");
  }

  return { errores, observaciones };
}
