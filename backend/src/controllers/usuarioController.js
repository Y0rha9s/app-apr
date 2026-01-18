const usuarioModel = require('../models/usuarioModel');

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
  }
};

module.exports = usuarioController;