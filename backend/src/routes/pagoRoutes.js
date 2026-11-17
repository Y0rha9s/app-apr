const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const pool = require('../config/database');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const { obtenerRecibo } = require('../utils/recibos');
const { boletasElegibles, registrarPagoBoleta, ErrorPago } = require('../utils/pagoBoleta');

// Todas las rutas de pagos exigen sesion de admin o recaudador (antes eran publicas:
// cualquiera con la URL podia registrar un pago).
router.use(authMiddleware, soloRoles('admin', 'recaudador'));

// Rutas
router.get('/', pagoController.getAll);
router.get('/caja/:cajaId', pagoController.getByCaja);
router.get('/resumen/:cajaId', pagoController.getResumenPorCaja);
router.post('/', pagoController.create);

// Caja: boletas que el cajero puede elegir para un socio (ventana de 3 meses, la mas antigua primero).
router.get('/boletas-elegibles/:usuarioId', async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.usuarioId, 10);
    if (!usuarioId) return res.status(400).json({ error: 'Usuario invalido' });
    res.json(await boletasElegibles(pool, usuarioId));
  } catch (error) {
    console.error('boletas elegibles:', error);
    res.status(500).json({ error: 'Error al obtener las boletas del socio' });
  }
});

// Caja: pagar una boleta elegida (abono, vuelto, deuda arrastrada). Ver utils/pagoBoleta.js
router.post('/boleta', async (req, res) => {
  try {
    const resultado = await registrarPagoBoleta(req.body);
    res.status(resultado.repetido ? 200 : 201).json(resultado);
  } catch (error) {
    if (error instanceof ErrorPago) return res.status(error.status).json({ error: error.message });
    console.error('pago de boleta:', error);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

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