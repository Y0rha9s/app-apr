const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

// Rutas
router.get('/', pagoController.getAll);
router.get('/caja/:cajaId', pagoController.getByCaja);
router.get('/resumen/:cajaId', pagoController.getResumenPorCaja);
router.post('/', pagoController.create);

module.exports = router;