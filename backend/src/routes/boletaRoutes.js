const express = require('express');
const router = express.Router();
const boletaController = require('../controllers/boletaController');

// Ruta para generar PDF
router.get('/pdf/:usuarioId', boletaController.generarPDF);

module.exports = router;