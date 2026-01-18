const express = require('express');
const router = express.Router();
const lecturaController = require('../controllers/lecturaController');

// Rutas
router.get('/', lecturaController.getAll);
router.get('/usuario/:usuarioId', lecturaController.getByUsuario);
router.post('/', lecturaController.create);

module.exports = router;