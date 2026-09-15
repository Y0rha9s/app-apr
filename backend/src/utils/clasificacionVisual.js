// Clasificacion puramente visual de una boleta: nunca se guarda en la base, se recalcula
// cada vez que se consulta (sin cron ni tareas programadas).
//
// Una boleta 'pendiente' que sigue sin pagarse se muestra como "No pagada" en vez de
// "Pendiente" los dias 18 y 19 de CADA MES CALENDARIO (fijo, sin importar que dia se emitio
// esa boleta en particular). El campo estado real en la base sigue siendo 'pendiente' hasta
// que se pague o se genere la boleta siguiente.
// El servidor corre en UTC (Render), no en hora de Chile: usar hoy.getDate() directamente
// puede adelantar/atrasar el dia varias horas segun la diferencia horaria. Se fuerza el
// calculo a America/Santiago para que el dia 18/19 sea el dia 18/19 en Chile, no en UTC.
const FORMATEADOR_DIA_CHILE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', day: 'numeric' });

function clasificarBoletaVisual(boleta, hoy = new Date()) {
  if (!boleta || boleta.estado !== 'pendiente') {
    return boleta?.estado ?? null;
  }

  const diaDelMes = parseInt(FORMATEADOR_DIA_CHILE.format(hoy), 10);
  if (diaDelMes === 18 || diaDelMes === 19) return 'no_pagada';
  return boleta.estado;
}

module.exports = { clasificarBoletaVisual };
