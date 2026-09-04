// Clasificacion puramente visual de una boleta: nunca se guarda en la base, se recalcula
// cada vez que se consulta (sin cron ni tareas programadas).
//
// Una boleta 'pendiente' que sigue sin pagarse y cuya fecha de emision tiene ya entre 18 y 19
// dias de antiguedad se muestra como "No pagada" en vez de "Pendiente". El campo estado real
// en la base sigue siendo 'pendiente' hasta que se pague o se genere la boleta siguiente.
function clasificarBoletaVisual(boleta, hoy = new Date()) {
  if (!boleta || boleta.estado !== 'pendiente' || !boleta.fecha_emision) {
    return boleta?.estado ?? null;
  }

  const emision = new Date(boleta.fecha_emision);
  const inicioEmision = new Date(emision.getFullYear(), emision.getMonth(), emision.getDate());
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diasDesdeEmision = Math.round((inicioHoy - inicioEmision) / (1000 * 60 * 60 * 24));

  if (diasDesdeEmision >= 18 && diasDesdeEmision <= 19) return 'no_pagada';
  return boleta.estado;
}

module.exports = { clasificarBoletaVisual };
