const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const { construirInforme } = require('../utils/informeCaja');

// Solo lectura. Solo admin y cajero (rol 'recaudador') pueden ver el informe.
router.use(authMiddleware, soloRoles('admin', 'recaudador'));

const VISTAS = ['dia', 'semana', 'mes'];
const MAX_DIAS_RANGO = 400;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Las columnas de fecha son 'timestamp without time zone' guardadas en UTC; se pasan a hora de
// Chile en SQL para que el corte de dia no dependa de la zona horaria del servidor.
const FECHA_CHILE = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')`;

const FORMATEADOR_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
});
const hoyChile = () => FORMATEADOR_CHILE.format(new Date());

const esFechaValida = (s) => RE_FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// GET /api/informe-caja?vista=dia|semana|mes&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const vista = req.query.vista || 'dia';
    if (!VISTAS.includes(vista)) {
      return res.status(400).json({ error: 'Vista invalida. Use dia, semana o mes' });
    }

    const hoy = hoyChile();
    const hasta = req.query.hasta || hoy;
    const desde = req.query.desde || `${hoy.slice(0, 8)}01`;
    if (!esFechaValida(desde) || !esFechaValida(hasta)) {
      return res.status(400).json({ error: 'Fechas invalidas. Use el formato YYYY-MM-DD' });
    }
    if (desde > hasta) {
      return res.status(400).json({ error: 'La fecha Desde no puede ser posterior a Hasta' });
    }
    const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
    if (dias > MAX_DIAS_RANGO) {
      return res.status(400).json({ error: `El rango no puede superar ${MAX_DIAS_RANGO} dias` });
    }

    const fechaPago = FECHA_CHILE('p.fecha_pago');
    const { rows: pagos } = await pool.query(
      `SELECT p.id, p.monto, p.metodo_pago, p.observaciones, p.caja_id,
              u.nombre AS usuario_nombre, u.numero_cliente,
              to_char(${fechaPago}, 'YYYY-MM-DD') AS dia,
              to_char(${fechaPago}, 'YYYY-MM-DD HH24:MI') AS fecha
       FROM pagos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE ${fechaPago}::date BETWEEN $1::date AND $2::date`,
      [desde, hasta]
    );

    const fechaEgreso = FECHA_CHILE('e.fecha_egreso');
    const { rows: egresos } = await pool.query(
      `SELECT e.id, e.monto, e.categoria, e.descripcion, e.observaciones, e.caja_id,
              to_char(${fechaEgreso}, 'YYYY-MM-DD') AS dia,
              to_char(${fechaEgreso}, 'YYYY-MM-DD HH24:MI') AS fecha
       FROM egresos_caja e
       WHERE ${fechaEgreso}::date BETWEEN $1::date AND $2::date`,
      [desde, hasta]
    );

    res.json({ vista, desde, hasta, ...construirInforme({ pagos, egresos, vista }) });
  } catch (error) {
    console.error('informe-caja:', error);
    res.status(500).json({ error: 'Error al generar el informe de caja' });
  }
});

module.exports = router;
