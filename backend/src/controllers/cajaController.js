const cajaModel = require('../models/cajaModel');

const cajaController = {
  // Obtener todas las cajas
  getAll: async (req, res) => {
    try {
      const cajas = await cajaModel.getAll();
      res.json(cajas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener cajas por rango de fechas
  getByFechas: async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.query;
      const cajas = await cajaModel.getByFechas(fechaInicio, fechaFin);
      res.json(cajas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener caja abierta
  getCajaAbierta: async (req, res) => {
    try {
      const caja = await cajaModel.getCajaAbierta();
      res.json(caja || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Abrir caja
  abrir: async (req, res) => {
    try {
      const nuevaCaja = await cajaModel.abrir(req.body);
      res.status(201).json(nuevaCaja);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Cerrar caja
  cerrar: async (req, res) => {
    try {
      const { id } = req.params;
      const cajaCerrada = await cajaModel.cerrar(id, req.body);
      res.json(cajaCerrada);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = cajaController;