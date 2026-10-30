// Utilidades de RUT chileno.

// '12.743.157-4' / '127431574' / '12743157-4' -> '127431574' (sin puntos ni guion, K en mayuscula)
const limpiarRut = (rut) => String(rut || '').replace(/[.\-\s]/g, '').toUpperCase();

// Digito verificador (modulo 11) del cuerpo numerico del RUT.
function calcularDV(cuerpo) {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

// Devuelve el RUT formateado ('12.743.157-4') o null si no es valido.
function validarYFormatearRut(rut) {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (calcularDV(cuerpo) !== dv) return null;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

module.exports = { limpiarRut, calcularDV, validarYFormatearRut };
