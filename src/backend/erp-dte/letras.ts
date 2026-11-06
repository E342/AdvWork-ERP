/**
 * Importe en letras para el campo `totalLetras` del DTE.
 * Ej.: 226 -> "DOSCIENTOS VEINTISEIS 00/100 USD".
 * Soporta de 0 a 999 999 999.99 (suficiente para el alcance del proyecto).
 */
const BAJOS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISEIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDOS",
  "VEINTITRES",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISEIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];
const DECENAS = [
  "",
  "",
  "",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];
const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]!);
  if (r > 0) {
    if (r < 30) partes.push(BAJOS[r]!);
    else {
      const d = DECENAS[Math.floor(r / 10)]!;
      partes.push(r % 10 === 0 ? d : `${d} Y ${BAJOS[r % 10]}`);
    }
  }
  return partes.join(" ");
}

// "UNO" -> "UN" delante de MIL / MILLONES (p. ej. VEINTIUN MIL, TREINTA Y UN MIL).
const apocopar = (s: string): string => s.replace(/UNO$/, "UN");

function entero(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLON" : `${apocopar(menorQueMil(millones))} MILLONES`);
  }
  if (miles > 0) partes.push(miles === 1 ? "MIL" : `${apocopar(menorQueMil(miles))} MIL`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(" ");
}

export function totalALetras(importe: number): string {
  if (!Number.isFinite(importe) || importe < 0 || importe >= 1_000_000_000) {
    throw new RangeError("Importe fuera de rango para convertir a letras");
  }
  const centavosTotales = Math.round(importe * 100);
  const parteEntera = Math.floor(centavosTotales / 100);
  const centavos = String(centavosTotales % 100).padStart(2, "0");
  return `${entero(parteEntera)} ${centavos}/100 USD`;
}
