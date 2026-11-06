/**
 * Pruebas de TLS del cliente del ERP hacia Hacienda, con un servidor HTTPS REAL y un
 * certificado autofirmado generado con openssl (requiere `openssl` instalado).
 *
 * Demuestra qué protege TLS en la práctica:
 *   - Autenticidad del servidor: un certificado que no está firmado por una CA de confianza
 *     se rechaza (un atacante intermedio no puede hacerse pasar por Hacienda).
 *   - Identidad: un certificado válido pero emitido para OTRO nombre también se rechaza.
 *   - Confidencialidad/integridad: solo viaja por un canal cifrado verificado.
 *   - Que el código NUNCA desactiva la verificación (NODE_TLS_REJECT_UNAUTHORIZED, rejectUnauthorized).
 *
 * Ejecutar desde la raíz del repo:  npx tsx --test scripts/erp-tls-test.ts
 */
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { crearClienteHacienda } from "../src/backend/erp-dte/hacienda-client";
import type { ErpDteConfig } from "../src/backend/erp-dte/config";

const execFileAsync = promisify(execFile);
const RAIZ = process.cwd();
const dir = mkdtempSync(path.join(tmpdir(), "erp-tls-"));
const clave = path.join(dir, "key.pem");
const cert = path.join(dir, "cert.pem");

let servidor: https.Server;
let puerto = 0;
const peticiones: string[] = [];

before(async () => {
  // Certificado autofirmado SOLO para DNS:localhost (no incluye la IP 127.0.0.1).
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      clave,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
    ],
    { stdio: "ignore" },
  );
  servidor = https.createServer(
    { key: readFileSync(clave), cert: readFileSync(cert) },
    (req, res) => {
      peticiones.push(`${req.method} ${req.url}`);
      let cuerpo = "";
      req.on("data", (d) => (cuerpo += d));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/auth") {
          // JWT mínimo con exp lejano (el cliente solo lee `exp`).
          const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
          res.end(
            JSON.stringify({
              status: "OK",
              body: { token: `Bearer ${b64({ alg: "HS512" })}.${b64({ exp: 9999999999 })}.x` },
            }),
          );
        } else {
          res.end(JSON.stringify({ estado: "PROCESADO", codigoMsg: "001" }));
        }
      });
    },
  );
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  puerto = (servidor.address() as AddressInfo).port;
});
after(() => servidor.close());

const cfg: ErpDteConfig = {
  apiUrl: undefined,
  user: "u",
  pwd: "p",
  firmaSecret: "f",
  timeoutMs: 3000,
  maxReintentos: 0,
  dataDir: "data",
  origenesPermitidos: [],
  hostsPermitidos: [],
};

/**
 * Ejecuta el cliente REAL en un proceso hijo, con o sin la CA de confianza.
 * Debe ser ASÍNCRONO: el servidor HTTPS vive en este proceso y un spawnSync bloquearía su bucle
 * de eventos (el hijo nunca recibiría respuesta).
 */
async function enviarDesdeHijo(baseUrl: string, confiarEnCa: boolean) {
  const modulo = pathToFileURL(path.join(RAIZ, "src/backend/erp-dte/hacienda-client.ts")).href;
  const codigo = `(async()=>{const m=await import(${JSON.stringify(modulo)});
    const c=m.crearClienteHacienda({baseUrl:${JSON.stringify(baseUrl)},cfg:${JSON.stringify(cfg)}});
    console.log("RESULTADO="+JSON.stringify(await c.enviar({})));})()`;
  const env = { ...process.env };
  delete env["NODE_EXTRA_CA_CERTS"];
  delete env["NODE_TLS_REJECT_UNAUTHORIZED"];
  if (confiarEnCa) env["NODE_EXTRA_CA_CERTS"] = cert; // se lee al ARRANCAR el proceso
  const r = await execFileAsync("npx", ["--yes", "tsx", "-e", codigo], { env, cwd: RAIZ }).catch(
    (e: { stdout?: string; stderr?: string }) => ({
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    }),
  );
  const linea = r.stdout.split("\n").find((l) => l.startsWith("RESULTADO="));
  assert.ok(linea, `el proceso hijo no devolvió resultado: ${r.stderr}`);
  return JSON.parse(linea.slice("RESULTADO=".length)) as {
    tipo: string;
    status?: number;
    mensaje?: string;
  };
}

test("TLS: un certificado autofirmado NO se acepta (el cliente no desactiva la verificación)", async () => {
  peticiones.length = 0;
  const r = await crearClienteHacienda({ baseUrl: `https://localhost:${puerto}`, cfg }).enviar({});
  assert.equal(r.tipo, "red", "debe fallar como error de red, no como respuesta");
  assert.equal(
    peticiones.length,
    0,
    "el servidor no debió recibir NI el usuario/contraseña: el handshake falló antes",
  );

  // Causa concreta (se consulta fetch directamente para ver el código de error de TLS).
  const causa = await fetch(`https://localhost:${puerto}/auth`).then(
    () => "sin error",
    (e: { cause?: { code?: string } }) => e.cause?.code,
  );
  assert.match(String(causa), /SELF_SIGNED|UNABLE_TO_VERIFY|CERT/);
});

test("TLS: con la CA en la que se confía, la comunicación funciona y viaja cifrada", async () => {
  peticiones.length = 0;
  const r = await enviarDesdeHijo(`https://localhost:${puerto}`, true);
  assert.deepEqual([r.tipo, r.status], ["respuesta", 200]);
  assert.deepEqual(peticiones, ["POST /auth", "POST /fesv/recepciondte"]);
});

test("TLS: un certificado válido pero emitido para OTRO nombre (127.0.0.1) se rechaza", async () => {
  peticiones.length = 0;
  const r = await enviarDesdeHijo(`https://127.0.0.1:${puerto}`, true); // CA confiable, pero el cert es solo para 'localhost'
  assert.equal(r.tipo, "red");
  assert.equal(peticiones.length, 0, "no debió llegar nada al servidor: la identidad no coincide");
});

test("TLS: el código fuente nunca desactiva la verificación de certificados", () => {
  const prohibido =
    /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized\s*:\s*false|strictSSL\s*:\s*false/;
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const nombre of readdirSync(d)) {
      const ruta = path.join(d, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx|mjs|js)$/.test(nombre) && !ruta.endsWith("erp-tls-test.ts"))
        archivos.push(ruta);
    }
  };
  recorrer(path.join(RAIZ, "src"));
  recorrer(path.join(RAIZ, "scripts"));
  assert.ok(archivos.length > 20, "el recorrido debe cubrir el código");
  const infractores = archivos.filter((f) => prohibido.test(readFileSync(f, "utf8")));
  assert.deepEqual(infractores, []);
});
