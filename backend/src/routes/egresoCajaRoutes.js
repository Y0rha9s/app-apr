const express = require('express');
const router = express.Router();
const egresoCajaController = require('../controllers/egresoCajaController');

// Rutas
router.get('/', egresoCajaController.getAll);
router.get('/caja/:cajaId', egresoCajaController.getByCaja);
router.get('/total/:cajaId', egresoCajaController.getTotalByCaja);
router.post('/', egresoCajaController.create);

module.exports = router;