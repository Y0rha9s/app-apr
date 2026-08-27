const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boletaController');

router.get('/', ctrl.getAll);
router.get('/usuario/:id', ctrl.getByUsuario);
router.get('/pdf/:id', ctrl.generarPDF);
router.get('/pdf-usuario/:usuarioId', ctrl.generarPDFPorUsuario);
router.get('/zip/:periodo', ctrl.generarZIP);
router.post('/generar-masivo', ctrl.generarMasivo);
router.post('/generar-individual', ctrl.generarIndividual);
router.delete('/periodo/:periodo', ctrl.eliminarPorPeriodo);
router.patch('/:id/estado', ctrl.actualizarEstado);
router.patch('/:id/enviada', ctrl.marcarEnviada);
router.post('/:id/enviar-whatsapp', ctrl.enviarWhatsapp);
router.delete('/:id', ctrl.eliminarBoleta);

module.exports = router;