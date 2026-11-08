import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { money } from "@/lib/erp-data";
import { Campo, Estado, inputCls, KpiCard, PageHeader, Panel, Tabla, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Control de inventarios — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Entradas, ajustes manuales con motivo, recálculo del saldo en bodega en tiempo real y estadísticas de reposición.",
      },
      { property: "og:title", content: "Control de inventarios — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-12 a HU-16: existencias por almacén, puntos mínimos y kardex de movimientos.",
      },
    ],
  }),
  component: Inventario,
});

function Inventario() {
  const { productos, movimientos, registrarEntrada, registrarAjuste } = useErp();
  const [almacen, setAlmacen] = useState("Todos");
  const [entrada, setEntrada] = useState({ codigo: productos[0].codigo, cantidad: 10, origen: "Compra", referencia: "" });
  const [ajuste, setAjuste] = useState({ codigo: productos[0].codigo, cantidad: -1, motivo: "" });

  const almacenes = ["Todos", ...Array.from(new Set(productos.map((p) => p.almacen)))];
  const lista = productos.filter((p) => almacen === "Todos" || p.almacen === almacen);
  const bajos = productos.filter((p) => p.stock < p.minimo);

  const accion = (r: { ok: boolean; mensaje: string }) =>
    r.ok ? toast.success(r.mensaje) : toast.error(r.mensaje);

  const exportar = () => {
    const filas = [
      ["Codigo", "Nombre", "Almacen", "Stock", "Minimo", "Maximo", "Precio", "Estado"].join(","),
      ...lista.map((p) =>
        [p.codigo, `"${p.nombre}"`, p.almacen, p.stock, p.minimo, p.maximo, p.precio, p.stock > 0 ? "Disponible" : "Agotado"].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([filas], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte-inventario.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte de inventario exportado en CSV.");
  };

  return (
    <>
      <PageHeader
        titulo="Control de inventarios"
        descripcion="Existencias por almacén con puntos mínimos y máximos, entradas por compra o producción, ajustes manuales con motivo obligatorio y kardex auditable."
        acciones={
          <button
            onClick={exportar}
            className="rounded-md border border-input bg-card px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Exportar reporte (CSV)
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          etiqueta="SKU registrados"
          valor={String(productos.length)}
          detalle={`${almacenes.length - 1} almacenes activos`}
        />
        <KpiCard
          etiqueta="Bajo punto mínimo"
          valor={String(bajos.length)}
          detalle="Requieren reposición inmediata"
          tono={bajos.length ? "warning" : "success"}
        />
        <KpiCard
          etiqueta="Movimientos registrados"
          valor={String(movimientos.length)}
          detalle="Entradas, salidas y ajustes auditados"
          tono="info"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel titulo="Registrar entrada de inventario">
          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Producto">
                <select
                  className={inputCls}
                  value={entrada.codigo}
                  onChange={(e) => setEntrada({ ...entrada, codigo: e.target.value })}
                >
                  {productos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Cantidad">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={entrada.cantidad}
                  onChange={(e) => setEntrada({ ...entrada, cantidad: Number(e.target.value) })}
                />
              </Campo>
              <Campo label="Origen">
                <select
                  className={inputCls}
                  value={entrada.origen}
                  onChange={(e) => setEntrada({ ...entrada, origen: e.target.value })}
                >
                  <option>Compra</option>
                  <option>Producción</option>
                  <option>Traslado entre almacenes</option>
                </select>
              </Campo>
              <Campo label="Comprobante / referencia">
                <input
                  className={inputCls}
                  value={entrada.referencia}
                  onChange={(e) => setEntrada({ ...entrada, referencia: e.target.value })}
                  placeholder="OC-2292"
                />
              </Campo>
            </div>
            <button
              onClick={() =>
                accion(registrarEntrada(entrada.codigo, entrada.cantidad, entrada.origen, entrada.referencia))
              }
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Registrar entrada
            </button>
          </div>
        </Panel>

        <Panel titulo="Ajuste manual de stock">
          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Producto">
                <select
                  className={inputCls}
                  value={ajuste.codigo}
                  onChange={(e) => setAjuste({ ...ajuste, codigo: e.target.value })}
                >
                  {productos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre} ({p.stock})
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Ajuste (+/-)">
                <input
                  type="number"
                  className={inputCls}
                  value={ajuste.cantidad}
                  onChange={(e) => setAjuste({ ...ajuste, cantidad: Number(e.target.value) })}
                />
              </Campo>
            </div>
            <Campo label="Motivo (obligatorio)">
              <input
                className={inputCls}
                value={ajuste.motivo}
                onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
                placeholder="Producto dañado, merma, conteo físico…"
              />
            </Campo>
            <button
              onClick={() => accion(registrarAjuste(ajuste.codigo, ajuste.cantidad, ajuste.motivo))}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Aplicar ajuste
            </button>
            <p className="text-xs text-muted-foreground">
              El sistema rechaza cualquier ajuste que deje el stock en negativo y guarda usuario, fecha y
              motivo para auditoría.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel
          titulo="Existencias por almacén"
          extra={
            <select
              className="rounded-md border border-input bg-card px-2 py-1 text-xs"
              value={almacen}
              onChange={(e) => setAlmacen(e.target.value)}
            >
              {almacenes.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          }
        >
          <Tabla
            cabeceras={["Código", "Producto", "Almacén", "Stock", "Mín/Máx", "Rotación 30d", "Precio", "Estado"]}
          >
            {lista.map((p) => (
              <tr key={p.codigo}>
                <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                <td className="px-4 py-3 text-sm">{p.nombre}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.almacen}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{p.stock}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                  {p.minimo} / {p.maximo}
                </td>
                <td className="px-4 py-3 tabular-nums">{p.vendidos30d}</td>
                <td className="px-4 py-3 tabular-nums">{money(p.precio)}</td>
                <td className="px-4 py-3">
                  {p.stock === 0 ? (
                    <Estado tono="danger">Agotado</Estado>
                  ) : p.stock < p.minimo ? (
                    <Estado tono="warning">Bajo mínimo</Estado>
                  ) : (
                    <Estado tono="success">Disponible</Estado>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel titulo="Kardex de movimientos (auditoría)">
          {movimientos.length ? (
            <Tabla cabeceras={["Fecha", "Producto", "Tipo", "Origen", "Cantidad", "Saldo", "Usuario", "Motivo/Ref."]}>
              {movimientos.slice(0, 25).map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.fecha}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.codigo}</td>
                  <td className="px-4 py-3">
                    <Estado
                      tono={m.tipo === "Entrada" ? "success" : m.tipo === "Salida" ? "info" : "warning"}
                    >
                      {m.tipo}
                    </Estado>
                  </td>
                  <td className="px-4 py-3 text-xs">{m.origen}</td>
                  <td
                    className={`px-4 py-3 tabular-nums font-semibold ${m.cantidad < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {m.cantidad > 0 ? "+" : ""}
                    {m.cantidad}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{m.saldo}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.usuario}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.motivo ?? m.referencia ?? "—"}</td>
                </tr>
              ))}
            </Tabla>
          ) : (
            <Vacio>Sin movimientos registrados.</Vacio>
          )}
        </Panel>
      </div>
    </>
  );
}
