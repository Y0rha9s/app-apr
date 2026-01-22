const pagoModel = require('../models/pagoModel');

const pagoController = {
  getAll: async (req, res) => {
    try {
      const pagos = await pagoModel.getAll();
      res.json(pagos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getByCaja: async (req, res) => {
    try {
      const { cajaId } = req.params;
      const pagos = await pagoModel.getByCaja(cajaId);
      res.json(pagos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getResumenPorCaja: async (req, res) => {
    try {
      const { cajaId } = req.params;
      const resumen = await pagoModel.getResumenPorCaja(cajaId);
      res.json(resumen);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const nuevoPago = await pagoModel.create(req.body);
      res.status(201).json(nuevoPago);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = pagoController;