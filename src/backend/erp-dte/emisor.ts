/**
 * Datos del EMISOR (Adventure Works). TODOS FICTICIOS.
 *
 * - NIT, NRC, códigos de actividad, de establecimiento y de punto de venta son
 *   valores de prueba: no corresponden a ningún contribuyente real.
 * - `codEstable` ("M001") y `codPuntoVenta` ("P001") siguen el patrón del
 *   `numeroControl` del esquema oficial: DTE-01-(M|B|S|P)NNN P NNN-<15 dígitos>.
 * - La dirección usa códigos de departamento/municipio/distrito de relleno.
 */
export const EMISOR_FICTICIO = {
  nit: "06140000000001",
  nrc: "1234567",
  nombre: "Adventure Works S.A. de C.V. (SIMULADO)",
  codActividad: "46900",
  descActividad: "Venta de bicicletas, repuestos y accesorios (simulado)",
  nombreComercial: "AdvWork",
  telefono: "22000000",
  correo: "facturacion@advwork.example",
  codEstable: "M001",
  codPuntoVenta: "P001",
  direccion: {
    departamento: "06",
    municipio: "14",
    distrito: "01",
    complemento: "San Salvador (dirección ficticia)",
  },
} as const;
