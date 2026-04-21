const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dteController');

router.get('/', ctrl.getAll);
router.post('/emitir/:boletaId', ctrl.emitirDTE);
router.post('/emitir-masivo', ctrl.emitirMasivo);
router.get('/estado/:trackId', ctrl.consultarEstadoDTE);

module.exports = router;