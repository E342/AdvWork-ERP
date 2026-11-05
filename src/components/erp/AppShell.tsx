import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BarChart3,
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
      { to: "/requerimientos", label: "Trazabilidad ERS", icon: BarChart3 },
    ],
  },
  {
    titulo: "Portal externo",
    items: [{ to: "/portal", label: "Portal del cliente", icon: Store }],
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { rolActivo, setRolActivo } = useErp();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="font-display text-lg font-bold tracking-tight text-sidebar-accent-foreground">
            AdvWork<span className="text-sidebar-primary">-ERP</span>
          </p>
          <p className="mt-0.5 text-[11px] text-sidebar-foreground/70">Adventure Works · Prototipo</p>
        </div>

        <nav className="flex-1 px-3 py-4">
          {grupos.map((g) => (
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

        <div className="border-t border-sidebar-border px-4 py-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
            Rol simulado (RNF-02)
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

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 overflow-x-auto border-b border-border bg-card px-4 py-3 lg:hidden">
          <span className="font-display text-sm font-bold">AdvWork-ERP</span>
          {(grupos.flatMap((g) => [...g.items]) as { to: string; label: string }[]).map((it) => (
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
