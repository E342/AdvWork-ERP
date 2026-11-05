import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, Tabla } from "@/components/erp/ui";

export const Route = createFileRoute("/requerimientos")({
  head: () => ({
    meta: [
      { title: "Trazabilidad ERS — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Matriz que vincula cada historia de usuario y requerimiento no funcional del ERS con la pantalla del prototipo que lo implementa.",
      },
      { property: "og:title", content: "Trazabilidad ERS — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-01 a HU-17 y RNF-01 a RNF-07 mapeados contra las pantallas del prototipo.",
      },
    ],
  }),
  component: Requerimientos,
});

const hus: { id: string; nombre: string; ruta: string; pantalla: string; como: string }[] = [
  { id: "HU-01", nombre: "Gestión de cotizaciones", ruta: "/ventas/cotizaciones", pantalla: "Nueva cotización", como: "Alta con descuentos, cálculo automático de subtotal/IVA y estado Pendiente editable o cancelable." },
  { id: "HU-02", nombre: "Conversión de cotización en pedido", ruta: "/ventas/cotizaciones", pantalla: "Listado de cotizaciones", como: "El botón solo se habilita en estado Aprobada; hereda los datos y reserva stock, avisando si falta existencia." },
  { id: "HU-03", nombre: "Devoluciones de productos", ruta: "/ventas/devoluciones", pantalla: "Registrar devolución", como: "Devolución parcial o total sobre una venta existente, con motivo obligatorio y reintegro al inventario." },
  { id: "HU-04", nombre: "Historial de ventas de un cliente", ruta: "/ventas/clientes", pantalla: "Clientes e historial", como: "Búsqueda por nombre/ID/documento, filtros por fecha y monto, y detalle expandible por venta." },
  { id: "HU-05", nombre: "Pedidos y pagos del cliente", ruta: "/portal", pantalla: "Portal del cliente", como: "Carrito con validación de stock, canal presencial o en línea, y generación de la orden con confirmación." },
  { id: "HU-06", nombre: "Historial de compras del cliente", ruta: "/portal", pantalla: "Mi historial de compras", como: "Filtros por fecha y canal, detalle de productos y descarga del comprobante." },
  { id: "HU-07", nombre: "Generación de facturas electrónicas", ruta: "/ventas/pedidos", pantalla: "Generar DTE", como: "Consolida cliente, productos e impuestos desde el pedido confirmado y crea el documento en Borrador." },
  { id: "HU-08", nombre: "Envío a la entidad tributaria", ruta: "/facturacion", pantalla: "Documentos DTE", como: "Simula la llamada API REST/HTTPS, registra sello o rechazo y muestra el detalle del error." },
  { id: "HU-09", nombre: "Gestión de estados de factura", ruta: "/facturacion", pantalla: "Documentos DTE", como: "Ciclo Borrador → Pendiente de envío → Emitida/Rechazada visible en el historial." },
  { id: "HU-10", nombre: "Consulta y descarga de facturas", ruta: "/facturacion", pantalla: "Historial de facturas", como: "Filtros por folio, cliente y fecha, más descarga del archivo del comprobante." },
  { id: "HU-11", nombre: "Configuración de catálogos tributarios", ruta: "/facturacion/catalogos", pantalla: "Catálogos tributarios", como: "CRUD de impuestos, porcentajes, series y folios restringido a roles autorizados." },
  { id: "HU-12", nombre: "Registro de entradas de inventario", ruta: "/inventario", pantalla: "Registrar entrada", como: "Origen (compra, producción, traslado) y comprobante obligatorio; el stock se actualiza al confirmar." },
  { id: "HU-13", nombre: "Descuento automático de inventario", ruta: "/ventas/pedidos", pantalla: "Confirmar pedido", como: "Al confirmar se genera el movimiento de salida; si falta stock, la venta se bloquea." },
  { id: "HU-14", nombre: "Correcciones manuales de inventario", ruta: "/inventario", pantalla: "Ajuste manual", como: "Ajuste positivo o negativo con motivo obligatorio, rechazo de stock negativo y registro auditable." },
  { id: "HU-15", nombre: "Recálculo en tiempo real del saldo", ruta: "/inventario", pantalla: "Existencias y kardex", como: "Cada movimiento recalcula el saldo y se refleja de inmediato en todas las pantallas." },
  { id: "HU-16", nombre: "Consulta de stock y reposición", ruta: "/inventario", pantalla: "Existencias por almacén", como: "Stock por almacén, puntos mínimo/máximo, rotación a 30 días y exportación del reporte." },
  { id: "HU-17", nombre: "Gestión de usuarios y permisos", ruta: "/admin/usuarios", pantalla: "Usuarios y permisos", como: "Alta/edición/desactivación, validación de correo duplicado y matriz de permisos por módulo." },
];

const rnfs = [
  ["RNF-01", "Rendimiento", "Estado en memoria y renderizado incremental: las tablas y KPIs responden sin recargar la página."],
  ["RNF-02", "Seguridad", "Selector de rol activo que restringe pantallas administrativas y catálogos tributarios."],
  ["RNF-03", "Disponibilidad", "Aplicación web sin dependencias de instalación; fuera del alcance del prototipo medir uptime real."],
  ["RNF-04", "Escalabilidad", "Modelo de datos y componentes desacoplados, listos para conectarse a un backend SQL Server."],
  ["RNF-05", "Mantenibilidad", "Sistema de diseño con tokens semánticos, componentes reutilizables y código comentado por historia."],
  ["RNF-06", "Portabilidad", "Diseño responsivo que funciona en navegadores modernos de escritorio y tablet."],
  ["RNF-07", "Cumplimiento tributario", "Serie, folio correlativo, IVA parametrizable, sello electrónico y respuesta de la Entidad Tributaria."],
];

function Requerimientos() {
  return (
    <>
      <PageHeader
        titulo="Trazabilidad con el documento de requerimientos"
        descripcion="Mapa entre la matriz de trazabilidad del ERS (IEEE 830) y las pantallas implementadas en este prototipo. El documento original no fue modificado."
      />

      <Panel titulo="Historias de usuario (HU-01 a HU-17)">
        <Tabla cabeceras={["ID", "Historia", "Pantalla del prototipo", "Cómo se cumple"]}>
          {hus.map((h) => (
            <tr key={h.id}>
              <td className="px-4 py-3 font-mono text-xs font-semibold">{h.id}</td>
              <td className="px-4 py-3 text-sm">{h.nombre}</td>
              <td className="px-4 py-3">
                <Link to={h.ruta} className="text-sm font-semibold text-info hover:underline">
                  {h.pantalla}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{h.como}</td>
            </tr>
          ))}
        </Tabla>
      </Panel>

      <div className="mt-6">
        <Panel titulo="Requerimientos no funcionales (RNF-01 a RNF-07)">
          <Tabla cabeceras={["ID", "Categoría", "Cobertura en el prototipo"]}>
            {rnfs.map(([id, cat, cobertura]) => (
              <tr key={id}>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{id}</td>
                <td className="px-4 py-3 text-sm">{cat}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{cobertura}</td>
              </tr>
            ))}
          </Tabla>
        </Panel>
      </div>

      <div className="mt-6 surface p-5">
        <h2 className="text-sm font-semibold">Alcance excluido según el ERS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Conforme al documento original, el prototipo no incluye nómina, contabilidad general ni gestión
          de proveedores. Los requisitos futuros (pasarelas de pago, conciliación tributaria mensual,
          aplicación móvil y notificaciones automáticas) tampoco forman parte de este Sprint.
        </p>
      </div>
    </>
  );
}
