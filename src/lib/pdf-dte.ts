/**
 * Generador de PDF para Documentos Tributarios Electrónicos.
 * Produce Factura (tipoDte "01") y Comprobante de Crédito Fiscal (tipoDte "03")
 * con el formato visual oficial de Hacienda El Salvador.
 *
 * El QR apunta a la consulta pública de Hacienda: https://admin.factura.gob.sv/consultaPublica
 * Los datos del emisor son ficticios (entorno académico).
 */

import type { Cliente, Factura, LineaItem } from "./erp-data";
import { IVA, money, totales } from "./erp-data";

const EMISOR = {
  nombre: "Adventure Works S.A. de C.V.",
  nit: "0614-000000-000-1",
  nrc: "123-4",
  actividad: "Venta de bicicletas, repuestos y accesorios deportivos",
  direccion: "Blvd. Los Héroes 45, San Salvador, El Salvador",
  telefono: "2200-0000",
  correo: "facturacion@advwork.example",
  establecimiento: "Casa Matriz",
};

type TipoDte = "01" | "03";

interface DatosFactura {
  factura: Factura;
  cliente: Cliente;
  tipoDte: TipoDte;
  numeroControl: string;
  codigoGeneracion: string;
  sello: string;
  fechaHora: string;
}

function tituloDocumento(tipo: TipoDte) {
  return tipo === "01" ? "FACTURA" : "COMPROBANTE DE CRÉDITO FISCAL";
}

function totalLetras(n: number): string {
  const parteEntera = Math.floor(n);
  const centavos = Math.round((n - parteEntera) * 100);
  const cents = centavos.toString().padStart(2, "0");
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const especiales: Record<number, string> = { 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE", 16: "DIECISÉIS", 17: "DIECISIETE", 18: "DIECIOCHO", 19: "DIECINUEVE" };
  const centenas = ["", "CIEN", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function menorMil(x: number): string {
    if (x === 0) return "";
    if (x === 100) return "CIEN";
    const c = Math.floor(x / 100);
    const r = x % 100;
    let res = c > 0 ? centenas[c]! : "";
    if (r > 0) {
      if (res) res += " ";
      if (r <= 10) res += unidades[r];
      else if (r < 20) res += especiales[r] ?? `DIECI${unidades[r - 10]}`;
      else {
        res += decenas[Math.floor(r / 10)];
        if (r % 10) res += ` Y ${unidades[r % 10]}`;
      }
    }
    return res;
  }

  if (parteEntera === 0) return `CERO ${cents}/100 DÓLARES`;
  if (parteEntera < 1000) return `${menorMil(parteEntera)} ${cents}/100 DÓLARES`;
  const miles = Math.floor(parteEntera / 1000);
  const resto = parteEntera % 1000;
  const milParte = miles === 1 ? "MIL" : `${menorMil(miles)} MIL`;
  const restoParte = resto > 0 ? ` ${menorMil(resto)}` : "";
  return `${milParte}${restoParte} ${cents}/100 DÓLARES`;
}

export async function generarPdfDte(datos: DatosFactura): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const QRCode = await import("qrcode");

  const { factura, cliente, tipoDte, numeroControl, codigoGeneracion, sello, fechaHora } = datos;
  const t = totales(factura.items);
  const iva = t.impuesto;
  const totalPagar = t.total;
  const ventaGravada = t.subtotal;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const W = 215.9;
  const margen = 10;
  const anchoUtil = W - margen * 2;

  // ── Colores ──────────────────────────────────────────────────────────────
  const azul: [number, number, number] = [30, 60, 120];
  const grisClaro: [number, number, number] = [230, 235, 245];
  const negro: [number, number, number] = [20, 20, 20];
  const blanco: [number, number, number] = [255, 255, 255];
  const grisBorde: [number, number, number] = [170, 175, 190];

  let y = margen;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setFont = (size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = negro) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };

  const rect = (x: number, yy: number, w: number, h: number, fill: [number, number, number], stroke?: [number, number, number]) => {
    doc.setFillColor(...fill);
    if (stroke) { doc.setDrawColor(...stroke); doc.rect(x, yy, w, h, "FD"); }
    else doc.rect(x, yy, w, h, "F");
  };

  const linea = (x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = azul, lw = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, y1, x2, y2);
  };

  // ── Encabezado ────────────────────────────────────────────────────────────
  rect(margen, y, anchoUtil, 14, azul);
  setFont(11, "bold", blanco);
  doc.text("DOCUMENTO TRIBUTARIO ELECTRÓNICO", W / 2, y + 5.5, { align: "center" });
  setFont(10, "bold", blanco);
  doc.text(tituloDocumento(tipoDte), W / 2, y + 11, { align: "center" });
  y += 16;

  // ── Fila de metadatos (3 columnas: izq | QR | der) ───────────────────────
  const metaH = 28;
  rect(margen, y, anchoUtil, metaH, grisClaro, grisBorde);

  // Generamos el QR apuntando a la consulta pública oficial
  const qrDataUrl: string = await QRCode.toDataURL("https://admin.factura.gob.sv/consultaPublica", {
    width: 100, margin: 1, errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qrSize = 24;
  const qrX = W / 2 - qrSize / 2;
  const qrY = y + 2;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  setFont(4.5, "normal", [80, 80, 80]);
  doc.text("VER. 3", W / 2, qrY + qrSize + 2, { align: "center" });

  // Columna izquierda: datos del DTE
  const col1 = margen + 3;
  const col1ValX = margen + 42; // separación fija para alinear valores
  const metaLeft = [
    ["Código de Generación:", codigoGeneracion.length > 30 ? codigoGeneracion.slice(0, 30) + "…" : codigoGeneracion],
    ["Número de Control:", numeroControl],
    ["Sello de Recepción:", sello.length > 28 ? sello.slice(0, 28) + "…" : sello],
  ];
  metaLeft.forEach(([label, val], i) => {
    setFont(6, "bold");
    doc.text(label, col1, y + 5 + i * 7.5);
    setFont(5.8, "normal");
    doc.text(val, col1ValX, y + 5 + i * 7.5);
  });

  // Columna derecha: modelo, transmisión, fecha
  const col2 = qrX + qrSize + 4;
  const col2ValX = col2 + 28;
  const metaRight = [
    ["Modelo:", "Previo"],
    ["Transmisión:", "Normal"],
    ["Fecha/Hora:", fechaHora.length > 20 ? fechaHora.slice(0, 20) : fechaHora],
  ];
  metaRight.forEach(([label, val], i) => {
    setFont(6, "bold");
    doc.text(label, col2, y + 5 + i * 7.5);
    setFont(5.8, "normal");
    doc.text(val, col2ValX, y + 5 + i * 7.5);
  });
  y += metaH + 3;

  // ── Emisor / Receptor ─────────────────────────────────────────────────────
  const mitad = (anchoUtil - 2) / 2;
  // Calcula altura según cuántos campos hay
  const camposEmisor = ["Nombre o razón social", "NIT", "NRC", "Actividad económica", "Dirección", "Número de teléfono", "Correo electrónico", "Tipo de establecimiento"];
  const camposReceptorBase = ["Nombre o razón social", "Documento", "Dirección", "Teléfono", "Correo electrónico"];
  const camposReceptor = tipoDte === "03" ? ["Nombre o razón social", "Documento", "NRC", "Dirección", "Teléfono", "Correo electrónico"] : camposReceptorBase;
  const filaAltura = 5; // mm por campo
  const cabH = 6;
  const bloqueH = cabH + Math.max(camposEmisor.length, camposReceptor.length) * filaAltura + 4;

  rect(margen, y, mitad, bloqueH, grisClaro, grisBorde);
  rect(margen + mitad + 2, y, mitad, bloqueH, grisClaro, grisBorde);

  rect(margen, y, mitad, cabH, azul);
  rect(margen + mitad + 2, y, mitad, cabH, azul);
  setFont(7.5, "bold", blanco);
  doc.text("EMISOR", margen + mitad / 2, y + 4.3, { align: "center" });
  doc.text("RECEPTOR", margen + mitad + 2 + mitad / 2, y + 4.3, { align: "center" });
  y += cabH + 1;

  // Helper mejorado: etiqueta en negrita + valor en normal, con ancho controlado
  const campo = (label: string, valor: string, colX: number, yy: number, maxValW: number) => {
    setFont(5.8, "bold");
    doc.text(`${label}:`, colX, yy);
    setFont(5.8, "normal");
    const labelW = doc.getTextWidth(`${label}: `);
    const valX = colX + labelW;
    const availW = maxValW - labelW;
    // Truncar si el valor no cabe en una línea
    let val = valor;
    while (val.length > 3 && doc.getTextWidth(val) > availW) {
      val = val.slice(0, -4) + "…";
    }
    doc.text(val, valX, yy);
  };

  const emisorVals = [
    EMISOR.nombre, EMISOR.nit, EMISOR.nrc, EMISOR.actividad,
    EMISOR.direccion, EMISOR.telefono, EMISOR.correo, EMISOR.establecimiento,
  ];
  const receptorVals = tipoDte === "03"
    ? [cliente.nombre, cliente.documento, "N/A", cliente.direccion, cliente.telefono, cliente.correo]
    : [cliente.nombre, cliente.documento, cliente.direccion, cliente.telefono, cliente.correo];

  const maxW = mitad - 4;
  camposEmisor.forEach((lbl, i) =>
    campo(lbl, emisorVals[i] ?? "", margen + 2, y + i * filaAltura, maxW));
  camposReceptor.forEach((lbl, i) =>
    campo(lbl, receptorVals[i] ?? "", margen + mitad + 4, y + i * filaAltura, maxW));

  y += Math.max(camposEmisor.length, camposReceptor.length) * filaAltura + 3;

  // ── Tabla de ítems ────────────────────────────────────────────────────────
  y += 2;
  // Anchos calibrados para que sumen exactamente anchoUtil
  const colsItems: { label: string; w: number; align: "center" | "left" | "right" }[] = [
    { label: "Nº",           w: 7,  align: "center" },
    { label: "Cant.",        w: 13, align: "center" },
    { label: "Unidad",      w: 14, align: "center" },
    { label: "Descripción", w: 68, align: "left"   },
    { label: "P. Unitario", w: 24, align: "right"  },
    { label: "Descuento",   w: 20, align: "right"  },
    { label: "V. No Suj.",  w: 18, align: "right"  },
    { label: "V. Exentas",  w: 18, align: "right"  },
    { label: "V. Gravadas", w: anchoUtil - 7 - 13 - 14 - 68 - 24 - 20 - 18 - 18, align: "right" },
  ];

  rect(margen, y, anchoUtil, 7, azul);
  let cx = margen;
  colsItems.forEach((col) => {
    setFont(5.5, "bold", blanco);
    const tx = col.align === "right" ? cx + col.w - 1.5 : col.align === "center" ? cx + col.w / 2 : cx + 1.5;
    doc.text(col.label, tx, y + 4.5, { align: col.align });
    cx += col.w;
  });
  y += 7;

  factura.items.forEach((item: LineaItem, idx: number) => {
    const bg: [number, number, number] = idx % 2 === 0 ? blanco : [245, 247, 252];
    rect(margen, y, anchoUtil, 7, bg);
    linea(margen, y + 7, margen + anchoUtil, y + 7, [210, 215, 225]);

    const vGravada = item.cantidad * item.precio * (1 - item.descuento / 100);
    const descu = item.cantidad * item.precio * (item.descuento / 100);
    const celdas = [
      String(idx + 1), String(item.cantidad), "Unidad", item.nombre,
      money(item.precio), money(descu), money(0), money(0), money(vGravada),
    ];

    cx = margen;
    setFont(5.5, "normal", negro);
    celdas.forEach((v, ci) => {
      const col = colsItems[ci]!;
      const tx = col.align === "right" ? cx + col.w - 1.5 : col.align === "center" ? cx + col.w / 2 : cx + 1.5;
      let txt = v;
      // Truncar si no cabe
      const avail = col.w - 3;
      while (txt.length > 3 && doc.getTextWidth(txt) > avail) txt = txt.slice(0, -4) + "…";
      doc.text(txt, tx, y + 4.5, { align: col.align });
      cx += col.w;
    });
    y += 7;
  });

  // Suma de ventas
  rect(margen, y, anchoUtil, 6, [220, 225, 235]);
  setFont(6, "bold");
  doc.text("SUMA DE VENTAS:", margen + 2, y + 4);
  const sumaStartX = margen + 7 + 13 + 14 + 68 + 24 + 20;
  const colW3 = anchoUtil - (sumaStartX - margen);
  const colW1 = colW3 / 3;
  [0, 0, ventaGravada].forEach((v, i) => {
    setFont(6, "normal");
    doc.text(money(v), sumaStartX + (i + 1) * colW1 - 1.5, y + 4, { align: "right" });
  });
  y += 8;

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalesX = margen + anchoUtil * 0.5;
  const totalesW = anchoUtil * 0.5;
  const filaH = 6;

  const filaTotal = (label: string, valor: number | string, negrita = false, fondo?: [number, number, number], colorTxt: [number, number, number] = negro) => {
    if (fondo) rect(totalesX, y, totalesW, filaH, fondo);
    setFont(6, negrita ? "bold" : "normal", colorTxt);
    doc.text(label, totalesX + 2, y + 4);
    const valStr = typeof valor === "number" ? money(valor) : valor;
    doc.text(valStr, totalesX + totalesW - 2, y + 4, { align: "right" });
    linea(totalesX, y + filaH, totalesX + totalesW, y + filaH, [200, 205, 215]);
    y += filaH;
  };

  filaTotal("Suma Total de Operaciones:", ventaGravada);
  filaTotal("Monto global Desc. a ventas no sujetas:", money(0));
  filaTotal("Monto global Desc. a ventas exentas:", money(0));
  filaTotal("Monto global Desc. a ventas gravadas:", money(t.descuento));
  filaTotal(`IVA ${(IVA * 100).toFixed(0)}%:`, iva);
  filaTotal("Sub-Total:", ventaGravada - t.descuento + iva);
  if (tipoDte === "03") {
    filaTotal("IVA Percibido:", money(0));
    filaTotal("IVA Retenido:", money(0));
  }
  filaTotal("Retención Renta:", money(0));
  filaTotal("Monto Total de la Operación:", totalPagar);
  filaTotal("Total Otros Montos no Afectos:", money(0));
  // Fila "Total a Pagar" en azul
  filaTotal("Total a Pagar:", totalPagar, true, azul, blanco);

  y += 4;

  // ── Pie ───────────────────────────────────────────────────────────────────
  rect(margen, y, anchoUtil, 14, grisClaro, grisBorde);
  setFont(6, "bold");
  doc.text("Valor en Letras:", margen + 2, y + 5);
  setFont(6, "normal");
  // Truncar valor en letras si es muy largo
  const letras = totalLetras(totalPagar);
  const letrasMax = anchoUtil / 2 - 28;
  let letrasCorto = letras;
  while (letrasCorto.length > 10 && doc.getTextWidth(letrasCorto) > letrasMax)
    letrasCorto = letrasCorto.slice(0, -4) + "…";
  doc.text(letrasCorto, margen + 28, y + 5);

  setFont(6, "bold");
  doc.text("Condición de la Operación:", W / 2 + 2, y + 5);
  setFont(6, "normal");
  doc.text("Contado", W / 2 + 46, y + 5);
  setFont(6, "bold");
  doc.text("Observaciones:", margen + 2, y + 11);
  y += 16;

  // Responsables
  rect(margen, y, anchoUtil, 10, grisClaro, grisBorde);
  setFont(6, "bold");
  doc.text("Responsable por parte del Emisor:", margen + 2, y + 4);
  setFont(6, "normal");
  doc.text(EMISOR.nombre, margen + 56, y + 4);
  setFont(6, "bold");
  doc.text("Responsable por parte del Receptor:", margen + 2, y + 9);
  setFont(6, "normal");
  doc.text(cliente.nombre, margen + 56, y + 9);

  setFont(6, "bold");
  doc.text("Nº de Documento Emisor:", W / 2 + 2, y + 4);
  setFont(6, "normal");
  doc.text(EMISOR.nit, W / 2 + 42, y + 4);
  setFont(6, "bold");
  doc.text("Nº de Documento Receptor:", W / 2 + 2, y + 9);
  setFont(6, "normal");
  doc.text(cliente.documento, W / 2 + 44, y + 9);
  y += 12;

  // Número de página
  setFont(6, "normal", [130, 130, 130]);
  doc.text("Página 1 de 1", W - margen, y + 3, { align: "right" });

  return doc.output("blob");
}

export function descargarPdf(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
