const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas
router.get('/', usuarioController.getAll);
router.get('/:id', usuarioController.getById);
router.get('/:id/deuda', usuarioController.getDeuda);
router.get('/:id/info-completa', usuarioController.getInfoCompleta);

module.exports = router;