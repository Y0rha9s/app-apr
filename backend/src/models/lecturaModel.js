const pool = require('../config/database');

const lecturaModel = {
  // Obtener todas las lecturas CON datos del usuario
  getAll: async () => {
    const result = await pool.query(`
      SELECT 
        l.id,
        l.usuario_id,
        l.lectura_anterior,
        l.lectura_actual,
        l.consumo_m3,
        l.mes,
        l.anio,
        l.monto_calculado,
        l.fecha_lectura,
        l.observaciones,
        l.created_at,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        u.direccion as usuario_direccion,
        u.numero_cliente as usuario_numero_cliente,
        u.medidor as usuario_medidor
      FROM lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      ORDER BY l.fecha_lectura DESC
    `);
    return result.rows;
  },

  // Obtener lecturas por usuario CON datos del usuario
  getByUsuario: async (usuarioId) => {
    const result = await pool.query(
      `SELECT 
        l.id,
        l.usuario_id,
        l.lectura_anterior,
        l.lectura_actual,
        l.consumo_m3,
        l.mes,
        l.anio,
        l.monto_calculado,
        l.fecha_lectura,
        l.observaciones,
        l.created_at,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        u.direccion as usuario_direccion,
        u.numero_cliente as usuario_numero_cliente,
        u.medidor as usuario_medidor
      FROM lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      WHERE l.usuario_id = $1 
      ORDER BY l.fecha_lectura DESC`,
      [usuarioId]
    );
    return result.rows;
  },

  // Crear lectura
  create: async (lectura) => {
    const { usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones } = lectura;
    
    const result = await pool.query(
      `INSERT INTO lecturas 
       (usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura, observaciones]
    );
    
    // Después de insertar, obtener también el nombre del usuario
    const lecturaCompleta = await pool.query(
      `SELECT 
        l.*,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        u.numero_cliente as usuario_numero_cliente,
        u.medidor as usuario_medidor
      FROM lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      WHERE l.id = $1`,
      [result.rows[0].id]
    );
    
    return lecturaCompleta.rows[0];
  }
};

module.exports = lecturaModel;
