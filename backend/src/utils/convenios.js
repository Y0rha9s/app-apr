// Maneja la cuota de préstamo/convenio (estanque, incorporación, arranque) que se cobra junto a la boleta.
// Un usuario puede tener un préstamo/convenio activo de cualquier tipo_convenio; se cobra una cuota por boleta.
async function obtenerProximaCuotaConvenio(client, usuarioId) {
  const { rows } = await client.query(
    `SELECT p.id AS prestamo_id, pc.id AS cuota_id, pc.monto_esperado
     FROM prestamos p
     JOIN prestamo_cuotas pc ON pc.prestamo_id = p.id
     WHERE p.usuario_id = $1 AND p.estado = 'activo' AND pc.estado = 'pendiente'
     ORDER BY p.fecha_inicio ASC, pc.numero_cuota ASC
     LIMIT 1`,
    [usuarioId]
  );
  if (rows.length === 0) return null;
  return {
    prestamoId: rows[0].prestamo_id,
    cuotaId: rows[0].cuota_id,
    monto: parseFloat(rows[0].monto_esperado)
  };
}

// Marca la cuota como pagada y avanza el contador del préstamo cuando la boleta que la trae se paga por completo.
async function marcarCuotaConvenioPagada(client, cuotaId, boletaId) {
  const { rows } = await client.query(
    `UPDATE prestamo_cuotas
     SET estado = 'pagada',
         fecha_pago = NOW(),
         monto_pagado = monto_esperado,
         notas = COALESCE(notas || ' | ', '') || 'Pagada automáticamente vía boleta #' || $2
     WHERE id = $1 AND estado != 'pagada'
     RETURNING prestamo_id`,
    [cuotaId, boletaId]
  );
  if (rows.length === 0) return;

  const { rows: p } = await client.query(
    `UPDATE prestamos
     SET cuotas_pagadas = cuotas_pagadas + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING cuotas_pagadas, num_cuotas`,
    [rows[0].prestamo_id]
  );
  if (p.length > 0 && p[0].cuotas_pagadas >= p[0].num_cuotas) {
    await client.query(
      `UPDATE prestamos SET estado = 'completado', fecha_fin = NOW() WHERE id = $1`,
      [rows[0].prestamo_id]
    );
  }
}

module.exports = { obtenerProximaCuotaConvenio, marcarCuotaConvenioPagada };
