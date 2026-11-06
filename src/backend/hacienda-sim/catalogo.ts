/**
 * Catálogo de mensajes del servicio de recepción.
 * FUENTE OFICIAL: Guía de Integración eFacturaSV v8.0 (21/09/2021),
 * tabla "Clasificación mensajes de error - Servicio de recepción".
 * Los textos se copian tal como aparecen en la guía.
 */
export const CLASIFICACION: Record<string, string> = {
  "10": "Recepcion exitosa",
  "11": "Errores de datos del DTE",
  "12": "Errores en los datos del emisor",
  "13": "Errores en los datos del receptor",
  "14": "Errores en los datos de Doc. Relacionandos",
  "15": "Errores en los datos de Items",
  "16": "Errores en los datos de Resumen",
  "17": "Errores en los datos de Extension",
  "18": "Errores en los datos de Apendice",
  "19": "Errores relacionados a seguridad",
  "20": "Errores realcionados a la firma electronica",
  "21": "Errores en los datos de Venta a Terceros",
  "98": "Errores no cumplen esquema",
  "99": "Errores generales del servicio",
};

/** Mensajes por código. Los que llevan [campo] se formatean con `mensaje()`. */
const MENSAJES: Record<string, { texto: string; conCampo: boolean }> = {
  "001": { texto: "RECIBIDO", conCampo: false },
  "002": { texto: "RECIBIDO CON OBSERVACIONES", conCampo: false },
  "003": { texto: "VALOR NO VALIDO", conCampo: true },
  "004": { texto: "YA EXISTE UN REGISTRO CON ESE VALOR", conCampo: true },
  "005": { texto: "DEBE PROPORCIONAR UN VALOR", conCampo: true },
  "006": { texto: "FORMATO NO VALIDO", conCampo: true },
  "007": { texto: "VALOR NO ES PERMITIDO", conCampo: true },
  "008": { texto: "NO CORRESPONDE A CONTRIBUYENTE", conCampo: true },
  "009": { texto: "NIT CONTRIBUYENTE NO EXISTE", conCampo: true },
  "010": { texto: "CONTRIBUYENTE NO SE ENCUENTRA ACTIVO", conCampo: true },
  "011": { texto: "NO ES CONTRIBUYENTE IVA", conCampo: true },
  "012": { texto: "NO EXISTE EVENTO DE CONTINGENCIA", conCampo: true },
  "013": { texto: "NO ESTA ENTRE PERIODO REPORTADO EN EVENTO DE CONTINGENCIA", conCampo: true },
  "014": { texto: "NO EXISTE UN REGISTRO CON ESTE DATO", conCampo: true },
  "015": { texto: "DOCUMENTO SE ENCUENTA ANULADO", conCampo: true }, // (sic) así figura en la guía
  "016": { texto: "MONTO DE OPERACIÓN ES MAYOR AL DOCUMENTO RELACIONADO", conCampo: true },
  "017": { texto: "FECHA NO ES CORRECTA", conCampo: true },
  "018": { texto: "FECHA FUERA DE PLAZO PERMITIDO", conCampo: true },
  "019": { texto: "ERROR EN CORRELATIVO", conCampo: true },
  "020": { texto: "CALCULO INCORRECTO", conCampo: true },
  "021": { texto: "NO SE PUEDE VALIDAR CAMPO", conCampo: true },
  "022": { texto: "SERVICIO DE VALIDACION DE FIRMA NO DISPONIBLE", conCampo: true },
  "096": { texto: "DOCUMENTO NO CUMPLE ESQUEMA JSON", conCampo: false },
  "097": { texto: "NO SE HA PROPORCIONADO DATOS PARA VALIDAR", conCampo: false },
  "098": { texto: "DATOS NO CUMPLEN ESTANDAR JSON", conCampo: false },
  "099": { texto: "ERROR NO CATALOGADO", conCampo: false },
};

/** Devuelve p. ej. "[emisor.nit] FORMATO NO VALIDO" o "RECIBIDO". */
export function mensaje(codigoMsg: string, campo?: string): string {
  const m = MENSAJES[codigoMsg];
  if (!m) return "ERROR NO CATALOGADO";
  return m.conCampo && campo ? `[${campo}] ${m.texto}` : m.texto;
}

/** Hallazgo de validación (error que rechaza u observación que no rechaza). */
export type Hallazgo = {
  clasificaMsg: string;
  codigoMsg: string;
  campo?: string;
  texto: string;
};

export const hallazgo = (clasificaMsg: string, codigoMsg: string, campo?: string): Hallazgo => ({
  clasificaMsg,
  codigoMsg,
  campo,
  texto: mensaje(codigoMsg, campo),
});
