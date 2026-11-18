const express = require('express');
const router = express.Router();
const egresoCajaController = require('../controllers/egresoCajaController');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const soloCaja = [authMiddleware, soloRoles('admin', 'recaudador')]; // registrar egresos: quienes operan la Caja

// Rutas
router.get('/', egresoCajaController.getAll);
router.get('/caja/:cajaId', egresoCajaController.getByCaja);
router.get('/total/:cajaId', egresoCajaController.getTotalByCaja);
router.post('/', soloCaja, egresoCajaController.create);

module.exports = router;