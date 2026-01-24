const pool = require('../config/database');

const egresoCajaModel = {
  // Obtener todos los egresos
  getAll: async () => {
    const result = await pool.query('SELECT * FROM egresos_caja ORDER BY fecha_egreso DESC');
    return result.rows;
  },

  // Obtener egresos por caja
  getByCaja: async (cajaId) => {
    const result = await pool.query(
      'SELECT * FROM egresos_caja WHERE caja_id = $1 ORDER BY fecha_egreso DESC',
      [cajaId]
    );
    return result.rows;
  },

  // Obtener total de egresos por caja
  getTotalByCaja: async (cajaId) => {
    const result = await pool.query(
      'SELECT COALESCE(SUM(monto), 0) as total FROM egresos_caja WHERE caja_id = $1',
      [cajaId]
    );
    return parseFloat(result.rows[0].total);
  },

  // Crear egreso
  create: async (egreso) => {
    const { caja_id, categoria, descripcion, monto, observaciones } = egreso;
    const result = await pool.query(
      'INSERT INTO egresos_caja (caja_id, categoria, descripcion, monto, observaciones) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [caja_id, categoria, descripcion, monto, observaciones]
    );
    return result.rows[0];
  }
};

module.exports = egresoCajaModel;