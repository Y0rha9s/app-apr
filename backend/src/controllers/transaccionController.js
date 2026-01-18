const transaccionModel = require('../models/transaccionModel');

const transaccionController = {
  // Obtener todas las transacciones
  getAll: async (req, res) => {
    try {
      const transacciones = await transaccionModel.getAll();
      res.json(transacciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener por tipo
  getByTipo: async (req, res) => {
    try {
      const { tipo } = req.params;
      const transacciones = await transaccionModel.getByTipo(tipo);
      res.json(transacciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener balance del mes
  getBalance: async (req, res) => {
    try {
      const { mes, anio } = req.query;
      const balance = await transaccionModel.getBalance(mes || new Date().getMonth() + 1, anio || new Date().getFullYear());
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Crear transacción
  create: async (req, res) => {
    try {
      const nuevaTransaccion = await transaccionModel.create(req.body);
      res.status(201).json(nuevaTransaccion);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = transaccionController;