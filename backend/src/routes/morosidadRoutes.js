const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Ejecutar actualización de estados de morosidad
router.post('/actualizar-estados', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM actualizar_estados_morosidad()');
    
    res.json({
      success: true,
      mensaje: `${result.rows.length} usuarios actualizados`,
      cambios: result.rows
    });
  } catch (error) {
    console.error('Error actualizando morosidad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener usuarios morosos
router.get('/morosos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.rut,
        u.estado_servicio,
        u.correo_electronico,
        u.medidor,
        SUM(b.saldo_pendiente) as deuda_total,
        MIN(b.fecha_vencimiento) as primera_fecha_vencida,
        CURRENT_DATE - MIN(b.fecha_vencimiento)::date as dias_morosidad
      FROM usuarios u
      JOIN boletas b ON u.id = b.usuario_id
      WHERE b.estado IN ('pendiente', 'parcial')
        AND b.saldo_pendiente > 0
        AND b.fecha_vencimiento < CURRENT_DATE
      GROUP BY u.id, u.nombre, u.rut, u.estado_servicio, u.correo_electronico, u.medidor
      ORDER BY dias_morosidad DESC
    `);
    
    res.json({
      success: true,
      morosos: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo morosos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener usuarios para corte (90+ días)
router.get('/para-corte', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nombre,
        u.rut,
        u.medidor,
        u.direccion,
        u.estado_servicio,
        SUM(b.saldo_pendiente) as deuda_total,
        MIN(b.fecha_vencimiento) as primera_fecha_vencida,
        CURRENT_DATE - MIN(b.fecha_vencimiento)::date as dias_morosidad
      FROM usuarios u
      JOIN boletas b ON u.id = b.usuario_id
      WHERE b.estado IN ('pendiente', 'parcial')
        AND b.saldo_pendiente > 0
        AND b.fecha_vencimiento < CURRENT_DATE - INTERVAL '90 days'
      GROUP BY u.id
      ORDER BY dias_morosidad DESC
    `);
    
    res.json({
      success: true,
      para_corte: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo para corte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;