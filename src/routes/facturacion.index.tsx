import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Send } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { money, totales } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, Tabla, tonoEstado, Vacio } from "@/components/erp/ui";

export const Route = createFileRoute("/facturacion/")({
  head: () => ({
    meta: [
      { title: "Documentos Tributarios Electrónicos — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Generación, envío a la Entidad Tributaria, control de estados y descarga de comprobantes electrónicos DTE.",
      },
      { property: "og:title", content: "Documentos Tributarios Electrónicos — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-07 a HU-10: emitir, sellar, consultar y descargar facturas electrónicas.",
      },
    ],
  }),
  component: Facturacion,
});

function Facturacion() {
  const { facturas, clientePorId, enviarFacturaHacienda, marcarPendienteEnvio } = useErp();
  const [q, setQ] = useState("");
  const [fecha, setFecha] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  const lista = facturas
    .filter((f) =>
      q
        ? f.folio.includes(q) ||
          f.id.toLowerCase().includes(q.toLowerCase()) ||
          (clientePorId(f.clienteId)?.nombre.toLowerCase().includes(q.toLowerCase()) ?? false)
        : true,
    )
    .filter((f) => (fecha ? f.fecha === fecha : true));

  const accion = (r: { ok: boolean; mensaje: string }) =>
    r.ok ? toast.success(r.mensaje) : toast.error(r.mensaje);

  const descargar = (id: string) => {
    const f = facturas.find((x) => x.id === id)!;
    const cli = clientePorId(f.clienteId)!;
    const t = totales(f.items);
    const texto = [
      "DOCUMENTO TRIBUTARIO ELECTRÓNICO (simulado)",
      `Serie/Folio: ${f.serie}-${f.folio}`,
      `Fecha: ${f.fecha}`,
      `Receptor: ${cli.nombre} — ${cli.documento}`,
      "",
      ...f.items.map((i) => `${i.cantidad} x ${i.nombre} @ ${money(i.precio)}`),
      "",
      `Subtotal: ${money(t.subtotal)}`,
      `IVA 13%: ${money(t.impuesto)}`,
      `Total: ${money(t.total)}`,
      `Sello electrónico: ${f.selloElectronico ?? "PENDIENTE"}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${f.serie}-${f.folio}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comprobante descargado (simulación del PDF/XML).");
  };

  return (
    <>
      <PageHeader
        hu={["HU-07", "HU-08", "HU-09", "HU-10"]}
        titulo="Facturación electrónica (DTE)"
        descripcion="Ciclo de vida completo del comprobante: borrador, envío a la Entidad Tributaria vía API REST/HTTPS, sellado o rechazo, y descarga del archivo."
      />

      <Panel titulo="Historial de facturas">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[2fr_1fr]">
          <Campo label="Buscar por folio, documento o cliente">
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="1041, FAC-0155, Rivas…" />
          </Campo>
          <Campo label="Fecha de emisión">
            <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        </div>

        {lista.length ? (
          <Tabla cabeceras={["Documento", "Serie-Folio", "Cliente", "Fecha", "Estado", "Total", "Acciones"]}>
            {lista.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-mono text-xs">{f.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {f.serie}-{f.folio}
                </td>
                <td className="px-4 py-3 text-sm">{clientePorId(f.clienteId)?.nombre}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{f.fecha}</td>
                <td className="px-4 py-3">
                  <Estado tono={tonoEstado(f.estado)}>{f.estado}</Estado>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totales(f.items).total)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => accion(marcarPendienteEnvio(f.id))}
                      disabled={f.estado === "Emitida"}
                      className="rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
                    >
                      Pendiente
                    </button>
                    <button
                      onClick={() => accion(enviarFacturaHacienda(f.id))}
                      disabled={f.estado === "Emitida"}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      <Send className="size-3" /> Enviar
                    </button>
                    <button
                      onClick={() => descargar(f.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground"
                    >
                      <Download className="size-3" /> Descargar
                    </button>
                    <button
                      onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                      className="text-xs font-semibold text-info hover:underline"
                    >
                      {abierta === f.id ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {abierta && (() => {
              const f = lista.find((x) => x.id === abierta);
              if (!f) return null;
              const t = totales(f.items);
              return (
                <tr>
                  <td colSpan={7} className="bg-muted/50 px-5 py-4">
                    <p className="label-caps mb-2">Vista previa del comprobante</p>
                    <ul className="space-y-1 text-xs">
                      {f.items.map((i) => (
                        <li key={i.codigo} className="flex justify-between">
                          <span>
                            {i.cantidad} × {i.nombre}
                          </span>
                          <span className="tabular-nums">{money(i.cantidad * i.precio)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 border-t border-border pt-2 text-xs">
                      <p className="flex justify-between">
                        <span>Subtotal</span> <span className="tabular-nums">{money(t.subtotal)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>IVA 13%</span> <span className="tabular-nums">{money(t.impuesto)}</span>
                      </p>
                      <p className="flex justify-between font-semibold">
                        <span>Total</span> <span className="tabular-nums">{money(t.total)}</span>
                      </p>
                    </div>
                    <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                      Sello: {f.selloElectronico ?? "— sin sellar —"}
                    </p>
                    {f.mensajeHacienda && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Respuesta de la Entidad Tributaria: {f.mensajeHacienda}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })()}
          </Tabla>
        ) : (
          <Vacio>No hay comprobantes que coincidan con los filtros.</Vacio>
        )}
      </Panel>
    </>
  );
}
