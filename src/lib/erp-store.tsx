import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clientesSeed,
  cotizacionesSeed,
  devolucionesSeed,
  facturasSeed,
  impuestosSeed,
  movimientosSeed,
  pedidosSeed,
  productosSeed,
  usuariosSeed,
  type Cliente,
  type Cotizacion,
  type Devolucion,
  type Factura,
  type Impuesto,
  type LineaItem,
  type Movimiento,
  type Pedido,
  type Producto,
  type Rol,
  type Usuario,
} from "./erp-data";
import {
  consultarEstadoDte,
  esResultadoTransmision,
  transmitirDte,
  type ErrorSolicitud,
  type RespuestaTransmision,
} from "./dte-api";

type Resultado = { ok: boolean; mensaje: string };

/** Resultado de operaciones asíncronas contra el backend: `nivel` guía el aviso al usuario. */
export type ResultadoEnvio = Resultado & { nivel: "exito" | "aviso" | "error" };

type Ctx = {
  rolActivo: Rol;
  setRolActivo: (r: Rol) => void;
  productos: Producto[];
  clientes: Cliente[];
  cotizaciones: Cotizacion[];
  pedidos: Pedido[];
  facturas: Factura[];
  devoluciones: Devolucion[];
  movimientos: Movimiento[];
  usuarios: Usuario[];
  impuestos: Impuesto[];
  clientePorId: (id: number) => Cliente | undefined;
  productoPorCodigo: (c: string) => Producto | undefined;
  crearCotizacion: (clienteId: number, items: LineaItem[]) => Resultado;
  cambiarEstadoCotizacion: (id: string, estado: Cotizacion["estado"]) => Resultado;
  convertirEnPedido: (id: string) => Resultado;
  confirmarPedido: (id: string) => Resultado;
  registrarVentaDirecta: (
    clienteId: number,
    items: LineaItem[],
    canal: Pedido["canal"],
    metodoPago: Pedido["metodoPago"],
  ) => Resultado;
  registrarDevolucion: (pedidoId: string, items: LineaItem[], motivo: string) => Resultado;
  generarFactura: (pedidoId: string) => Resultado;
  /** Facturas con un envío o consulta en curso (el envío puede tardar ~15 s con reintentos). */
  enviandoIds: ReadonlySet<string>;
  enviarFacturaHacienda: (facturaId: string) => Promise<ResultadoEnvio>;
  consultarEstadoFactura: (facturaId: string) => Promise<ResultadoEnvio>;
  marcarPendienteEnvio: (facturaId: string) => Resultado;
  registrarEntrada: (codigo: string, cantidad: number, origen: string, referencia: string) => Resultado;
  registrarAjuste: (codigo: string, cantidad: number, motivo: string) => Resultado;
  guardarUsuario: (u: Usuario, esNuevo: boolean) => Resultado;
  alternarUsuario: (id: string) => Resultado;
  guardarImpuesto: (i: Impuesto, esNuevo: boolean) => Resultado;
  eliminarImpuesto: (id: string) => Resultado;
};

const ErpContext = createContext<Ctx | null>(null);

let seq = 5000;
const nid = (p: string) => `${p}-${++seq}`;
// Los datos del prototipo viven en memoria y se reinician al recargar, pero la bitácora del
// servidor persiste. Sin un sufijo de sesión, la factura nueva "FAC-5001" tras una recarga
// se confundiría con la "FAC-5001" anterior y recibiría su sello. El sufijo evita la colisión.
const sesion = Math.random().toString(36).slice(2, 6).toUpperCase();
const nidUnico = (p: string) => `${p}-${++seq}-${sesion}`;
const fecha = () => new Date().toISOString().slice(0, 10);

export function ErpProvider({ children }: { children: ReactNode }) {
  const [rolActivo, setRolActivo] = useState<Rol>("Administrador");
  const [productos, setProductos] = useState<Producto[]>(productosSeed);
  const [clientes] = useState<Cliente[]>(clientesSeed);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(cotizacionesSeed);
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosSeed);
  const [facturas, setFacturas] = useState<Factura[]>(facturasSeed);
  const [enviando, setEnviando] = useState<ReadonlySet<string>>(new Set());
  // La ref evita dobles envíos dentro del mismo "tick", antes de que el estado se actualice.
  const enVuelo = useRef(new Set<string>());
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>(devolucionesSeed);
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosSeed);
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosSeed);
  const [impuestos, setImpuestos] = useState<Impuesto[]>(impuestosSeed);

  const clientePorId = useCallback((id: number) => clientes.find((c) => c.id === id), [clientes]);
  const productoPorCodigo = useCallback(
    (c: string) => productos.find((p) => p.codigo === c),
    [productos],
  );

  /** HU-13 / HU-15: aplica movimientos y recalcula el saldo en bodega. */
  const aplicarMovimientos = useCallback(
    (
      cambios: { codigo: string; delta: number; tipo: Movimiento["tipo"]; origen: string; motivo?: string; referencia?: string }[],
      usuario: string,
    ) => {
      setProductos((prev) => {
        const next = prev.map((p) => ({ ...p }));
        const nuevos: Movimiento[] = [];
        for (const c of cambios) {
          const prod = next.find((p) => p.codigo === c.codigo);
          if (!prod) continue;
          prod.stock += c.delta;
          nuevos.push({
            id: nid("MOV"),
            fecha: fecha(),
            codigo: c.codigo,
            tipo: c.tipo,
            origen: c.origen,
            cantidad: c.delta,
            saldo: prod.stock,
            usuario,
            motivo: c.motivo,
            referencia: c.referencia,
          });
        }
        setMovimientos((m) => [...nuevos.reverse(), ...m]);
        return next;
      });
    },
    [],
  );

  const hayStock = useCallback(
    (items: LineaItem[]) => {
      for (const it of items) {
        const prod = productos.find((p) => p.codigo === it.codigo);
        if (!prod || prod.stock < it.cantidad) {
          return `Stock insuficiente para ${it.nombre} (disponible: ${prod?.stock ?? 0}).`;
        }
      }
      return null;
    },
    [productos],
  );

  const crearCotizacion = useCallback<Ctx["crearCotizacion"]>((clienteId, items) => {
    if (!items.length) return { ok: false, mensaje: "Agrega al menos un producto a la cotización." };
    const id = nid("COT");
    setCotizaciones((prev) => [
      { id, clienteId, fecha: fecha(), items, estado: "Pendiente", vendedor: "Usuario demo" },
      ...prev,
    ]);
    return { ok: true, mensaje: `Cotización ${id} creada en estado Pendiente.` };
  }, []);

  const cambiarEstadoCotizacion = useCallback<Ctx["cambiarEstadoCotizacion"]>((id, estado) => {
    setCotizaciones((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)));
    return { ok: true, mensaje: `Cotización ${id} marcada como ${estado}.` };
  }, []);

  /** HU-02: solo cotizaciones aprobadas se convierten y reservan stock. */
  const convertirEnPedido = useCallback<Ctx["convertirEnPedido"]>(
    (id) => {
      const cot = cotizaciones.find((c) => c.id === id);
      if (!cot) return { ok: false, mensaje: "Cotización no encontrada." };
      if (cot.estado !== "Aprobada")
        return { ok: false, mensaje: "Solo las cotizaciones aprobadas pueden convertirse en pedido." };
      const err = hayStock(cot.items);
      if (err) return { ok: false, mensaje: err };
      const pid = nid("PED");
      setPedidos((prev) => [
        {
          id: pid,
          cotizacionId: cot.id,
          clienteId: cot.clienteId,
          fecha: fecha(),
          items: cot.items,
          estado: "Reservado",
          canal: "Tienda física",
          metodoPago: "Transferencia",
        },
        ...prev,
      ]);
      setCotizaciones((prev) => prev.map((c) => (c.id === id ? { ...c, estado: "Convertida" } : c)));
      return { ok: true, mensaje: `Pedido ${pid} creado con stock reservado.` };
    },
    [cotizaciones, hayStock],
  );

  /** HU-13: al confirmar se descuenta el inventario. */
  const confirmarPedido = useCallback<Ctx["confirmarPedido"]>(
    (id) => {
      const ped = pedidos.find((p) => p.id === id);
      if (!ped) return { ok: false, mensaje: "Pedido no encontrado." };
      if (ped.estado !== "Reservado") return { ok: false, mensaje: "El pedido ya fue confirmado." };
      const err = hayStock(ped.items);
      if (err) return { ok: false, mensaje: err };
      aplicarMovimientos(
        ped.items.map((i) => ({
          codigo: i.codigo,
          delta: -i.cantidad,
          tipo: "Salida" as const,
          origen: `Venta ${ped.id}`,
          referencia: ped.id,
        })),
        "Usuario demo",
      );
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "Confirmado" } : p)));
      return { ok: true, mensaje: `Pedido ${id} confirmado. Inventario descontado automáticamente.` };
    },
    [pedidos, hayStock, aplicarMovimientos],
  );

  const registrarVentaDirecta = useCallback<Ctx["registrarVentaDirecta"]>(
    (clienteId, items, canal, metodoPago) => {
      if (!items.length) return { ok: false, mensaje: "El carrito está vacío." };
      const err = hayStock(items);
      if (err) return { ok: false, mensaje: err };
      const pid = nid("PED");
      aplicarMovimientos(
        items.map((i) => ({
          codigo: i.codigo,
          delta: -i.cantidad,
          tipo: "Salida" as const,
          origen: `Venta ${pid}`,
          referencia: pid,
        })),
        "Usuario demo",
      );
      setPedidos((prev) => [
        { id: pid, clienteId, fecha: fecha(), items, estado: "Confirmado", canal, metodoPago },
        ...prev,
      ]);
      return { ok: true, mensaje: `Orden ${pid} generada. Se envió confirmación al cliente.` };
    },
    [hayStock, aplicarMovimientos],
  );

  /** HU-03: devolución parcial o total, reintegra al inventario. */
  const registrarDevolucion = useCallback<Ctx["registrarDevolucion"]>(
    (pedidoId, items, motivo) => {
      const ped = pedidos.find((p) => p.id === pedidoId);
      if (!ped) return { ok: false, mensaje: "Pedido no encontrado." };
      if (!items.length) return { ok: false, mensaje: "Selecciona al menos un producto a devolver." };
      if (!motivo.trim()) return { ok: false, mensaje: "El motivo de la devolución es obligatorio." };
      const did = nid("DEV");
      aplicarMovimientos(
        items.map((i) => ({
          codigo: i.codigo,
          delta: i.cantidad,
          tipo: "Entrada" as const,
          origen: `Devolución ${did}`,
          referencia: pedidoId,
          motivo,
        })),
        "Usuario demo",
      );
      setDevoluciones((prev) => [
        { id: did, pedidoId, clienteId: ped.clienteId, fecha: fecha(), items, motivo },
        ...prev,
      ]);
      return { ok: true, mensaje: `Devolución ${did} registrada. Productos reintegrados al inventario.` };
    },
    [pedidos, aplicarMovimientos],
  );

  /** HU-07: consolida datos del cliente, productos e impuestos. */
  const generarFactura = useCallback<Ctx["generarFactura"]>(
    (pedidoId) => {
      const ped = pedidos.find((p) => p.id === pedidoId);
      if (!ped) return { ok: false, mensaje: "Pedido no encontrado." };
      if (ped.estado === "Reservado")
        return { ok: false, mensaje: "El pedido debe estar confirmado antes de facturar." };
      if (ped.facturaId) return { ok: false, mensaje: "Este pedido ya tiene factura asociada." };
      const imp = impuestos.find((i) => i.activo) ?? impuestos[0];
      const fid = nidUnico("FAC");
      const folio = String(imp.folioActual + 1);
      setImpuestos((prev) =>
        prev.map((i) => (i.id === imp.id ? { ...i, folioActual: i.folioActual + 1 } : i)),
      );
      setFacturas((prev) => [
        {
          id: fid,
          folio,
          serie: imp.serie,
          pedidoId,
          clienteId: ped.clienteId,
          fecha: fecha(),
          items: ped.items,
          estado: "Borrador",
        },
        ...prev,
      ]);
      setPedidos((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, facturaId: fid } : p)));
      return { ok: true, mensaje: `Factura ${fid} generada en estado Borrador (folio ${imp.serie}-${folio}).` };
    },
    [pedidos, impuestos],
  );

  const marcarEnviando = useCallback((id: string, activo: boolean) => {
    setEnviando((prev) => {
      const siguiente = new Set(prev);
      if (activo) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }, []);

  /** Refleja en la factura el resultado devuelto por el backend del ERP. */
  const aplicarResultado = useCallback((facturaId: string, d: RespuestaTransmision) => {
    setFacturas((prev) =>
      prev.map((f) =>
        f.id === facturaId
          ? {
              ...f,
              estado: d.facturaEstado,
              selloElectronico: d.selloRecibido ?? undefined,
              mensajeHacienda: d.mensaje,
              codigoGeneracion: d.codigoGeneracion,
              numeroControl: d.numeroControl,
              codigoMsg: d.codigoMsg ?? undefined,
              descripcionMsg: d.descripcionMsg ?? undefined,
              fhProcesamiento: d.fhProcesamiento ?? undefined,
              observaciones: d.observaciones,
              transmisionId: d.transmisionId,
              totalDte: d.totales?.totalPagar,
              // Si el servidor solo devolvió lo ya registrado (0 envíos), se conservan los contadores.
              ...(d.yaEmitida
                ? {}
                : {
                    envios: d.envios,
                    consultas: d.consultas,
                    recuperadoPorConsulta: d.recuperadoPorConsulta,
                  }),
            }
          : f,
      ),
    );
  }, []);

  /**
   * HU-08: envía la factura a la API (simulada) de Hacienda a través del backend del ERP y
   * refleja el resultado. Es asíncrona: con reintentos puede tardar unos 15 s.
   */
  const enviarFacturaHacienda = useCallback<Ctx["enviarFacturaHacienda"]>(
    async (facturaId) => {
      const fac = facturas.find((f) => f.id === facturaId);
      if (!fac) return { ok: false, nivel: "error", mensaje: "Factura no encontrada." };
      if (fac.estado === "Emitida")
        return { ok: false, nivel: "aviso", mensaje: "La factura ya fue sellada." };
      const cli = clientes.find((c) => c.id === fac.clienteId);
      if (!cli)
        return { ok: false, nivel: "error", mensaje: "No se encontró el cliente de la factura." };
      if (enVuelo.current.has(facturaId))
        return {
          ok: false,
          nivel: "aviso",
          mensaje: "Ya hay un envío en curso para esta factura.",
        };

      enVuelo.current.add(facturaId);
      marcarEnviando(facturaId, true);
      try {
        const r = await transmitirDte(fac, cli);
        if (r.tipo === "timeout") {
          return {
            ok: false,
            nivel: "aviso",
            mensaje:
              "El servidor tardó demasiado en responder. Use «Consultar estado» para verificar si Hacienda recibió el documento.",
          };
        }
        if (r.tipo === "sin_conexion") {
          return {
            ok: false,
            nivel: "error",
            mensaje:
              "No fue posible comunicarse con el servidor del ERP. La factura conserva su estado.",
          };
        }
        if (!esResultadoTransmision(r.datos)) {
          const e = r.datos as ErrorSolicitud | null;
          const detalle = e?.detalles?.length ? ` ${e.detalles.join("; ")}` : "";
          return {
            ok: false,
            nivel: "error",
            mensaje: `${e?.mensaje ?? `El servidor respondió con un error (HTTP ${r.status}).`}${detalle}`,
          };
        }

        const d = r.datos;
        aplicarResultado(facturaId, d);
        if (d.ok) {
          return {
            ok: true,
            nivel: d.yaEmitida ? "aviso" : "exito",
            mensaje: d.yaEmitida
              ? d.mensaje
              : `DTE emitido. Sello: ${d.selloRecibido}${d.recuperadoPorConsulta ? " (recuperado por consulta de estado)" : ""}`,
          };
        }
        return {
          ok: false,
          nivel: d.resultado === "rechazado" ? "error" : "aviso",
          mensaje: d.mensaje,
        };
      } finally {
        enVuelo.current.delete(facturaId);
        marcarEnviando(facturaId, false);
      }
    },
    [facturas, clientes, aplicarResultado, marcarEnviando],
  );

  /** Pregunta a Hacienda si ya tiene el documento y, si es así, concilia la factura como emitida. */
  const consultarEstadoFactura = useCallback<Ctx["consultarEstadoFactura"]>(
    async (facturaId) => {
      if (enVuelo.current.has(facturaId))
        return {
          ok: false,
          nivel: "aviso",
          mensaje: "Hay una operación en curso para esta factura.",
        };

      enVuelo.current.add(facturaId);
      marcarEnviando(facturaId, true);
      try {
        const r = await consultarEstadoDte(facturaId);
        if (r.tipo === "timeout") {
          return {
            ok: false,
            nivel: "aviso",
            mensaje: "La consulta tardó demasiado. Intente de nuevo.",
          };
        }
        if (r.tipo === "sin_conexion" || !r.datos) {
          return {
            ok: false,
            nivel: "error",
            mensaje: "No fue posible comunicarse con el servidor del ERP.",
          };
        }
        const d = r.datos;
        if (!d.ok) {
          return d.motivo === "desconocida"
            ? {
                ok: false,
                nivel: "aviso",
                mensaje: "Esta factura aún no se ha enviado a Hacienda.",
              }
            : { ok: false, nivel: "error", mensaje: d.mensaje };
        }
        if (!d.encontrado) {
          return {
            ok: false,
            nivel: "aviso",
            mensaje: "Hacienda no tiene registrado este documento.",
          };
        }
        setFacturas((prev) =>
          prev.map((f) =>
            f.id === facturaId
              ? {
                  ...f,
                  estado: "Emitida",
                  selloElectronico: d.selloRecibido ?? f.selloElectronico,
                  fhProcesamiento: d.fhProcesamiento ?? f.fhProcesamiento,
                  codigoGeneracion: d.codigoGeneracion,
                  mensajeHacienda: d.mensaje,
                }
              : f,
          ),
        );
        return { ok: true, nivel: d.conciliada ? "exito" : "aviso", mensaje: d.mensaje };
      } finally {
        enVuelo.current.delete(facturaId);
        marcarEnviando(facturaId, false);
      }
    },
    [marcarEnviando],
  );

  const marcarPendienteEnvio = useCallback<Ctx["marcarPendienteEnvio"]>((facturaId) => {
    setFacturas((prev) =>
      prev.map((f) => (f.id === facturaId && f.estado !== "Emitida" ? { ...f, estado: "Pendiente de envío" } : f)),
    );
    return { ok: true, mensaje: `Factura ${facturaId} marcada como pendiente de envío.` };
  }, []);

  /** HU-12 */
  const registrarEntrada = useCallback<Ctx["registrarEntrada"]>(
    (codigo, cantidad, origen, referencia) => {
      if (cantidad <= 0) return { ok: false, mensaje: "La cantidad debe ser mayor a cero." };
      if (!referencia.trim()) return { ok: false, mensaje: "La referencia o comprobante es obligatorio." };
      aplicarMovimientos([{ codigo, delta: cantidad, tipo: "Entrada", origen, referencia }], "Usuario demo");
      return { ok: true, mensaje: `Entrada de ${cantidad} unidades registrada (${origen}).` };
    },
    [aplicarMovimientos],
  );

  /** HU-14 */
  const registrarAjuste = useCallback<Ctx["registrarAjuste"]>(
    (codigo, cantidad, motivo) => {
      if (cantidad === 0) return { ok: false, mensaje: "El ajuste no puede ser cero." };
      if (!motivo.trim()) return { ok: false, mensaje: "El motivo del ajuste es obligatorio." };
      const prod = productos.find((p) => p.codigo === codigo);
      if (!prod) return { ok: false, mensaje: "Producto no encontrado." };
      if (prod.stock + cantidad < 0)
        return { ok: false, mensaje: "El ajuste dejaría el stock en negativo. Operación rechazada." };
      aplicarMovimientos([{ codigo, delta: cantidad, tipo: "Ajuste", origen: "Ajuste manual", motivo }], "Usuario demo");
      return { ok: true, mensaje: `Ajuste de ${cantidad > 0 ? "+" : ""}${cantidad} registrado con motivo y auditoría.` };
    },
    [productos, aplicarMovimientos],
  );

  /** HU-17 */
  const guardarUsuario = useCallback<Ctx["guardarUsuario"]>(
    (u, esNuevo) => {
      if (!u.nombre.trim() || !u.correo.trim()) return { ok: false, mensaje: "Nombre y correo son obligatorios." };
      const dup = usuarios.some((x) => x.correo.toLowerCase() === u.correo.toLowerCase() && x.id !== u.id);
      if (dup) return { ok: false, mensaje: "Ya existe un usuario con ese correo." };
      setUsuarios((prev) => (esNuevo ? [...prev, { ...u, id: nid("U") }] : prev.map((x) => (x.id === u.id ? u : x))));
      return { ok: true, mensaje: esNuevo ? "Usuario creado. Permisos aplicados de inmediato." : "Usuario actualizado." };
    },
    [usuarios],
  );

  const alternarUsuario = useCallback<Ctx["alternarUsuario"]>((id) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u)));
    return { ok: true, mensaje: "Estado del usuario actualizado." };
  }, []);

  /** HU-11 */
  const guardarImpuesto = useCallback<Ctx["guardarImpuesto"]>((i, esNuevo) => {
    if (!i.nombre.trim() || !i.serie.trim()) return { ok: false, mensaje: "Nombre y serie son obligatorios." };
    setImpuestos((prev) => (esNuevo ? [...prev, { ...i, id: nid("IMP") }] : prev.map((x) => (x.id === i.id ? i : x))));
    return { ok: true, mensaje: "Catálogo tributario guardado y registrado para auditoría." };
  }, []);

  const eliminarImpuesto = useCallback<Ctx["eliminarImpuesto"]>((id) => {
    setImpuestos((prev) => prev.filter((i) => i.id !== id));
    return { ok: true, mensaje: "Catálogo eliminado." };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      rolActivo,
      setRolActivo,
      productos,
      clientes,
      cotizaciones,
      pedidos,
      facturas,
      devoluciones,
      movimientos,
      usuarios,
      impuestos,
      clientePorId,
      productoPorCodigo,
      crearCotizacion,
      cambiarEstadoCotizacion,
      convertirEnPedido,
      confirmarPedido,
      registrarVentaDirecta,
      registrarDevolucion,
      generarFactura,
      enviandoIds: enviando,
      enviarFacturaHacienda,
      consultarEstadoFactura,
      marcarPendienteEnvio,
      registrarEntrada,
      registrarAjuste,
      guardarUsuario,
      alternarUsuario,
      guardarImpuesto,
      eliminarImpuesto,
    }),
    [
      rolActivo,
      productos,
      clientes,
      cotizaciones,
      pedidos,
      facturas,
      devoluciones,
      movimientos,
      usuarios,
      impuestos,
      clientePorId,
      productoPorCodigo,
      crearCotizacion,
      cambiarEstadoCotizacion,
      convertirEnPedido,
      confirmarPedido,
      registrarVentaDirecta,
      registrarDevolucion,
      generarFactura,
      enviando,
      enviarFacturaHacienda,
      consultarEstadoFactura,
      marcarPendienteEnvio,
      registrarEntrada,
      registrarAjuste,
      guardarUsuario,
      alternarUsuario,
      guardarImpuesto,
      eliminarImpuesto,
    ],
  );

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp debe usarse dentro de ErpProvider");
  return ctx;
}
