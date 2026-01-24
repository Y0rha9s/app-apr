const egresoCajaModel = require('../models/egresoCajaModel');

const egresoCajaController = {
  getAll: async (req, res) => {
    try {
      const egresos = await egresoCajaModel.getAll();
      res.json(egresos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getByCaja: async (req, res) => {
    try {
      const { cajaId } = req.params;
      const egresos = await egresoCajaModel.getByCaja(cajaId);
      res.json(egresos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTotalByCaja: async (req, res) => {
    try {
      const { cajaId } = req.params;
      const total = await egresoCajaModel.getTotalByCaja(cajaId);
      res.json({ total });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const nuevoEgreso = await egresoCajaModel.create(req.body);
      res.status(201).json(nuevoEgreso);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = egresoCajaController;