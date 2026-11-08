/**
 * Cliente del navegador para los endpoints de correo del ERP.
 * Solo contiene llamadas fetch; no importa código del servidor.
 */

export type ResultadoCorreo =
  | { ok: true; id: string; destinatario: string }
  | { ok: false; error: string; preview: boolean };

export async function enviarCorreoConfirmacion(cuerpo: {
  pedidoId: string;
  cliente: { nombre: string; correo: string; documento: string; direccion: string; telefono: string; fechaRegistro: string };
  items: { codigo: string; nombre: string; cantidad: number; precio: number; descuento: number }[];
  fecha: string;
  canal: string;
  metodoPago: string;
}): Promise<ResultadoCorreo> {
  const r = await fetch("/api/erp/correo/pedido", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return r.json() as Promise<ResultadoCorreo>;
}

export async function enviarCorreoDte(cuerpo: {
  factura: { id: string; folio: string; serie: string; pedidoId: string; clienteId: number; fecha: string; items: { codigo: string; nombre: string; cantidad: number; precio: number; descuento: number }[]; estado: string };
  cliente: { nombre: string; correo: string; documento: string; direccion: string; telefono: string; fechaRegistro: string };
  tipoDte: "Factura" | "Crédito Fiscal";
  numeroControl: string;
  codigoGeneracion: string;
  sello: string;
  fechaHora: string;
  canal?: string;
  metodoPago?: string;
}): Promise<ResultadoCorreo> {
  const r = await fetch("/api/erp/correo/dte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return r.json() as Promise<ResultadoCorreo>;
}
