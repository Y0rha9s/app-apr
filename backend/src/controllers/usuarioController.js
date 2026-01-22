const usuarioModel = require('../models/usuarioModel');
const pool = require('../config/database');

const usuarioController = {
  // Obtener todos los usuarios
  getAll: async (req, res) => {
    try {
      const usuarios = await usuarioModel.getAll();
      // Eliminar passwords de la respuesta
      const usuariosSinPassword = usuarios.map(({ password, ...usuario }) => usuario);
      res.json(usuariosSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener usuario por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = await usuarioModel.getById(id);

      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const { password, ...usuarioSinPassword } = usuario;
      res.json(usuarioSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener deuda de un usuario
  getDeuda: async (req, res) => {
    try {
      const { id } = req.params;

      // Suma de lecturas
      const lecturasResult = await pool.query(
        'SELECT SUM(monto_calculado) as total_lecturas FROM lecturas WHERE usuario_id = $1',
        [id]
      );

      // Suma de pagos
      const pagosResult = await pool.query(
        'SELECT SUM(monto) as total_pagos FROM pagos WHERE usuario_id = $1',
        [id]
      );

      const totalLecturas = parseFloat(lecturasResult.rows[0].total_lecturas || 0);
      const totalPagos = parseFloat(pagosResult.rows[0].total_pagos || 0);
      const deuda = totalLecturas - totalPagos;

      res.json({ deuda: deuda >= 0 ? deuda : 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};


module.exports = usuarioController;