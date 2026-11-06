/*
 * Helpers compartidos por los scripts de la colección de Postman.
 *
 * Postman no permite compartir funciones entre requests, así que `construir.mjs` guarda este
 * archivo COMPLETO en la variable de colección `helpers` y cada script lo carga con:
 *     const H = eval(pm.collectionVariables.get("helpers"));
 *
 * Es una expresión que devuelve un objeto (por eso va envuelta en una función autoejecutable).
 * Usa solo lo que trae el sandbox de Postman/Newman: CryptoJS, Intl, JSON, Math.
 *
 * SIMULACIÓN ACADÉMICA: la "firma" es un JWS con HMAC-SHA512 y una clave de PRUEBA
 * (variable de entorno `firma_secret`); no es una firma electrónica certificada.
 */
(function () {
  function r2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // base64url de un WordArray de CryptoJS (sin relleno "=", con - y _ en lugar de + y /)
  function b64url(wordArray) {
    return CryptoJS.enc.Base64.stringify(wordArray)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // JWS compacto: base64url(cabecera).base64url(carga).base64url(HMAC-SHA512)
  function firmar(objeto, secreto) {
    var h = b64url(CryptoJS.enc.Utf8.parse(JSON.stringify({ alg: "HS512", typ: "JWT" })));
    var p = b64url(CryptoJS.enc.Utf8.parse(JSON.stringify(objeto)));
    return h + "." + p + "." + b64url(CryptoJS.HmacSHA512(h + "." + p, secreto));
  }

  // UUID v4 en MAYÚSCULAS, formato exigido para codigoGeneracion e idEnvio
  function uuid(pm) {
    return pm.variables.replaceIn("{{$guid}}").toUpperCase();
  }

  // Fecha y hora actuales en El Salvador. El sandbox de Postman/Newman NO expone `Intl`, así que se
  // calcula con un desplazamiento fijo: El Salvador está en UTC-6 todo el año (no usa horario de verano).
  function fechaHoraSV() {
    var d = new Date(Date.now() - 6 * 60 * 60 * 1000);
    function dos(n) {
      return ("0" + n).slice(-2);
    }
    return {
      fecEmi: d.getUTCFullYear() + "-" + dos(d.getUTCMonth() + 1) + "-" + dos(d.getUTCDate()),
      horEmi: dos(d.getUTCHours()) + ":" + dos(d.getUTCMinutes()) + ":" + dos(d.getUTCSeconds()),
    };
  }

  // Correlativo único por ejecución (15 dígitos en el número de control)
  function siguienteCorrelativo(pm) {
    var n = Number(pm.collectionVariables.get("correlativo") || Date.now() % 1e9) + 1;
    pm.collectionVariables.set("correlativo", String(n));
    return n;
  }

  // DTE de Factura (tipo 01, esquema oficial fe-f-v2) VÁLIDO: 2 líneas, total $226.00
  function dteValido(pm) {
    var t = fechaHoraSV();
    var n = siguienteCorrelativo(pm);
    return {
      identificacion: {
        version: 2,
        ambiente: "00",
        tipoDte: "01",
        numeroControl: "DTE-01-M001P001-" + ("000000000000000" + n).slice(-15),
        codigoGeneracion: uuid(pm),
        tipoModelo: 1,
        tipoOperacion: 1,
        fecEmi: t.fecEmi,
        horEmi: t.horEmi,
        tipoMoneda: "USD",
        tipoContingencia: null,
        motivoContin: null,
      },
      documentoRelacionado: null,
      emisor: {
        nit: pm.environment.get("nit_emisor"),
        nrc: "1234567",
        nombre: "Adventure Works S.A. de C.V. (SIMULADO)",
        codActividad: "46900",
        descActividad: "Venta de bicicletas y accesorios (simulado)",
        nombreComercial: "AdvWork",
        telefono: "22000000",
        correo: "facturacion@advwork.example",
        codEstable: "M001",
        codPuntoVenta: "P001",
        direccion: {
          departamento: "06",
          municipio: "14",
          distrito: "01",
          complemento: "San Salvador",
        },
      },
      receptor: {
        tipoDocumento: "13",
        numDocumento: "04512398-7",
        nrc: null,
        nombre: "Maria Fernanda Rivas",
        codActividad: null,
        descActividad: null,
        telefono: "78451203",
        correo: "mf.rivas@correo.com",
        direccion: {
          departamento: "06",
          municipio: "14",
          distrito: "01",
          complemento: "Col. Escalon",
        },
      },
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento: [
        {
          numItem: 1,
          tipoItem: 1,
          numeroDocumento: null,
          codigo: "BK-T79U-50",
          codTributo: null,
          descripcion: "Bicicleta de montana T79U 50",
          cantidad: 1,
          uniMedida: 59,
          precioUni: 113,
          montoDescu: 0,
          ventaNoSuj: 0,
          ventaExenta: 0,
          ventaGravada: 113,
          tributos: null,
          psv: 0,
          noGravado: 0,
          ivaItem: 13,
        },
        {
          numItem: 2,
          tipoItem: 1,
          numeroDocumento: null,
          codigo: "GL-H102-L",
          codTributo: null,
          descripcion: "Guantes H102 L",
          cantidad: 2,
          uniMedida: 59,
          precioUni: 56.5,
          montoDescu: 0,
          ventaNoSuj: 0,
          ventaExenta: 0,
          ventaGravada: 113,
          tributos: null,
          psv: 0,
          noGravado: 0,
          ivaItem: 13,
        },
      ],
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: 226,
        subTotalVentas: 226,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: 0,
        tributos: null,
        subTotal: 226,
        ivaRete: 0,
        montoTotalOperacion: 226,
        totalNoGravado: 0,
        totalPagar: 226,
        totalLetras: "DOSCIENTOS VEINTISEIS 00/100 USD",
        totalIva: 26,
        saldoFavor: 0,
        condicionOperacion: 1,
        pagos: null,
        numPagoElectronico: null,
        observaciones: null,
      },
      apendice: null,
    };
  }

  // Un solo ítem por un importe dado (IVA del 13 % incluido en el precio), con totales coherentes
  function conImporte(dte, importe) {
    var iva = r2((importe / 1.13) * 0.13);
    var linea = dte.cuerpoDocumento[0];
    linea.cantidad = 1;
    linea.precioUni = importe;
    linea.ventaGravada = importe;
    linea.ivaItem = iva;
    dte.cuerpoDocumento = [linea];
    var r = dte.resumen;
    r.totalGravada = importe;
    r.subTotalVentas = importe;
    r.subTotal = importe;
    r.montoTotalOperacion = importe;
    r.totalPagar = importe;
    r.totalIva = iva;
    return dte;
  }

  // Petición de recepción: el DTE viaja FIRMADO en `documento`. `extras` sobrescribe campos
  // (un valor `undefined` elimina el campo).
  function peticion(pm, dte, extras) {
    var p = {
      ambiente: "00",
      idEnvio: uuid(pm),
      version: 2,
      tipoDte: "01",
      codigoGeneracion: dte.identificacion ? dte.identificacion.codigoGeneracion : undefined,
      documento: firmar(dte, pm.environment.get("firma_secret")),
    };
    var claves = Object.keys(extras || {});
    for (var i = 0; i < claves.length; i++) {
      if (extras[claves[i]] === undefined) delete p[claves[i]];
      else p[claves[i]] = extras[claves[i]];
    }
    return p;
  }

  // Cuerpo para el backend del ERP: { factura, cliente }. Genera un id de factura único.
  function facturaErp(pm, opciones) {
    var o = opciones || {};
    var n = Number(pm.collectionVariables.get("seq_factura") || 0) + 1;
    pm.collectionVariables.set("seq_factura", String(n));
    var marca = Date.now().toString(36).toUpperCase();
    return {
      factura: {
        id: "FAC-PM-" + marca + "-" + n,
        folio: String((Date.now() % 1e9) + n),
        pedidoId: "PED-PM-" + n,
        items: [
          {
            codigo: "BK-T79U-50",
            nombre: "Bicicleta T79U",
            cantidad: 1,
            precio: 100,
            descuento: 0,
          },
          { codigo: "GL-H102-L", nombre: "Guantes H102", cantidad: 2, precio: 50, descuento: 10 },
        ],
      },
      cliente: {
        nombre: "Maria Fernanda Rivas",
        documento: o.documento || "04512398-7",
        direccion: "Col. Escalon, San Salvador",
        telefono: "78451203",
        correo: "mf.rivas@correo.com",
      },
    };
  }

  return {
    r2: r2,
    b64url: b64url,
    firmar: firmar,
    uuid: uuid,
    dteValido: dteValido,
    conImporte: conImporte,
    peticion: peticion,
    facturaErp: facturaErp,
  };
})();
