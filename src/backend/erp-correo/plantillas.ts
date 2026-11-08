/**
 * Plantillas HTML para los correos de AdvWork-ERP.
 * Solo HTML + CSS inline (compatible con todos los clientes de correo).
 */
import type { Cliente, Factura, LineaItem } from "../../lib/erp-data";
import { IVA, money, totales } from "../../lib/erp-data";
const EMISOR = "Adventure Works S.A. de C.V.";
const EMISOR_CORREO = "facturacion@advwork.example";
const AZUL = "#1e3c78";
const NARANJA = "#e8834a";

// ── Cabecera ─────────────────────────────────────────────────────────────────
// Los clientes de correo (Gmail, Outlook) bloquean imágenes base64 en src="data:...".
// Se usa el nombre de la empresa con diseño tipográfico en su lugar.
// Si en el futuro se aloja la app en un dominio, reemplaza el bloque de texto por:
//   <img src="https://tudominio.com/logo-menbrete.png" alt="AdvWork-ERP" style="height:56px;" />
const cabecera = (subtitulo: string) => `
  <div style="background:${AZUL};padding:24px 32px;text-align:center;">
    <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:22px;
       font-weight:800;letter-spacing:2px;color:#e8834a;text-transform:uppercase;">
      AdvWork<span style="color:#ffffff;">-ERP</span>
    </p>
    <p style="margin:2px 0 0;font-family:'Segoe UI',Arial,sans-serif;
       font-size:10px;letter-spacing:3px;color:#a8c0e8;text-transform:uppercase;">
      DESDE 2026
    </p>
    <div style="width:40px;height:2px;background:${NARANJA};margin:10px auto 8px;"></div>
    <p style="margin:0;color:#a8c0e8;font-size:12px;letter-spacing:.5px;">${subtitulo}</p>
  </div>`;

// ── Pie de página ────────────────────────────────────────────────────────────
const pie = `
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">
      Generado automáticamente por AdvWork-ERP · ${EMISOR_CORREO}
    </p>
  </div>`;

// ── Título de subsección ─────────────────────────────────────────────────────
const seccion = (titulo: string) => `
  <p style="margin:24px 0 8px;font-size:11px;font-weight:700;color:${NARANJA};
     text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid ${NARANJA};
     padding-bottom:4px;">${titulo}</p>`;

// ── Fila de dato (etiqueta + valor) ──────────────────────────────────────────
const fila = (label: string, valor: string, mono = false) => `
  <tr>
    <td style="padding:7px 0;font-size:12px;color:#64748b;width:45%;vertical-align:top;">${label}</td>
    <td style="padding:7px 0;font-size:${mono ? "11px" : "12px"};
       font-family:${mono ? "monospace,Courier New" : "inherit"};
       font-weight:600;color:#1e293b;vertical-align:top;word-break:break-all;">${valor}</td>
  </tr>`;

const wrap = (cabHTML: string, cuerpo: string) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;
            box-shadow:0 2px 8px rgba(0,0,0,.08);">
  ${cabHTML}
  <div style="padding:28px 32px;">${cuerpo}</div>
  ${pie}
</div></body></html>`;

// ════════════════════════════════════════════════════════════════════════════
//  Correo 1: Confirmación de pedido
// ════════════════════════════════════════════════════════════════════════════
export function correoConfirmacionPedido(p: {
  pedidoId: string;
  cliente: Cliente;
  items: LineaItem[];
  fecha: string;
  canal: string;
  metodoPago: string;
}) {
  const t = totales(p.items);

  const filas = p.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${i.nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;">${i.cantidad}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${money(i.precio)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${money(i.cantidad * i.precio * (1 - i.descuento / 100))}</td>
      </tr>`,
    )
    .join("");

  const cuerpo = `
    <p style="font-size:15px;color:#1e293b;">Hola <strong>${p.cliente.nombre}</strong>,</p>
    <p style="font-size:14px;color:#475569;">Tu pedido ha sido confirmado exitosamente.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Número de pedido</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:${AZUL};">${p.pedidoId}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead><tr style="background:${AZUL};">
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Producto</th>
        <th style="padding:10px 12px;text-align:center;color:#fff;font-size:12px;">Cant.</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Precio</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Subtotal</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <div style="text-align:right;border-top:1px solid #e2e8f0;padding-top:12px;">
      <p style="font-size:13px;color:#64748b;margin:4px 0;">Subtotal: <strong>${money(t.subtotal)}</strong></p>
      <p style="font-size:13px;color:#64748b;margin:4px 0;">IVA ${(IVA * 100).toFixed(0)}%: <strong>${money(t.impuesto)}</strong></p>
      <p style="font-size:16px;color:${AZUL};font-weight:700;margin:8px 0;">Total: ${money(t.total)}</p>
    </div>

    ${seccion("Detalle de pago")}
    <table style="width:100%;border-collapse:collapse;">
      ${fila("Fecha", p.fecha)}
      ${fila("Canal de compra", p.canal)}
      ${fila("Método de pago", p.metodoPago)}
    </table>`;

  return {
    asunto: `Comprobante de ${EMISOR} — ${p.pedidoId}`,
    html: wrap(cabecera(`Confirmación de pedido ${p.pedidoId}`), cuerpo),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  Correo 2: DTE emitido (Factura o Crédito Fiscal)
// ════════════════════════════════════════════════════════════════════════════
export function correoDteEmitido(p: {
  factura: Factura;
  cliente: Cliente;
  tipoDte: "Factura" | "Crédito Fiscal";
  numeroControl: string;
  codigoGeneracion: string;
  sello: string;
  fechaHora: string;
  canal?: string;
  metodoPago?: string;
}) {
  const t = totales(p.factura.items);
  const identificador = p.tipoDte === "Factura" ? p.factura.id : p.factura.id;

  const cuerpo = `
    <p style="font-size:15px;color:#1e293b;">Hola <strong>${p.cliente.nombre}</strong>,</p>
    <p style="font-size:14px;color:#475569;">
      Tu ${p.tipoDte.toLowerCase()} ha sido procesada y sellada electrónicamente.
    </p>

    <!-- Estado -->
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;
                padding:14px 16px;margin:20px 0;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#065f46;">✅ DTE RECIBIDO — Código 001</p>
      <p style="margin:4px 0 0;font-size:12px;color:#047857;">Comprobante recibido y sellado.</p>
    </div>

    <!-- Sección 1: Receptor -->
    ${seccion("Receptor")}
    <table style="width:100%;border-collapse:collapse;">
      ${fila("Nombre", p.cliente.nombre)}
      ${fila("Documento", p.cliente.documento)}
    </table>

    <!-- Sección 2: Detalles del documento -->
    ${seccion("Detalles del documento")}
    <table style="width:100%;border-collapse:collapse;">
      ${fila("Tipo de documento", p.tipoDte)}
      ${fila("Número de control", p.numeroControl, true)}
      ${fila("Código de generación", p.codigoGeneracion, true)}
      ${fila("Sello de recepción", p.sello, true)}
      ${fila("Fecha de procesamiento", p.fechaHora)}
      ${fila("Total a pagar", `<span style="font-size:16px;color:${AZUL};font-weight:700;">${money(t.total)}</span>`)}
    </table>

    <!-- Sección 3: Detalle de pago -->
    ${seccion("Detalle de pago")}
    <table style="width:100%;border-collapse:collapse;">
      ${fila("Canal de compra", p.canal ?? "—")}
      ${fila("Método de pago", p.metodoPago ?? "—")}
    </table>`;

  return {
    asunto: `Comprobante de ${EMISOR} — ${identificador}`,
    html: wrap(cabecera(`${p.tipoDte} electrónica`), cuerpo),
  };
}
