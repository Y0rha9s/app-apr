// El saldo anterior de una boleta nueva debe salir de la boleta del periodo
// inmediatamente anterior (por periodo, no por orden de creacion). Si una boleta
// se genera fuera de orden (ej: se genera julio despues de que ya existia agosto,
// por una lectura que llego atrasada), buscar "la ultima boleta creada" en vez de
// "la ultima boleta del periodo anterior" trae el saldo equivocado.
async function obtenerSaldoAnteriorPeriodo(client, usuarioId, periodo) {
  const { rows } = await client.query(
    `SELECT saldo_pendiente FROM boletas
     WHERE usuario_id = $1 AND periodo < $2
     ORDER BY periodo DESC LIMIT 1`,
    [usuarioId, periodo]
  );
  return rows.length > 0 ? parseFloat(rows[0].saldo_pendiente) : 0;
}

module.exports = { obtenerSaldoAnteriorPeriodo };
