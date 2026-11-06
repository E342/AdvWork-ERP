#!/usr/bin/env node
/**
 * Genera la colección y el entorno de Postman a partir de los casos definidos aquí.
 *
 *   node postman/construir.mjs
 *
 * Salida (se importan en Postman con File > Import):
 *   postman/AdvWork-ERP-Hacienda-DTE.postman_collection.json
 *   postman/AdvWork-ERP-local.postman_environment.json
 *
 * Cada caso lleva en su descripción los cuatro datos que exige la consigna (objetivo, datos de
 * entrada, resultado esperado, criterio de éxito); `scripts/postman-evidencia.mjs` los lee junto
 * con el resultado REAL de una ejecución para generar la evidencia.
 */
import { readFileSync, writeFileSync } from "node:fs";

const AQUI = new URL("./", import.meta.url);
const helpers = readFileSync(new URL("helpers.js", AQUI), "utf8");
const H = 'const H = eval(pm.collectionVariables.get("helpers"));';
const j = JSON.stringify;

// ---------------------------------------------------------------------------------------------
// Aserciones reutilizables (devuelven líneas de código para el sandbox de Postman)
// ---------------------------------------------------------------------------------------------
const prueba = (nombre, cuerpo) => `pm.test(${j(nombre)}, function () { ${cuerpo} });`;

/** Aserciones sobre una respuesta de la API SIMULADA de Hacienda. */
function esperaSim(o) {
  const l = [
    prueba(`HTTP ${o.http}`, `pm.response.to.have.status(${o.http});`),
    "const j = pm.response.json();",
  ];
  for (const campo of ["estado", "codigoMsg", "clasificaMsg"]) {
    if (o[campo] !== undefined)
      l.push(prueba(`${campo} = ${o[campo]}`, `pm.expect(j.${campo}).to.eql(${j(o[campo])});`));
  }
  if (o.incluye)
    l.push(
      prueba(
        `el mensaje menciona ${j(o.incluye)}`,
        `pm.expect(JSON.stringify(j)).to.include(${j(o.incluye)});`,
      ),
    );
  return [...l, ...(o.extra ?? [])];
}

/** Aserciones sobre una respuesta del backend del ERP. */
function esperaErp(o) {
  const l = [
    prueba(`HTTP ${o.http}`, `pm.response.to.have.status(${o.http});`),
    "const j = pm.response.json();",
  ];
  for (const campo of [
    "ok",
    "resultado",
    "facturaEstado",
    "envios",
    "consultas",
    "codigoMsg",
    "clasificaMsg",
    "yaEmitida",
    "recuperadoPorConsulta",
    "error",
  ]) {
    if (o[campo] !== undefined)
      l.push(prueba(`${campo} = ${o[campo]}`, `pm.expect(j.${campo}).to.eql(${j(o[campo])});`));
  }
  return [...l, ...(o.extra ?? [])];
}

// ---------------------------------------------------------------------------------------------
// Constructores de items de Postman
// ---------------------------------------------------------------------------------------------
const AUTH = { key: "Authorization", value: "{{token}}" };
const JSON_CT = { key: "Content-Type", value: "application/json" };

function url(ruta) {
  const [camino, consulta] = ruta.split("?");
  return {
    raw: `{{base_url}}${ruta}`,
    host: ["{{base_url}}"],
    path: camino.split("/").filter(Boolean),
    ...(consulta
      ? {
          query: consulta.split("&").map((p) => ({ key: p.split("=")[0], value: p.split("=")[1] })),
        }
      : {}),
  };
}

function descripcion(doc, tipo) {
  if (tipo === "preparación") return `**Tipo:** preparación\n\n${doc}`;
  return [
    "**Tipo:** caso de prueba",
    `**Objetivo:** ${doc.objetivo}`,
    `**Datos de entrada:** ${doc.entrada}`,
    `**Resultado esperado:** ${doc.esperado}`,
    `**Criterio de éxito:** ${doc.criterio}`,
  ].join("\n\n");
}

/** Un item de Postman. `cuerpo`: raw JSON por defecto "{}" (se reemplaza en el script previo). */
function item({
  id,
  nombre,
  metodo = "POST",
  ruta,
  cabeceras = [JSON_CT, AUTH],
  cuerpo,
  formulario,
  pre = [],
  test = [],
  doc,
  tipo = "caso",
}) {
  const body = formulario
    ? { mode: "urlencoded", urlencoded: formulario.map(([key, value]) => ({ key, value })) }
    : cuerpo === null
      ? undefined
      : { mode: "raw", raw: cuerpo ?? "{}", options: { raw: { language: "json" } } };
  return {
    name: `${id} ${nombre}`,
    event: [
      ...(pre.length
        ? [{ listen: "prerequest", script: { type: "text/javascript", exec: pre } }]
        : []),
      { listen: "test", script: { type: "text/javascript", exec: test } },
    ],
    request: {
      method: metodo,
      header: cabeceras,
      ...(body ? { body } : {}),
      url: url(ruta),
      description: descripcion(doc, tipo),
    },
  };
}

/** Cambia el escenario de la simulación (paso de preparación; verifica que el cambio se aplicó). */
const escenario = (id, modo, motivo) =>
  item({
    id,
    nombre: `Escenario: ${modo}`,
    metodo: "PUT",
    ruta: "/api/hacienda-sim/control/escenario",
    cuerpo: j({ modo }),
    tipo: "preparación",
    doc: `Pone la simulación en modo \`${modo}\`. ${motivo}`,
    test: [
      prueba("HTTP 200", "pm.response.to.have.status(200);"),
      prueba(`modo = ${modo}`, `pm.expect(pm.response.json().modo).to.eql(${j(modo)});`),
    ],
  });

// Scripts previos reutilizables -----------------------------------------------------------------
/** DTE válido, con una modificación opcional, firmado y enviado en la petición. */
const preDte = (modificacion = "", extras = "undefined", guardar = false) => [
  H,
  "const dte = H.dteValido(pm);",
  ...(modificacion ? [modificacion] : []),
  `const cuerpo = H.peticion(pm, dte, ${extras});`,
  "pm.request.body.update(JSON.stringify(cuerpo));",
  ...(guardar
    ? [
        'pm.collectionVariables.set("peticion_valida", JSON.stringify(cuerpo));',
        'pm.collectionVariables.set("cg_valido", cuerpo.codigoGeneracion);',
      ]
    : []),
];
/** Factura nueva para el backend del ERP; se guarda con la clave indicada para poder reenviarla. */
const preErp = (clave, opciones = "{}", modificacion = "") => [
  H,
  `const cuerpo = H.facturaErp(pm, ${opciones});`,
  ...(modificacion ? [modificacion] : []),
  "pm.request.body.update(JSON.stringify(cuerpo));",
  `pm.collectionVariables.set(${j(clave)}, JSON.stringify(cuerpo));`,
];
const SELLO = /^[A-Z0-9]{40}$/.toString();
const UUID = /^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.toString();
const NUMCTL = /^DTE-01-M001P001-\d{15}$/.toString();
const URL_ENVIAR = "/api/hacienda-sim/fesv/recepciondte";
const URL_CONSULTA = "/api/hacienda-sim/fesv/recepcion/consultadte";
const URL_CONTROL = "/api/hacienda-sim/control/escenario";
const URL_TRANSMITIR = "/api/erp/dte/transmitir";
const URL_CONSULTAR_ERP = "/api/erp/dte/consultar";

// ---------------------------------------------------------------------------------------------
// 0. Preparación
// ---------------------------------------------------------------------------------------------
const carpeta0 = {
  name: "0. Preparación",
  item: [
    item({
      id: "0.1",
      nombre: "Autenticación correcta (obtener token)",
      ruta: "/api/hacienda-sim/auth",
      cabeceras: [],
      formulario: [
        ["user", "{{hacienda_user}}"],
        ["pwd", "{{hacienda_pwd}}"],
      ],
      doc: {
        objetivo:
          "Verificar que la API simulada autentica con usuario y contraseña de prueba y entrega un token JWT.",
        entrada:
          "POST form-urlencoded con `user` y `pwd` (variables del entorno; credenciales FICTICIAS).",
        esperado: "HTTP 200 con `status: OK` y `body.token` = `Bearer <jwt>`.",
        criterio:
          "Código 200, `status` igual a `OK`, el token empieza con `Bearer ` y se guarda para las demás peticiones.",
      },
      test: [
        prueba("HTTP 200", "pm.response.to.have.status(200);"),
        "const j = pm.response.json();",
        prueba("status = OK", 'pm.expect(j.status).to.eql("OK");'),
        prueba(
          "token con formato Bearer <jwt>",
          "pm.expect(j.body.token).to.match(/^Bearer [\\w-]+\\.[\\w-]+\\.[\\w-]+$/);",
        ),
        'pm.collectionVariables.set("token", j.body.token);',
        'pm.collectionVariables.set("token_vence", String(Date.now() + 30 * 60 * 1000));',
      ],
    }),
    escenario("0.2", "normal", "Punto de partida de todas las pruebas."),
  ],
};

// ---------------------------------------------------------------------------------------------
// 1. API simulada de Hacienda: casos mínimos
// ---------------------------------------------------------------------------------------------
const carpeta1 = {
  name: "1. API simulada de Hacienda — casos mínimos",
  item: [
    item({
      id: "1.1",
      nombre: "DTE válido → aceptación",
      ruta: URL_ENVIAR,
      cuerpo: "{}",
      pre: preDte("", "undefined", true),
      doc: {
        objetivo:
          "Demostrar que un DTE de Factura válido y firmado es recibido, sellado y aceptado.",
        entrada:
          "POST con una petición cuyo `documento` es el DTE (esquema oficial fe-f-v2, total $226.00, ambiente `00`) firmado con JWS simulado. `codigoGeneracion` UUID v4 nuevo.",
        esperado:
          "HTTP 200, `estado: PROCESADO`, `codigoMsg: 001` (RECIBIDO), `selloRecibido` de 40 caracteres y fecha de procesamiento.",
        criterio:
          "Código 200; `estado`, `codigoMsg` y `clasificaMsg` (10) como se indica; sello alfanumérico de 40 caracteres; fecha `dd/MM/yyyy HH:mm:ss`; cabecera `X-AdvWork-Simulacion: true`.",
      },
      test: esperaSim({
        http: 200,
        estado: "PROCESADO",
        codigoMsg: "001",
        clasificaMsg: "10",
        extra: [
          prueba(
            "selloRecibido: 40 caracteres alfanuméricos",
            `pm.expect(j.selloRecibido).to.match(${SELLO});`,
          ),
          prueba(
            "fhProcesamiento con formato dd/MM/yyyy HH:mm:ss",
            "pm.expect(j.fhProcesamiento).to.match(/^\\d{2}\\/\\d{2}\\/\\d{4} \\d{2}:\\d{2}:\\d{2}$/);",
          ),
          prueba(
            "la respuesta se identifica como simulada",
            'pm.response.to.have.header("X-AdvWork-Simulacion", "true");',
          ),
          'pm.collectionVariables.set("sello_valido", j.selloRecibido);',
        ],
      }),
    }),
    item({
      id: "1.2",
      nombre: "Reenvío del mismo documento → rechazo por duplicado",
      ruta: URL_ENVIAR,
      pre: ['pm.request.body.update(pm.collectionVariables.get("peticion_valida"));'],
      doc: {
        objetivo:
          "Documentar el comportamiento controlado ante un REENVÍO: el mismo documento ya aceptado no se vuelve a registrar.",
        entrada: "La misma petición exacta del caso 1.1 (mismo `codigoGeneracion`).",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 004` (YA EXISTE UN REGISTRO CON ESE VALOR), `clasificaMsg: 11`.",
        criterio:
          "Código 400 y código de mensaje 004; no se genera un segundo sello (ver 1.3, donde el sello original sigue siendo el mismo).",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "004",
        clasificaMsg: "11",
        incluye: "YA EXISTE UN REGISTRO CON ESE VALOR",
      }),
    }),
    item({
      id: "1.3",
      nombre: "Consulta del documento aceptado → mismo sello",
      ruta: URL_CONSULTA,
      pre: [
        'pm.request.body.update(JSON.stringify({ nitEmisor: pm.environment.get("nit_emisor"), tdte: "01", codigoGeneracion: pm.collectionVariables.get("cg_valido") }));',
      ],
      doc: {
        objetivo:
          "Comprobar que la consulta de estado devuelve el documento aceptado, con el sello original (no uno nuevo).",
        entrada: "POST con `nitEmisor`, `tdte: 01` y el `codigoGeneracion` del caso 1.1.",
        esperado:
          "HTTP 200, `estado: PROCESADO`, `codigoMsg: 001` y el MISMO `selloRecibido` del caso 1.1.",
        criterio: "Código 200 y `selloRecibido` idéntico al guardado en 1.1.",
      },
      test: esperaSim({
        http: 200,
        estado: "PROCESADO",
        codigoMsg: "001",
        extra: [
          prueba(
            "el sello coincide con el del caso 1.1",
            'pm.expect(j.selloRecibido).to.eql(pm.collectionVariables.get("sello_valido"));',
          ),
        ],
      }),
    }),
    item({
      id: "1.4",
      nombre: "DTE sin campos obligatorios → rechazo",
      ruta: URL_ENVIAR,
      pre: preDte("delete dte.emisor.nit;"),
      doc: {
        objetivo:
          "Demostrar el rechazo de un DTE al que le falta un campo obligatorio del esquema oficial.",
        entrada: "DTE válido al que se le elimina `emisor.nit`, firmado y enviado.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 005` (DEBE PROPORCIONAR UN VALOR), `clasificaMsg: 12` (datos del emisor), mensaje con `[emisor.nit]`.",
        criterio:
          "Código 400, código 005, clasificación 12 y el campo faltante nombrado en el mensaje.",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "005",
        clasificaMsg: "12",
        incluye: "[emisor.nit]",
      }),
    }),
    item({
      id: "1.5",
      nombre: "DTE con datos inconsistentes → rechazo",
      ruta: URL_ENVIAR,
      pre: preDte("dte.resumen.totalPagar = 276; // los ítems suman 226"),
      doc: {
        objetivo: "Demostrar el rechazo de un DTE cuyos totales no cuadran con sus ítems.",
        entrada:
          "DTE válido con `resumen.totalPagar` alterado a 276.00 (los ítems suman 226.00), firmado y enviado.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 020` (CALCULO INCORRECTO), `clasificaMsg: 16` (resumen).",
        criterio:
          "Código 400, código 020, clasificación 16 y el campo `resumen.totalPagar` nombrado en el mensaje.",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "020",
        clasificaMsg: "16",
        incluye: "totalPagar",
      }),
    }),
    item({
      id: "1.6",
      nombre: "Diferencia de cálculo pequeña → aceptado con observaciones",
      ruta: URL_ENVIAR,
      pre: preDte("dte.resumen.totalIva = 26.06; // diferencia de 0.06"),
      doc: {
        objetivo:
          "Mostrar que una diferencia de cálculo menor no rechaza el documento: se acepta con observaciones (como en el ejemplo oficial).",
        entrada: "DTE válido con `resumen.totalIva` = 26.06 en lugar de 26.00.",
        esperado:
          "HTTP 200, `estado: PROCESADO`, `codigoMsg: 002` (RECIBIDO CON OBSERVACIONES) y una observación sobre `resumen.totalIva`.",
        criterio: "Código 200, código 002 y la observación presente en `observaciones`.",
      },
      test: esperaSim({
        http: 200,
        estado: "PROCESADO",
        codigoMsg: "002",
        clasificaMsg: "10",
        extra: [
          prueba(
            "observaciones menciona resumen.totalIva",
            "pm.expect(j.observaciones.join(' ')).to.include('resumen.totalIva');",
          ),
        ],
      }),
    }),
    item({
      id: "1.7",
      nombre: "Solicitud mal estructurada (JSON mal formado) → error de validación",
      ruta: URL_ENVIAR,
      cuerpo: "{esto no es json",
      doc: {
        objetivo: "Demostrar el error de validación ante un cuerpo que no es JSON válido.",
        entrada: "Cuerpo `{esto no es json`, con token válido.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 098` (DATOS NO CUMPLEN ESTANDAR JSON), `clasificaMsg: 98`.",
        criterio: "Código 400 y código de mensaje 098.",
      },
      test: esperaSim({ http: 400, estado: "RECHAZADO", codigoMsg: "098", clasificaMsg: "98" }),
    }),
    item({
      id: "1.8",
      nombre: "Solicitud mal estructurada (falta `documento`) → error de validación",
      ruta: URL_ENVIAR,
      pre: preDte("", "{ documento: undefined }"),
      doc: {
        objetivo:
          "Demostrar el error de validación cuando la petición no trae el campo obligatorio `documento`.",
        entrada:
          "Petición con `ambiente`, `idEnvio`, `version`, `tipoDte` y `codigoGeneracion`, pero SIN `documento`.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 096` (DOCUMENTO NO CUMPLE ESQUEMA JSON), `clasificaMsg: 98`; el detalle nombra `documento`.",
        criterio: "Código 400, código 096 y `documento` mencionado en las observaciones.",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "096",
        clasificaMsg: "98",
        incluye: "documento",
      }),
    }),
    item({
      id: "1.9",
      nombre: "Cuerpo vacío → error de validación",
      ruta: URL_ENVIAR,
      cuerpo: "",
      doc: {
        objetivo: "Demostrar el error ante una solicitud sin datos para validar.",
        entrada: "Cuerpo vacío, con token válido.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 097` (NO SE HA PROPORCIONADO DATOS PARA VALIDAR).",
        criterio: "Código 400 y código de mensaje 097.",
      },
      test: esperaSim({ http: 400, estado: "RECHAZADO", codigoMsg: "097", clasificaMsg: "98" }),
    }),
    item({
      id: "1.10",
      nombre: "Firma inválida → rechazo",
      ruta: URL_ENVIAR,
      pre: preDte("", '{ documento: H.firmar(dte, "otra-clave-incorrecta") }'),
      doc: {
        objetivo:
          "Demostrar que un documento firmado con otra clave (firma que no se puede verificar) es rechazado.",
        entrada: "DTE válido firmado con una clave distinta a la configurada.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 003` (VALOR NO VALIDO), `clasificaMsg: 20` (firma electrónica), mensaje con `[firma]`.",
        criterio: "Código 400, código 003, clasificación 20 y `[firma]` en el mensaje.",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "003",
        clasificaMsg: "20",
        incluye: "[firma]",
      }),
    }),
    item({
      id: "1.11",
      nombre: 'Ambiente de producción ("01") → rechazado',
      ruta: URL_ENVIAR,
      pre: preDte("", '{ ambiente: "01" }'),
      doc: {
        objetivo:
          "Comprobar que la simulación NUNCA acepta el ambiente de producción, para que no pueda confundirse con el servicio real.",
        entrada: "Petición con `ambiente: 01`.",
        esperado:
          "HTTP 400, `estado: RECHAZADO`, `codigoMsg: 007` (VALOR NO ES PERMITIDO), `clasificaMsg: 19`.",
        criterio: "Código 400 y código de mensaje 007 mencionando `[ambiente]`.",
      },
      test: esperaSim({
        http: 400,
        estado: "RECHAZADO",
        codigoMsg: "007",
        clasificaMsg: "19",
        incluye: "[ambiente]",
      }),
    }),
    item({
      id: "1.12",
      nombre: "Importe con centavos ($1,234.56) → aceptado",
      ruta: URL_ENVIAR,
      pre: preDte("H.conImporte(dte, 1234.56);"),
      doc: {
        objetivo:
          "Regresión: un importe con centavos (que el validador rechazó por error en una versión anterior) debe aceptarse.",
        entrada: "DTE de una sola línea por $1,234.56 con totales coherentes (IVA 13 % incluido).",
        esperado: "HTTP 200, `estado: PROCESADO`, `codigoMsg: 001`.",
        criterio: "Código 200 y código 001.",
      },
      test: esperaSim({ http: 200, estado: "PROCESADO", codigoMsg: "001", clasificaMsg: "10" }),
    }),
    // --- Servicio indisponible ---
    escenario("1.13a", "indisponible", "Simula que el servicio de Hacienda no está disponible."),
    item({
      id: "1.13b",
      nombre: "Servicio indisponible: enviar DTE → error de comunicación (503)",
      ruta: URL_ENVIAR,
      pre: preDte(),
      doc: {
        objetivo:
          "Demostrar el error de comunicación cuando el servicio no está disponible (recepción).",
        entrada: "DTE válido enviado con la simulación en modo `indisponible`.",
        esperado:
          "HTTP 503 con `status: ERROR` y `error: Service Unavailable`; el documento NO se procesa.",
        criterio: "Código 503 y cuerpo con `error` = `Service Unavailable`.",
      },
      test: [
        prueba("HTTP 503", "pm.response.to.have.status(503);"),
        "const j = pm.response.json();",
        prueba("error = Service Unavailable", 'pm.expect(j.error).to.eql("Service Unavailable");'),
        prueba("status = ERROR", 'pm.expect(j.status).to.eql("ERROR");'),
      ],
    }),
    item({
      id: "1.13c",
      nombre: "Servicio indisponible: consultar estado → 503",
      ruta: URL_CONSULTA,
      pre: [
        'pm.request.body.update(JSON.stringify({ nitEmisor: pm.environment.get("nit_emisor"), tdte: "01", codigoGeneracion: pm.collectionVariables.get("cg_valido") }));',
      ],
      doc: {
        objetivo:
          "Demostrar que la consulta de estado también falla con 503 mientras el servicio está caído.",
        entrada:
          "Consulta del `codigoGeneracion` del caso 1.1 con la simulación en modo `indisponible`.",
        esperado: "HTTP 503.",
        criterio: "Código 503.",
      },
      test: [prueba("HTTP 503", "pm.response.to.have.status(503);")],
    }),
    escenario("1.13d", "normal", "Restablece el servicio."),
    // --- Error interno ---
    escenario("1.14a", "error_interno", "Simula un fallo interno del servicio."),
    item({
      id: "1.14b",
      nombre: "Error interno simulado → 500 con código 099",
      ruta: URL_ENVIAR,
      pre: preDte(),
      doc: {
        objetivo: "Demostrar la respuesta ante un error interno del servicio.",
        entrada: "DTE válido enviado con la simulación en modo `error_interno`.",
        esperado:
          "HTTP 500, `codigoMsg: 099` (ERROR NO CATALOGADO), `clasificaMsg: 99`; el documento NO se procesa.",
        criterio: "Código 500, código 099 y clasificación 99.",
      },
      test: esperaSim({ http: 500, estado: "RECHAZADO", codigoMsg: "099", clasificaMsg: "99" }),
    }),
    escenario("1.14c", "normal", "Restablece el servicio."),
    // --- Sin respuesta ---
    escenario(
      "1.15a",
      "timeout",
      "Simula que el servicio no responde a tiempo (tarda 6 s y devuelve 504).",
    ),
    item({
      id: "1.15b",
      nombre: "Sin respuesta a tiempo → 504 tras ≈6 s",
      ruta: URL_ENVIAR,
      pre: preDte(),
      doc: {
        objetivo:
          "Demostrar el comportamiento cuando el servicio tarda más que el umbral de espera (5 s).",
        entrada: "DTE válido enviado con la simulación en modo `timeout`.",
        esperado: "Tras ≈6 s responde HTTP 504 (`Gateway Timeout`); el documento NO se procesa.",
        criterio:
          "Código 504 y tiempo de respuesta de al menos 5.5 s (mayor que el umbral de 5 s).",
      },
      test: [
        prueba("HTTP 504", "pm.response.to.have.status(504);"),
        prueba(
          "tardó más que el umbral de 5 s",
          "pm.expect(pm.response.responseTime).to.be.above(5500);",
        ),
      ],
    }),
    escenario("1.15c", "normal", "Restablece el servicio."),
  ],
};

// ---------------------------------------------------------------------------------------------
// 2. Control de acceso de la API simulada
// ---------------------------------------------------------------------------------------------
const sin401 = (msg) => [
  prueba("HTTP 401", "pm.response.to.have.status(401);"),
  "const j = pm.response.json();",
  prueba(`mensaje: ${msg}`, `pm.expect(j.message).to.eql(${j(msg)});`),
];
const carpeta2 = {
  name: "2. Control de acceso (API simulada)",
  item: [
    item({
      id: "2.1",
      nombre: "Recepción sin token → 401",
      ruta: URL_ENVIAR,
      cabeceras: [JSON_CT],
      doc: {
        objetivo: "Comprobar que la recepción exige autenticación.",
        entrada: "POST sin encabezado `Authorization`.",
        esperado: "HTTP 401, mensaje `Token no proporcionado`.",
        criterio: "Código 401 y el mensaje indicado.",
      },
      test: sin401("Token no proporcionado"),
    }),
    item({
      id: "2.2",
      nombre: "Token inválido → 401",
      ruta: URL_ENVIAR,
      cabeceras: [JSON_CT, { key: "Authorization", value: "Bearer abc.def.ghi" }],
      doc: {
        objetivo: "Comprobar que un token con formato JWT pero sin firma válida se rechaza.",
        entrada: "`Authorization: Bearer abc.def.ghi`.",
        esperado: "HTTP 401, mensaje `Token no valido`.",
        criterio: "Código 401 y el mensaje indicado.",
      },
      test: sin401("Token no valido"),
    }),
    item({
      id: "2.3",
      nombre: 'Token con algoritmo "none" → 401',
      ruta: URL_ENVIAR,
      cabeceras: [JSON_CT],
      pre: [
        H,
        'const cab = H.b64url(CryptoJS.enc.Utf8.parse(JSON.stringify({ alg: "none", typ: "JWT" })));',
        'const car = H.b64url(CryptoJS.enc.Utf8.parse(JSON.stringify({ sub: "x", exp: 9999999999 })));',
        'pm.request.headers.upsert({ key: "Authorization", value: "Bearer " + cab + "." + car + "." });',
      ],
      doc: {
        objetivo:
          "Comprobar que no se acepta un token sin firma (ataque clásico de algoritmo `none`).",
        entrada: "Token cuya cabecera declara `alg: none` y sin firma.",
        esperado: "HTTP 401, mensaje `Token no valido`.",
        criterio: "Código 401 y el mensaje indicado.",
      },
      test: sin401("Token no valido"),
    }),
    item({
      id: "2.4",
      nombre: "Cambiar el escenario sin token → 401",
      metodo: "PUT",
      ruta: URL_CONTROL,
      cabeceras: [JSON_CT],
      cuerpo: j({ modo: "indisponible" }),
      doc: {
        objetivo: "Comprobar que el control de escenarios de falla está protegido.",
        entrada: 'PUT con `{"modo":"indisponible"}` y sin `Authorization`.',
        esperado: "HTTP 401; el escenario NO cambia.",
        criterio: "Código 401.",
      },
      test: [prueba("HTTP 401", "pm.response.to.have.status(401);")],
    }),
  ],
};

// ---------------------------------------------------------------------------------------------
// 3. Backend del ERP (lo que usa el navegador)
// ---------------------------------------------------------------------------------------------
const cabErp = [JSON_CT];
const carpeta3 = {
  name: "3. Backend del ERP (navegador → ERP → Hacienda)",
  item: [
    item({
      id: "3.1",
      nombre: "Emitir una factura válida → Emitida",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [
        ...preErp("erp_valida"),
        'pm.collectionVariables.set("fac_id_valida", cuerpo.factura.id);',
      ],
      doc: {
        objetivo:
          "Demostrar el ciclo completo desde el ERP: construir el DTE, firmarlo, enviarlo y registrar la respuesta.",
        entrada:
          "POST `{ factura, cliente }` con 2 ítems (Bicicleta ×1 a $100; Guantes ×2 a $50 con 10 % de descuento), cliente con documento válido.",
        esperado:
          "HTTP 200, `ok: true`, `resultado: aceptado`, `facturaEstado: Emitida`, 1 envío y 0 consultas; sello de 40 caracteres; total del DTE $214.70.",
        criterio:
          "Código 200; resultado y estado como se indica; sello, `codigoGeneracion` y `numeroControl` con formato válido; `totales.totalPagar` = 214.7.",
      },
      test: esperaErp({
        http: 200,
        ok: true,
        resultado: "aceptado",
        facturaEstado: "Emitida",
        envios: 1,
        consultas: 0,
        yaEmitida: false,
        extra: [
          prueba(
            "selloRecibido: 40 caracteres alfanuméricos",
            `pm.expect(j.selloRecibido).to.match(${SELLO});`,
          ),
          prueba(
            "codigoGeneracion: UUID v4 en mayúsculas",
            `pm.expect(j.codigoGeneracion).to.match(${UUID});`,
          ),
          prueba(
            "numeroControl con formato DTE-01-M001P001-<15 dígitos>",
            `pm.expect(j.numeroControl).to.match(${NUMCTL});`,
          ),
          prueba("total del DTE = 214.70", "pm.expect(j.totales.totalPagar).to.eql(214.7);"),
          'pm.collectionVariables.set("trx_id_valida", j.transmisionId);',
          'pm.collectionVariables.set("sello_erp_valida", j.selloRecibido);',
          'pm.collectionVariables.set("cg_erp_valida", j.codigoGeneracion);',
        ],
      }),
    }),
    item({
      id: "3.2",
      nombre: "Reenviar la misma factura (ya emitida) → no se vuelve a enviar",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: ['pm.request.body.update(pm.collectionVariables.get("erp_valida"));'],
      doc: {
        objetivo:
          "Documentar el comportamiento controlado del REENVÍO desde el ERP: una factura ya emitida no se envía otra vez.",
        entrada: "El mismo cuerpo exacto del caso 3.1.",
        esperado:
          "HTTP 200, `yaEmitida: true`, 0 envíos y 0 consultas, la MISMA transmisión y el MISMO sello del caso 3.1.",
        criterio:
          "Código 200, `yaEmitida` verdadero, `envios` 0, y `transmisionId` y `selloRecibido` idénticos a los de 3.1.",
      },
      test: esperaErp({
        http: 200,
        ok: true,
        yaEmitida: true,
        envios: 0,
        consultas: 0,
        extra: [
          prueba(
            "misma transmisión que en 3.1",
            'pm.expect(j.transmisionId).to.eql(pm.collectionVariables.get("trx_id_valida"));',
          ),
          prueba(
            "mismo sello que en 3.1",
            'pm.expect(j.selloRecibido).to.eql(pm.collectionVariables.get("sello_erp_valida"));',
          ),
        ],
      }),
    }),
    item({
      id: "3.3",
      nombre: "Cliente con documento inválido → Rechazada",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [...preErp("erp_rechazo", '{ documento: "1234" }')],
      doc: {
        objetivo:
          "Demostrar el rechazo de Hacienda reflejado en el ERP, sin reintentos (un rechazo no se reintenta).",
        entrada: "Factura cuyo cliente tiene el documento `1234` (menos de 8 dígitos).",
        esperado:
          "HTTP 422, `ok: false`, `resultado: rechazado`, `facturaEstado: Rechazada`, `codigoMsg: 003`, `clasificaMsg: 13` (receptor), 1 envío y 0 consultas.",
        criterio:
          "Código 422; resultado, estado, código y clasificación como se indica; sin reintentos (1 envío).",
      },
      test: esperaErp({
        http: 422,
        ok: false,
        resultado: "rechazado",
        facturaEstado: "Rechazada",
        codigoMsg: "003",
        clasificaMsg: "13",
        envios: 1,
        consultas: 0,
        extra: ['pm.collectionVariables.set("cg_erp_rechazo", j.codigoGeneracion);'],
      }),
    }),
    item({
      id: "3.4",
      nombre: "Corregir el dato y reenviar → Emitida con el mismo código de generación",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [
        'const cuerpo = JSON.parse(pm.collectionVariables.get("erp_rechazo"));',
        'cuerpo.cliente.documento = "04512398-7";',
        "pm.request.body.update(JSON.stringify(cuerpo));",
      ],
      doc: {
        objetivo:
          "Demostrar que tras un rechazo se puede corregir el dato y reenviar, conservando el `codigoGeneracion` de la factura.",
        entrada:
          "La misma factura del caso 3.3 con el documento del cliente corregido a `04512398-7`.",
        esperado:
          "HTTP 200, `resultado: aceptado`, `facturaEstado: Emitida` y el MISMO `codigoGeneracion` del caso 3.3.",
        criterio: "Código 200, estado Emitida y `codigoGeneracion` igual al de 3.3.",
      },
      test: esperaErp({
        http: 200,
        ok: true,
        resultado: "aceptado",
        facturaEstado: "Emitida",
        extra: [
          prueba(
            "conserva el codigoGeneracion del caso 3.3",
            'pm.expect(j.codigoGeneracion).to.eql(pm.collectionVariables.get("cg_erp_rechazo"));',
          ),
        ],
      }),
    }),
    item({
      id: "3.5",
      nombre: "Solicitud inválida (factura sin ítems) → 400",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [...preErp("erp_sin_items", "{}", "cuerpo.factura.items = [];")],
      doc: {
        objetivo:
          "Demostrar el error de validación del ERP ante una solicitud que incumple el formato (sin ítems).",
        entrada: "Factura con `items: []`.",
        esperado: "HTTP 400, `error: solicitud_invalida` y una lista de `detalles`.",
        criterio: "Código 400, `error` igual a `solicitud_invalida` y al menos un detalle.",
      },
      test: esperaErp({
        http: 400,
        ok: false,
        error: "solicitud_invalida",
        extra: [
          prueba(
            "incluye detalles de validación",
            "pm.expect(j.detalles).to.be.an('array').that.is.not.empty;",
          ),
        ],
      }),
    }),
    item({
      id: "3.6",
      nombre: "Solicitud mal estructurada (JSON mal formado) → 400",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      cuerpo: "{no es json",
      doc: {
        objetivo: "Demostrar el error de validación del ERP ante un cuerpo que no es JSON.",
        entrada: "Cuerpo `{no es json`.",
        esperado: "HTTP 400, `error: cuerpo_invalido`.",
        criterio: "Código 400 y `error` igual a `cuerpo_invalido`.",
      },
      test: esperaErp({ http: 400, ok: false, error: "cuerpo_invalido" }),
    }),
    // --- Servicio caído ---
    escenario("3.7a", "indisponible", "Simula que Hacienda no está disponible."),
    item({
      id: "3.7b",
      nombre: "Servicio indisponible: emitir → Pendiente de envío (3 envíos y 3 consultas)",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [
        ...preErp("erp_caida"),
        'pm.collectionVariables.set("fac_id_caida", cuerpo.factura.id);',
      ],
      doc: {
        objetivo:
          "Demostrar el error de comunicación visto desde el ERP y la política oficial de reintentos (consultar estado, reenviar hasta 2 veces, dejar pendiente).",
        entrada: "Factura válida emitida con la simulación en modo `indisponible`.",
        esperado:
          "HTTP 502, `ok: false`, `resultado: servicio_no_disponible`, `facturaEstado: Pendiente de envío`, 3 envíos y 3 consultas.",
        criterio:
          "Código 502; resultado y estado como se indica; exactamente 3 envíos (1 + 2 reintentos) y 3 consultas.",
      },
      test: esperaErp({
        http: 502,
        ok: false,
        resultado: "servicio_no_disponible",
        facturaEstado: "Pendiente de envío",
        envios: 3,
        consultas: 3,
        extra: ['pm.collectionVariables.set("cg_erp_caida", j.codigoGeneracion);'],
      }),
    }),
    escenario("3.7c", "normal", "Restablece el servicio."),
    item({
      id: "3.7d",
      nombre: "Restablecido el servicio, reintentar la misma factura → Emitida",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: ['pm.request.body.update(pm.collectionVariables.get("erp_caida"));'],
      doc: {
        objetivo:
          "Demostrar que una factura pendiente se emite al reintentar cuando el servicio vuelve, conservando su `codigoGeneracion`.",
        entrada: "El mismo cuerpo exacto del caso 3.7b.",
        esperado:
          "HTTP 200, `resultado: aceptado`, `facturaEstado: Emitida`, 1 envío y el MISMO `codigoGeneracion` del caso 3.7b.",
        criterio: "Código 200, estado Emitida, 1 envío y `codigoGeneracion` igual al de 3.7b.",
      },
      test: esperaErp({
        http: 200,
        ok: true,
        resultado: "aceptado",
        facturaEstado: "Emitida",
        envios: 1,
        consultas: 0,
        extra: [
          prueba(
            "conserva el codigoGeneracion del intento fallido",
            'pm.expect(j.codigoGeneracion).to.eql(pm.collectionVariables.get("cg_erp_caida"));',
          ),
        ],
      }),
    }),
    // --- Respuesta tardía ---
    escenario(
      "3.8a",
      "timeout_procesado",
      "Hacienda recibirá el documento pero responderá demasiado tarde.",
    ),
    item({
      id: "3.8b",
      nombre: "Hacienda recibió pero respondió tarde → se recupera por consulta (≈5 s)",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [...preErp("erp_tardia")],
      doc: {
        objetivo:
          "Demostrar la política oficial: si no hay respuesta en 5 s, primero se CONSULTA el estado antes de reenviar, evitando un documento duplicado.",
        entrada:
          "Factura válida con la simulación en modo `timeout_procesado` (procesa y guarda el documento, pero responde después del umbral).",
        esperado:
          "HTTP 200, `resultado: aceptado`, `recuperadoPorConsulta: true`, 1 envío y 1 consulta, tras ≈5 s de espera.",
        criterio:
          "Código 200, `recuperadoPorConsulta` verdadero, exactamente 1 envío (no se reenvió) y 1 consulta; tiempo de respuesta de al menos 4.8 s.",
      },
      test: esperaErp({
        http: 200,
        ok: true,
        resultado: "aceptado",
        facturaEstado: "Emitida",
        envios: 1,
        consultas: 1,
        recuperadoPorConsulta: true,
        extra: [
          prueba(
            "esperó el umbral de 5 s antes de consultar",
            "pm.expect(pm.response.responseTime).to.be.above(4800);",
          ),
        ],
      }),
    }),
    escenario("3.8c", "normal", "Restablece el servicio."),
    item({
      id: "3.8d",
      nombre: "Volver a emitir esa factura no genera un duplicado",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: ['pm.request.body.update(pm.collectionVariables.get("erp_tardia"));'],
      doc: {
        objetivo:
          "Comprobar que, tras recuperarla por consulta, volver a emitir la factura no la envía otra vez.",
        entrada: "El mismo cuerpo exacto del caso 3.8b.",
        esperado: "HTTP 200, `yaEmitida: true` y 0 envíos.",
        criterio: "Código 200, `yaEmitida` verdadero y `envios` 0.",
      },
      test: esperaErp({ http: 200, ok: true, yaEmitida: true, envios: 0 }),
    }),
    // --- Sin respuesta ---
    escenario("3.9a", "timeout", "Hacienda no responderá ni procesará el documento."),
    item({
      id: "3.9b",
      nombre: "Sin respuesta: emitir → Pendiente tras ≈15 s (3 envíos de 5 s)",
      ruta: URL_TRANSMITIR,
      cabeceras: cabErp,
      pre: [...preErp("erp_sinrespuesta")],
      doc: {
        objetivo:
          "Demostrar el agotamiento de la política de reintentos cuando el servicio nunca responde.",
        entrada: "Factura válida con la simulación en modo `timeout`.",
        esperado:
          "HTTP 504, `ok: false`, `resultado: sin_respuesta`, `facturaEstado: Pendiente de envío`, 3 envíos y 3 consultas, tras ≈15 s.",
        criterio:
          "Código 504; resultado y estado como se indica; 3 envíos y 3 consultas; tiempo de respuesta de al menos 14 s.",
      },
      test: esperaErp({
        http: 504,
        ok: false,
        resultado: "sin_respuesta",
        facturaEstado: "Pendiente de envío",
        envios: 3,
        consultas: 3,
        extra: [
          prueba(
            "esperó 3 umbrales de 5 s",
            "pm.expect(pm.response.responseTime).to.be.above(14000);",
          ),
          'pm.collectionVariables.set("fac_id_sinrespuesta", JSON.parse(pm.collectionVariables.get("erp_sinrespuesta")).factura.id);',
        ],
      }),
    }),
    escenario("3.9c", "normal", "Restablece el servicio."),
    item({
      id: "3.9d",
      nombre: "Consultar estado: Hacienda no tiene ese documento",
      ruta: URL_CONSULTAR_ERP,
      cabeceras: cabErp,
      pre: [
        'pm.request.body.update(JSON.stringify({ facturaId: pm.collectionVariables.get("fac_id_sinrespuesta") }));',
      ],
      doc: {
        objetivo:
          "Comprobar que la consulta de estado confirma que un documento que nunca llegó a Hacienda no existe allí.",
        entrada: "`{ facturaId }` de la factura del caso 3.9b.",
        esperado: "HTTP 200, `ok: true` y `encontrado: false`.",
        criterio: "Código 200 y `encontrado` falso.",
      },
      test: [
        prueba("HTTP 200", "pm.response.to.have.status(200);"),
        "const j = pm.response.json();",
        prueba("ok = true", "pm.expect(j.ok).to.eql(true);"),
        prueba("encontrado = false", "pm.expect(j.encontrado).to.eql(false);"),
      ],
    }),
    // --- Consultas e historial ---
    item({
      id: "3.10",
      nombre: "Consultar estado de una factura emitida",
      ruta: URL_CONSULTAR_ERP,
      cabeceras: cabErp,
      pre: [
        'pm.request.body.update(JSON.stringify({ facturaId: pm.collectionVariables.get("fac_id_valida") }));',
      ],
      doc: {
        objetivo: "Demostrar la consulta posterior del resultado de una factura ya emitida.",
        entrada: "`{ facturaId }` de la factura del caso 3.1.",
        esperado:
          "HTTP 200, `encontrado: true`, `estado: PROCESADO` y el mismo sello del caso 3.1.",
        criterio: "Código 200, documento encontrado y `selloRecibido` igual al de 3.1.",
      },
      test: [
        prueba("HTTP 200", "pm.response.to.have.status(200);"),
        "const j = pm.response.json();",
        prueba("encontrado = true", "pm.expect(j.encontrado).to.eql(true);"),
        prueba("estado = PROCESADO", 'pm.expect(j.estado).to.eql("PROCESADO");'),
        prueba(
          "mismo sello que en 3.1",
          'pm.expect(j.selloRecibido).to.eql(pm.collectionVariables.get("sello_erp_valida"));',
        ),
      ],
    }),
    item({
      id: "3.11",
      nombre: "Consultar una factura desconocida → 404",
      ruta: URL_CONSULTAR_ERP,
      cabeceras: cabErp,
      cuerpo: j({ facturaId: "FAC-NO-EXISTE" }),
      doc: {
        objetivo: "Demostrar la respuesta ante una factura sin ninguna transmisión registrada.",
        entrada: '`{ facturaId: "FAC-NO-EXISTE" }`.',
        esperado: "HTTP 404 con `motivo: desconocida`.",
        criterio: "Código 404 y `motivo` igual a `desconocida`.",
      },
      test: [
        prueba("HTTP 404", "pm.response.to.have.status(404);"),
        prueba(
          "motivo = desconocida",
          'pm.expect(pm.response.json().motivo).to.eql("desconocida");',
        ),
      ],
    }),
    item({
      id: "3.12",
      nombre: "Historial de envíos de una factura",
      metodo: "GET",
      ruta: "/api/erp/dte/transmisiones?facturaId={{fac_id_valida}}",
      cabeceras: [],
      cuerpo: null,
      doc: {
        objetivo: "Demostrar el registro y la consulta del historial de envíos.",
        entrada: "GET con `facturaId` de la factura del caso 3.1.",
        esperado: "HTTP 200 con una transmisión: la del caso 3.1, resultado `aceptado`.",
        criterio: "Código 200, `total` 1, el `id` de la transmisión coincide con el de 3.1.",
      },
      test: [
        prueba("HTTP 200", "pm.response.to.have.status(200);"),
        "const j = pm.response.json();",
        prueba("una sola transmisión", "pm.expect(j.total).to.eql(1);"),
        prueba(
          "es la transmisión del caso 3.1",
          'pm.expect(j.transmisiones[0].id).to.eql(pm.collectionVariables.get("trx_id_valida"));',
        ),
        prueba(
          "resultado = aceptado",
          'pm.expect(j.transmisiones[0].resultado).to.eql("aceptado");',
        ),
      ],
    }),
    item({
      id: "3.13",
      nombre: "Detalle de una transmisión (DTE enviado e intentos)",
      metodo: "GET",
      ruta: "/api/erp/dte/transmisiones/{{trx_id_valida}}",
      cabeceras: [],
      cuerpo: null,
      doc: {
        objetivo:
          "Demostrar que se conserva el DTE enviado y cada intento (fecha, estado HTTP, respuesta).",
        entrada: "GET de la transmisión del caso 3.1.",
        esperado:
          "HTTP 200, `estadoProceso: finalizada`, el DTE con el mismo `codigoGeneracion` y 1 intento.",
        criterio:
          "Código 200, estado finalizada, `codigoGeneracion` del DTE igual al de 3.1 y 1 intento con HTTP 200.",
      },
      test: [
        prueba("HTTP 200", "pm.response.to.have.status(200);"),
        "const j = pm.response.json();",
        prueba("estadoProceso = finalizada", 'pm.expect(j.estadoProceso).to.eql("finalizada");'),
        prueba(
          "el DTE guardado tiene el codigoGeneracion de 3.1",
          'pm.expect(j.dte.identificacion.codigoGeneracion).to.eql(pm.collectionVariables.get("cg_erp_valida"));',
        ),
        prueba(
          "un intento, con HTTP 200",
          "pm.expect(j.intentos).to.have.lengthOf(1); pm.expect(j.intentos[0].httpStatus).to.eql(200);",
        ),
      ],
    }),
    item({
      id: "3.14",
      nombre: "Detalle de una transmisión inexistente → 404",
      metodo: "GET",
      ruta: "/api/erp/dte/transmisiones/TRX-9999",
      cabeceras: [],
      cuerpo: null,
      doc: {
        objetivo: "Demostrar la respuesta ante un identificador de transmisión que no existe.",
        entrada: "GET de `TRX-9999`.",
        esperado: "HTTP 404.",
        criterio: "Código 404.",
      },
      test: [prueba("HTTP 404", "pm.response.to.have.status(404);")],
    }),
    // --- Seguridad del ERP ---
    item({
      id: "3.15",
      nombre: "Petición desde otro sitio (CSRF) → 403",
      ruta: URL_TRANSMITIR,
      cabeceras: [JSON_CT, { key: "Origin", value: "http://evil.example" }],
      pre: [...preErp("erp_csrf")],
      doc: {
        objetivo:
          "Comprobar que el ERP rechaza peticiones que un navegador envía desde otro sitio web.",
        entrada: "Factura válida con el encabezado `Origin: http://evil.example`.",
        esperado: "HTTP 403, `error: origen_no_permitido`; la factura NO se procesa.",
        criterio: "Código 403 y `error` igual a `origen_no_permitido`.",
      },
      test: esperaErp({ http: 403, ok: false, error: "origen_no_permitido" }),
    }),
    item({
      id: "3.16",
      nombre: "Cuerpo que no es JSON (text/plain) → 415",
      ruta: URL_TRANSMITIR,
      cabeceras: [{ key: "Content-Type", value: "text/plain" }],
      pre: [...preErp("erp_texto")],
      doc: {
        objetivo:
          "Comprobar que el ERP exige `application/json` (un formulario de otro sitio solo puede enviar `text/plain`).",
        entrada: "Factura válida enviada con `Content-Type: text/plain`.",
        esperado: "HTTP 415, `error: tipo_contenido_invalido`.",
        criterio: "Código 415 y `error` igual a `tipo_contenido_invalido`.",
      },
      test: esperaErp({ http: 415, ok: false, error: "tipo_contenido_invalido" }),
    }),
  ],
};

const carpeta4 = {
  name: "4. Cierre",
  item: [escenario("4.1", "normal", "Deja la simulación en su estado normal al terminar.")],
};

// ---------------------------------------------------------------------------------------------
// Colección y entorno
// ---------------------------------------------------------------------------------------------
const preColeccion = [
  "// Si la petición necesita token y no hay uno vigente, se autentica automáticamente",
  "// (así cada request puede ejecutarse por separado). Las credenciales son FICTICIAS.",
  "if (!/^0\\.1 /.test(pm.info.requestName)) {",
  '  const vence = Number(pm.collectionVariables.get("token_vence") || 0);',
  '  if (!pm.collectionVariables.get("token") || Date.now() > vence) {',
  "    pm.sendRequest({",
  '      url: pm.environment.get("base_url") + "/api/hacienda-sim/auth",',
  '      method: "POST",',
  '      header: { "Content-Type": "application/x-www-form-urlencoded" },',
  '      body: { mode: "urlencoded", urlencoded: [',
  '        { key: "user", value: pm.environment.get("hacienda_user") },',
  '        { key: "pwd", value: pm.environment.get("hacienda_pwd") },',
  "      ] },",
  "    }, function (err, res) {",
  "      if (err || !res) return;",
  "      const cuerpo = res.json();",
  '      if (cuerpo && cuerpo.status === "OK") {',
  '        pm.collectionVariables.set("token", cuerpo.body.token);',
  '        pm.collectionVariables.set("token_vence", String(Date.now() + 30 * 60 * 1000));',
  "      }",
  "    });",
  "  }",
  "}",
];

const coleccion = {
  info: {
    name: "AdvWork-ERP — Simulación de la API de Hacienda (DTE)",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: [
      "Pruebas de la **simulación académica** de la comunicación con el Ministerio de Hacienda (recepción de DTE de Factura) y del backend del ERP que la usa.",
      "",
      "**No es una integración real**: no hay credenciales, certificados ni endpoints reales. Todos los usuarios, contraseñas y claves son FICTICIOS.",
      "",
      "Cómo usarla: importa también el entorno `AdvWork-ERP-local`, selecciónalo, arranca el proyecto (`bun dev`) y ejecuta la colección completa con el *Runner* (en orden). Cada carpeta deja la simulación en modo `normal` al terminar.",
      "",
      "Los casos 1.15b, 3.8b y 3.9b esperan el umbral oficial de 5 s por intento (≈6 s, ≈5 s y ≈15 s).",
    ].join("\n"),
  },
  event: [{ listen: "prerequest", script: { type: "text/javascript", exec: preColeccion } }],
  variable: [
    { key: "helpers", value: helpers },
    { key: "token", value: "" },
    { key: "token_vence", value: "0" },
  ],
  item: [carpeta0, carpeta1, carpeta2, carpeta3, carpeta4],
};

const entorno = {
  id: "advwork-erp-local",
  name: "AdvWork-ERP local",
  values: [
    { key: "base_url", value: "http://127.0.0.1:8080", type: "default", enabled: true },
    { key: "hacienda_user", value: "SIM-FACTURADOR-01", type: "default", enabled: true },
    { key: "hacienda_pwd", value: "SIM-NO-REAL-Pwd#2026", type: "secret", enabled: true },
    { key: "firma_secret", value: "dev-only-firma-secret-NOT-REAL", type: "secret", enabled: true },
    { key: "nit_emisor", value: "06140000000001", type: "default", enabled: true },
  ],
  _postman_variable_scope: "environment",
};

writeFileSync(
  new URL("AdvWork-ERP-Hacienda-DTE.postman_collection.json", AQUI),
  JSON.stringify(coleccion, null, 2) + "\n",
);
writeFileSync(
  new URL("AdvWork-ERP-local.postman_environment.json", AQUI),
  JSON.stringify(entorno, null, 2) + "\n",
);

const todos = [carpeta0, carpeta1, carpeta2, carpeta3, carpeta4].flatMap((c) => c.item);
const casos = todos.filter((i) => i.request.description.startsWith("**Tipo:** caso"));
console.log(
  `Colección generada: ${todos.length} requests (${casos.length} casos de prueba, ${todos.length - casos.length} pasos de preparación).`,
);
