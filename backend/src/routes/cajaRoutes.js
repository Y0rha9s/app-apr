const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');

// Abrir/cerrar/consultar caja exige sesion de admin o recaudador (antes era publico).
router.use(authMiddleware, soloRoles('admin', 'recaudador'));

// Rutas
router.get('/', cajaController.getAll);
router.get('/filtrar', cajaController.getByFechas);
router.get('/abierta', cajaController.getCajaAbierta);
router.post('/abrir', cajaController.abrir);
router.put('/cerrar/:id', cajaController.cerrar);

module.exports = router;