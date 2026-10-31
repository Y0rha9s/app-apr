const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const pool = require('../config/database');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const { obtenerRecibo } = require('../utils/recibos');

// Rutas
router.get('/', pagoController.getAll);
router.get('/caja/:cajaId', pagoController.getByCaja);
router.get('/resumen/:cajaId', pagoController.getResumenPorCaja);
router.post('/', pagoController.create);

// Datos para imprimir el comprobante ("recibo de dinero") de un pago. Solo lectura.
// Devuelve la copia respaldada al registrar el pago; si no existe (pagos anteriores o ingresados por otras
// vias) la arma en el momento. 'respaldado' indica cual de las dos fue.
router.get('/:id/comprobante', authMiddleware, soloRoles('admin', 'recaudador'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Pago invalido' });

    const comprobante = await obtenerRecibo(pool, id);
    if (!comprobante) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json({ success: true, comprobante });
  } catch (error) {
    console.error('comprobante de pago:', error);
    res.status(500).json({ error: 'Error al obtener el comprobante' });
  }
});

module.exports = router;