const pool = require('../config/database');

const pagoModel = {
  // Obtener todos los pagos
  getAll: async () => {
    const result = await pool.query('SELECT * FROM pagos ORDER BY fecha_pago DESC');
    return result.rows;
  },

  // Obtener pagos por caja
  getByCaja: async (cajaId) => {
    const result = await pool.query(
      'SELECT * FROM pagos WHERE caja_id = $1 ORDER BY fecha_pago DESC',
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

  // Crear pago
  create: async (pago) => {
    const { usuario_id, caja_id, monto, metodo_pago, observaciones } = pago;
    const result = await pool.query(
      'INSERT INTO pagos (usuario_id, caja_id, monto, metodo_pago, observaciones) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [usuario_id, caja_id, monto, metodo_pago, observaciones]
    );
    return result.rows[0];
  }
};

module.exports = pagoModel;