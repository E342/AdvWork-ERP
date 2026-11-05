import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { money, totales, type LineaItem } from "@/lib/erp-data";
import { Campo, inputCls, PageHeader, Panel, Tabla, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/ventas/devoluciones")({
  head: () => ({
    meta: [
      { title: "Devoluciones — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Procesamiento de devoluciones parciales o totales con reintegro automático de productos al inventario.",
      },
      { property: "og:title", content: "Devoluciones — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-03: devolver uno o varios productos de una venta y ajustar el inventario.",
      },
    ],
  }),
  component: Devoluciones,
});

function Devoluciones() {
  const { pedidos, devoluciones, clientePorId, registrarDevolucion } = useErp();
  const vendidos = useMemo(() => pedidos.filter((p) => p.estado !== "Reservado"), [pedidos]);
  const [pedidoId, setPedidoId] = useState(vendidos[0]?.id ?? "");
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState("");

  const pedido = vendidos.find((p) => p.id === pedidoId);

  const enviar = () => {
    if (!pedido) return toast.error("Selecciona una venta.");
    const items: LineaItem[] = pedido.items
      .filter((i) => (seleccion[i.codigo] ?? 0) > 0)
      .map((i) => ({ ...i, cantidad: Math.min(seleccion[i.codigo], i.cantidad) }));
    const r = registrarDevolucion(pedido.id, items, motivo);
    if (r.ok) {
      toast.success(r.mensaje);
      setSeleccion({});
      setMotivo("");
    } else toast.error(r.mensaje);
  };

  return (
    <>
      <PageHeader
        hu={["HU-03"]}
        titulo="Devoluciones de productos"
        descripcion="Selecciona una venta existente y devuelve uno o varios productos. El inventario se actualiza al confirmar y queda un registro asociado a la venta original."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel titulo="Registrar devolución">
          <div className="space-y-4 p-5">
            <Campo label="Venta original">
              <select className={inputCls} value={pedidoId} onChange={(e) => { setPedidoId(e.target.value); setSeleccion({}); }}>
                {vendidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {clientePorId(p.clienteId)?.nombre} ({p.fecha})
                  </option>
                ))}
              </select>
            </Campo>

            {pedido ? (
              <div className="rounded-md border border-border">
                <Tabla cabeceras={["Producto", "Comprado", "A devolver"]}>
                  {pedido.items.map((i) => (
                    <tr key={i.codigo}>
                      <td className="px-4 py-2.5">{i.nombre}</td>
                      <td className="px-4 py-2.5 tabular-nums">{i.cantidad}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={i.cantidad}
                          value={seleccion[i.codigo] ?? 0}
                          onChange={(e) =>
                            setSeleccion((s) => ({ ...s, [i.codigo]: Number(e.target.value) }))
                          }
                          className="w-20 rounded-md border border-input bg-card px-2 py-1 text-sm tabular-nums outline-none focus:border-ring"
                        />
                      </td>
                    </tr>
                  ))}
                </Tabla>
              </div>
            ) : (
              <Vacio>No hay ventas confirmadas disponibles.</Vacio>
            )}

            <Campo label="Motivo (obligatorio)">
              <input
                className={inputCls}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Producto defectuoso, talla incorrecta…"
              />
            </Campo>

            <button
              onClick={enviar}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Confirmar devolución y reintegrar al inventario
            </button>
          </div>
        </Panel>

        <Panel titulo="Historial de devoluciones">
          {devoluciones.length ? (
            <ul className="divide-y divide-border">
              {devoluciones.map((d) => (
                <li key={d.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {d.id} · venta {d.pedidoId} · {d.fecha}
                      </p>
                      <p className="text-sm font-semibold">{clientePorId(d.clienteId)?.nombre}</p>
                    </div>
                    <span className="tabular-nums text-sm font-semibold">
                      {money(totales(d.items).total)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {d.items.map((i) => (
                      <li key={i.codigo}>
                        {i.cantidad} × {i.nombre}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    <span className="label-caps">Motivo:</span> {d.motivo}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Sin devoluciones registradas.</Vacio>
          )}
        </Panel>
      </div>
    </>
  );
}
