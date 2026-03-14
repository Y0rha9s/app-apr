const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Obtener todos los insumos disponibles
router.get('/insumos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insumos WHERE activo = true ORDER BY categoria, nombre'
    );
    res.json({ success: true, insumos: result.rows });
  } catch (error) {
    console.error('Error obteniendo insumos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear nuevo préstamo de insumo
router.post('/crear', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { usuario_id, insumo_id, cantidad, num_cuotas, notas } = req.body;
    
    if (!usuario_id || !insumo_id || !cantidad || !num_cuotas) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: usuario_id, insumo_id, cantidad, num_cuotas'
      });
    }
    
    // Validar número de cuotas (1-24)
    if (num_cuotas < 1 || num_cuotas > 24) {
      return res.status(400).json({
        success: false,
        error: 'El número de cuotas debe ser entre 1 y 24'
      });
    }
    
    await client.query('BEGIN');
    
    // Obtener información del insumo
    const insumoResult = await client.query(
      'SELECT * FROM insumos WHERE id = $1 AND activo = true',
      [insumo_id]
    );
    
    if (insumoResult.rows.length === 0) {
      throw new Error('Insumo no encontrado o no disponible');
    }
    
    const insumo = insumoResult.rows[0];
    
    // Verificar stock disponible
    if (insumo.stock_disponible < cantidad) {
      throw new Error(`Stock insuficiente. Disponible: ${insumo.stock_disponible} ${insumo.unidad_medida}`);
    }
    
    // Calcular monto total
    const montoTotal = parseFloat(insumo.precio_unitario) * parseInt(cantidad);
    const cuotaMensual = Math.ceil(montoTotal / num_cuotas);
    
    // Obtener nombre del usuario
    const usuarioResult = await client.query(
      'SELECT nombre FROM usuarios WHERE id = $1',
      [usuario_id]
    );
    
    if (usuarioResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const nombreUsuario = usuarioResult.rows[0].nombre;
    
    // Crear préstamo
    const prestamoResult = await client.query(
      `INSERT INTO prestamos 
       (usuario_id, insumo_id, cantidad, monto_total, num_cuotas, cuota_mensual, cuotas_pagadas, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 'activo', $7)
       RETURNING id`,
      [usuario_id, insumo_id, cantidad, montoTotal, num_cuotas, cuotaMensual, notas]
    );
    
    const prestamoId = prestamoResult.rows[0].id;
    
    // Actualizar stock del insumo
    await client.query(
      'UPDATE insumos SET stock_disponible = stock_disponible - $1, updated_at = NOW() WHERE id = $2',
      [cantidad, insumo_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: `Préstamo creado para ${nombreUsuario}`,
      prestamo: {
        id: prestamoId,
        insumo: insumo.nombre,
        cantidad: cantidad,
        monto_total: montoTotal,
        num_cuotas: num_cuotas,
        cuota_mensual: cuotaMensual
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando préstamo:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Obtener préstamos activos
router.get('/activos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        i.nombre as insumo_nombre,
        i.unidad_medida,
        (p.num_cuotas - p.cuotas_pagadas) as cuotas_pendientes,
        (p.cuota_mensual * (p.num_cuotas - p.cuotas_pagadas)) as saldo_pendiente
       FROM prestamos p
       JOIN usuarios u ON p.usuario_id = u.id
       JOIN insumos i ON p.insumo_id = i.id
       WHERE p.estado = 'activo'
       ORDER BY p.created_at DESC`
    );
    
    res.json({ success: true, prestamos: result.rows });
  } catch (error) {
    console.error('Error obteniendo préstamos activos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener préstamos de un usuario
router.get('/usuario/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        p.*,
        i.nombre as insumo_nombre,
        i.unidad_medida,
        (p.num_cuotas - p.cuotas_pagadas) as cuotas_pendientes,
        (p.cuota_mensual * (p.num_cuotas - p.cuotas_pagadas)) as saldo_pendiente
       FROM prestamos p
       JOIN insumos i ON p.insumo_id = i.id
       WHERE p.usuario_id = $1
       ORDER BY p.created_at DESC`,
      [usuario_id]
    );
    
    res.json({ success: true, prestamos: result.rows });
  } catch (error) {
    console.error('Error obteniendo préstamos del usuario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pagar cuota de préstamo
router.post('/pagar-cuota', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { prestamo_id } = req.body;
    
    if (!prestamo_id) {
      return res.status(400).json({ success: false, error: 'Se requiere prestamo_id' });
    }
    
    await client.query('BEGIN');
    
    // Obtener préstamo
    const prestamoResult = await client.query(
      'SELECT * FROM prestamos WHERE id = $1',
      [prestamo_id]
    );
    
    if (prestamoResult.rows.length === 0) {
      throw new Error('Préstamo no encontrado');
    }
    
    const prestamo = prestamoResult.rows[0];
    
    if (prestamo.estado !== 'activo') {
      throw new Error('El préstamo no está activo');
    }
    
    const nuevasCuotasPagadas = prestamo.cuotas_pagadas + 1;
    const nuevoEstado = nuevasCuotasPagadas >= prestamo.num_cuotas ? 'completado' : 'activo';
    const fechaFin = nuevoEstado === 'completado' ? new Date() : null;
    
    // Actualizar préstamo
    await client.query(
      `UPDATE prestamos 
       SET cuotas_pagadas = $1,
           estado = $2,
           fecha_fin = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [nuevasCuotasPagadas, nuevoEstado, fechaFin, prestamo_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: nuevoEstado === 'completado' 
        ? 'Préstamo completado' 
        : `Cuota ${nuevasCuotasPagadas}/${prestamo.num_cuotas} pagada`,
      cuotas_pagadas: nuevasCuotasPagadas,
      cuotas_pendientes: prestamo.num_cuotas - nuevasCuotasPagadas,
      estado: nuevoEstado
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error pagando cuota:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Crear/Actualizar insumo (gestión de catálogo)
router.post('/insumos', async (req, res) => {
  try {
    const { nombre, descripcion, precio_unitario, stock_disponible, categoria, unidad_medida } = req.body;
    
    if (!nombre || !precio_unitario || !categoria || !unidad_medida) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: nombre, precio_unitario, categoria, unidad_medida'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO insumos (nombre, descripcion, precio_unitario, stock_disponible, categoria, unidad_medida)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, descripcion, precio_unitario, stock_disponible || 0, categoria, unidad_medida]
    );
    
    res.json({ success: true, insumo: result.rows[0] });
  } catch (error) {
    console.error('Error creando insumo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar stock de insumo
router.put('/insumos/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body; // cantidad a agregar (positivo) o quitar (negativo)
    
    const result = await pool.query(
      `UPDATE insumos 
       SET stock_disponible = stock_disponible + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [cantidad, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Insumo no encontrado' });
    }
    
    res.json({ success: true, insumo: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;