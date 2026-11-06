/**
 * Construcción del DTE de Factura (tipo 01, esquema oficial fe-f-v2) a partir de
 * una factura y un cliente del prototipo. Implementa HU-07.
 *
 * OFICIAL: estructura, nombres de campo, patrón de `numeroControl`,
 *   `codigoGeneracion` como UUID v4 en mayúsculas.
 * ACADÉMICO / SIMPLIFICACIONES (a verificar contra el Manual Funcional):
 *   - Los precios del prototipo NO incluyen IVA; el DTE sí (precioUni y
 *     ventaGravada con 13 % de IVA incluido, `ivaItem` = IVA contenido).
 *   - Resumen de descuentos: descuGravada = totalDescu = suma de montoDescu.
 *   - tipoDocumento del receptor: 13 (9 dígitos), 36 (14 dígitos), 37 (otro).
 *   - El prototipo no guarda la dirección estructurada del cliente: se envía
 *     como texto en `apendice` en vez de inventar códigos de departamento.
 *
 * Los totales SIEMPRE se calculan aquí a partir de los ítems; nunca se aceptan
 * totales enviados por el navegador.
 */
import { EMISOR_FICTICIO } from "./emisor";
import { totalALetras } from "./letras";

export const IVA = 0.13;

export type ItemEntrada = {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number; // sin IVA
  descuento: number; // porcentaje 0..100
};
export type FacturaEntrada = {
  id: string;
  folio: string;
  pedidoId: string;
  items: ItemEntrada[];
};
export type ClienteEntrada = {
  nombre: string;
  documento: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
};

export type TotalesDte = {
  totalGravada: number;
  totalIva: number;
  totalDescu: number;
  totalPagar: number;
};

export type DteFactura = Record<string, unknown> & {
  identificacion: { codigoGeneracion: string; numeroControl: string; [campo: string]: unknown };
};

const redondear = (n: number, decimales: number): number => {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
};
const r2 = (n: number): number => redondear(n, 2);

/** Fecha (YYYY-MM-DD) y hora (HH:mm:ss) en zona horaria de El Salvador. */
function fechaHoraEmision(ahora: Date): { fecEmi: string; horEmi: string } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ahora);
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return {
    fecEmi: `${g("year")}-${g("month")}-${g("day")}`,
    horEmi: `${hh}:${g("minute")}:${g("second")}`,
  };
}

function tipoDocumentoReceptor(documento: string): string {
  const digitos = documento.replace(/\D/g, "").length;
  if (digitos === 9) return "13"; // DUI
  if (digitos === 14) return "36"; // NIT
  return "37"; // otro
}

const recortar = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s);
const nuloSiCorto = (s: string | undefined, min: number, max: number): string | null =>
  s && s.trim().length >= min ? recortar(s.trim(), max) : null;

export function construirDte(entrada: {
  factura: FacturaEntrada;
  cliente: ClienteEntrada;
  codigoGeneracion: string;
  ahora?: Date;
}): { dte: DteFactura; totales: TotalesDte } {
  const { factura, cliente, codigoGeneracion } = entrada;
  const { fecEmi, horEmi } = fechaHoraEmision(entrada.ahora ?? new Date());
  const e = EMISOR_FICTICIO;

  const cuerpoDocumento = factura.items.map((it, i) => {
    const precioUni = redondear(it.precio * (1 + IVA), 4); // con IVA incluido
    // Se redondea primero el importe bruto de la línea: restar un descuento ya
    // redondeado de un bruto sin redondear daba ventaGravada = -0.01 con descuento 100 %.
    const bruto = r2(it.cantidad * precioUni);
    const montoDescu = r2((bruto * it.descuento) / 100);
    const ventaGravada = Math.max(0, r2(bruto - montoDescu));
    return {
      numItem: i + 1,
      tipoItem: 1,
      numeroDocumento: null,
      codigo: recortar(it.codigo, 25),
      codTributo: null,
      descripcion: recortar(it.nombre, 1500),
      cantidad: it.cantidad,
      uniMedida: 59,
      precioUni,
      montoDescu,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada,
      tributos: null,
      psv: 0,
      noGravado: 0,
      ivaItem: r2((ventaGravada / (1 + IVA)) * IVA),
    };
  });

  const sum = (f: (x: (typeof cuerpoDocumento)[number]) => number): number =>
    r2(cuerpoDocumento.reduce((a, x) => a + f(x), 0));
  const totalGravada = sum((x) => x.ventaGravada);
  const totalIva = sum((x) => x.ivaItem);
  const totalDescu = sum((x) => x.montoDescu);

  const apendice = [
    {
      campo: "factura_erp",
      etiqueta: "Factura interna AdvWork-ERP",
      valor: recortar(factura.id, 150),
    },
    { campo: "pedido", etiqueta: "Pedido de origen", valor: recortar(factura.pedidoId, 150) },
    ...(cliente.direccion?.trim()
      ? [
          {
            campo: "direccion",
            etiqueta: "Direccion del cliente",
            valor: recortar(cliente.direccion.trim(), 150),
          },
        ]
      : []),
  ];

  const dte: DteFactura = {
    identificacion: {
      version: 2,
      ambiente: "00",
      tipoDte: "01",
      // DTE-01-{codEstable}{codPuntoVenta}-{correlativo de 15 dígitos}; correlativo = folio.
      numeroControl: `DTE-01-${e.codEstable}${e.codPuntoVenta}-${factura.folio.padStart(15, "0")}`,
      codigoGeneracion,
      tipoModelo: 1,
      tipoOperacion: 1,
      fecEmi,
      horEmi,
      tipoMoneda: "USD",
      tipoContingencia: null,
      motivoContin: null,
    },
    documentoRelacionado: null,
    emisor: { ...e, direccion: { ...e.direccion } },
    receptor: {
      tipoDocumento: tipoDocumentoReceptor(cliente.documento),
      numDocumento: recortar(cliente.documento.trim(), 20),
      nrc: null,
      nombre: recortar(cliente.nombre, 250),
      codActividad: null,
      descActividad: null,
      direccion: null,
      telefono: nuloSiCorto(cliente.telefono, 8, 30),
      correo: nuloSiCorto(cliente.correo, 6, 100),
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada,
      subTotalVentas: totalGravada,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: totalDescu,
      porcentajeDescuento: 0,
      totalDescu,
      tributos: null,
      subTotal: totalGravada,
      ivaRete: 0,
      montoTotalOperacion: totalGravada,
      totalNoGravado: 0,
      totalPagar: totalGravada,
      totalLetras: totalALetras(totalGravada),
      totalIva,
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: null,
      numPagoElectronico: null,
      observaciones: null,
    },
    apendice,
  };

  return { dte, totales: { totalGravada, totalIva, totalDescu, totalPagar: totalGravada } };
}
