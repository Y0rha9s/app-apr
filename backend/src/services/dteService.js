const forge = require('node-forge');
const { create } = require('xmlbuilder2');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

// ─── CARGAR CERTIFICADO .pfx ─────────────────────────────────────────────────
const cargarCertificado = () => {
  const pfxPath = path.join(__dirname, '../assets/certificado.pfx');
  const pfxPassword = process.env.PFX_PASSWORD || '';
  
  const pfxBuffer = fs.readFileSync(pfxPath);
  const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pfxPassword);

  let privateKey, certificate;

  for (const safeContents of pfx.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKey = safeBag.key;
      }
      if (safeBag.type === forge.pki.oids.certBag) {
        certificate = safeBag.cert;
      }
    }
  }

  return { privateKey, certificate };
};

// ─── OBTENER SIGUIENTE FOLIO ──────────────────────────────────────────────────
const obtenerSiguienteFolio = async (tipoDte) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(`
      SELECT id, folio_actual, folio_hasta, xml_caf
      FROM caf_folios 
      WHERE tipo_dte = $1 AND activo = TRUE AND folio_actual <= folio_hasta
      ORDER BY folio_desde ASC
      LIMIT 1
      FOR UPDATE
    `, [tipoDte]);

    if (!rows[0]) throw new Error(`Sin folios disponibles para tipo DTE ${tipoDte}`);

    const caf = rows[0];
    const folio = caf.folio_actual;

    await client.query(`
      UPDATE caf_folios 
      SET folio_actual = folio_actual + 1,
          activo = CASE WHEN folio_actual + 1 > folio_hasta THEN FALSE ELSE TRUE END
      WHERE id = $1
    `, [caf.id]);

    await client.query('COMMIT');
    return { folio, xmlCaf: caf.xml_caf };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── PARSEAR CAF XML ──────────────────────────────────────────────────────────
const parsearCAF = (xmlCaf) => {
  // Extraer datos del CAF para incluir en el TED
  const match = {
    modulo: xmlCaf.match(/<M>(.*?)<\/M>/s)?.[1]?.trim(),
    exponente: xmlCaf.match(/<E>(.*?)<\/E>/s)?.[1]?.trim(),
    idk: xmlCaf.match(/<IDK>(.*?)<\/IDK>/s)?.[1]?.trim(),
    firmaCAF: xmlCaf.match(/<FRMA[^>]*>(.*?)<\/FRMA>/s)?.[1]?.trim(),
    xmlCAFCompleto: xmlCaf.match(/<CAF[^>]*>[\s\S]*?<\/CAF>/)?.[0],
  };
  return match;
};

// ─── GENERAR TED (Timbre Electrónico) ────────────────────────────────────────
const generarTED = (datos, cafData, privateKey) => {
  const { folio, tipoDte, fechaEmision, rutReceptor, razonReceptor, montoTotal, primerItem } = datos;

  const ddContent = 
    `<RE>${datos.rutEmisor}</RE>` +
    `<TD>${tipoDte}</TD>` +
    `<F>${folio}</F>` +
    `<FE>${fechaEmision}</FE>` +
    `<RR>${rutReceptor}</RR>` +
    `<RSR>${razonReceptor}</RSR>` +
    `<MNT>${montoTotal}</MNT>` +
    `<IT1>${primerItem}</IT1>` +
    cafData.xmlCAFCompleto +
    `<TSTED>${new Date().toISOString().replace('Z', '')}</TSTED>`;

  const dd = `<DD>${ddContent}</DD>`;

  // Firmar DD con SHA1withRSA
  const md = forge.md.sha1.create();
  md.update(dd, 'utf8');
  const signature = forge.util.encode64(privateKey.sign(md));

  return `<TED version="1.0"><DD>${ddContent}</DD><FRMT algoritmo="SHA1withRSA">${signature}</FRMT></TED>`;
};

// ─── GENERAR XML DTE TIPO 34 ─────────────────────────────────────────────────
const generarXMLDTE34 = async (boleta, usuario) => {
  const { privateKey, certificate } = cargarCertificado();
  const { folio, xmlCaf } = await obtenerSiguienteFolio(34);
  const cafData = parsearCAF(xmlCaf);

  const fechaEmision = new Date().toISOString().split('T')[0];
  const tmstFirma = new Date().toISOString().replace('Z', '');
  const rutEmisor = '71810200-6';
  const docId = `F${folio}T34`;

  const primerItem = `Suministro Agua Potable ${boleta.periodo}`;

  // Generar TED
  const ted = generarTED({
    folio, tipoDte: 34, fechaEmision,
    rutEmisor,
    rutReceptor: usuario.rut.replace(/\./g, ''),
    razonReceptor: usuario.nombre,
    montoTotal: Math.round(boleta.total_a_pagar),
    primerItem
  }, cafData, privateKey);

  // Construir XML del Documento
  const xmlDocumento = 
    `<Documento ID="${docId}">` +
    `<Encabezado>` +
    `<IdDoc>` +
    `<TipoDTE>34</TipoDTE>` +
    `<Folio>${folio}</Folio>` +
    `<FchEmis>${fechaEmision}</FchEmis>` +
    `<IndServicio>1</IndServicio>` +
    `</IdDoc>` +
    `<Emisor>` +
    `<RUTEmisor>${rutEmisor}</RUTEmisor>` +
    `<RznSoc>COMITE APR SANTA FILOMENA PEDREGOSO</RznSoc>` +
    `<GiroEmis>Suministro de Agua Potable Rural</GiroEmis>` +
    `<DirOrigen>SECTOR VILLA ALEGRE S/N</DirOrigen>` +
    `<CmnaOrigen>Villarrica</CmnaOrigen>` +
    `<CiudadOrigen>Villarrica</CiudadOrigen>` +
    `</Emisor>` +
    `<Receptor>` +
    `<RUTRecep>${usuario.rut.replace(/\./g, '')}</RUTRecep>` +
    `<RznSocRecep>${usuario.nombre}</RznSocRecep>` +
    `<DirRecep>${usuario.direccion || 'S/D'}</DirRecep>` +
    `<CmnaRecep>Villarrica</CmnaRecep>` +
    `<CiudadRecep>Villarrica</CiudadRecep>` +
    `</Receptor>` +
    `<Totales>` +
    `<MntExe>${Math.round(boleta.total_a_pagar)}</MntExe>` +
    `<MntTotal>${Math.round(boleta.total_a_pagar)}</MntTotal>` +
    `</Totales>` +
    `</Encabezado>` +
    `<Detalle>` +
    `<NroLinDet>1</NroLinDet>` +
    `<NmbItem>Cargo Fijo Servicio Agua Potable</NmbItem>` +
    `<QtyItem>1</QtyItem>` +
    `<PrcItem>${Math.round(boleta.total_mes)}</PrcItem>` +
    `<MontoItem>${Math.round(boleta.total_mes)}</MontoItem>` +
    `</Detalle>` +
    (boleta.saldo_anterior > 0 ? 
    `<Detalle>` +
    `<NroLinDet>2</NroLinDet>` +
    `<NmbItem>Saldo Anterior</NmbItem>` +
    `<QtyItem>1</QtyItem>` +
    `<PrcItem>${Math.round(boleta.saldo_anterior)}</PrcItem>` +
    `<MontoItem>${Math.round(boleta.saldo_anterior)}</MontoItem>` +
    `</Detalle>` : '') +
    ted +
    `<TmstFirma>${tmstFirma}</TmstFirma>` +
    `</Documento>`;

  // Firmar el Documento con XMLDSig
  const xmlDteFirmado = firmarDocumento(xmlDocumento, docId, privateKey, certificate);

  return { xmlDteFirmado, folio };
};

// ─── FIRMAR DOCUMENTO XMLDSig ─────────────────────────────────────────────────
const firmarDocumento = (xmlDoc, docId, privateKey, certificate) => {
  // Calcular digest SHA1 del documento canonicalizado
  const md = forge.md.sha1.create();
  md.update(xmlDoc, 'utf8');
  const digestValue = forge.util.encode64(md.digest().getBytes());

  // Calcular firma sobre SignedInfo
  const signedInfo = 
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${docId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfo, 'utf8');
  const signatureValue = forge.util.encode64(privateKey.sign(mdSig));

  const certPem = forge.pki.certificateToPem(certificate)
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '');

  const signature = 
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<KeyValue><RSAKeyValue>` +
    `<Modulus>${forge.util.encode64(forge.util.hexToBytes(privateKey.n.toString(16)))}</Modulus>` +
    `<Exponent>${forge.util.encode64(forge.util.hexToBytes(privateKey.e.toString(16)))}</Exponent>` +
    `</RSAKeyValue></KeyValue>` +
    `<X509Data><X509Certificate>${certPem}</X509Certificate></X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  return `<DTE version="1.0">${xmlDoc}${signature}</DTE>`;
};

// ─── GENERAR ENVIO DTE AL SII ─────────────────────────────────────────────────
const generarEnvioDTE = (dtesFirmados, rutEnvia, fchResol, nroResol) => {
  const tmstFirma = new Date().toISOString().replace('Z', '');
  const rutEmisor = '71810200-6';

  const subTotDTE = `<SubTotDTE><TpoDTE>34</TpoDTE><NroDTE>${dtesFirmados.length}</NroDTE></SubTotDTE>`;

  const caratula = 
    `<Caratula version="1.0">` +
    `<RutEmisor>${rutEmisor}</RutEmisor>` +
    `<RutEnvia>${rutEnvia}</RutEnvia>` +
    `<RutReceptor>60803000-K</RutReceptor>` +
    `<FchResol>${fchResol}</FchResol>` +
    `<NroResol>${nroResol}</NroResol>` +
    `<TmstFirmaEnv>${tmstFirma}</TmstFirmaEnv>` +
    subTotDTE +
    `</Caratula>`;

  const setDTE = 
    `<SetDTE ID="SetDoc">` +
    caratula +
    dtesFirmados.join('') +
    `</SetDTE>`;

  return `<?xml version="1.0" encoding="ISO-8859-1"?>` +
    `<EnvioDTE xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" ` +
    `version="1.0">` +
    setDTE +
    `</EnvioDTE>`;
};

module.exports = { generarXMLDTE34, generarEnvioDTE, obtenerSiguienteFolio };