const pool = require('../config/database');

const cajaModel = {
  // Obtener todas las cajas
  getAll: async () => {
    const result = await pool.query('SELECT * FROM cajas ORDER BY fecha_apertura DESC');
    return result.rows;
  },

  // Obtener cajas por rango de fechas
  getByFechas: async (fechaInicio, fechaFin) => {
    const result = await pool.query(
      'SELECT * FROM cajas WHERE DATE(fecha_apertura) BETWEEN $1 AND $2 ORDER BY fecha_apertura DESC',
      [fechaInicio, fechaFin]
    );
    return result.rows;
  },

  // Obtener caja abierta actual
  getCajaAbierta: async () => {
    const result = await pool.query(
      "SELECT * FROM cajas WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1"
    );
    return result.rows[0];
  },

  // Abrir caja
  abrir: async (caja) => {
    const { usuario_id, saldo_inicial, observaciones_apertura } = caja;
    const result = await pool.query(
      "INSERT INTO cajas (usuario_id, saldo_inicial, observaciones_apertura, estado) VALUES ($1, $2, $3, 'abierta') RETURNING *",
      [usuario_id, saldo_inicial, observaciones_apertura]
    );
    return result.rows[0];
  },

  // Cerrar caja
  cerrar: async (id, datosCierre) => {
    const { monto_efectivo, monto_transferencia, monto_tarjeta, efectivo_contado, observaciones_cierre } = datosCierre;
    
    // Calcular totales
    const efectivo_esperado = parseFloat(monto_efectivo || 0);
    const diferencia = parseFloat(efectivo_contado || 0) - efectivo_esperado;
    
    const result = await pool.query(
      `UPDATE cajas SET 
        fecha_cierre = NOW(),
        monto_efectivo = $1,
        monto_transferencia = $2,
        monto_tarjeta = $3,
        efectivo_esperado = $4,
        efectivo_contado = $5,
        diferencia = $6,
        observaciones_cierre = $7,
        estado = 'cerrada'
      WHERE id = $8 RETURNING *`,
      [monto_efectivo, monto_transferencia, monto_tarjeta, efectivo_esperado, efectivo_contado, diferencia, observaciones_cierre, id]
    );
    return result.rows[0];
  }
};

module.exports = cajaModel;