const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dteController');
const { authMiddleware, esAdmin } = require('../middleware/authMiddleware');
const soloAdmin = [authMiddleware, esAdmin]; // modificar datos: solo administracion

router.get('/', ctrl.getAll);
router.post('/emitir/:boletaId', soloAdmin, ctrl.emitirDTE);
router.post('/emitir-masivo', soloAdmin, ctrl.emitirMasivo);
router.get('/estado/:trackId', ctrl.consultarEstadoDTE);

module.exports = router;