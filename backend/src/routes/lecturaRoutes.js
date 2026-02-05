const express = require('express');
const router = express.Router();
const lecturaController = require('../controllers/lecturaController');

// Rutas
router.get('/', lecturaController.getAll);
router.get('/usuario/:usuarioId', lecturaController.getByUsuario);
router.post('/', lecturaController.create);
router.put('/:id', lecturaController.update);
router.get('/:id/historial', lecturaController.getHistorial);

module.exports = router;