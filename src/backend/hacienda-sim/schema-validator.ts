/**
 * Validación estructural del DTE contra el JSON Schema OFICIAL de Factura
 * (fe-f-v2.json, descargado del portal factura.gob.sv).
 *
 * Qué es oficial aquí: el esquema (campos, tipos, patrones, rangos).
 * Qué es ACADÉMICO aquí: la traducción de cada violación del esquema a un
 * código del catálogo (la guía no publica esa correspondencia campo a campo).
 */
import Ajv from "ajv8";
import schemaFactura from "./schemas/fe-f-v2.json";
import { hallazgo, type Hallazgo } from "./catalogo";

const fechaValida = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const ajv = new Ajv({
  allErrors: true,
  strict: false, // el esquema oficial usa tipos unión ("type": ["string","null"])
  allowUnionTypes: true,
  formats: { date: { type: "string", validate: fechaValida } },
});

/**
 * Número de decimales de un valor a partir de su representación decimal.
 * (JSON.parse produce el número cuya representación más corta es la escrita.)
 */
export function decimalesDe(n: number): number {
  const m = /^-?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(n));
  if (!m) return Number.POSITIVE_INFINITY;
  return Math.max(0, (m[2]?.length ?? 0) - Number(m[3] ?? 0));
}

// El esquema oficial declara `multipleOf` con potencias de 10 negativas (0.01, 1e-8).
// Con coma flotante `1234.56 / 1e-8` no es un entero exacto y Ajv rechazaría valores
// válidos. Se sustituye (solo en memoria) por "máximo k decimales", equivalente a lo que
// hace el validador real con aritmética decimal. El archivo oficial no se modifica.
ajv.addKeyword({
  keyword: "x-maxDecimales",
  type: "number",
  schemaType: "number",
  validate: (maximo: number, valor: number) => decimalesDe(valor) <= maximo,
});

function adaptarMultipleOf(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(adaptarMultipleOf);
  if (nodo && typeof nodo === "object") {
    const copia: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nodo)) copia[k] = adaptarMultipleOf(v);
    const m = copia["multipleOf"];
    if (typeof m === "number" && m > 0 && m < 1) {
      const k = Math.round(-Math.log10(m));
      if (Math.abs(10 ** -k - m) < 1e-15) {
        delete copia["multipleOf"];
        copia["x-maxDecimales"] = k;
      }
    }
    return copia;
  }
  return nodo;
}

const validarFactura = ajv.compile(adaptarMultipleOf(schemaFactura) as object);

/** Clasificación (clasificaMsg) según la sección del DTE donde ocurre el error. */
const CLASIFICA_POR_SECCION: Record<string, string> = {
  identificacion: "11",
  otrosDocumentos: "11",
  emisor: "12",
  receptor: "13",
  documentoRelacionado: "14",
  cuerpoDocumento: "15",
  resumen: "16",
  apendice: "18",
  ventaTercero: "21",
};

/** "/cuerpoDocumento/0/ventaGravada" -> "cuerpoDocumento[0].ventaGravada" */
export function aRutaCampo(instancePath: string, extra?: string): string {
  const segmentos = instancePath.split("/").filter(Boolean);
  if (extra) segmentos.push(extra);
  return segmentos.reduce(
    (ruta, seg) => (/^\d+$/.test(seg) ? `${ruta}[${seg}]` : ruta ? `${ruta}.${seg}` : seg),
    "",
  );
}

/** Palabra clave de Ajv -> código del catálogo (correspondencia ACADÉMICA). */
function codigoPorKeyword(keyword: string): string {
  switch (keyword) {
    case "required":
      return "005"; // DEBE PROPORCIONAR UN VALOR
    case "pattern":
    case "format":
    case "type":
      return "006"; // FORMATO NO VALIDO
    case "enum":
    case "const":
    case "additionalProperties":
      return "007"; // VALOR NO ES PERMITIDO
    default:
      return "003"; // VALOR NO VALIDO (longitudes, rangos, multipleOf, oneOf...)
  }
}

/**
 * Prioridad cuando un mismo campo incumple varias reglas del esquema:
 * falta de valor > formato/tipo > valor no permitido > otras (longitud, rango...).
 * Se informa UN hallazgo por campo, el de mayor prioridad (decisión ACADÉMICA).
 */
const PRIORIDAD: Record<string, number> = {
  required: 1,
  type: 2,
  pattern: 2,
  format: 2,
  enum: 3,
  const: 3,
  additionalProperties: 3,
};

export function validarEsquemaFactura(dte: unknown): Hallazgo[] {
  if (validarFactura(dte)) return [];

  const porCampo = new Map<string, { prioridad: number; h: Hallazgo }>();

  for (const err of validarFactura.errors ?? []) {
    const extra =
      err.keyword === "required"
        ? String((err.params as { missingProperty?: string }).missingProperty ?? "")
        : err.keyword === "additionalProperties"
          ? String((err.params as { additionalProperty?: string }).additionalProperty ?? "")
          : undefined;
    const campo = aRutaCampo(err.instancePath, extra) || "documento";
    const seccion = campo.split(/[.[]/)[0] ?? "";
    const clasifica = CLASIFICA_POR_SECCION[seccion] ?? "98";
    const h = hallazgo(clasifica, codigoPorKeyword(err.keyword), campo);
    const prioridad = PRIORIDAD[err.keyword] ?? 4;

    const previo = porCampo.get(campo);
    if (!previo || prioridad < previo.prioridad) porCampo.set(campo, { prioridad, h });
  }
  return [...porCampo.values()].map((x) => x.h);
}
