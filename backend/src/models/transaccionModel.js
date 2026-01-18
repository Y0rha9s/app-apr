const pool = require('../config/database');

const transaccionModel = {
  // Obtener todas las transacciones
  getAll: async () => {
    const result = await pool.query('SELECT * FROM transacciones ORDER BY fecha DESC');
    return result.rows;
  },

  // Obtener transacciones por tipo (ingreso o egreso)
  getByTipo: async (tipo) => {
    const result = await pool.query('SELECT * FROM transacciones WHERE tipo = $1 ORDER BY fecha DESC', [tipo]);
    return result.rows;
  },

  // Obtener transacciones por mes/año
  getByPeriodo: async (mes, anio) => {
    const result = await pool.query(
      'SELECT * FROM transacciones WHERE EXTRACT(MONTH FROM fecha) = $1 AND EXTRACT(YEAR FROM fecha) = $2 ORDER BY fecha DESC',
      [mes, anio]
    );
    return result.rows;
  },

  // Crear transacción
  create: async (transaccion) => {
    const { tipo, categoria, descripcion, monto, fecha, usuario_id } = transaccion;
    const result = await pool.query(
      'INSERT INTO transacciones (tipo, categoria, descripcion, monto, fecha, usuario_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [tipo, categoria, descripcion, monto, fecha, usuario_id]
    );
    return result.rows[0];
  },

  // Obtener balance del mes
  getBalance: async (mes, anio) => {
    const result = await pool.query(
      `SELECT 
        SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) as total_egresos
       FROM transacciones 
       WHERE EXTRACT(MONTH FROM fecha) = $1 AND EXTRACT(YEAR FROM fecha) = $2`,
      [mes, anio]
    );
    return result.rows[0];
  }
};

module.exports = transaccionModel;