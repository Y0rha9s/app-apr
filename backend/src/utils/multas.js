// Fecha/hora de Chile explicita (el servidor corre en UTC en Render) para que la
// regla del dia 20 no se corra segun donde este desplegado el backend.
const FORMATEADOR_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
});

function partesFechaChile(fecha = new Date()) {
  const partes = Object.fromEntries(FORMATEADOR_CHILE.formatToParts(fecha).map(p => [p.type, p.value]));
  return { anio: parseInt(partes.year, 10), mes: parseInt(partes.month, 10), dia: parseInt(partes.day, 10) };
}

// Una multa generada antes del dia 20 va en la boleta del mismo mes (la que se
// emite ese dia 20); generada el 20 o despues, va a la boleta del mes siguiente.
function calcularPeriodoDestino(fecha = new Date()) {
  const { anio, mes, dia } = partesFechaChile(fecha);
  let anioDestino = anio, mesDestino = mes;
  if (dia >= 20) {
    mesDestino += 1;
    if (mesDestino > 12) { mesDestino = 1; anioDestino += 1; }
  }
  return `${anioDestino}-${String(mesDestino).padStart(2, '0')}`;
}

// Suma de multas activas y aun no facturadas para un usuario/periodo, y las marca
// con el id de la boleta que se esta generando para que no se vuelvan a cobrar.
async function aplicarMultasPendientes(client, usuarioId, periodo, boletaId) {
  const { rows } = await client.query(
    `SELECT id, monto FROM multas
     WHERE usuario_id = $1 AND periodo_destino = $2 AND estado = 'activa' AND boleta_id IS NULL`,
    [usuarioId, periodo]
  );
  if (rows.length === 0) return 0;

  const ids = rows.map(r => r.id);
  await client.query(`UPDATE multas SET boleta_id = $1 WHERE id = ANY($2::int[])`, [boletaId, ids]);
  return rows.reduce((sum, r) => sum + parseFloat(r.monto), 0);
}

// Total de multas pendientes para un usuario/periodo sin marcarlas (para calcular
// el total antes de tener el id de la boleta que se va a insertar).
async function obtenerMontoMultasPendientes(client, usuarioId, periodo) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(monto), 0) as total FROM multas
     WHERE usuario_id = $1 AND periodo_destino = $2 AND estado = 'activa' AND boleta_id IS NULL`,
    [usuarioId, periodo]
  );
  return parseFloat(rows[0].total || 0);
}

module.exports = { calcularPeriodoDestino, aplicarMultasPendientes, obtenerMontoMultasPendientes };
