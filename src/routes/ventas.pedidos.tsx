import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { money, totales } from "@/lib/erp-data";
import { Estado, PageHeader, Panel, Tabla, tonoEstado, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/ventas/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Pedidos oficiales de Adventure Works: confirmación con descuento automático de inventario y generación de factura electrónica.",
      },
      { property: "og:title", content: "Pedidos — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-02 y HU-13: confirmar pedidos y descontar stock en tiempo real.",
      },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const { pedidos, clientePorId, confirmarPedido, generarFactura } = useErp();
  const accion = (r: { ok: boolean; mensaje: string }) =>
    r.ok ? toast.success(r.mensaje) : toast.error(r.mensaje);

  return (
    <>
      <PageHeader
        titulo="Pedidos oficiales"
        descripcion="Los pedidos heredan los datos de la cotización aprobada. Al confirmarlos, el sistema descuenta el inventario automáticamente y habilita la emisión del DTE."
      />

      <Panel titulo={`${pedidos.length} pedidos registrados`}>
        {pedidos.length ? (
          <Tabla
            cabeceras={["Pedido", "Origen", "Cliente", "Canal / Pago", "Estado", "Total", "Acciones"]}
          >
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {p.cotizacionId ?? "Venta directa"}
                </td>
                <td className="px-4 py-3">
                  <span className="block text-sm">{clientePorId(p.clienteId)?.nombre}</span>
                  <span className="text-xs text-muted-foreground">{p.fecha}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {p.canal}
                  <br />
                  {p.metodoPago}
                </td>
                <td className="px-4 py-3">
                  <Estado tono={tonoEstado(p.estado)}>{p.estado}</Estado>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totales(p.items).total)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => accion(confirmarPedido(p.id))}
                      disabled={p.estado !== "Reservado"}
                      className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => accion(generarFactura(p.id))}
                      disabled={!!p.facturaId || p.estado === "Reservado"}
                      className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {p.facturaId ? `Facturado (${p.facturaId})` : "Generar DTE"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        ) : (
          <Vacio>No hay pedidos. Convierte una cotización aprobada para generar el primero.</Vacio>
        )}
      </Panel>
    </>
  );
}
