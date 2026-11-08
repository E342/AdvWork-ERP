/**
 * Plantillas HTML para los correos de AdvWork-ERP.
 * Solo HTML + CSS inline (compatible con todos los clientes de correo).
 */
import type { Cliente, Factura, LineaItem } from "../../lib/erp-data";
import { IVA, money, totales } from "../../lib/erp-data";

const EMISOR = "Adventure Works S.A. de C.V.";
const EMISOR_CORREO = "facturacion@advwork.example";
const AZUL = "#1e3c78";

const wrap = (titulo: string, cuerpo: string) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <div style="background:${AZUL};padding:28px 32px;">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${EMISOR}</p>
    <p style="margin:4px 0 0;color:#a8c0e8;font-size:13px;">${titulo}</p>
  </div>
  <div style="padding:28px 32px;">${cuerpo}</div>
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">Generado automáticamente por AdvWork-ERP · ${EMISOR_CORREO}</p>
  </div>
</div></body></html>`;

export function correoConfirmacionPedido(p: { pedidoId: string; cliente: Cliente; items: LineaItem[]; fecha: string; canal: string; metodoPago: string }) {
  const t = totales(p.items);
  const filas = p.items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${i.nombre}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;">${i.cantidad}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${money(i.precio)}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">${money(i.cantidad * i.precio * (1 - i.descuento / 100))}</td></tr>`
  ).join("");

  const html = wrap(`Confirmación de pedido ${p.pedidoId}`, `
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
    <div style="text-align:right;">
      <p style="font-size:13px;color:#64748b;margin:4px 0;">Subtotal: <strong>${money(t.subtotal)}</strong></p>
      <p style="font-size:13px;color:#64748b;margin:4px 0;">IVA ${(IVA * 100).toFixed(0)}%: <strong>${money(t.impuesto)}</strong></p>
      <p style="font-size:16px;color:#1e293b;font-weight:700;margin:8px 0;">Total: ${money(t.total)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;width:40%;">Fecha</td><td style="padding:10px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${p.fecha}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Canal</td><td style="padding:10px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${p.canal}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;">Método de pago</td><td style="padding:10px 16px;font-size:13px;font-weight:600;">${p.metodoPago}</td></tr>
    </table>`);

  return { asunto: `Confirmación de pedido ${p.pedidoId} — ${EMISOR}`, html };
}

export function correoDteEmitido(p: { factura: Factura; cliente: Cliente; tipoDte: "Factura" | "Crédito Fiscal"; numeroControl: string; codigoGeneracion: string; sello: string; fechaHora: string }) {
  const t = totales(p.factura.items);
  const html = wrap(`${p.tipoDte} electrónica — ${p.factura.id}`, `
    <p style="font-size:15px;color:#1e293b;">Hola <strong>${p.cliente.nombre}</strong>,</p>
    <p style="font-size:14px;color:#475569;">Tu ${p.tipoDte.toLowerCase()} ha sido procesada y sellada electrónicamente.</p>
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#065f46;">✅ DTE RECIBIDO — Código 001</p>
      <p style="margin:4px 0 0;font-size:12px;color:#047857;">Comprobante recibido y sellado por el servicio simulado de Hacienda.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <tr><td colspan="2" style="padding:10px 16px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0;">Datos del documento</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;width:45%;border-bottom:1px solid #f1f5f9;">Tipo</td><td style="padding:8px 16px;font-size:12px;font-weight:600;border-bottom:1px solid #f1f5f9;">${p.tipoDte}</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Número de control</td><td style="padding:8px 16px;font-size:11px;font-family:monospace;border-bottom:1px solid #f1f5f9;">${p.numeroControl}</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Código de generación</td><td style="padding:8px 16px;font-size:10px;font-family:monospace;border-bottom:1px solid #f1f5f9;">${p.codigoGeneracion}</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Sello de recepción</td><td style="padding:8px 16px;font-size:10px;font-family:monospace;border-bottom:1px solid #f1f5f9;">${p.sello}</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Fecha de procesamiento</td><td style="padding:8px 16px;font-size:12px;border-bottom:1px solid #f1f5f9;">${p.fechaHora}</td></tr>
      <tr><td style="padding:8px 16px;font-size:12px;color:#64748b;">Total a pagar</td><td style="padding:8px 16px;font-size:16px;color:${AZUL};font-weight:700;">${money(t.total)}</td></tr>
    </table>`);

  return { asunto: `${p.tipoDte} ${p.factura.id} — DTE emitido por ${EMISOR}`, html };
}
