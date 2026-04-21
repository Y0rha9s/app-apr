const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const SII_AMBIENTE = process.env.SII_AMBIENTE || 'certificacion'; // 'certificacion' o 'produccion'

const SII_URLS = {
  certificacion: {
    token: 'https://maullin.sii.cl/cgi_dte/UF/TSTED.cgi',
    envio: 'https://maullin.sii.cl/cgi_dte/UF/DTEUpload',
    estado: 'https://maullin.sii.cl/cgi_dte/UF/DTEUpload',
  },
  produccion: {
    token: 'https://palena.sii.cl/cgi_dte/UF/TSTED.cgi',
    envio: 'https://palena.sii.cl/cgi_dte/UF/DTEUpload',
    estado: 'https://palena.sii.cl/cgi_dte/UF/DTEUpload',
  }
};

const urls = SII_URLS[SII_AMBIENTE];

// ─── OBTENER TOKEN SII ────────────────────────────────────────────────────────
const obtenerToken = async () => {
  const pfxPath = path.join(__dirname, '../assets/certificado.pfx');
  const pfxPassword = process.env.PFX_PASSWORD || '';

  const pfxBuffer = fs.readFileSync(pfxPath);
  const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pfxPassword);

  let privateKey;
  for (const safeContents of pfx.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKey = safeBag.key;
      }
    }
  }

  // Seed firmado con timestamp
  const timestamp = new Date().toISOString().replace('Z', '');
  const seed = `<getToken><item><Semilla>${timestamp}</Semilla></item></getToken>`;
  
  const md = forge.md.sha1.create();
  md.update(seed, 'utf8');
  const firma = forge.util.encode64(privateKey.sign(md));

  const xmlFirmado = `<?xml version="1.0"?><getToken><item><Semilla>${timestamp}</Semilla></item><Signature>${firma}</Signature></getToken>`;

  const response = await axios.post(urls.token, xmlFirmado, {
    headers: { 'Content-Type': 'text/xml' }
  });

  const token = response.data.match(/<TOKEN>(.*?)<\/TOKEN>/)?.[1];
  if (!token) throw new Error('No se pudo obtener token del SII');
  return token;
};

// ─── ENVIAR DTE AL SII ────────────────────────────────────────────────────────
const enviarDTE = async (xmlEnvio, rutEmisor) => {
  const token = await obtenerToken();

  const rutLimpio = rutEmisor.replace(/\./g, '').replace('-', '');
  const dv = rutLimpio.slice(-1);
  const rut = rutLimpio.slice(0, -1);

  const formData = new FormData();
  formData.append('rutSender', rut);
  formData.append('dvSender', dv);
  formData.append('rutCompany', rut);
  formData.append('dvCompany', dv);
  formData.append('archivo', new Blob([xmlEnvio], { type: 'text/xml' }), 'envio.xml');

  const response = await axios.post(urls.envio, formData, {
    headers: {
      'Cookie': `TOKEN=${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });

  const trackId = response.data.match(/<TRACKID>(.*?)<\/TRACKID>/)?.[1];
  const estado = response.data.match(/<STATUS>(.*?)<\/STATUS>/)?.[1];

  return { trackId, estado, respuestaCompleta: response.data };
};

// ─── CONSULTAR ESTADO ENVIO ───────────────────────────────────────────────────
const consultarEstado = async (trackId, rutEmisor) => {
  const token = await obtenerToken();

  const rutLimpio = rutEmisor.replace(/\./g, '').replace('-', '');
  const rut = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  const response = await axios.get(
    `${urls.estado}?rutEmpresa=${rut}&dvEmpresa=${dv}&trackId=${trackId}`,
    { headers: { 'Cookie': `TOKEN=${token}` } }
  );

  const estado = response.data.match(/<STATUS>(.*?)<\/STATUS>/)?.[1];
  const glosa = response.data.match(/<GLOSA>(.*?)<\/GLOSA>/)?.[1];

  return { estado, glosa, respuestaCompleta: response.data };
};

module.exports = { obtenerToken, enviarDTE, consultarEstado };