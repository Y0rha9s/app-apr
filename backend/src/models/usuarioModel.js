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

  // Generar número de cliente automáticamente (solo números: 001, 002, etc.)
  generarNumeroCliente: async () => {
    // Obtener el siguiente número disponible
    const maxResult = await pool.query(`
      SELECT COALESCE(
        MAX(CAST(numero_cliente AS INTEGER)),
        0
      ) + 1 as siguiente
      FROM usuarios
      WHERE rol = 'socio' AND numero_cliente ~ '^[0-9]+$'
    `);
    const siguienteNumero = parseInt(maxResult.rows[0]?.siguiente || 1);
    
    // Formatear: 001 hasta 999, luego 1000, 1001, etc.
    return siguienteNumero < 1000 
      ? siguienteNumero.toString().padStart(3, '0')
      : siguienteNumero.toString();
  },

  // Crear usuario
  create: async (usuario) => {
    const { rut, nombre, email, telefono, direccion, password, rol } = usuario;
    
    // Si es un socio (no admin), generar número de cliente automáticamente
    let numeroCliente = null;
    if (rol === 'socio') {
      numeroCliente = await usuarioModel.generarNumeroCliente();
    }

    const result = await pool.query(
      'INSERT INTO usuarios (rut, nombre, email, telefono, direccion, password, rol, numero_cliente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [rut, nombre, email, telefono, direccion, password, rol, numeroCliente]
    );
    return result.rows[0];
  }
};

module.exports = usuarioModel;