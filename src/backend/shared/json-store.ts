/// <reference types="node" />
/**
 * Persistencia genérica en un archivo JSON.
 *
 * Las escrituras se serializan con una cola y son atómicas (archivo temporal +
 * rename) para no corromper el JSON con solicitudes concurrentes o si el
 * proceso se interrumpe a mitad de escritura.
 *
 * Solo funciona ejecutando con Node en local (necesita sistema de archivos
 * escribible); no sirve en Cloudflare Workers.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export function crearJsonStore<T extends object>(opciones: {
  /** Ruta del archivo; se evalúa en cada operación (permite cambiar el entorno). */
  archivo: () => string;
  /** Contenido inicial cuando el archivo aún no existe. */
  vacio: () => T;
}) {
  let cola: Promise<unknown> = Promise.resolve();

  async function leer(): Promise<T> {
    try {
      const parsed = JSON.parse(await fs.readFile(opciones.archivo(), "utf8")) as Partial<T>;
      return { ...opciones.vacio(), ...parsed };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return opciones.vacio();
      throw err;
    }
  }

  async function escribir(datos: T): Promise<void> {
    const destino = opciones.archivo();
    // 0700 / 0600: solo el usuario del servidor puede leer la bitácora (datos personales).
    // En Windows estos modos no tienen efecto; allí rige el ACL de la carpeta.
    await fs.mkdir(path.dirname(destino), { recursive: true, mode: 0o700 });
    const tmp = `${destino}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(datos, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmp, destino);
  }

  /** Lectura-modificación-escritura serializada. */
  function mutar<R>(fn: (datos: T) => R | Promise<R>): Promise<R> {
    const tarea = cola.then(async () => {
      const datos = await leer();
      const resultado = await fn(datos);
      await escribir(datos);
      return resultado;
    });
    cola = tarea.catch(() => undefined); // un fallo no bloquea las siguientes escrituras
    return tarea;
  }

  return { leer, mutar };
}
