const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boletaController');

router.get('/', ctrl.getAll);
router.get('/usuario/:id', ctrl.getByUsuario);
router.get('/pdf/:id', ctrl.generarPDF);
router.post('/generar-masivo', ctrl.generarMasivo);
router.patch('/:id/estado', ctrl.actualizarEstado);
router.patch('/:id/enviada', ctrl.marcarEnviada);

module.exports = router;