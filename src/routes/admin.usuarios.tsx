import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { ROLES, type Usuario } from "@/lib/erp-data";
import { Campo, Estado, inputCls, PageHeader, Panel, Tabla, tonoEstado } from "@/components/erp/ui";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y permisos — AdvWork-ERP" },
      {
        name: "description",
        content:
          "Creación de cuentas, asignación de roles y matriz de permisos por módulo para el sistema AdvWork-ERP.",
      },
      { property: "og:title", content: "Usuarios y permisos — AdvWork-ERP" },
      {
        property: "og:description",
        content: "HU-17 y RNF-02: control de acceso por roles con efecto inmediato.",
      },
    ],
  }),
  component: Usuarios,
});

const vacio: Usuario = { id: "", nombre: "", correo: "", rol: "Vendedor", activo: true };

const matriz: { modulo: string; permisos: Record<string, string> }[] = [
  {
    modulo: "Ventas",
    permisos: {
      Administrador: "Total",
      Vendedor: "Crear / editar",
      Cajero: "Cobrar / devolver",
      "Encargado de Inventario": "Solo lectura",
      Contador: "Solo lectura",
      "Data Analyst": "Solo lectura",
      Cliente: "Propias",
    },
  },
  {
    modulo: "Facturación electrónica",
    permisos: {
      Administrador: "Total",
      Vendedor: "Emitir",
      Cajero: "Emitir",
      "Encargado de Inventario": "Sin acceso",
      Contador: "Total",
      "Data Analyst": "Solo lectura",
      Cliente: "Descargar propias",
    },
  },
  {
    modulo: "Inventarios",
    permisos: {
      Administrador: "Total",
      Vendedor: "Consulta stock",
      Cajero: "Consulta stock",
      "Encargado de Inventario": "Total",
      Contador: "Solo lectura",
      "Data Analyst": "Solo lectura",
      Cliente: "Sin acceso",
    },
  },
  {
    modulo: "Administración",
    permisos: {
      Administrador: "Total",
      Vendedor: "Sin acceso",
      Cajero: "Sin acceso",
      "Encargado de Inventario": "Sin acceso",
      Contador: "Catálogos",
      "Data Analyst": "Sin acceso",
      Cliente: "Sin acceso",
    },
  },
];

function Usuarios() {
  const { usuarios, guardarUsuario, alternarUsuario, rolActivo } = useErp();
  const [form, setForm] = useState<Usuario>(vacio);
  const esNuevo = !form.id;
  const esAdmin = rolActivo === "Administrador";

  const guardar = () => {
    if (!esAdmin) return toast.error("Solo el Administrador puede gestionar usuarios (RNF-02).");
    const r = guardarUsuario(form, esNuevo);
    if (r.ok) {
      toast.success(r.mensaje);
      setForm(vacio);
    } else toast.error(r.mensaje);
  };

  return (
    <>
      <PageHeader
        hu={["HU-17", "RNF-02"]}
        titulo="Gestión de usuarios y permisos"
        descripcion="Crea, edita y desactiva cuentas, asigna roles y visualiza la matriz de permisos por módulo. Los cambios tienen efecto inmediato."
      />

      {!esAdmin && (
        <div className="mb-5 rounded-md border border-warning/40 bg-warning/12 px-4 py-3 text-sm text-warning-foreground">
          Operando como <strong>{rolActivo}</strong>: esta pantalla es de solo lectura.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel titulo={esNuevo ? "Nuevo usuario" : `Editando ${form.id}`}>
          <div className="space-y-4 p-5">
            <Campo label="Nombre completo">
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Campo>
            <Campo label="Correo electrónico">
              <input
                type="email"
                className={inputCls}
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                placeholder="usuario@adventureworks.sv"
              />
            </Campo>
            <Campo label="Rol asignado">
              <select
                className={inputCls}
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Usuario["rol"] })}
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
              Cuenta activa
            </label>
            <div className="flex gap-2">
              <button
                onClick={guardar}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {esNuevo ? "Crear usuario" : "Guardar cambios"}
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
            <p className="text-xs text-muted-foreground">
              El sistema valida que no existan usuarios duplicados por correo o identificador.
            </p>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel titulo={`${usuarios.length} usuarios registrados`}>
            <Tabla cabeceras={["ID", "Nombre", "Correo", "Rol", "Estado", ""]}>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-mono text-xs">{u.id}</td>
                  <td className="px-4 py-3 text-sm font-medium">{u.nombre}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.correo}</td>
                  <td className="px-4 py-3 text-sm">{u.rol}</td>
                  <td className="px-4 py-3">
                    <Estado tono={tonoEstado(u.activo ? "Activo" : "Inactivo")}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Estado>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setForm(u)}
                        className="text-xs font-semibold text-info hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (!esAdmin) return toast.error("Sin permisos para esta acción (RNF-02).");
                          toast.success(alternarUsuario(u.id).mensaje);
                        }}
                        className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabla>
          </Panel>

          <Panel titulo="Matriz de permisos por módulo (RNF-02)">
            <Tabla cabeceras={["Módulo", ...ROLES]}>
              {matriz.map((m) => (
                <tr key={m.modulo}>
                  <td className="px-4 py-3 text-sm font-semibold">{m.modulo}</td>
                  {ROLES.map((r) => (
                    <td
                      key={r}
                      className={`px-4 py-3 text-xs ${
                        m.permisos[r] === "Sin acceso" ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {m.permisos[r]}
                    </td>
                  ))}
                </tr>
              ))}
            </Tabla>
          </Panel>
        </div>
      </div>
    </>
  );
}
