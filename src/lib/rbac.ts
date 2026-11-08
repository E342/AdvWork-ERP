/**
 * Control de acceso basado en roles (RBAC) para AdvWork-ERP.
 *
 * Define qué rutas puede ver cada rol y cuál es su ruta de inicio.
 * El menú lateral filtra los grupos según esta tabla; si alguien navega
 * directamente a una ruta no permitida, se redirige a rutaInicio.
 *
 * Implementación: lado del cliente, coherente con que el resto del sistema
 * persiste en memoria. No reemplaza autenticación real en producción.
 */
import type { Rol } from "./erp-data";

/** Rutas permitidas por rol. Se compara con startsWith, por eso "/ventas"
 *  cubre /ventas/pedidos, /ventas/cotizaciones, etc. */
const PERMISOS: Record<Rol, string[]> = {
  "Administrador": [
    "/",
    "/ventas",
    "/facturacion",
    "/inventario",
    "/admin",
    "/portal",
  ],
  "Cajero": [
    "/",
    "/ventas/pedidos",
    "/ventas/devoluciones",
    "/facturacion",
    "/portal",
  ],
  "Encargado de Inventario": [
    "/",
    "/inventario",
  ],
  "Contador": [
    "/",
    "/facturacion",
  ],
  "Vendedor": [
    "/",
    "/ventas/cotizaciones",
    "/ventas/pedidos",
    "/ventas/devoluciones",
    "/ventas/clientes",
    "/portal",
  ],
  "Data Analyst": [
    "/",
  ],
  "Cliente": [
    "/portal",
  ],
};

/** Ruta de inicio de cada rol (a donde se redirige si accede a algo no permitido). */
export const RUTA_INICIO: Record<Rol, string> = {
  "Administrador":          "/",
  "Cajero":                 "/ventas/pedidos",
  "Encargado de Inventario": "/inventario",
  "Contador":               "/facturacion",
  "Data Analyst":           "/",
  "Vendedor":               "/ventas/pedidos",
  "Cliente":                "/portal",
};

/** ¿Puede este rol acceder a esta ruta? */
export function puedeAcceder(rol: Rol, ruta: string): boolean {
  const permitidas = PERMISOS[rol] ?? [];
  // "/" es exacta (el panel); el resto es por prefijo
  return permitidas.some((p) =>
    p === "/" ? ruta === "/" : ruta === p || ruta.startsWith(p + "/"),
  );
}

/** Rutas de un grupo que el rol puede ver (para filtrar el menú). */
export function itemsPermitidos<T extends { readonly to: string }>(
  rol: Rol,
  items: ReadonlyArray<T>,
): T[] {
  return [...items].filter((it) => puedeAcceder(rol, it.to));
}
