const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');

// Rutas
router.get('/', cajaController.getAll);
router.get('/filtrar', cajaController.getByFechas);
router.get('/abierta', cajaController.getCajaAbierta);
router.post('/abrir', cajaController.abrir);
router.put('/cerrar/:id', cajaController.cerrar);

module.exports = router;