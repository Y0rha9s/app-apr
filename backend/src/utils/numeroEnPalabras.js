// Monto en pesos chilenos escrito en palabras (para el recibo de dinero).
// Soporta de 0 a 999.999.999. Ej: 14100 -> "Catorce mil cien pesos".

const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve'
];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

// 1..999
function menorAMil(n) {
  if (n === 100) return 'cien';
  const centenas = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (centenas) partes.push(CENTENAS[centenas]);
  if (resto) {
    if (resto < 30) {
      partes.push(UNIDADES[resto]);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      partes.push(unidad ? `${DECENAS[decena]} y ${UNIDADES[unidad]}` : DECENAS[decena]);
    }
  }
  return partes.join(' ');
}

// "uno" -> "un" cuando va antes de "mil", "millones" o "pesos" (veintiún mil, ciento un pesos)
const apocopar = (texto) => texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

function numeroEnPalabras(valor) {
  const n = Math.round(Math.abs(Number(valor) || 0));
  if (n === 0) return 'cero';
  if (n > 999999999) throw new Error('Monto demasiado grande');

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  const partes = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocopar(menorAMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(menorAMil(miles))} mil`);
  if (resto) partes.push(menorAMil(resto));
  return partes.join(' ');
}

// "Catorce mil cien pesos" / "Un peso"
function montoEnPalabras(valor) {
  const n = Math.round(Math.abs(Number(valor) || 0));
  const texto = apocopar(numeroEnPalabras(n));
  const conMayuscula = texto.charAt(0).toUpperCase() + texto.slice(1);
  // "un millón de pesos" / "dos millones de pesos": se usa "de" cuando termina en millón(es)
  const terminaEnMillones = n >= 1000000 && n % 1000000 === 0;
  return `${conMayuscula}${terminaEnMillones ? ' de' : ''} ${n === 1 ? 'peso' : 'pesos'}`;
}

module.exports = { montoEnPalabras };
