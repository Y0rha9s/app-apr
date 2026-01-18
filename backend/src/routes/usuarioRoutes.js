const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Rutas
router.get('/', usuarioController.getAll);
router.get('/:id', usuarioController.getById);

module.exports = router;