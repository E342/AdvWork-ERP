import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

export function Panel({
  titulo,
  extra,
  children,
  className,
}: {
  titulo?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      {titulo ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {extra}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const tonos = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/18 text-warning-foreground",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  accent: "bg-accent/20 text-accent-foreground",
} as const;

export type Tono = keyof typeof tonos;

export function Estado({ children, tono = "neutral" }: { children: ReactNode; tono?: Tono }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        tonos[tono],
      )}
    >
      {children}
    </span>
  );
}

export function tonoEstado(estado: string): Tono {
  switch (estado) {
    case "Aprobada":
    case "Emitida":
    case "Entregado":
    case "Confirmado":
    case "Activo":
      return "success";
    case "Pendiente":
    case "Pendiente de envío":
    case "Reservado":
    case "Borrador":
      return "warning";
    case "Rechazada":
    case "Cancelada":
    case "Inactivo":
    case "Cancelado":
      return "danger";
    case "Convertida":
      return "info";
    default:
      return "neutral";
  }
}

export function KpiCard({
  etiqueta,
  valor,
  detalle,
  tono = "neutral",
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  tono?: Tono;
}) {
  return (
    <div className="surface p-5">
      <p className="label-caps">{etiqueta}</p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">{valor}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>
      <div className={cn("mt-3 h-1 w-10 rounded-full", tonos[tono])} />
    </div>
  );
}

export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {cabeceras.map((c) => (
              <th key={c} className="label-caps px-4 py-2.5 text-left whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
