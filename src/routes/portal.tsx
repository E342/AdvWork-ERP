import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Minus, Plus, ShoppingCart } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { hoy, money, totales, type LineaItem, type Pedido } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, tonoEstado, Vacio } from "@/components/erp/ui";
import { enviarCorreoConfirmacion } from "@/lib/correo-api";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal del cliente — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Portal de autoservicio: pedidos en línea o en tienda, pagos, historial de compras y descarga de comprobantes.",
      },
      { property: "og:title", content: "Portal del cliente — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-05 y HU-06: comprar por cualquier canal y consultar comprobantes propios.",
      },
    ],
  }),
  component: Portal,
});

function Portal() {
  const { productos, clientes, pedidos, facturas, registrarVentaDirecta } = useErp();
  const [clienteId, setClienteId] = useState(clientes[1]?.id ?? clientes[0].id);
  const [carrito, setCarrito] = useState<LineaItem[]>([]);
  const [canal, setCanal] = useState<Pedido["canal"]>("En línea");
  const [metodoPago, setMetodoPago] = useState<Pedido["metodoPago"]>("Pago en línea");
  const [fCanal, setFCanal] = useState("Todos");
  const [fDesde, setFDesde] = useState("");

  const t = totales(carrito);

  const cambiar = (codigo: string, delta: number) => {
    const prod = productos.find((p) => p.codigo === codigo)!;
    setCarrito((prev) => {
      const ex = prev.find((i) => i.codigo === codigo);
      const cant = (ex?.cantidad ?? 0) + delta;
      if (cant <= 0) return prev.filter((i) => i.codigo !== codigo);
      if (cant > prod.stock) {
        toast.error(`Solo hay ${prod.stock} unidades disponibles de ${prod.nombre}.`);
        return prev;
      }
      if (ex) return prev.map((i) => (i.codigo === codigo ? { ...i, cantidad: cant } : i));
      return [...prev, { codigo, nombre: prod.nombre, cantidad: 1, precio: prod.precio, descuento: 0 }];
    });
  };

  const pagar = () => {
    const cli = clientes.find((c) => c.id === clienteId);
    const r = registrarVentaDirecta(clienteId, carrito, canal, metodoPago);
    if (r.ok) {
      toast.success(r.mensaje);
      // Extraer el id del pedido del mensaje ("Orden PED-XXXX generada…")
      const matchPed = /PED-[A-Z0-9-]+/.exec(r.mensaje);
      const pedidoId = matchPed?.[0] ?? "PED-NUEVO";
      setCarrito([]);
      // Enviar confirmación por correo (no bloqueante)
      if (cli) {
        void enviarCorreoConfirmacion({
          pedidoId,
          cliente: cli,
          items: carrito,
          fecha: hoy(),
          canal,
          metodoPago,
        }).then((res) => {
          if (res.ok) toast(`Confirmación enviada a ${res.destinatario}.`, { icon: "📧" });
          
        });
      }
    } else toast.error(r.mensaje);
  };

  const compras = pedidos
    .filter((p) => p.clienteId === clienteId)
    .filter((p) => (fCanal === "Todos" ? true : p.canal === fCanal))
    .filter((p) => (fDesde ? p.fecha >= fDesde : true));

  const descargarComprobante = (pedidoId: string) => {
    const f = facturas.find((x) => x.pedidoId === pedidoId);
    if (!f) return toast.error("Esta compra aún no tiene comprobante emitido.");
    const url = URL.createObjectURL(
      new Blob(
        [
          `Comprobante ${f.serie}-${f.folio}\nFecha: ${f.fecha}\nTotal: ${money(totales(f.items).total)}\nSello: ${f.selloElectronico ?? "PENDIENTE"}`,
        ],
        { type: "text/plain" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprobante-${f.serie}-${f.folio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comprobante descargado.");
  };

  return (
    <>
      <PageHeader
        titulo="Portal del cliente"
        descripcion="Canal de autoservicio: arma tu pedido en línea o en tienda física, paga y consulta el historial de compras con descarga de comprobantes."
        acciones={
          <select
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={clienteId}
            onChange={(e) => setClienteId(Number(e.target.value))}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                Sesión: {c.nombre}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel titulo="Catálogo de productos">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {productos.map((p) => (
              <div key={p.codigo} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.categoria} · {p.codigo}
                    </p>
                  </div>
                  <Estado tono={p.stock > 0 ? "success" : "danger"}>
                    {p.stock > 0 ? `${p.stock} disp.` : "Agotado"}
                  </Estado>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-lg font-bold tabular-nums">{money(p.precio)}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => cambiar(p.codigo, -1)}
                      className="grid size-7 place-items-center rounded-md border border-input"
                      aria-label={`Quitar ${p.nombre}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {carrito.find((i) => i.codigo === p.codigo)?.cantidad ?? 0}
                    </span>
                    <button
                      onClick={() => cambiar(p.codigo, 1)}
                      disabled={p.stock === 0}
                      className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                      aria-label={`Agregar ${p.nombre}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel titulo="Carrito y pago">
            <div className="space-y-4 p-5">
              {carrito.length ? (
                <ul className="space-y-1.5 text-sm">
                  {carrito.map((i) => (
                    <li key={i.codigo} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">
                        {i.cantidad} × {i.nombre}
                      </span>
                      <span className="tabular-nums">{money(i.cantidad * i.precio)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Tu carrito está vacío.
                </p>
              )}

              <Campo label="Canal de compra">
                <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value as Pedido["canal"])}>
                  <option>En línea</option>
                  <option>Tienda física</option>
                </select>
              </Campo>
              <Campo label="Método de pago">
                <select
                  className={inputCls}
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as Pedido["metodoPago"])}
                >
                  <option>Pago en línea</option>
                  <option>Tarjeta</option>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                </select>
              </Campo>

              <dl className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{money(t.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IVA 13%</dt>
                  <dd className="tabular-nums">{money(t.impuesto)}</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(t.total)}</dd>
                </div>
              </dl>

              <button
                onClick={pagar}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                <ShoppingCart className="size-4" /> Confirmar pedido y pagar
              </button>
              <p className="text-xs text-muted-foreground">
                El sistema valida el stock antes de confirmar y envía la confirmación al correo del cliente.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6">
        <Panel titulo="Mi historial de compras">
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
            <Campo label="Canal">
              <select className={inputCls} value={fCanal} onChange={(e) => setFCanal(e.target.value)}>
                <option>Todos</option>
                <option>En línea</option>
                <option>Tienda física</option>
              </select>
            </Campo>
            <Campo label="Desde">
              <input type="date" className={inputCls} value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
            </Campo>
          </div>
          {compras.length ? (
            <ul className="divide-y divide-border">
              {compras.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.id} · {c.fecha} · {c.canal} · {c.metodoPago}
                    </p>
                    <p className="text-sm">
                      {c.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Estado tono={tonoEstado(c.estado)}>{c.estado}</Estado>
                    <span className="tabular-nums text-sm font-semibold">{money(totales(c.items).total)}</span>
                    <button
                      onClick={() => descargarComprobante(c.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <Download className="size-3" /> Comprobante
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>No hay compras registradas para este cliente con los filtros aplicados.</Vacio>
          )}
        </Panel>
      </div>
    </>
  );
}
