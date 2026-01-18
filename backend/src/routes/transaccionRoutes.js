const express = require('express');
const router = express.Router();
const transaccionController = require('../controllers/transaccionController');

// Rutas
router.get('/', transaccionController.getAll);
router.get('/tipo/:tipo', transaccionController.getByTipo);
router.get('/balance', transaccionController.getBalance);
router.post('/', transaccionController.create);

module.exports = router;