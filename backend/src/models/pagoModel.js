const pool = require('../config/database');
const { marcarCuotaConvenioPagada } = require('../utils/convenios');

const pagoModel = {
  // Obtener todos los pagos
  getAll: async () => {
    const result = await pool.query('SELECT * FROM pagos ORDER BY fecha_pago DESC');
    return result.rows;
  },

  // Obtener pagos por caja
  getByCaja: async (cajaId) => {
    const result = await pool.query(
      `SELECT p.*, u.nombre AS usuario_nombre, u.rut AS usuario_rut, u.numero_cliente
       FROM pagos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.caja_id = $1
       ORDER BY p.fecha_pago DESC`,
      [cajaId]
    );
    return result.rows;
  },

  // Obtener resumen de pagos por método (para cerrar caja)
  getResumenPorCaja: async (cajaId) => {
    const result = await pool.query(
      `SELECT
        metodo_pago,
        SUM(monto) as total
       FROM pagos
       WHERE caja_id = $1
       GROUP BY metodo_pago`,
      [cajaId]
    );

    // Convertir a objeto con efectivo, tarjeta, transferencia
    const resumen = {
      monto_efectivo: 0,
      monto_tarjeta: 0,
      monto_transferencia: 0
    };

    result.rows.forEach(row => {
      if (row.metodo_pago === 'efectivo') resumen.monto_efectivo = parseFloat(row.total);
      if (row.metodo_pago === 'tarjeta') resumen.monto_tarjeta = parseFloat(row.total);
      if (row.metodo_pago === 'transferencia') resumen.monto_transferencia = parseFloat(row.total);
    });

    return resumen;
  },

  // Crear pago Y sincronizar boletas automáticamente
  create: async (pago) => {
    const { usuario_id, caja_id, monto, metodo_pago, observaciones } = pago;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Registrar el pago
      const pagoResult = await client.query(
        'INSERT INTO pagos (usuario_id, caja_id, monto, metodo_pago, observaciones) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [usuario_id, caja_id, monto, metodo_pago, observaciones]
      );
      const pagoCreado = pagoResult.rows[0];

      // 2. Aplicar el monto a las boletas pendientes/abonadas (más antigua primero)
      let restante = parseFloat(monto);

      const { rows: boletasPendientes } = await client.query(
        `SELECT id, saldo_pendiente, prestamo_cuota_id FROM boletas
         WHERE usuario_id = $1 AND estado IN ('pendiente', 'abonada')
         ORDER BY created_at ASC`,
        [usuario_id]
      );

      for (const b of boletasPendientes) {
        if (restante <= 0) break;

        const saldo = parseFloat(b.saldo_pendiente);
        const aplicado = Math.min(restante, saldo);
        const nuevoSaldo = saldo - aplicado;
        restante -= aplicado;

        const nuevoEstado = nuevoSaldo <= 0 ? 'pagada' : 'abonada';

        await client.query(
          `UPDATE boletas SET estado = $1, saldo_pendiente = $2, fecha_pago = NOW() WHERE id = $3`,
          [nuevoEstado, nuevoSaldo, b.id]
        );

        if (nuevoEstado === 'pagada' && b.prestamo_cuota_id) {
          await marcarCuotaConvenioPagada(client, b.prestamo_cuota_id, b.id);
        }
      }

      // 3. Si sobra plata después de cubrir todo lo pendiente, va a saldo a favor
      if (restante > 0) {
        await client.query(
          `UPDATE usuarios SET saldo_favor = COALESCE(saldo_favor, 0) + $1 WHERE id = $2`,
          [restante, usuario_id]
        );
      }

      await client.query('COMMIT');
      return pagoCreado;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

module.exports = pagoModel;
