const pool = require('../config/database');

const lecturaModel = {
  // Obtener todas las lecturas
  getAll: async () => {
    const result = await pool.query('SELECT * FROM lecturas ORDER BY fecha_lectura DESC');
    return result.rows;
  },

  // Obtener lecturas por usuario
  getByUsuario: async (usuarioId) => {
    const result = await pool.query(
      'SELECT * FROM lecturas WHERE usuario_id = $1 ORDER BY fecha_lectura DESC',
      [usuarioId]
    );
    return result.rows;
  },

  // Crear lectura
  create: async (lectura) => {
    const { usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones } = lectura;
    const result = await pool.query(
      'INSERT INTO lecturas (usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones]
    );
    return result.rows[0];
  }
};

module.exports = lecturaModel;