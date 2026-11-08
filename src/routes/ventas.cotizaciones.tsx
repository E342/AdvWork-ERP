import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { money, subtotalLinea, totales, type LineaItem } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, Tabla, tonoEstado, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/ventas/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Registro de cotizaciones con descuentos e impuestos calculados y conversión a pedido con reserva de stock.",
      },
      { property: "og:title", content: "Cotizaciones — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-01 y HU-02: cotizar, aprobar y convertir en pedido oficial.",
      },
    ],
  }),
  component: Cotizaciones,
});

function Cotizaciones() {
  const {
    productos,
    clientes,
    cotizaciones,
    clientePorId,
    crearCotizacion,
    cambiarEstadoCotizacion,
    convertirEnPedido,
  } = useErp();

  const [clienteId, setClienteId] = useState(clientes[0].id);
  const [codigo, setCodigo] = useState(productos[0].codigo);
  const [cantidad, setCantidad] = useState(1);
  const [descuento, setDescuento] = useState(0);
  const [items, setItems] = useState<LineaItem[]>([]);

  const t = totales(items);

  const agregar = () => {
    const prod = productos.find((p) => p.codigo === codigo);
    if (!prod || cantidad < 1) return toast.error("Selecciona un producto y una cantidad válida.");
    setItems((prev) => [
      ...prev.filter((i) => i.codigo !== codigo),
      { codigo: prod.codigo, nombre: prod.nombre, cantidad, precio: prod.precio, descuento },
    ]);
    setCantidad(1);
    setDescuento(0);
  };

  const guardar = () => {
    const r = crearCotizacion(clienteId, items);
    r.ok ? toast.success(r.mensaje) : toast.error(r.mensaje);
    if (r.ok) setItems([]);
  };

  const accion = (r: { ok: boolean; mensaje: string }) =>
    r.ok ? toast.success(r.mensaje) : toast.error(r.mensaje);

  return (
    <>
      <PageHeader
        titulo="Gestión de cotizaciones"
        descripcion="Registra cotizaciones con descuentos, cálculo automático de subtotal e IVA, y conviértelas en pedidos oficiales con reserva de stock."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel titulo="Nueva cotización">
          <div className="space-y-4 p-5">
            <Campo label="Cliente">
              <select
                className={inputCls}
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {c.documento}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid gap-3 sm:grid-cols-[2fr_0.7fr_0.9fr_auto] sm:items-end">
              <Campo label="Producto">
                <select className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)}>
                  {productos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre} ({p.stock} disp.)
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Cant.">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                />
              </Campo>
              <Campo label="Desc. %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputCls}
                  value={descuento}
                  onChange={(e) => setDescuento(Number(e.target.value))}
                />
              </Campo>
              <button
                onClick={agregar}
                className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-4" /> Añadir
              </button>
            </div>

            {items.length ? (
              <div className="rounded-md border border-border">
                <Tabla cabeceras={["Producto", "Cant.", "P. unit.", "Desc.", "Subtotal", ""]}>
                  {items.map((i) => (
                    <tr key={i.codigo}>
                      <td className="px-4 py-2.5">{i.nombre}</td>
                      <td className="px-4 py-2.5 tabular-nums">{i.cantidad}</td>
                      <td className="px-4 py-2.5 tabular-nums">{money(i.precio)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{i.descuento}%</td>
                      <td className="px-4 py-2.5 tabular-nums">{money(subtotalLinea(i))}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setItems((p) => p.filter((x) => x.codigo !== i.codigo))}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Quitar ${i.nombre}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Tabla>
                <dl className="space-y-1 border-t border-border bg-muted/50 px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">{money(t.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Descuento aplicado</dt>
                    <dd className="tabular-nums text-destructive">-{money(t.descuento)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">IVA 13%</dt>
                    <dd className="tabular-nums">{money(t.impuesto)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{money(t.total)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Agrega productos para calcular subtotal, descuento e impuestos automáticamente.
              </p>
            )}

            <button
              onClick={guardar}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Guardar cotización (queda Pendiente)
            </button>
          </div>
        </Panel>

        <Panel titulo="Cotizaciones registradas">
          {cotizaciones.length ? (
            <ul className="divide-y divide-border">
              {cotizaciones.map((c) => {
                const tc = totales(c.items);
                return (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{c.id} · {c.fecha}</p>
                        <p className="text-sm font-semibold">{clientePorId(c.clienteId)?.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.items.length} línea(s) · {money(tc.total)} · Vendedor: {c.vendedor}
                        </p>
                      </div>
                      <Estado tono={tonoEstado(c.estado)}>{c.estado}</Estado>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.estado === "Pendiente" && (
                        <>
                          <button
                            onClick={() => accion(cambiarEstadoCotizacion(c.id, "Aprobada"))}
                            className="rounded-md bg-success/12 px-2.5 py-1.5 text-xs font-semibold text-success"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => accion(cambiarEstadoCotizacion(c.id, "Rechazada"))}
                            className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive"
                          >
                            Rechazar
                          </button>
                          <button
                            onClick={() => accion(cambiarEstadoCotizacion(c.id, "Cancelada"))}
                            className="rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => accion(convertirEnPedido(c.id))}
                        disabled={c.estado !== "Aprobada"}
                        className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Convertir en pedido
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vacio>Aún no hay cotizaciones registradas.</Vacio>
          )}
        </Panel>
      </div>
    </>
  );
}
