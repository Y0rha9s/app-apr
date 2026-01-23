const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas - IMPORTANTE: Las rutas más específicas deben ir ANTES de las genéricas
router.get('/', usuarioController.getAll);
router.get('/:id/info-completa', usuarioController.getInfoCompleta);
router.get('/:id/deuda', usuarioController.getDeuda);
router.get('/:id', usuarioController.getById);

module.exports = router;