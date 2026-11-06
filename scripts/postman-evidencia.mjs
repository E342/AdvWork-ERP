#!/usr/bin/env node
/**
 * Genera la EVIDENCIA de las pruebas de Postman a partir del reporte JSON de Newman.
 *
 *   newman run postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json \
 *     -e postman/AdvWork-ERP-local.postman_environment.json \
 *     --reporters cli,json --reporter-json-export reporte.json --timeout-request 60000
 *   node scripts/postman-evidencia.mjs reporte.json docs/evidencia-postman.md [--newman 6.2.3]
 *
 * Nada de lo que aparece como "respuesta obtenida" o "resultado" se escribe a mano: sale del
 * reporte de la ejecución. Un caso solo figura como EXITOSO si TODAS sus aserciones pasaron.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const versionNewman = opcion("--newman") ?? "no indicada";
const [rutaReporte, rutaSalida = "docs/evidencia-postman.md"] = args;
if (!rutaReporte) {
  console.error(
    "Uso: node scripts/postman-evidencia.mjs <reporte.json> [salida.md] [--newman X.Y.Z]",
  );
  process.exit(2);
}

const reporte = JSON.parse(readFileSync(rutaReporte, "utf8"));
const run = reporte.run;
const CARPETAS = {
  0: "0. Preparación",
  1: "1. API simulada de Hacienda — casos mínimos",
  2: "2. Control de acceso (API simulada)",
  3: "3. Backend del ERP (navegador → ERP → Hacienda)",
  4: "4. Cierre",
};

// ---- Normalización de cada ejecución -----------------------------------------------------------------
const cuerpoDe = (stream) => {
  if (!stream?.data) return "";
  return Buffer.from(stream.data).toString("utf8");
};

function parsearDescripcion(texto) {
  const tipo = /\*\*Tipo:\*\* (.+)/.exec(texto)?.[1] ?? "";
  const m =
    /\*\*Objetivo:\*\* ([\s\S]*?)\n\n\*\*Datos de entrada:\*\* ([\s\S]*?)\n\n\*\*Resultado esperado:\*\* ([\s\S]*?)\n\n\*\*Criterio de éxito:\*\* ([\s\S]*)$/.exec(
      texto,
    );
  return m
    ? { tipo, objetivo: m[1], entrada: m[2], esperado: m[3], criterio: m[4] }
    : { tipo, preparacion: texto.replace(/\*\*Tipo:\*\* .+\n\n/, "") };
}

const ejecuciones = run.executions.map((e) => {
  const nombre = e.item.name;
  const id = nombre.split(" ")[0];
  const descripcion = parsearDescripcion(
    e.item.request?.description?.content ?? e.request?.description?.content ?? "",
  );
  const url = e.request.url;
  const ruta =
    "/" +
    (url.path ?? []).join("/") +
    (url.query?.length ? "?" + url.query.map((q) => `${q.key}=${q.value}`).join("&") : "");
  const aserciones = (e.assertions ?? []).map((a) => ({
    texto: a.assertion,
    ok: !a.error,
    error: a.error?.message,
  }));
  const respondio = Boolean(e.response);
  return {
    id,
    nombre: nombre.slice(id.length + 1),
    carpeta: CARPETAS[id.split(".")[0]] ?? "?",
    descripcion,
    metodo: e.request.method,
    ruta,
    cuerpoEnviado: e.request.body?.raw ?? "",
    codigo: e.response?.code,
    estado: e.response?.status,
    ms: e.response?.responseTime,
    cuerpoRespuesta: respondio ? cuerpoDe(e.response.stream) : "",
    aserciones,
    exitoso: respondio && aserciones.length > 0 && aserciones.every((a) => a.ok),
  };
});

// ---- Presentación -------------------------------------------------------------------------------------------------------
const recortar = (texto, max) =>
  texto.length > max
    ? `${texto.slice(0, max)}\n… (recortado: ${texto.length - max} caracteres más)`
    : texto;
const celda = (t) => String(t).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Muestra lo enviado de forma legible: el DTE firmado se decodifica para ver qué se mandó realmente. */
function resumenEnviado(raw) {
  if (!raw) return "(sin cuerpo)";
  try {
    const c = JSON.parse(raw);
    if (typeof c.documento === "string" && c.documento.split(".").length === 3) {
      const p = JSON.parse(Buffer.from(c.documento.split(".")[1], "base64url").toString("utf8"));
      const { documento, ...sobre } = c;
      return JSON.stringify(
        {
          ...sobre,
          documento: "<JWS firmado; contiene el DTE de abajo>",
          "DTE (decodificado)": {
            numeroControl: p.identificacion?.numeroControl,
            ambiente: p.identificacion?.ambiente,
            "emisor.nit": p.emisor?.nit ?? "(AUSENTE)",
            "receptor.numDocumento": p.receptor?.numDocumento,
            ítems: p.cuerpoDocumento?.length,
            "resumen.totalGravada": p.resumen?.totalGravada,
            "resumen.totalIva": p.resumen?.totalIva,
            "resumen.totalPagar": p.resumen?.totalPagar,
          },
        },
        null,
        2,
      );
    }
    if (c.factura) {
      return JSON.stringify(
        {
          factura: { id: c.factura.id, folio: c.factura.folio, ítems: c.factura.items?.length },
          cliente: { nombre: c.cliente?.nombre, documento: c.cliente?.documento },
        },
        null,
        2,
      );
    }
    return JSON.stringify(c, null, 2);
  } catch {
    return JSON.stringify(raw); // no es JSON (caso deliberado de cuerpo mal formado)
  }
}

function resumenRespuesta(raw) {
  if (!raw) return "(sin cuerpo)";
  try {
    const c = JSON.parse(raw);
    if (c && typeof c === "object" && "dte" in c)
      c.dte = "[DTE completo omitido en esta evidencia]";
    return recortar(JSON.stringify(c, null, 2), 1400);
  } catch {
    return recortar(raw, 600);
  }
}

const porId = new Map(ejecuciones.map((e) => [e.id, e]));
const casos = ejecuciones.filter((e) => e.descripcion.objetivo);
const preparacion = ejecuciones.filter((e) => e.descripcion.preparacion);
const totalAserciones = ejecuciones.flatMap((e) => e.aserciones);
const fallidas = totalAserciones.filter((a) => !a.ok).length;
const casosExitosos = casos.filter((e) => e.exitoso).length;

const iniciada = run.timings?.started ? new Date(run.timings.started) : null;
const fecha = (iniciada ?? new Date()).toLocaleString("es-SV", {
  timeZone: "America/El_Salvador",
  dateStyle: "long",
  timeStyle: "medium",
});
const segundos =
  run.timings?.completed && run.timings?.started
    ? ((run.timings.completed - run.timings.started) / 1000).toFixed(0)
    : "?";
const urlBase = (() => {
  const u = run.executions[0]?.request.url;
  return u ? `${u.protocol}://${u.host.join(".")}${u.port ? `:${u.port}` : ""}` : "?";
})();

const L = [];
L.push("# Evidencia de las pruebas con Postman");
L.push("");
L.push(
  "> **Documento generado automáticamente** por `scripts/postman-evidencia.mjs` a partir del reporte de una",
);
L.push(
  "> ejecución real de la colección con Newman. Las respuestas y los resultados **no se escriben a mano**: salen",
);
L.push("> del reporte. Un caso figura como exitoso solo si **todas** sus aserciones pasaron.");
L.push(
  "> Todo corresponde a una **simulación académica**; no se usó ningún servicio, credencial ni certificado reales.",
);
L.push("");
L.push("| Dato | Valor |");
L.push("|---|---|");
L.push(`| Fecha de ejecución | ${fecha} (hora de El Salvador) |`);
L.push(`| Herramienta | Newman ${versionNewman} (ejecutor de línea de comandos de Postman) |`);
L.push(`| Servidor probado | \`${urlBase}\` |`);
L.push(`| Duración total | ${segundos} s |`);
L.push(
  `| Requests ejecutados | ${run.stats.requests.total} (${casos.length} casos de prueba y ${preparacion.length} pasos de preparación) |`,
);
L.push(`| Aserciones | ${totalAserciones.length} ejecutadas, **${fallidas} fallidas** |`);
L.push(`| Casos exitosos | **${casosExitosos} de ${casos.length}** |`);
L.push("");

// -- Casos mínimos de la consigna
const MINIMOS = [
  ["DTE válido", "Aceptación simulada", ["1.1", "3.1"]],
  ["DTE sin campos obligatorios", "Rechazo simulado", ["1.4"]],
  ["DTE con datos inconsistentes", "Rechazo simulado", ["1.5", "1.6"]],
  ["Solicitud mal estructurada", "Error de validación", ["1.7", "1.8", "1.9", "3.5", "3.6"]],
  ["Servicio indisponible", "Error de comunicación", ["1.13b", "1.13c", "3.7b"]],
  [
    "Reenvío de un documento",
    "Comportamiento controlado y documentado",
    ["1.2", "3.2", "3.4", "3.7d"],
  ],
];
L.push("## Casos mínimos de la consigna");
L.push("");
L.push("| Caso | Resultado esperado | Requests que lo prueban | Resultado |");
L.push("|---|---|---|---|");
for (const [caso, esperado, ids] of MINIMOS) {
  const ejecutados = ids.map((id) => porId.get(id));
  const ok = ejecutados.every((e) => e?.exitoso);
  const detalle = ejecutados
    .map((e, i) => (e ? `${ids[i]} ${e.exitoso ? "✅" : "❌"}` : `${ids[i]} (no ejecutado)`))
    .join(", ");
  L.push(`| ${caso} | ${esperado} | ${detalle} | ${ok ? "✅ Exitoso" : "❌ Con fallos"} |`);
}
L.push("");

// -- Resumen por carpeta
L.push("## Resumen por carpeta");
L.push("");
L.push("| Carpeta | Casos | Exitosos | Aserciones | Fallidas |");
L.push("|---|---|---|---|---|");
for (const nombre of Object.values(CARPETAS)) {
  const enCarpeta = ejecuciones.filter((e) => e.carpeta === nombre);
  const deCasos = enCarpeta.filter((e) => e.descripcion.objetivo);
  const aserc = enCarpeta.flatMap((e) => e.aserciones);
  if (!enCarpeta.length) continue;
  L.push(
    `| ${celda(nombre)} | ${deCasos.length} | ${deCasos.filter((e) => e.exitoso).length} | ${aserc.length} | ${aserc.filter((a) => !a.ok).length} |`,
  );
}
L.push("");

// -- Detalle por caso
L.push("## Detalle de cada caso");
L.push("");
let carpetaActual = "";
for (const e of casos) {
  if (e.carpeta !== carpetaActual) {
    carpetaActual = e.carpeta;
    L.push(`### ${carpetaActual}`);
    L.push("");
  }
  L.push(`#### ${e.id} — ${e.nombre}`);
  L.push("");
  L.push(`- **Objetivo:** ${e.descripcion.objetivo}`);
  L.push(`- **Datos de entrada:** ${e.descripcion.entrada}`);
  L.push(`- **Endpoint:** \`${e.ruta}\``);
  L.push(`- **Método HTTP:** \`${e.metodo}\``);
  L.push(`- **Resultado esperado:** ${e.descripcion.esperado}`);
  L.push(`- **Criterio de éxito:** ${e.descripcion.criterio}`);
  L.push("");
  L.push("Cuerpo enviado (resumen):");
  L.push("");
  L.push("```json");
  L.push(recortar(resumenEnviado(e.cuerpoEnviado), 1200));
  L.push("```");
  L.push("");
  L.push(
    `**Respuesta obtenida:** HTTP ${e.codigo ?? "—"} ${e.estado ?? "(sin respuesta)"} · ${e.ms ?? "?"} ms`,
  );
  L.push("");
  L.push("```json");
  L.push(resumenRespuesta(e.cuerpoRespuesta));
  L.push("```");
  L.push("");
  L.push("Aserciones automáticas:");
  L.push("");
  for (const a of e.aserciones)
    L.push(`- ${a.ok ? "✔" : "✘"} ${a.texto}${a.ok ? "" : ` — ${a.error}`}`);
  L.push("");
  L.push(`**Resultado: ${e.exitoso ? "✅ EXITOSA" : "❌ FALLIDA"}**`);
  L.push("");
}

// -- Preparación
L.push("## Pasos de preparación");
L.push("");
L.push("Cambian el escenario de la simulación entre casos y lo restablecen al terminar.");
L.push("");
L.push("| Paso | Acción | HTTP | Resultado |");
L.push("|---|---|---|---|");
for (const e of preparacion)
  L.push(`| ${e.id} | ${celda(e.nombre)} | ${e.codigo ?? "—"} | ${e.exitoso ? "✅" : "❌"} |`);
L.push("");
L.push("## Cómo reproducir");
L.push("");
L.push("```bash");
L.push("bun dev                                   # servidor en http://127.0.0.1:8080");
L.push("npx newman run postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json \\");
L.push("  -e postman/AdvWork-ERP-local.postman_environment.json \\");
L.push("  --reporters cli,json --reporter-json-export reporte.json --timeout-request 60000");
L.push("node scripts/postman-evidencia.mjs reporte.json docs/evidencia-postman.md");
L.push("```");
L.push("");

writeFileSync(rutaSalida, L.join("\n"));
console.log(
  `Evidencia escrita en ${rutaSalida}: ${casosExitosos}/${casos.length} casos exitosos, ${totalAserciones.length} aserciones (${fallidas} fallidas).`,
);
process.exit(fallidas > 0 || casosExitosos < casos.length ? 1 : 0);
