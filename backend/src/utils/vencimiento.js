// Regla del APR: la boleta vence SIEMPRE el dia 10 del mes siguiente a su periodo, sin importar
// cuando se genere (boleta de octubre '2026-10' -> vence el 2026-11-10, se genere el 20/10, el 28/10
// o el 7/11). Asi una boleta regenerada o generada tarde no gana plazo extra.
// Recibe el periodo 'YYYY-MM' y devuelve 'YYYY-MM-DD' (columna DATE).
function calcularVencimiento(periodo) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
  if (!match) throw new Error(`Periodo invalido para calcular vencimiento: ${periodo}`);
  let anio = Number(match[1]);
  let mes = Number(match[2]) + 1;
  if (mes > 12) { mes = 1; anio += 1; }
  return `${anio}-${String(mes).padStart(2, '0')}-10`;
}

module.exports = { calcularVencimiento };
