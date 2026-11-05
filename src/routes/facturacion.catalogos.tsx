import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import type { Impuesto } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, Tabla, tonoEstado } from "@/components/erp/ui";

export const Route = createFileRoute("/facturacion/catalogos")({
  head: () => ({
    meta: [
      { title: "Catálogos tributarios — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Configuración de impuestos, porcentajes, series y folios para mantener la facturación alineada con la normativa vigente.",
      },
      { property: "og:title", content: "Catálogos tributarios — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-11: administrar catálogos de impuestos, series y folios con registro de auditoría.",
      },
    ],
  }),
  component: Catalogos,
});

const vacio: Impuesto = { id: "", nombre: "", porcentaje: 13, serie: "", folioActual: 1, activo: true };

function Catalogos() {
  const { impuestos, guardarImpuesto, eliminarImpuesto, rolActivo } = useErp();
  const [form, setForm] = useState<Impuesto>(vacio);
  const esNuevo = !form.id;
  const puedeEditar = rolActivo === "Administrador" || rolActivo === "Contador";

  const guardar = () => {
    if (!puedeEditar)
      return toast.error("Tu rol no tiene permiso para modificar catálogos tributarios (RNF-02).");
    const r = guardarImpuesto(form, esNuevo);
    if (r.ok) {
      toast.success(r.mensaje);
      setForm(vacio);
    } else toast.error(r.mensaje);
  };

  return (
    <>
      <PageHeader
        hu={["HU-11"]}
        titulo="Catálogos tributarios"
        descripcion="Crea, edita y elimina catálogos de impuestos con porcentajes, series y folios. Los cambios quedan registrados para auditoría y solo son aplicables a roles autorizados."
      />

      {!puedeEditar && (
        <div className="mb-5 rounded-md border border-warning/40 bg-warning/12 px-4 py-3 text-sm text-warning-foreground">
          Estás operando como <strong>{rolActivo}</strong>. Esta pantalla es de solo lectura para tu rol.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel titulo={esNuevo ? "Nuevo catálogo" : `Editando ${form.id}`}>
          <div className="space-y-4 p-5">
            <Campo label="Nombre del impuesto">
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="IVA 13% (El Salvador)"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Porcentaje">
                <input
                  type="number"
                  className={inputCls}
                  value={form.porcentaje}
                  onChange={(e) => setForm({ ...form, porcentaje: Number(e.target.value) })}
                />
              </Campo>
              <Campo label="Serie">
                <input
                  className={inputCls}
                  value={form.serie}
                  onChange={(e) => setForm({ ...form, serie: e.target.value })}
                  placeholder="DTE-01"
                />
              </Campo>
            </div>
            <Campo label="Folio actual">
              <input
                type="number"
                className={inputCls}
                value={form.folioActual}
                onChange={(e) => setForm({ ...form, folioActual: Number(e.target.value) })}
              />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
              Catálogo activo
            </label>
            <div className="flex gap-2">
              <button
                onClick={guardar}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {esNuevo ? "Crear catálogo" : "Guardar cambios"}
              </button>
              {!esNuevo && (
                <button
                  onClick={() => setForm(vacio)}
                  className="rounded-md border border-input px-4 py-2.5 text-sm font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </Panel>

        <Panel titulo="Catálogos configurados">
          <Tabla cabeceras={["ID", "Nombre", "%", "Serie", "Folio", "Estado", ""]}>
            {impuestos.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                <td className="px-4 py-3 text-sm">{i.nombre}</td>
                <td className="px-4 py-3 tabular-nums">{i.porcentaje}%</td>
                <td className="px-4 py-3 font-mono text-xs">{i.serie}</td>
                <td className="px-4 py-3 tabular-nums">{i.folioActual}</td>
                <td className="px-4 py-3">
                  <Estado tono={tonoEstado(i.activo ? "Activo" : "Inactivo")}>
                    {i.activo ? "Activo" : "Inactivo"}
                  </Estado>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setForm(i)}
                      className="text-xs font-semibold text-info hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (!puedeEditar) return toast.error("Sin permisos para esta acción (RNF-02).");
                        toast.success(eliminarImpuesto(i.id).mensaje);
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Eliminar ${i.nombre}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        </Panel>
      </div>
    </>
  );
}
