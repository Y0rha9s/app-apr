const express = require('express');
const router = express.Router();
const transaccionController = require('../controllers/transaccionController');
const { authMiddleware, esAdmin } = require('../middleware/authMiddleware');
const soloAdmin = [authMiddleware, esAdmin]; // modificar datos: solo administracion

// Rutas
router.get('/', transaccionController.getAll);
router.get('/tipo/:tipo', transaccionController.getByTipo);
router.get('/balance', transaccionController.getBalance);
router.post('/', soloAdmin, transaccionController.create);

module.exports = router;