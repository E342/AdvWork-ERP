/**
 * Validación de la solicitud que envía el NAVEGADOR al backend del ERP.
 *
 * El backend no tiene base de datos de facturas (viven en el estado del
 * navegador), así que recibe `factura` y `cliente` en el cuerpo y NO confía en
 * ellos: se valida su forma y los totales se recalculan siempre en el servidor.
 * Se toleran propiedades adicionales (el navegador envía el objeto completo).
 */
import Ajv from "ajv8";
import { IVA, type ClienteEntrada, type FacturaEntrada } from "./dte-builder";

export type SolicitudTransmision = { factura: FacturaEntrada; cliente: ClienteEntrada };

const validar = new Ajv({ allErrors: true, strict: false }).compile({
  type: "object",
  required: ["factura", "cliente"],
  properties: {
    factura: {
      type: "object",
      required: ["id", "folio", "pedidoId", "items"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 40 },
        folio: { type: "string", pattern: "^[0-9]{1,15}$" },
        pedidoId: { type: "string", minLength: 1, maxLength: 40 },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 2000,
          items: {
            type: "object",
            required: ["codigo", "nombre", "cantidad", "precio", "descuento"],
            properties: {
              codigo: { type: "string", minLength: 1, maxLength: 25 },
              nombre: { type: "string", minLength: 1, maxLength: 1500 },
              cantidad: { type: "number", exclusiveMinimum: 0, maximum: 1000000 },
              precio: { type: "number", minimum: 0, maximum: 1000000 },
              descuento: { type: "number", minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
    cliente: {
      type: "object",
      required: ["nombre", "documento"],
      properties: {
        nombre: { type: "string", minLength: 1, maxLength: 250 },
        documento: { type: "string", minLength: 1, maxLength: 20 },
        direccion: { type: "string", maxLength: 500 },
        telefono: { type: "string", maxLength: 30 },
        correo: { type: "string", maxLength: 100 },
      },
    },
  },
});

/**
 * Máximo que soporta el DTE: el esquema oficial limita los importes a < 10^11 y el conversor
 * de importe a letras llega a 999 999 999.99. Sin esta validación un importe enorme (que sí
 * cumple los máximos individuales de cada campo) producía un error 500 en vez de un 400.
 */
const TOTAL_MAXIMO = 999_999_999.99;

export type ResultadoSolicitud =
  { ok: true; solicitud: SolicitudTransmision } | { ok: false; detalles: string[] };

export function validarSolicitud(cuerpo: unknown): ResultadoSolicitud {
  if (validar(cuerpo)) {
    const solicitud = cuerpo as unknown as SolicitudTransmision;
    const total =
      solicitud.factura.items.reduce(
        (a, i) => a + i.cantidad * i.precio * (1 - i.descuento / 100),
        0,
      ) *
      (1 + IVA);
    if (!(total <= TOTAL_MAXIMO)) {
      return {
        ok: false,
        detalles: [
          `/factura/items el total (${total.toExponential(3)}) excede el máximo soportado (${TOTAL_MAXIMO.toLocaleString("en-US")})`,
        ],
      };
    }
    return { ok: true, solicitud };
  }
  const detalles = (validar.errors ?? []).map(
    (e) => `${e.instancePath || "(raíz)"} ${e.message ?? "no válido"}`,
  );
  return { ok: false, detalles };
}
