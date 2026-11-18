const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boletaController');
const { authMiddleware, esAdmin } = require('../middleware/authMiddleware');
const soloAdmin = [authMiddleware, esAdmin]; // modificar datos: solo administracion

router.get('/', ctrl.getAll);
router.get('/usuario/:id', ctrl.getByUsuario);
router.get('/pdf/:id', ctrl.generarPDF);
router.get('/pdf-usuario/:usuarioId', ctrl.generarPDFPorUsuario);
router.get('/zip/:periodo', ctrl.generarZIP);
router.post('/generar-masivo', soloAdmin, ctrl.generarMasivo);
router.post('/generar-individual', soloAdmin, ctrl.generarIndividual);
router.delete('/periodo/:periodo', soloAdmin, ctrl.eliminarPorPeriodo);
router.patch('/:id/estado', soloAdmin, ctrl.actualizarEstado);
router.patch('/:id/enviada', soloAdmin, ctrl.marcarEnviada);
router.post('/:id/enviar-whatsapp', soloAdmin, ctrl.enviarWhatsapp);
router.delete('/:id', soloAdmin, ctrl.eliminarBoleta);

module.exports = router;