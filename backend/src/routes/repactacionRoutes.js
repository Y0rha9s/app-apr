const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Crear nueva repactación
router.post('/crear', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { usuario_id, num_cuotas, notas } = req.body;
    
    if (!usuario_id || !num_cuotas) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere usuario_id y num_cuotas'
      });
    }
    
    // Validar número de cuotas
    if (num_cuotas < 1 || num_cuotas > 6) {
      return res.status(400).json({
        success: false,
        error: 'El número de cuotas debe ser entre 1 y 6'
      });
    }
    
    await client.query('BEGIN');
    
    // Obtener deuda total del usuario
    const deudaResult = await client.query(
      `SELECT 
        u.nombre,
        SUM(b.saldo_pendiente) as deuda_total
       FROM usuarios u
       LEFT JOIN boletas b ON u.id = b.usuario_id
       WHERE u.id = $1 
         AND b.estado IN ('pendiente', 'parcial')
         AND b.saldo_pendiente > 0
       GROUP BY u.id, u.nombre`,
      [usuario_id]
    );
    
    if (deudaResult.rows.length === 0 || !deudaResult.rows[0].deuda_total) {
      throw new Error('El usuario no tiene deuda pendiente');
    }
    
    const deudaTotal = parseFloat(deudaResult.rows[0].deuda_total);
    const nombreUsuario = deudaResult.rows[0].nombre;
    
    // Verificar que no tenga repactación activa
    const repactacionActiva = await client.query(
      'SELECT id FROM repactaciones WHERE usuario_id = $1 AND estado = $2',
      [usuario_id, 'activa']
    );
    
    if (repactacionActiva.rows.length > 0) {
      throw new Error('El usuario ya tiene una repactación activa');
    }
    
    // Calcular cuota mensual
    const cuotaMensual = Math.ceil(deudaTotal / num_cuotas);
    
    // Crear repactación
    const resultRepactacion = await client.query(
      `INSERT INTO repactaciones 
       (usuario_id, monto_original, num_cuotas, cuota_mensual, cuotas_pagadas, estado, notas)
       VALUES ($1, $2, $3, $4, 0, 'activa', $5)
       RETURNING id`,
      [usuario_id, deudaTotal, num_cuotas, cuotaMensual, notas]
    );
    
    const repactacionId = resultRepactacion.rows[0].id;
    
    // Marcar boletas pendientes como "repactadas" (opcional: agregar campo)
    // Por ahora, mantenemos el saldo_pendiente para referencia
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: `Repactación creada para ${nombreUsuario}`,
      repactacion: {
        id: repactacionId,
        monto_original: deudaTotal,
        num_cuotas: num_cuotas,
        cuota_mensual: cuotaMensual
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando repactación:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Obtener repactaciones activas
router.get('/activas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        (r.num_cuotas - r.cuotas_pagadas) as cuotas_pendientes,
        (r.cuota_mensual * (r.num_cuotas - r.cuotas_pagadas)) as saldo_pendiente
       FROM repactaciones r
       JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.estado = 'activa'
       ORDER BY r.created_at DESC`
    );
    
    res.json({
      success: true,
      repactaciones: result.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo repactaciones activas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener repactaciones de un usuario
router.get('/usuario/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        r.*,
        (r.num_cuotas - r.cuotas_pagadas) as cuotas_pendientes,
        (r.cuota_mensual * (r.num_cuotas - r.cuotas_pagadas)) as saldo_pendiente
       FROM repactaciones r
       WHERE r.usuario_id = $1
       ORDER BY r.created_at DESC`,
      [usuario_id]
    );
    
    res.json({
      success: true,
      repactaciones: result.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo repactaciones del usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Marcar cuota como pagada
router.post('/pagar-cuota', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { repactacion_id } = req.body;
    
    if (!repactacion_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere repactacion_id'
      });
    }
    
    await client.query('BEGIN');
    
    // Obtener repactación
    const repactacion = await client.query(
      'SELECT * FROM repactaciones WHERE id = $1',
      [repactacion_id]
    );
    
    if (repactacion.rows.length === 0) {
      throw new Error('Repactación no encontrada');
    }
    
    const rep = repactacion.rows[0];
    
    if (rep.estado !== 'activa') {
      throw new Error('La repactación no está activa');
    }
    
    const nuevasCuotasPagadas = rep.cuotas_pagadas + 1;
    const nuevoEstado = nuevasCuotasPagadas >= rep.num_cuotas ? 'completada' : 'activa';
    const fechaFin = nuevoEstado === 'completada' ? new Date() : null;
    
    // Actualizar repactación
    await client.query(
      `UPDATE repactaciones 
       SET cuotas_pagadas = $1,
           estado = $2,
           fecha_fin = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [nuevasCuotasPagadas, nuevoEstado, fechaFin, repactacion_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: nuevoEstado === 'completada' 
        ? 'Repactación completada' 
        : `Cuota ${nuevasCuotasPagadas}/${rep.num_cuotas} pagada`,
      cuotas_pagadas: nuevasCuotasPagadas,
      cuotas_pendientes: rep.num_cuotas - nuevasCuotasPagadas,
      estado: nuevoEstado
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error pagando cuota:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Marcar repactación como incumplida
router.post('/marcar-incumplida', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { repactacion_id } = req.body;
    
    await client.query('BEGIN');
    
    // Obtener repactación y usuario
    const result = await client.query(
      `SELECT r.*, u.nombre 
       FROM repactaciones r
       JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.id = $1`,
      [repactacion_id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Repactación no encontrada');
    }
    
    const rep = result.rows[0];
    
    // Marcar como incumplida
    await client.query(
      `UPDATE repactaciones 
       SET estado = 'incumplida',
           fecha_fin = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [repactacion_id]
    );
    
    // Cambiar estado del usuario a corte_programado
    await client.query(
      `UPDATE usuarios 
       SET estado_servicio = 'corte_programado'
       WHERE id = $1`,
      [rep.usuario_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: `Repactación marcada como incumplida. Usuario ${rep.nombre} programado para corte.`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error marcando incumplimiento:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;