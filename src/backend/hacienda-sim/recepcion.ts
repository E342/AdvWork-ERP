/**
 * Servicio de recepción SIMULADO (POST /api/hacienda-sim/fesv/recepciondte)
 * y consulta (POST /api/hacienda-sim/fesv/recepcion/consultadte).
 *
 * OFICIAL: rutas, campos de la respuesta, catálogo de mensajes, formato de fecha
 * y códigos HTTP (Guía de Integración v8.0).
 * ADAPTADO: la `peticion` (la guía no muestra su estructura para recepción
 * individual; aquí: ambiente, idEnvio, version, tipoDte, codigoGeneracion,
 * documento = DTE firmado en formato compacto).
 * ACADÉMICO: firma HMAC, escenarios de falla, duplicados, reglas de cálculo.
 */
import Ajv from "ajv8";
import { fechaHoraSV, newSello, verifyCompact } from "../shared/hmac-jws";
import { LIMITE_CUERPO_DTE, LIMITE_CUERPO_PEQUENO } from "../shared/http-seguro";
import { jsonSim, leerCuerpoSim, verificarBearer } from "./auth";
import { hallazgo, mensaje, type Hallazgo } from "./catalogo";
import { getSimConfig } from "./config";
import { dormir, escenarioActivo } from "./escenarios";
import { aplicarReglas } from "./reglas";
import { validarEsquemaFactura } from "./schema-validator";
import { leerDb, mutarDb, type DocumentoRecibido } from "./store";

const BASE = { version: 2, ambiente: "00", versionApp: 2 } as const;
const UUID_V4_MAYUS = "^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$";

/** Esquema de la petición (basado en los patrones del esquema oficial de lote). */
const validarPeticion = new Ajv({ allErrors: true, strict: false }).compile({
  type: "object",
  required: ["ambiente", "idEnvio", "version", "tipoDte", "codigoGeneracion", "documento"],
  properties: {
    ambiente: { type: "string", enum: ["00", "01"] },
    idEnvio: { type: "string", pattern: UUID_V4_MAYUS },
    version: { type: "number", enum: [2] },
    tipoDte: { type: "string", enum: ["01"] },
    codigoGeneracion: { type: "string", pattern: UUID_V4_MAYUS },
    documento: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
});

// --- Constructores de respuesta ----------------------------------------------

function rechazo(h: Hallazgo, codigoGeneracion: string | null, todos: Hallazgo[] = [h]): Response {
  return jsonSim(
    {
      ...BASE,
      estado: "RECHAZADO",
      codigoGeneracion,
      selloRecibido: null,
      fhProcesamiento: null,
      clasificaMsg: h.clasificaMsg,
      codigoMsg: h.codigoMsg,
      descripcionMsg: h.texto,
      // ADAPTADO: en el ejemplo oficial de rechazo observaciones es null; aquí se
      // lista el detalle completo para poder mostrar todos los errores al usuario.
      observaciones: todos.map((x) => x.texto),
    },
    400,
  );
}

const rechazoGeneral = (
  codigoMsg: "096" | "097" | "098",
  cg: string | null,
  extra: string[] = [],
) =>
  jsonSim(
    {
      ...BASE,
      estado: "RECHAZADO",
      codigoGeneracion: cg,
      selloRecibido: null,
      fhProcesamiento: null,
      clasificaMsg: "98",
      codigoMsg,
      descripcionMsg: mensaje(codigoMsg),
      observaciones: extra,
    },
    400,
  );

const respuestaServicio = (status: 500 | 503 | 504, error: string, message: string): Response =>
  jsonSim({ status: "ERROR", error, message }, status);

// --- Recepción ---------------------------------------------------------------

export async function handleRecepcion(request: Request): Promise<Response> {
  const cfg = getSimConfig();
  const escenario = await escenarioActivo(request);

  // Escenarios de falla (antes de autenticar: un servicio caído no valida nada).
  if (escenario === "indisponible") {
    return respuestaServicio(
      503,
      "Service Unavailable",
      "Servicio simulado no disponible (escenario de prueba).",
    );
  }
  if (escenario === "error_interno") {
    return jsonSim(
      {
        ...BASE,
        estado: "RECHAZADO",
        codigoGeneracion: null,
        selloRecibido: null,
        fhProcesamiento: null,
        clasificaMsg: "99",
        codigoMsg: "099",
        descripcionMsg: mensaje("099"),
        observaciones: ["Error interno simulado (escenario de prueba)."],
      },
      500,
    );
  }
  if (escenario === "timeout") {
    await dormir(cfg.timeoutMs);
    return respuestaServicio(
      504,
      "Gateway Timeout",
      "Tiempo de espera agotado (escenario de prueba).",
    );
  }

  const denegado = verificarBearer(request);
  if (denegado) return denegado;

  const respuesta = await procesar(request);
  // timeout_procesado: ya se procesó y guardó; se demora la respuesta a propósito.
  if (escenario === "timeout_procesado") await dormir(cfg.timeoutMs);
  return respuesta;
}

async function procesar(request: Request): Promise<Response> {
  const cfg = getSimConfig();

  // 1. Cuerpo y estructura de la petición ------------------------------------
  const leido = await leerCuerpoSim(request, LIMITE_CUERPO_DTE);
  if (!leido.ok) return leido.respuesta;
  const texto = leido.texto;
  if (texto.trim() === "") return rechazoGeneral("097", null);

  let peticion: unknown;
  try {
    peticion = JSON.parse(texto);
  } catch {
    return rechazoGeneral("098", null);
  }
  if (typeof peticion !== "object" || peticion === null || Array.isArray(peticion)) {
    return rechazoGeneral("098", null);
  }

  const cgPeticion =
    typeof (peticion as { codigoGeneracion?: unknown }).codigoGeneracion === "string"
      ? (peticion as { codigoGeneracion: string }).codigoGeneracion
      : null;

  if (!validarPeticion(peticion)) {
    const detalle = (validarPeticion.errors ?? []).map(
      (e) => `${e.instancePath || "peticion"} ${e.message}`,
    );
    return rechazoGeneral("096", cgPeticion, detalle);
  }
  const pet = peticion as {
    ambiente: string;
    tipoDte: string;
    codigoGeneracion: string;
    documento: string;
  };

  // 2. Ambiente: la simulación nunca acepta producción ------------------------
  if (pet.ambiente !== "00") {
    return rechazo(hallazgo("19", "007", "ambiente"), pet.codigoGeneracion);
  }

  // 3. Firma del documento (JWS simulado) -------------------------------------
  const firma = verifyCompact<unknown>(pet.documento, cfg.firmaSecret);
  if (!firma.ok) {
    return rechazo(hallazgo("20", "003", "firma"), pet.codigoGeneracion);
  }
  const dte = firma.payload;
  if (typeof dte !== "object" || dte === null || Array.isArray(dte)) {
    return rechazo(hallazgo("20", "003", "firma"), pet.codigoGeneracion);
  }

  // 4. Esquema oficial de Factura ---------------------------------------------
  const errEsquema = validarEsquemaFactura(dte);
  if (errEsquema.length > 0) {
    return rechazo(errEsquema[0]!, pet.codigoGeneracion, errEsquema);
  }

  // 5. Reglas académicas -------------------------------------------------------
  const { errores, observaciones } = aplicarReglas(
    dte as Parameters<typeof aplicarReglas>[0],
    pet.codigoGeneracion,
    cfg,
  );
  if (errores.length > 0) {
    return rechazo(errores[0]!, pet.codigoGeneracion, errores);
  }

  // 6. Duplicado + registro (atómico: evita doble aceptación concurrente) ------
  const d = dte as {
    identificacion: { numeroControl: string };
    emisor: { nit: string };
  };
  const resultado = await mutarDb((db) => {
    if (db.documentos[pet.codigoGeneracion]) return { duplicado: true as const };
    const doc: DocumentoRecibido = {
      codigoGeneracion: pet.codigoGeneracion,
      tipoDte: pet.tipoDte,
      nitEmisor: d.emisor.nit,
      numeroControl: d.identificacion.numeroControl,
      estado: "PROCESADO",
      codigoMsg: observaciones.length > 0 ? "002" : "001",
      selloRecibido: newSello(),
      fhProcesamiento: fechaHoraSV(),
      observaciones: observaciones.map((o) => o.texto),
      recibidoEn: new Date().toISOString(),
      dte,
    };
    db.documentos[pet.codigoGeneracion] = doc;
    return { duplicado: false as const, doc };
  });

  if (resultado.duplicado) {
    return rechazo(hallazgo("11", "004", "identificacion.codigoGeneracion"), pet.codigoGeneracion);
  }

  const { doc } = resultado;
  return jsonSim({
    ...BASE,
    estado: "PROCESADO",
    codigoGeneracion: doc.codigoGeneracion,
    selloRecibido: doc.selloRecibido,
    fhProcesamiento: doc.fhProcesamiento,
    clasificaMsg: "10",
    codigoMsg: doc.codigoMsg,
    descripcionMsg: mensaje(doc.codigoMsg),
    observaciones: doc.observaciones,
  });
}

// --- Consulta ----------------------------------------------------------------

const validarConsulta = new Ajv({ allErrors: true, strict: false }).compile({
  type: "object",
  required: ["nitEmisor", "tdte", "codigoGeneracion"],
  properties: {
    nitEmisor: { type: "string", pattern: "^[0-9]{14}$" }, // patrón del esquema oficial de lote
    tdte: { type: "string", enum: ["01"] },
    codigoGeneracion: { type: "string", pattern: UUID_V4_MAYUS },
  },
});

export async function handleConsulta(request: Request): Promise<Response> {
  const escenario = await escenarioActivo(request);
  if (escenario === "indisponible") {
    return respuestaServicio(
      503,
      "Service Unavailable",
      "Servicio simulado no disponible (escenario de prueba).",
    );
  }
  if (escenario === "error_interno") {
    return respuestaServicio(
      500,
      "Internal Server Error",
      "Error interno simulado (escenario de prueba).",
    );
  }

  const denegado = verificarBearer(request);
  if (denegado) return denegado;

  const leido = await leerCuerpoSim(request, LIMITE_CUERPO_PEQUENO);
  if (!leido.ok) return leido.respuesta;
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(leido.texto);
  } catch {
    return rechazoGeneral("098", null);
  }
  if (!validarConsulta(cuerpo)) {
    const cg = (cuerpo as { codigoGeneracion?: unknown } | null)?.codigoGeneracion;
    return rechazoGeneral(
      "096",
      typeof cg === "string" ? cg : null,
      (validarConsulta.errors ?? []).map((e) => `${e.instancePath || "peticion"} ${e.message}`),
    );
  }
  const q = cuerpo as { nitEmisor: string; tdte: string; codigoGeneracion: string };

  const doc = (await leerDb()).documentos[q.codigoGeneracion];
  if (!doc || doc.nitEmisor !== q.nitEmisor || doc.tipoDte !== q.tdte) {
    return rechazo(hallazgo("11", "014", "codigoGeneracion"), q.codigoGeneracion);
  }
  return jsonSim({
    ...BASE,
    estado: "PROCESADO",
    codigoGeneracion: doc.codigoGeneracion,
    selloRecibido: doc.selloRecibido,
    fhProcesamiento: doc.fhProcesamiento,
    clasificaMsg: "10",
    codigoMsg: "001",
    descripcionMsg: "DTE RECIBIDO, VALIDADO Y PROCESADO",
    observaciones: doc.observaciones,
  });
}
