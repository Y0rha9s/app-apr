const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas
router.get('/', usuarioController.getAll);
router.get('/:id', usuarioController.getById);
router.get('/:id/deuda', usuarioController.getDeuda);
router.post('/', usuarioController.create);
router.put('/:id/suspender', usuarioController.suspender);
router.put('/:id/reponer', usuarioController.reponer);

module.exports = router;