const lecturaModel = require('../models/lecturaModel');

const lecturaController = {
  // Obtener todas las lecturas
  getAll: async (req, res) => {
    try {
      const lecturas = await lecturaModel.getAll();
      res.json(lecturas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener lecturas por usuario
  getByUsuario: async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const lecturas = await lecturaModel.getByUsuario(usuarioId);
      res.json(lecturas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Crear lectura
  create: async (req, res) => {
    try {
      const nuevaLectura = await lecturaModel.create(req.body);
      res.status(201).json(nuevaLectura);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = lecturaController;