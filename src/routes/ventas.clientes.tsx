import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useErp } from "@/lib/erp-store";
import { money, totales } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, Tabla, tonoEstado, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/ventas/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes e historial de ventas — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Búsqueda de clientes y consulta del historial de ventas con filtros por rango de fechas y monto.",
      },
      { property: "og:title", content: "Clientes e historial de ventas — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-04: buscar clientes, ver compras previas, importes y estado de factura.",
      },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  const { clientes, pedidos, facturas } = useErp();
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<number | null>(clientes[0]?.id ?? null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [minimo, setMinimo] = useState("");
  const [detalle, setDetalle] = useState<string | null>(null);

  const filtrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      String(c.id).includes(busqueda) ||
      c.documento.includes(busqueda),
  );

  const cliente = clientes.find((c) => c.id === sel);

  const ventas = useMemo(
    () =>
      pedidos
        .filter((p) => p.clienteId === sel)
        .filter((p) => (desde ? p.fecha >= desde : true))
        .filter((p) => (hasta ? p.fecha <= hasta : true))
        .filter((p) => (minimo ? totales(p.items).total >= Number(minimo) : true)),
    [pedidos, sel, desde, hasta, minimo],
  );

  const estadoFactura = (facturaId?: string) =>
    facturaId ? (facturas.find((f) => f.id === facturaId)?.estado ?? "Sin factura") : "Sin factura";

  return (
    <>
      <PageHeader
        titulo="Clientes e historial de ventas"
        descripcion="Busca clientes por nombre o identificador y consulta sus compras previas con importes, estado de factura y detalle completo."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Clientes">
          <div className="border-b border-border p-4">
            <input
              className={inputCls}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, ID o DUI/NIT…"
            />
          </div>
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSel(c.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted ${
                    sel === c.id ? "bg-muted" : ""
                  }`}
                >
                  <p className="text-sm font-semibold">{c.nombre}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    #{c.id} · {c.documento}
                  </p>
                </button>
              </li>
            ))}
            {!filtrados.length && <Vacio>Sin coincidencias.</Vacio>}
          </ul>
        </Panel>

        <div className="space-y-6">
          {cliente && (
            <Panel titulo="Ficha del cliente">
              <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Nombre completo", cliente.nombre],
                  ["DUI / NIT", cliente.documento],
                  ["Correo electrónico", cliente.correo],
                  ["Teléfono", cliente.telefono],
                  ["Dirección", cliente.direccion],
                  ["Fecha de registro", cliente.fechaRegistro],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="label-caps">{k}</dt>
                    <dd className="mt-0.5 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          <Panel titulo="Historial de ventas">
            <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
              <Campo label="Desde">
                <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
              </Campo>
              <Campo label="Hasta">
                <input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </Campo>
              <Campo label="Monto mínimo (USD)">
                <input
                  type="number"
                  className={inputCls}
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  placeholder="0.00"
                />
              </Campo>
            </div>

            {ventas.length ? (
              <Tabla cabeceras={["Venta", "Fecha", "Productos", "Importe", "Estado factura", ""]}>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-mono text-xs">{v.id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{v.fecha}</td>
                    <td className="px-4 py-3 text-xs">{v.items.length} línea(s)</td>
                    <td className="px-4 py-3 tabular-nums">{money(totales(v.items).total)}</td>
                    <td className="px-4 py-3">
                      <Estado tono={tonoEstado(estadoFactura(v.facturaId))}>
                        {estadoFactura(v.facturaId)}
                      </Estado>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetalle(detalle === v.id ? null : v.id)}
                        className="text-xs font-semibold text-info hover:underline"
                      >
                        {detalle === v.id ? "Ocultar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>
                ))}
                {detalle && (
                  <tr>
                    <td colSpan={6} className="bg-muted/50 px-4 py-3">
                      <ul className="space-y-1 text-xs">
                        {ventas
                          .find((v) => v.id === detalle)
                          ?.items.map((i) => (
                            <li key={i.codigo} className="flex justify-between">
                              <span>
                                {i.cantidad} × {i.nombre} ({i.codigo})
                              </span>
                              <span className="tabular-nums">{money(i.cantidad * i.precio)}</span>
                            </li>
                          ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Tabla>
            ) : (
              <Vacio>Este cliente no tiene ventas en el rango seleccionado.</Vacio>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
