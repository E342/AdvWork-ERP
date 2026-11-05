import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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

type Resultado = { ok: boolean; mensaje: string };

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
  enviarFacturaHacienda: (facturaId: string) => Resultado;
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
const fecha = () => new Date().toISOString().slice(0, 10);

export function ErpProvider({ children }: { children: ReactNode }) {
  const [rolActivo, setRolActivo] = useState<Rol>("Administrador");
  const [productos, setProductos] = useState<Producto[]>(productosSeed);
  const [clientes] = useState<Cliente[]>(clientesSeed);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(cotizacionesSeed);
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosSeed);
  const [facturas, setFacturas] = useState<Factura[]>(facturasSeed);
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
      const fid = nid("FAC");
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

  /** HU-08: simula el envío a la Entidad Tributaria y su respuesta. */
  const enviarFacturaHacienda = useCallback<Ctx["enviarFacturaHacienda"]>(
    (facturaId) => {
      const fac = facturas.find((f) => f.id === facturaId);
      if (!fac) return { ok: false, mensaje: "Factura no encontrada." };
      if (fac.estado === "Emitida") return { ok: false, mensaje: "La factura ya fue sellada." };
      const cli = clientes.find((c) => c.id === fac.clienteId);
      const documentoValido = !!cli && cli.documento.replace(/\D/g, "").length >= 8;
      if (!documentoValido) {
        setFacturas((prev) =>
          prev.map((f) =>
            f.id === facturaId
              ? { ...f, estado: "Rechazada", mensajeHacienda: "DUI/NIT del receptor inválido o incompleto." }
              : f,
          ),
        );
        return { ok: false, mensaje: "Rechazado por la Entidad Tributaria: DUI/NIT inválido." };
      }
      const sello = `2026-${Math.random().toString(16).slice(2, 10).toUpperCase()}-${fac.serie}-${fac.folio.padStart(16, "0")}`;
      setFacturas((prev) =>
        prev.map((f) =>
          f.id === facturaId
            ? {
                ...f,
                estado: "Emitida",
                selloElectronico: sello,
                mensajeHacienda: "Comprobante recibido y sellado correctamente.",
              }
            : f,
        ),
      );
      return { ok: true, mensaje: `DTE sellado por la Entidad Tributaria. Sello: ${sello}` };
    },
    [facturas, clientes],
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
      enviarFacturaHacienda,
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
      enviarFacturaHacienda,
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
