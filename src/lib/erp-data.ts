/**
 * AdvWork-ERP — Modelo de datos simulado (mock).
 * Prototipo académico: los datos viven en memoria del navegador.
 * Basado en el esquema conceptual Adventure Works (bicicletas y accesorios).
 */

export type Rol =
  | "Administrador"
  | "Vendedor"
  | "Cajero"
  | "Encargado de Inventario"
  | "Contador"
  | "Data Analyst"
  | "Cliente";

export const ROLES: Rol[] = [
  "Administrador",
  "Vendedor",
  "Cajero",
  "Encargado de Inventario",
  "Contador",
  "Data Analyst",
  "Cliente",
];

export type Producto = {
  codigo: string;
  nombre: string;
  categoria: "Bicicleta" | "Accesorio" | "Componente" | "Indumentaria";
  marca: string;
  precio: number;
  stock: number;
  minimo: number;
  maximo: number;
  almacen: "Bodega Central" | "Sucursal Santa Ana" | "Sucursal San Miguel";
  estado: "Activo" | "Inactivo";
  vendidos30d: number;
};

export type Cliente = {
  id: number;
  nombre: string;
  documento: string;
  direccion: string;
  telefono: string;
  correo: string;
  fechaRegistro: string;
};

export type LineaItem = {
  codigo: string;
  nombre: string;
  cantidad: number;
  precio: number;
  descuento: number;
};

export type EstadoCotizacion = "Pendiente" | "Aprobada" | "Rechazada" | "Convertida" | "Cancelada";

export type Cotizacion = {
  id: string;
  clienteId: number;
  fecha: string;
  items: LineaItem[];
  estado: EstadoCotizacion;
  vendedor: string;
};

export type EstadoPedido = "Reservado" | "Confirmado" | "Entregado" | "Cancelado";

export type Pedido = {
  id: string;
  cotizacionId?: string;
  clienteId: number;
  fecha: string;
  items: LineaItem[];
  estado: EstadoPedido;
  canal: "Tienda física" | "En línea";
  metodoPago: "Efectivo" | "Tarjeta" | "Transferencia" | "Pago en línea";
  facturaId?: string;
};

export type EstadoFactura = "Borrador" | "Pendiente de envío" | "Emitida" | "Rechazada";

export type Factura = {
  id: string;
  folio: string;
  serie: string;
  pedidoId: string;
  clienteId: number;
  fecha: string;
  items: LineaItem[];
  estado: EstadoFactura;
  selloElectronico?: string;
  mensajeHacienda?: string;
  // --- Resultado del último envío a la API (simulada) de Hacienda -------------
  codigoGeneracion?: string;
  numeroControl?: string;
  /** Código del catálogo oficial de mensajes (001 = recibido, 002 = con observaciones...). */
  codigoMsg?: string;
  descripcionMsg?: string;
  /** Fecha-hora de procesamiento informada por Hacienda (dd/MM/yyyy HH:mm:ss). */
  fhProcesamiento?: string;
  observaciones?: string[];
  transmisionId?: string;
  envios?: number;
  consultas?: number;
  recuperadoPorConsulta?: boolean;
  /** Total a pagar según el DTE (puede diferir centavos del total del prototipo). */
  totalDte?: number;
};

export type Devolucion = {
  id: string;
  pedidoId: string;
  clienteId: number;
  fecha: string;
  items: LineaItem[];
  motivo: string;
};

export type Movimiento = {
  id: string;
  fecha: string;
  codigo: string;
  tipo: "Entrada" | "Salida" | "Ajuste";
  origen: string;
  cantidad: number;
  saldo: number;
  usuario: string;
  motivo?: string;
  referencia?: string;
};

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
};

export type Impuesto = {
  id: string;
  nombre: string;
  porcentaje: number;
  serie: string;
  folioActual: number;
  activo: boolean;
};

export const IVA = 0.13;

export const subtotalLinea = (l: LineaItem) => l.cantidad * l.precio * (1 - l.descuento / 100);

export function totales(items: LineaItem[]) {
  const bruto = items.reduce((a, l) => a + l.cantidad * l.precio, 0);
  const subtotal = items.reduce((a, l) => a + subtotalLinea(l), 0);
  const descuento = bruto - subtotal;
  const impuesto = subtotal * IVA;
  return { bruto, subtotal, descuento, impuesto, total: subtotal + impuesto };
}

export const money = (n: number) =>
  n.toLocaleString("es-SV", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const hoy = () => new Date().toISOString().slice(0, 10);

export const productosSeed: Producto[] = [
  { codigo: "BK-M82S-42", nombre: "Mountain-100 Silver, 42", categoria: "Bicicleta", marca: "AdvWorks", precio: 3399.99, stock: 12, minimo: 5, maximo: 40, almacen: "Bodega Central", estado: "Activo", vendidos30d: 18 },
  { codigo: "BK-R93R-48", nombre: "Road-150 Red, 48", categoria: "Bicicleta", marca: "AdvWorks", precio: 3578.27, stock: 3, minimo: 6, maximo: 30, almacen: "Bodega Central", estado: "Activo", vendidos30d: 22 },
  { codigo: "BK-T79U-50", nombre: "Touring-1000 Blue, 50", categoria: "Bicicleta", marca: "AdvWorks", precio: 2384.07, stock: 9, minimo: 4, maximo: 25, almacen: "Sucursal Santa Ana", estado: "Activo", vendidos30d: 11 },
  { codigo: "HL-U509-R", nombre: "Sport-100 Helmet, Red", categoria: "Accesorio", marca: "AdvWorks", precio: 34.99, stock: 148, minimo: 40, maximo: 300, almacen: "Bodega Central", estado: "Activo", vendidos30d: 96 },
  { codigo: "WB-H098", nombre: "Water Bottle - 30 oz.", categoria: "Accesorio", marca: "AdvWorks", precio: 4.99, stock: 26, minimo: 60, maximo: 400, almacen: "Bodega Central", estado: "Activo", vendidos30d: 210 },
  { codigo: "TI-T723", nombre: "Touring Tire Tube", categoria: "Componente", marca: "AdvWorks", precio: 4.99, stock: 320, minimo: 80, maximo: 600, almacen: "Sucursal San Miguel", estado: "Activo", vendidos30d: 140 },
  { codigo: "SO-B909-M", nombre: "Mountain Bike Socks, M", categoria: "Indumentaria", marca: "AdvWorks", precio: 9.5, stock: 54, minimo: 30, maximo: 200, almacen: "Sucursal Santa Ana", estado: "Activo", vendidos30d: 63 },
  { codigo: "FE-6654", nombre: "Front Brakes", categoria: "Componente", marca: "AdvWorks", precio: 106.5, stock: 41, minimo: 15, maximo: 120, almacen: "Bodega Central", estado: "Activo", vendidos30d: 27 },
  { codigo: "GL-H102-L", nombre: "Half-Finger Gloves, L", categoria: "Indumentaria", marca: "AdvWorks", precio: 24.49, stock: 7, minimo: 20, maximo: 150, almacen: "Sucursal San Miguel", estado: "Activo", vendidos30d: 44 },
  { codigo: "LI-2100", nombre: "Headlights - Dual-Beam", categoria: "Accesorio", marca: "AdvWorks", precio: 34.99, stock: 62, minimo: 25, maximo: 180, almacen: "Bodega Central", estado: "Activo", vendidos30d: 31 },
];

export const clientesSeed: Cliente[] = [
  { id: 11001, nombre: "Ciclos del Valle S.A. de C.V.", documento: "0614-120589-102-3", direccion: "Blvd. Los Héroes 45, San Salvador", telefono: "22458890", correo: "compras@ciclosdelvalle.sv", fechaRegistro: "2024-03-12" },
  { id: 11002, nombre: "María Fernanda Rivas", documento: "04512398-7", direccion: "Col. Escalón, San Salvador", telefono: "78451203", correo: "mf.rivas@correo.com", fechaRegistro: "2024-07-02" },
  { id: 11003, nombre: "Deportes El Pedal", documento: "0210-030716-101-9", direccion: "Av. Independencia, Santa Ana", telefono: "24409911", correo: "ventas@elpedal.sv", fechaRegistro: "2023-11-25" },
  { id: 11004, nombre: "Carlos Alberto Menjívar", documento: "03998721-4", direccion: "Res. Altavista, Ilopango", telefono: "70129933", correo: "cmenjivar@correo.com", fechaRegistro: "2025-01-18" },
  { id: 11005, nombre: "Club Ciclista Cuscatlán", documento: "0511-140312-103-1", direccion: "San Miguel Centro", telefono: "26619000", correo: "admin@cuscatlanbike.sv", fechaRegistro: "2024-09-30" },
  // Cliente de PRUEBA: su documento es inválido a propósito para poder demostrar un rechazo (HU-08).
  { id: 11006, nombre: "Cliente de prueba (documento inválido)", documento: "1234", direccion: "Dato ficticio para demostrar un rechazo", telefono: "70000000", correo: "prueba.rechazo@advwork.example", fechaRegistro: "2026-11-05" },
];

export const usuariosSeed: Usuario[] = [
  { id: "U-001", nombre: "Silvia Ortiz", correo: "sortiz@adventureworks.sv", rol: "Administrador", activo: true },
  { id: "U-002", nombre: "Elías Zelaya", correo: "ezelaya@adventureworks.sv", rol: "Vendedor", activo: true },
  { id: "U-003", nombre: "Erika Hernández", correo: "ehernandez@adventureworks.sv", rol: "Cajero", activo: true },
  { id: "U-004", nombre: "Alexei Quintana", correo: "aquintana@adventureworks.sv", rol: "Encargado de Inventario", activo: true },
  { id: "U-005", nombre: "Florence Cruz", correo: "fcruz@adventureworks.sv", rol: "Contador", activo: true },
  { id: "U-006", nombre: "Alejandra Serrano", correo: "aserrano@adventureworks.sv", rol: "Data Analyst", activo: false },
];

export const impuestosSeed: Impuesto[] = [
  { id: "IMP-01", nombre: "IVA 13% (El Salvador)", porcentaje: 13, serie: "DTE-01", folioActual: 1042, activo: true },
  { id: "IMP-02", nombre: "Retención 1% Gran Contribuyente", porcentaje: 1, serie: "DTE-07", folioActual: 118, activo: true },
  { id: "IMP-03", nombre: "Exento (Zona Franca)", porcentaje: 0, serie: "DTE-14", folioActual: 9, activo: false },
];

const p = (codigo: string, cantidad: number, descuento = 0): LineaItem => {
  const prod = productosSeed.find((x) => x.codigo === codigo)!;
  return { codigo, nombre: prod.nombre, cantidad, precio: prod.precio, descuento };
};

export const cotizacionesSeed: Cotizacion[] = [
  { id: "COT-0031", clienteId: 11001, fecha: "2026-08-24", items: [p("BK-M82S-42", 4, 5), p("HL-U509-R", 4)], estado: "Aprobada", vendedor: "Elías Zelaya" },
  { id: "COT-0032", clienteId: 11003, fecha: "2026-08-25", items: [p("TI-T723", 60), p("FE-6654", 8, 10)], estado: "Pendiente", vendedor: "Elías Zelaya" },
  { id: "COT-0033", clienteId: 11005, fecha: "2026-08-26", items: [p("SO-B909-M", 25, 15)], estado: "Pendiente", vendedor: "Elías Zelaya" },
  { id: "COT-0030", clienteId: 11002, fecha: "2026-08-20", items: [p("BK-T79U-50", 1)], estado: "Convertida", vendedor: "Elías Zelaya" },
];

export const pedidosSeed: Pedido[] = [
  { id: "PED-0210", cotizacionId: "COT-0030", clienteId: 11002, fecha: "2026-08-20", items: [p("BK-T79U-50", 1)], estado: "Confirmado", canal: "Tienda física", metodoPago: "Tarjeta", facturaId: "FAC-0154" },
  { id: "PED-0211", clienteId: 11004, fecha: "2026-08-22", items: [p("HL-U509-R", 2), p("GL-H102-L", 1)], estado: "Entregado", canal: "En línea", metodoPago: "Pago en línea", facturaId: "FAC-0155" },
  { id: "PED-0212", clienteId: 11001, fecha: "2026-08-26", items: [p("LI-2100", 6), p("WB-H098", 12)], estado: "Reservado", canal: "Tienda física", metodoPago: "Transferencia" },
];

export const facturasSeed: Factura[] = [
  { id: "FAC-0154", folio: "1040", serie: "DTE-01", pedidoId: "PED-0210", clienteId: 11002, fecha: "2026-08-20", items: [p("BK-T79U-50", 1)], estado: "Emitida", selloElectronico: "2026-4B7C9A11-DTE-01-0000000000001040", mensajeHacienda: "Comprobante recibido y sellado correctamente." },
  { id: "FAC-0155", folio: "1041", serie: "DTE-01", pedidoId: "PED-0211", clienteId: 11004, fecha: "2026-08-22", items: [p("HL-U509-R", 2), p("GL-H102-L", 1)], estado: "Pendiente de envío" },
];

export const devolucionesSeed: Devolucion[] = [
  { id: "DEV-0018", pedidoId: "PED-0211", clienteId: 11004, fecha: "2026-08-25", items: [p("GL-H102-L", 1)], motivo: "Talla incorrecta" },
];

export const movimientosSeed: Movimiento[] = [
  { id: "MOV-1001", fecha: "2026-08-20", codigo: "BK-T79U-50", tipo: "Salida", origen: "Venta PED-0210", cantidad: -1, saldo: 9, usuario: "Erika Hernández", referencia: "PED-0210" },
  { id: "MOV-1002", fecha: "2026-08-21", codigo: "TI-T723", tipo: "Entrada", origen: "Compra", cantidad: 120, saldo: 320, usuario: "Alexei Quintana", referencia: "OC-2291" },
  { id: "MOV-1003", fecha: "2026-08-22", codigo: "HL-U509-R", tipo: "Salida", origen: "Venta PED-0211", cantidad: -2, saldo: 148, usuario: "Erika Hernández", referencia: "PED-0211" },
  { id: "MOV-1004", fecha: "2026-08-23", codigo: "WB-H098", tipo: "Ajuste", origen: "Ajuste manual", cantidad: -6, saldo: 26, usuario: "Alexei Quintana", motivo: "Producto dañado en bodega" },
];
