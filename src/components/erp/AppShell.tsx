import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Boxes,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import { ROLES } from "@/lib/erp-data";
import { useErp } from "@/lib/erp-store";
import { itemsPermitidos, puedeAcceder, RUTA_INICIO } from "@/lib/rbac";

const grupos = [
  {
    titulo: "General",
    items: [{ to: "/", label: "Panel de control", icon: LayoutDashboard, exact: true }],
  },
  {
    titulo: "Ventas",
    items: [
      { to: "/ventas/cotizaciones", label: "Cotizaciones", icon: FileText },
      { to: "/ventas/pedidos", label: "Pedidos", icon: ShoppingCart },
      { to: "/ventas/devoluciones", label: "Devoluciones", icon: RotateCcw },
      { to: "/ventas/clientes", label: "Clientes e historial", icon: Users },
    ],
  },
  {
    titulo: "Facturación electrónica",
    items: [
      { to: "/facturacion", label: "Documentos DTE", icon: Receipt },
      { to: "/facturacion/catalogos", label: "Catálogos tributarios", icon: FileSpreadsheet },
    ],
  },
  {
    titulo: "Inventarios",
    items: [{ to: "/inventario", label: "Control de existencias", icon: Boxes }],
  },
  {
    titulo: "Administración",
    items: [
      { to: "/admin/usuarios", label: "Usuarios y permisos", icon: UsersRound },
    ],
  },
  {
    titulo: "Portal externo",
    items: [{ to: "/portal", label: "Portal del cliente", icon: Store }],
  },
] as const;

/** Filtra los grupos del menú según el rol activo, eliminando grupos vacíos. */
function gruposFiltrados(rol: (typeof ROLES)[number]) {
  return grupos
    .map((g) => ({ ...g, items: itemsPermitidos(rol, [...g.items]) }))
    .filter((g) => g.items.length > 0);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { rolActivo, setRolActivo } = useErp();
  const navigate = useNavigate();
  const rutaActual = useRouterState({ select: (s) => s.location.pathname });

  // Redirige si el rol activo no tiene permiso para la ruta actual
  useEffect(() => {
    if (!puedeAcceder(rolActivo, rutaActual)) {
      void navigate({ to: RUTA_INICIO[rolActivo] });
    }
  }, [rolActivo, rutaActual, navigate]);

  const grupos_ = gruposFiltrados(rolActivo);
  // Todos los ítems visibles (para la barra móvil)
  const todosItems = grupos_.flatMap((g) => [...g.items]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar escritorio ───────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground lg:flex">
        {/* Logo */}
        <div className="border-b border-sidebar-border px-5 py-4">
          <img
            src="/logo-menbrete.png"
            alt="AdvWork-ERP"
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Navegación filtrada por rol */}
        <nav className="flex-1 px-3 py-4">
          {grupos_.map((g) => (
            <div key={g.titulo} className="mb-5">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                {g.titulo}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      activeOptions={{ exact: "exact" in it ? it.exact : false }}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
                    >
                      <it.icon className="size-4 shrink-0 opacity-80" />
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Selector de rol */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
            Rol activo (RNF-02)
          </p>
          <select
            value={rolActivo}
            onChange={(e) => setRolActivo(e.target.value as (typeof ROLES)[number])}
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-[13px] text-sidebar-accent-foreground outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="text-foreground">
                {r}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra de navegación móvil (solo ítems permitidos) */}
        <div className="flex items-center gap-3 overflow-x-auto border-b border-border bg-card px-4 py-3 lg:hidden">
          <span className="font-display text-sm font-bold">AdvWork-ERP</span>
          {todosItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              {it.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
