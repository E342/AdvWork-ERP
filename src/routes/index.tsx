import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useErp } from "@/lib/erp-store";
import { money, totales } from "@/lib/erp-data";
import { Estado, KpiCard, Panel, Tabla, tonoEstado, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de control — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Indicadores en tiempo real de ventas, facturación electrónica e inventarios de AdvWork-ERP.",
      },
      { property: "og:title", content: "Panel de control — AdvWork-ERP" },
      {
        property: "og:description",
        content: "KPIs de ventas, DTE emitidos y alertas de reposición de Adventure Works.",
      },
    ],
  }),
  component: Panel_,
});

function Panel_() {
  const { productos, pedidos, facturas, cotizaciones, clientePorId } = useErp();

  const facturado = facturas
    .filter((f) => f.estado === "Emitida")
    .reduce((a, f) => a + totales(f.items).total, 0);
  const bajoMinimo = productos.filter((p) => p.stock < p.minimo);
  const pendientes = facturas.filter((f) => f.estado !== "Emitida").length;
  const valorInventario = productos.reduce((a, p) => a + p.stock * p.precio, 0);

  const datos = productos
    .slice()
    .sort((a, b) => b.vendidos30d - a.vendidos30d)
    .slice(0, 6)
    .map((p) => ({ nombre: p.codigo, Unidades: p.vendidos30d }));

  return (
    <>
      <header className="mb-6 border-b border-border pb-5">
        <p className="label-caps">Adventure Works</p>
        <h1 className="mt-1 text-2xl font-bold">Panel de control operativo</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Vista consolidada de los cuatro módulos del ERS: Ventas, Facturación Electrónica,
          Inventarios y Administración. Los datos son simulados y se recalculan en tiempo real
          conforme operas el sistema.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          etiqueta="Facturado (DTE emitidos)"
          valor={money(facturado)}
          detalle={`${facturas.filter((f) => f.estado === "Emitida").length} comprobantes sellados`}
          tono="success"
        />
        <KpiCard
          etiqueta="Pedidos activos"
          valor={String(pedidos.filter((p) => p.estado !== "Cancelado").length)}
          detalle={`${cotizaciones.filter((c) => c.estado === "Pendiente").length} cotizaciones pendientes`}
          tono="info"
        />
        <KpiCard
          etiqueta="Valor de inventario"
          valor={money(valorInventario)}
          detalle={`${productos.length} SKU en ${new Set(productos.map((p) => p.almacen)).size} almacenes`}
          tono="accent"
        />
        <KpiCard
          etiqueta="DTE por procesar"
          valor={String(pendientes)}
          detalle="Borradores y pendientes de envío"
          tono={pendientes ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel titulo="Rotación por producto (últimos 30 días)" className="lg:col-span-2">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Unidades" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          titulo="Alertas de reposición"
          extra={
            <Link to="/inventario" className="text-xs font-semibold text-info hover:underline">
              Ver inventario
            </Link>
          }
        >
          {bajoMinimo.length ? (
            <ul className="divide-y divide-border">
              {bajoMinimo.map((p) => (
                <li key={p.codigo} className="flex items-start gap-3 px-5 py-3.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {p.stock} · mínimo {p.minimo} · {p.almacen}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Todos los productos están sobre su punto mínimo.</Vacio>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          titulo="Últimos pedidos"
          extra={
            <Link
              to="/ventas/pedidos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline"
            >
              Gestionar <ArrowRight className="size-3" />
            </Link>
          }
        >
          <Tabla cabeceras={["Pedido", "Cliente", "Estado", "Total"]}>
            {pedidos.slice(0, 5).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                <td className="px-4 py-3">{clientePorId(p.clienteId)?.nombre}</td>
                <td className="px-4 py-3">
                  <Estado tono={tonoEstado(p.estado)}>{p.estado}</Estado>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totales(p.items).total)}</td>
              </tr>
            ))}
          </Tabla>
        </Panel>

        <Panel
          titulo="Facturación electrónica reciente"
          extra={
            <Link
              to="/facturacion"
              className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline"
            >
              Gestionar <ArrowRight className="size-3" />
            </Link>
          }
        >
          <Tabla cabeceras={["Documento", "Serie/Folio", "Estado", "Total"]}>
            {facturas.slice(0, 5).map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-mono text-xs">{f.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {f.serie}-{f.folio}
                </td>
                <td className="px-4 py-3">
                  <Estado tono={tonoEstado(f.estado)}>{f.estado}</Estado>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totales(f.items).total)}</td>
              </tr>
            ))}
          </Tabla>
        </Panel>
      </div>
    </>
  );
}
