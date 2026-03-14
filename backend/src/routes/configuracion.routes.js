const express = require('express');
const router = express.Router();
const { getCicloFechas, getConfig } = require('../helpers/configuracion.helper');

// GET /api/configuracion/ciclo
router.get('/ciclo', async (req, res) => {
  try {
    const ciclo = await getCicloFechas();
    const hoy = new Date().getDate();

    res.json({
      ...ciclo,
      hoy,
      enPeriodoLecturas: hoy >= ciclo.inicioLecturas && hoy <= ciclo.finLecturas,
      enPeriodoBoletas:  hoy === ciclo.entregaBoletas,
      enPeriodoReporte:  hoy === ciclo.reporteMensual,
    });
  } catch (error) {
    console.error('Error ciclo:', error.message); // agrega esto
    res.status(500).json({ error: 'Error al obtener configuración del ciclo' });
  }
});

// GET /api/configuracion
router.get('/', async (req, res) => {
  try {
    const pool = require('../config/database');
    const { rows } = await pool.query(
      'SELECT * FROM configuracion_sistema ORDER BY id'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error configuracion:', error.message);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PUT /api/configuracion/:clave
router.put('/:clave', async (req, res) => {
  try {
    const { clave } = req.params;
    const { valor } = req.body;
    const pool = require('../config/database');
    const { rows } = await pool.query(
      `UPDATE configuracion_sistema 
       SET valor = $1, updated_at = NOW() 
       WHERE clave = $2 
       RETURNING *`,
      [valor, clave]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Clave no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error update configuracion:', error.message);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;