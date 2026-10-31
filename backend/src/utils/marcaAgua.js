// Marca de agua con fecha y hora para las fotos de medidor. La genera el SERVIDOR con su propio
// reloj (hora de Chile) en el momento de recibir la foto, asi el celular no puede alterarla.
//
// El texto se dibuja con una fuente de puntos 5x7 incluida aca (rectangulos SVG) en vez de usar
// <text>: no depende de fuentes instaladas en el servidor, asi se ve igual en Render que en local.

const FUENTE = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const FORMATEADOR_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
});

// 'dd/mm/yyyy HH:MM:SS' en hora de Chile
function formatearFechaHoraChile(fecha) {
  const p = Object.fromEntries(FORMATEADOR_CHILE.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

// Lineas de la marca. La hora principal es siempre la del servidor. Si el celular informo una hora
// de captura distinta (>2 min, ej. foto tomada sin conexion y subida despues), se agrega aparte.
function lineasMarca(ahora = new Date(), capturadaEn = null) {
  const lineas = [`SAFIP APR  ${formatearFechaHoraChile(ahora)}`];
  const captura = capturadaEn ? new Date(capturadaEn) : null;
  if (captura && !Number.isNaN(captura.getTime()) && Math.abs(ahora - captura) > 2 * 60 * 1000) {
    lineas.push(`CAPTURA EQUIPO  ${formatearFechaHoraChile(captura).slice(0, 16)}`);
  }
  return lineas;
}

// SVG de una franja inferior con las lineas de texto, del ancho de la imagen.
function construirMarcaSvg(ancho, alto, lineas) {
  const largoMax = Math.max(...lineas.map((l) => l.length));
  const escala = Math.max(1, Math.min(Math.round(ancho / 300), Math.floor((ancho * 0.95) / (largoMax * 6))));
  const celda = 6 * escala;
  const margen = 2 * escala;
  const altoLinea = 7 * escala;
  const separacion = 2 * escala;
  const altoFranja = lineas.length * altoLinea + (lineas.length - 1) * separacion + margen * 2;
  const yFranja = Math.max(0, alto - altoFranja);

  const rects = [];
  lineas.forEach((linea, i) => {
    const y0 = yFranja + margen + i * (altoLinea + separacion);
    [...linea].forEach((ch, j) => {
      const glifo = FUENTE[ch] || FUENTE[' '];
      const x0 = margen + j * celda;
      glifo.forEach((fila, fy) => {
        [...fila].forEach((bit, fx) => {
          if (bit === '1') rects.push(`<rect x="${x0 + fx * escala}" y="${y0 + fy * escala}" width="${escala}" height="${escala}"/>`);
        });
      });
    });
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">` +
    `<rect x="0" y="${yFranja}" width="${ancho}" height="${altoFranja}" fill="#000" fill-opacity="0.7"/>` +
    `<g fill="#fff">${rects.join('')}</g></svg>`;
  return { svg, top: 0 };
}

// Dibuja la marca sobre la imagen (buffer ya orientado y redimensionado). Devuelve un buffer JPEG.
async function aplicarMarcaAgua(sharp, bufferImagen, { capturadaEn = null, ahora = new Date(), calidad = 75 } = {}) {
  const { width, height } = await sharp(bufferImagen).metadata();
  const { svg } = construirMarcaSvg(width, height, lineasMarca(ahora, capturadaEn));
  return sharp(bufferImagen)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: calidad })
    .toBuffer();
}

module.exports = { formatearFechaHoraChile, lineasMarca, construirMarcaSvg, aplicarMarcaAgua };
