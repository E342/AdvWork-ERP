import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { money, totales, type Factura } from "@/lib/erp-data";
import { detalleTransmision, listarTransmisiones, type ResumenTransmision } from "@/lib/dte-api";
import { descargarPdf, generarPdfDte } from "@/lib/pdf-dte";
import { enviarCorreoDte } from "@/lib/correo-api";
import {
  Campo,
  Estado,
  inputCls,
  PageHeader,
  Panel,
  Tabla,
  tonoEstado,
  Vacio,
} from "@/components/erp/ui";

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

type Aviso = { ok: boolean; mensaje: string; nivel?: "exito" | "aviso" | "error" };

const avisar = (r: Aviso) => {
  const nivel = r.nivel ?? (r.ok ? "exito" : "error");
  if (nivel === "exito") toast.success(r.mensaje);
  else if (nivel === "aviso") toast.warning(r.mensaje);
  else toast.error(r.mensaje);
};

function guardarArchivo(contenido: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const ETIQUETA_RESULTADO: Record<string, string> = {
  aceptado: "Aceptado",
  aceptado_con_observaciones: "Aceptado con observaciones",
  rechazado: "Rechazado",
  sin_respuesta: "Sin respuesta",
  servicio_no_disponible: "Servicio no disponible",
  error_servicio: "Error del servicio",
  error_autenticacion: "Error de autenticación",
  respuesta_inesperada: "Respuesta inesperada",
};
const ETIQUETA_ORIGEN: Record<string, string> = {
  envio: "Envío",
  consulta_manual: "Consulta manual",
};
const tonoResultado = (r: string | null) =>
  r === "aceptado" || r === "aceptado_con_observaciones"
    ? "success"
    : r === "rechazado"
      ? "danger"
      : "warning";

function Facturacion() {
  const {
    facturas,
    pedidos,
    clientePorId,
    enviandoIds,
    enviarFacturaHacienda,
    consultarEstadoFactura,
    marcarPendienteEnvio,
  } = useErp();
  const [q, setQ] = useState("");
  const [fecha, setFecha] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [tipoDte, setTipoDte] = useState<"01" | "03">("01");
  const [enviandoCorreo, setEnviandoCorreo] = useState<string | null>(null);

  const lista = facturas
    .filter((f) =>
      q
        ? f.folio.includes(q) ||
          f.id.toLowerCase().includes(q.toLowerCase()) ||
          (clientePorId(f.clienteId)?.nombre.toLowerCase().includes(q.toLowerCase()) ?? false)
        : true,
    )
    .filter((f) => (fecha ? f.fecha === fecha : true));

  const enviar = async (id: string) => {
    const r = await enviarFacturaHacienda(id);
    avisar(r);
    setAbierta(id); // se muestra el resultado detallado del envío
  };

  const consultar = async (id: string) => avisar(await consultarEstadoFactura(id));

  const descargar = async (id: string) => {
    const f = facturas.find((x) => x.id === id)!;
    const cli = clientePorId(f.clienteId)!;
    try {
      const blob = await generarPdfDte({
        factura: f,
        cliente: cli,
        tipoDte,
        numeroControl: f.numeroControl ?? `DTE-01-M001P001-${"0".repeat(15)}`,
        codigoGeneracion: f.codigoGeneracion ?? "00000000-0000-4000-8000-000000000000",
        sello: f.selloElectronico ?? "PENDIENTE",
        fechaHora: f.fhProcesamiento ?? new Date().toLocaleString("es-SV"),
      });
      const nombre = tipoDte === "01" ? `Factura-${f.serie}-${f.folio}.pdf` : `CCF-${f.serie}-${f.folio}.pdf`;
      descargarPdf(blob, nombre);
      toast.success(`${tipoDte === "01" ? "Factura" : "Crédito Fiscal"} descargado en PDF.`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF. Revisa la consola.");
    }
  };

  const enviarCorreoFactura = async (id: string) => {
    const f = facturas.find((x) => x.id === id)!;
    const cli = clientePorId(f.clienteId)!;
    if (!f.selloElectronico) {
      toast.error("La factura debe estar Emitida antes de enviar el correo.");
      return;
    }
    const ped = pedidos.find((p) => p.id === f.pedidoId);
    setEnviandoCorreo(id);
    try {
      const r = await enviarCorreoDte({
        factura: f,
        cliente: cli,
        tipoDte: tipoDte === "01" ? "Factura" : "Crédito Fiscal",
        numeroControl: f.numeroControl ?? "",
        codigoGeneracion: f.codigoGeneracion ?? "",
        sello: f.selloElectronico,
        fechaHora: f.fhProcesamiento ?? new Date().toLocaleString("es-SV"),
        canal: ped?.canal ?? "Tienda física",
        metodoPago: ped?.metodoPago ?? "Efectivo",
      });
      if (r.ok) {
        toast.success(`Correo enviado a ${r.destinatario}.`);
      } else if (r.preview) {
        toast("Correo enviado.", { icon: "📧" });
      } else {
        toast.error(`Error al enviar correo: ${r.error}`);
      }
    } finally {
      setEnviandoCorreo(null);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Facturación electrónica (DTE)"
        descripcion="Ciclo de vida completo del comprobante: borrador, envío a la Entidad Tributaria vía API REST/HTTPS, sellado o rechazo, y descarga del archivo."
      />

      {/* Selector de tipo de DTE */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Tipo de DTE:</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="radio" name="tipoDte" value="01" checked={tipoDte === "01"} onChange={() => setTipoDte("01")} className="accent-primary" />
          Factura (01)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="radio" name="tipoDte" value="03" checked={tipoDte === "03"} onChange={() => setTipoDte("03")} className="accent-primary" />
          Crédito Fiscal (03)
        </label>
        <span className="ml-auto text-xs text-muted-foreground">Aplica al PDF y al correo</span>
      </div>

      <Panel titulo="Historial de facturas">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[2fr_1fr]">
          <Campo label="Buscar por folio, documento o cliente">
            <input
              className={inputCls}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="1041, FAC-0155, Rivas…"
            />
          </Campo>
          <Campo label="Fecha de emisión">
            <input
              type="date"
              className={inputCls}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
        </div>

        {lista.length ? (
          <Tabla
            cabeceras={[
              "Documento",
              "Serie-Folio",
              "Cliente",
              "Fecha",
              "Estado",
              "Total",
              "Acciones",
            ]}
          >
            {lista.map((f) => {
              const enCurso = enviandoIds.has(f.id);
              return (
                <tr key={f.id} aria-busy={enCurso}>
                  <td className="px-4 py-3 font-mono text-xs">{f.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.serie}-{f.folio}
                  </td>
                  <td className="px-4 py-3 text-sm">{clientePorId(f.clienteId)?.nombre}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.fecha}</td>
                  <td className="px-4 py-3">
                    <Estado tono={tonoEstado(f.estado)}>{f.estado}</Estado>
                    {enCurso && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Comunicando con Hacienda… (puede tardar unos 15 s)
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(totales(f.items).total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => avisar(marcarPendienteEnvio(f.id))}
                        disabled={f.estado === "Emitida" || enCurso}
                        className="rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
                      >
                        Pendiente
                      </button>
                      <button
                        onClick={() => void enviar(f.id)}
                        disabled={f.estado === "Emitida" || enCurso}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                      >
                        {enCurso ? (
                          <>
                            <Loader2 className="size-3 animate-spin" /> Enviando…
                          </>
                        ) : (
                          <>
                            <Send className="size-3" />{" "}
                            {f.estado === "Borrador" ? "Enviar" : "Reenviar"}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => void descargar(f.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground"
                      >
                        <Download className="size-3" /> Descargar PDF
                      </button>
                      <button
                        onClick={() => void enviarCorreoFactura(f.id)}
                        disabled={f.estado !== "Emitida" || enviandoCorreo === f.id}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
                        title={f.estado !== "Emitida" ? "Solo se puede enviar correo de facturas Emitidas" : `Enviar correo a ${clientePorId(f.clienteId)?.correo}`}
                      >
                        {enviandoCorreo === f.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Mail className="size-3" />
                        )}{" "}
                        Correo
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
              );
            })}
            {abierta &&
              (() => {
                const f = lista.find((x) => x.id === abierta);
                if (!f) return null;
                return (
                  <tr>
                    <td colSpan={7} className="bg-muted/50 px-5 py-4">
                      <DetalleFactura
                        f={f}
                        enCurso={enviandoIds.has(f.id)}
                        onConsultar={() => void consultar(f.id)}
                      />
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

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 break-all text-xs">{children}</dd>
    </div>
  );
}

function DetalleFactura({
  f,
  enCurso,
  onConsultar,
}: {
  f: Factura;
  enCurso: boolean;
  onConsultar: () => void;
}) {
  const t = totales(f.items);
  const hayResultado = !!(f.transmisionId || f.selloElectronico || f.mensajeHacienda);
  const puedeConsultar =
    !!f.transmisionId || f.estado === "Pendiente de envío" || f.estado === "Rechazada";
  const difiere = f.totalDte !== undefined && Math.abs(f.totalDte - t.total) >= 0.005;

  const descargarDte = async () => {
    if (!f.transmisionId) return;
    const r = await detalleTransmision(f.transmisionId);
    if (r.tipo !== "respuesta" || r.status !== 200 || !r.datos) {
      toast.error("No se pudo obtener el DTE del servidor.");
      return;
    }
    guardarArchivo(
      JSON.stringify(r.datos.dte, null, 2),
      `${r.datos.numeroControl}.json`,
      "application/json",
    );
    toast.success("DTE descargado (JSON sin firmar; la firma simulada se aplica al enviarlo).");
  };

  return (
    <div className="space-y-4">
      <div>
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
          {difiere && (
            <p className="mt-1 flex justify-between text-muted-foreground">
              <span>Total según el DTE (redondeo por línea)</span>
              <span className="tabular-nums">{money(f.totalDte!)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2">
          <p className="label-caps">Resultado del envío</p>
        </div>

        {hayResultado ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Dato etiqueta="Estado">
              <Estado tono={tonoEstado(f.estado)}>{f.estado}</Estado>
            </Dato>
            {f.mensajeHacienda && <Dato etiqueta="Mensaje">{f.mensajeHacienda}</Dato>}
            {f.codigoMsg && (
              <Dato etiqueta="Código de respuesta">
                {f.codigoMsg}
                {f.descripcionMsg ? ` — ${f.descripcionMsg}` : ""}
              </Dato>
            )}
            <Dato etiqueta="Sello de recepción">
              <span className="font-mono">{f.selloElectronico ?? "— sin sellar —"}</span>
            </Dato>
            {f.fhProcesamiento && <Dato etiqueta="Procesado">{f.fhProcesamiento}</Dato>}
            {f.codigoGeneracion && (
              <Dato etiqueta="Código de generación">
                <span className="font-mono">{f.codigoGeneracion}</span>
              </Dato>
            )}
            {f.numeroControl && (
              <Dato etiqueta="Número de control">
                <span className="font-mono">{f.numeroControl}</span>
              </Dato>
            )}
            {f.envios !== undefined && (
              <Dato etiqueta="Intentos">
                {f.envios} envío(s), {f.consultas ?? 0} consulta(s)
                {f.recuperadoPorConsulta && " — recuperado por consulta de estado"}
              </Dato>
            )}
            {!!f.observaciones?.length && (
              <Dato etiqueta="Observaciones">
                <ul className="list-disc pl-4">
                  {f.observaciones.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </Dato>
            )}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            Esta factura aún no se ha enviado a Hacienda.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {puedeConsultar && (
            <button
              onClick={onConsultar}
              disabled={enCurso}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground disabled:opacity-40"
            >
              <RefreshCw className={`size-3 ${enCurso ? "animate-spin" : ""}`} /> Consultar estado
            </button>
          )}
          {f.transmisionId && (
            <button
              onClick={() => void descargarDte()}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground"
            >
              <Download className="size-3" /> Descargar DTE (JSON)
            </button>
          )}
        </div>
      </div>

      <Historial facturaId={f.id} version={`${f.transmisionId ?? ""}|${f.estado}`} />
    </div>
  );
}

function Historial({ facturaId, version }: { facturaId: string; version: string }) {
  const [est, setEst] = useState<{
    cargando: boolean;
    error: string | null;
    lista: ResumenTransmision[];
  }>({ cargando: true, error: null, lista: [] });

  // `version` cambia tras cada envío/consulta y fuerza a recargar el historial del servidor.
  useEffect(() => {
    let vigente = true;
    setEst((s) => ({ ...s, cargando: true, error: null }));
    void listarTransmisiones(facturaId).then((r) => {
      if (!vigente) return;
      if (r.tipo === "respuesta" && r.status === 200 && r.datos) {
        setEst({ cargando: false, error: null, lista: r.datos.transmisiones });
      } else {
        setEst({ cargando: false, error: "No se pudo cargar el historial de envíos.", lista: [] });
      }
    });
    return () => {
      vigente = false;
    };
  }, [facturaId, version]);

  const descargar = async (id: string) => {
    const r = await detalleTransmision(id);
    if (r.tipo !== "respuesta" || r.status !== 200 || !r.datos) {
      toast.error("No se pudo obtener el DTE del servidor.");
      return;
    }
    guardarArchivo(
      JSON.stringify(r.datos.dte, null, 2),
      `${r.datos.numeroControl}-${id}.json`,
      "application/json",
    );
    toast.success("DTE descargado (JSON sin firmar).");
  };

  return (
    <div className="border-t border-border pt-3">
      <p className="label-caps mb-2">Historial de envíos</p>
      {est.cargando ? (
        <p className="text-xs text-muted-foreground">Cargando historial…</p>
      ) : est.error ? (
        <p className="text-xs text-destructive">{est.error}</p>
      ) : est.lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Esta factura no tiene envíos registrados.</p>
      ) : (
        <Tabla
          cabeceras={[
            "Transmisión",
            "Fecha",
            "Tipo",
            "Resultado",
            "Código",
            "Envíos / consultas",
            "DTE",
          ]}
        >
          {est.lista.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-2 font-mono text-xs">{t.id}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {new Date(t.iniciadaEn).toLocaleString("es-SV")}
              </td>
              <td className="px-4 py-2 text-xs">{ETIQUETA_ORIGEN[t.origen] ?? t.origen}</td>
              <td className="px-4 py-2">
                {t.resultado ? (
                  <Estado tono={tonoResultado(t.resultado)}>
                    {ETIQUETA_RESULTADO[t.resultado] ?? t.resultado}
                  </Estado>
                ) : (
                  <span className="text-xs text-muted-foreground">En proceso…</span>
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs">{t.codigoMsg ?? "—"}</td>
              <td className="px-4 py-2 text-xs tabular-nums">
                {t.envios} / {t.consultas}
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => void descargar(t.id)}
                  className="text-xs font-semibold text-info hover:underline"
                >
                  JSON
                </button>
              </td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  );
}
