const pool = require('../config/database');

const usuarioModel = {
  // Obtener todos los usuarios
  getAll: async () => {
    const result = await pool.query('SELECT * FROM usuarios ORDER BY nombre');
    return result.rows;
  },

  // Obtener usuario por RUT
  getByRut: async (rut) => {
    const result = await pool.query('SELECT * FROM usuarios WHERE rut = $1', [rut]);
    return result.rows[0];
  },

  // Obtener usuario por ID
  getById: async (id) => {
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Crear usuario
  create: async (usuario) => {
    const { rut, nombre, email, telefono, direccion, password, rol } = usuario;
    const result = await pool.query(
      'INSERT INTO usuarios (rut, nombre, email, telefono, direccion, password, rol) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [rut, nombre, email, telefono, direccion, password, rol]
    );
    return result.rows[0];
  }
};

module.exports = usuarioModel;