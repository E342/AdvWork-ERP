/// <reference types="node" />
/**
 * Persistencia de la API simulada en un archivo JSON (data/hacienda-sim.json).
 * Representa "el lado Hacienda": documentos recibidos y escenario activo.
 *
 * Solo funciona ejecutando con Node en local (necesita sistema de archivos
 * escribible). No sirve en Cloudflare Workers.
 *
 * Las escrituras se serializan con una cola y se hacen de forma atómica
 * (archivo temporal + rename) para no corromper el JSON si llegan solicitudes
 * concurrentes o el proceso se interrumpe a mitad de escritura.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSimConfig } from "./config";

export const ESCENARIOS = [
  "normal",
  "indisponible",
  "timeout",
  "timeout_procesado",
  "error_interno",
] as const;
export type Escenario = (typeof ESCENARIOS)[number];

export type DocumentoRecibido = {
  codigoGeneracion: string;
  tipoDte: string;
  nitEmisor: string;
  numeroControl: string;
  estado: "PROCESADO";
  codigoMsg: "001" | "002";
  selloRecibido: string;
  fhProcesamiento: string;
  observaciones: string[];
  recibidoEn: string; // ISO-8601
  dte: unknown;
};

type SimDb = {
  escenario: { modo: Escenario };
  documentos: Record<string, DocumentoRecibido>;
};

const vacia = (): SimDb => ({ escenario: { modo: "normal" }, documentos: {} });
const archivo = (): string =>
  path.resolve(process.cwd(), getSimConfig().dataDir, "hacienda-sim.json");

let cola: Promise<unknown> = Promise.resolve();

async function leer(): Promise<SimDb> {
  try {
    const parsed = JSON.parse(await fs.readFile(archivo(), "utf8")) as Partial<SimDb>;
    return {
      escenario: parsed.escenario ?? { modo: "normal" },
      documentos: parsed.documentos ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return vacia();
    throw err;
  }
}

async function escribir(db: SimDb): Promise<void> {
  const destino = archivo();
  // 0700 / 0600: guarda copias completas de los DTE (datos personales); solo el usuario del
  // servidor debe poder leerlas. En Windows estos modos no tienen efecto (rige el ACL).
  await fs.mkdir(path.dirname(destino), { recursive: true, mode: 0o700 });
  const tmp = `${destino}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, destino);
}

/** Lectura simple (no modifica). */
export const leerDb = (): Promise<SimDb> => leer();

/** Lectura-modificación-escritura serializada. */
export function mutarDb<T>(fn: (db: SimDb) => T | Promise<T>): Promise<T> {
  const tarea = cola.then(async () => {
    const db = await leer();
    const resultado = await fn(db);
    await escribir(db);
    return resultado;
  });
  cola = tarea.catch(() => undefined); // un fallo no bloquea las siguientes escrituras
  return tarea;
}
