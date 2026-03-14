const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Registrar corte de servicio
router.post('/registrar-corte', async (req, res) => {
  const client = await pool.connect();

  try {
    const { usuario_id, motivo, monto_corte } = req.body;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere usuario_id'
      });
    }

    await client.query('BEGIN');

    // Verificar que el usuario no esté ya cortado
    const usuarioCheck = await client.query(
      'SELECT nombre, estado_servicio FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (usuarioCheck.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const usuario = usuarioCheck.rows[0];

    if (usuario.estado_servicio === 'cortado') {
      throw new Error('El usuario ya tiene el servicio cortado');
    }

    // Obtener configuración de montos
    const montoCorteConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_corte'"
    );
    const montoFinal = monto_corte || parseFloat(montoCorteConfig.rows[0]?.valor || 15000);

    // Registrar corte en historial
    const resultCorte = await client.query(
      `INSERT INTO historial_cortes 
       (usuario_id, fecha_corte, monto_corte, motivo, estado)
       VALUES ($1, CURRENT_DATE, $2, $3, 'cortado')
       RETURNING id`,
      [usuario_id, montoFinal, motivo || 'Morosidad']
    );

    const corteId = resultCorte.rows[0].id;

    // Cambiar estado del usuario a 'cortado'
    await client.query(
      `UPDATE usuarios 
       SET estado_servicio = 'cortado'
       WHERE id = $1`,
      [usuario_id]
    );

    // Obtener la próxima boleta (o crear una referencia para cuando se genere)
    // El monto se agregará cuando se genere la siguiente boleta

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: `Corte registrado para ${usuario.nombre}`,
      corte: {
        id: corteId,
        fecha_corte: new Date().toISOString().split('T')[0],
        monto_corte: montoFinal
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando corte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Registrar reposición de servicio
router.post('/registrar-reposicion', async (req, res) => {
  const client = await pool.connect();

  try {
    const { usuario_id, monto_reposicion } = req.body;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere usuario_id'
      });
    }

    await client.query('BEGIN');

    // Buscar corte activo
    const corteActivo = await client.query(
      `SELECT id, monto_reposicion 
       FROM historial_cortes 
       WHERE usuario_id = $1 AND estado = 'cortado'
       ORDER BY fecha_corte DESC 
       LIMIT 1`,
      [usuario_id]
    );

    if (corteActivo.rows.length === 0) {
      throw new Error('No hay un corte activo para este usuario');
    }

    const corteId = corteActivo.rows[0].id;

    // Obtener configuración de montos
    const montoReposicionConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_reposicion'"
    );
    const montoFinal = monto_reposicion || parseFloat(montoReposicionConfig.rows[0]?.valor || 15000);

    // Actualizar el corte con la fecha de reposición
    await client.query(
      `UPDATE historial_cortes 
       SET fecha_reposicion = CURRENT_DATE,
           monto_reposicion = $1,
           estado = 'repuesto',
           updated_at = NOW()
       WHERE id = $2`,
      [montoFinal, corteId]
    );

    // Cambiar estado del usuario a 'activo'
    await client.query(
      `UPDATE usuarios 
       SET estado_servicio = 'activo'
       WHERE id = $1`,
      [usuario_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Reposición registrada correctamente',
      reposicion: {
        corte_id: corteId,
        fecha_reposicion: new Date().toISOString().split('T')[0],
        monto_reposicion: montoFinal
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando reposición:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Obtener historial de cortes de un usuario
router.get('/historial/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const result = await pool.query(
      `SELECT 
        hc.*,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut
       FROM historial_cortes hc
       JOIN usuarios u ON hc.usuario_id = u.id
       WHERE hc.usuario_id = $1
       ORDER BY hc.fecha_corte DESC`,
      [usuario_id]
    );

    res.json({
      success: true,
      historial: result.rows
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener todos los usuarios cortados actualmente
router.get('/usuarios-cortados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.nombre,
        u.rut,
        u.medidor,
        u.direccion,
        hc.fecha_corte,
        hc.motivo,
        hc.monto_corte,
        CURRENT_DATE - hc.fecha_corte as dias_cortado
       FROM usuarios u
       JOIN historial_cortes hc ON u.id = hc.usuario_id
       WHERE u.estado_servicio = 'cortado'
         AND hc.estado = 'cortado'
       ORDER BY hc.fecha_corte DESC`
    );

    res.json({
      success: true,
      cortados: result.rows
    });

  } catch (error) {
    console.error('Error obteniendo usuarios cortados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ─── OBTENER USUARIOS CORTADOS ACTUALMENTE ────────────────────────────────────
router.get('/usuarios-cortados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.nombre,
        u.rut,
        u.medidor,
        u.direccion,
        hc.id AS corte_id,
        hc.fecha_corte,
        hc.motivo,
        hc.monto_corte,
        CURRENT_DATE - hc.fecha_corte AS dias_cortado
       FROM usuarios u
       JOIN historial_cortes hc ON u.id = hc.usuario_id
       WHERE u.estado_servicio = 'cortado'
         AND hc.estado = 'cortado'
       ORDER BY hc.fecha_corte DESC`
    );
    res.json({ success: true, cortados: result.rows });
  } catch (error) {
    console.error('Error obteniendo usuarios cortados:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── HISTORIAL DE UN USUARIO ─────────────────────────────────────────────────
router.get('/historial/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const result = await pool.query(
      `SELECT 
        hc.*,
        u.nombre AS usuario_nombre,
        u.rut AS usuario_rut
       FROM historial_cortes hc
       JOIN usuarios u ON hc.usuario_id = u.id
       WHERE hc.usuario_id = $1
       ORDER BY hc.fecha_corte DESC`,
      [usuario_id]
    );
    res.json({ success: true, historial: result.rows });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── REGISTRAR CORTE ──────────────────────────────────────────────────────────
router.post('/registrar-corte', async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario_id, motivo, monto_corte } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ success: false, error: 'Se requiere usuario_id' });
    }

    await client.query('BEGIN');

    // Verificar usuario y estado
    const usuarioCheck = await client.query(
      'SELECT nombre, estado_servicio FROM usuarios WHERE id = $1',
      [usuario_id]
    );
    if (usuarioCheck.rows.length === 0) throw new Error('Usuario no encontrado');

    const usuario = usuarioCheck.rows[0];
    if (usuario.estado_servicio === 'cortado') {
      throw new Error('El usuario ya tiene el servicio cortado');
    }

    // Monto desde config o parámetro
    const montoCorteConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_corte'"
    );
    const montoFinal = monto_corte || parseFloat(montoCorteConfig.rows[0]?.valor || 15000);

    // Insertar en historial
    const resultCorte = await client.query(
      `INSERT INTO historial_cortes 
       (usuario_id, fecha_corte, monto_corte, motivo, estado)
       VALUES ($1, CURRENT_DATE, $2, $3, 'cortado')
       RETURNING id`,
      [usuario_id, montoFinal, motivo || 'Morosidad']
    );
    const corteId = resultCorte.rows[0].id;

    // Actualizar estado del usuario
    await client.query(
      'UPDATE usuarios SET estado_servicio = $1 WHERE id = $2',
      ['cortado', usuario_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: `Corte registrado para ${usuario.nombre}`,
      corte: {
        id: corteId,
        fecha_corte: new Date().toISOString().split('T')[0],
        monto_corte: montoFinal
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando corte:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ─── REGISTRAR REPOSICIÓN ─────────────────────────────────────────────────────
router.post('/registrar-reposicion', async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario_id, monto_reposicion } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ success: false, error: 'Se requiere usuario_id' });
    }

    await client.query('BEGIN');

    // Buscar corte activo
    const corteActivo = await client.query(
      `SELECT id FROM historial_cortes 
       WHERE usuario_id = $1 AND estado = 'cortado'
       ORDER BY fecha_corte DESC LIMIT 1`,
      [usuario_id]
    );
    if (corteActivo.rows.length === 0) {
      throw new Error('No hay un corte activo para este usuario');
    }
    const corteId = corteActivo.rows[0].id;

    // Monto desde config o parámetro
    const montoRepConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_reposicion'"
    );
    const montoFinal = monto_reposicion || parseFloat(montoRepConfig.rows[0]?.valor || 15000);

    // Actualizar corte
    await client.query(
      `UPDATE historial_cortes 
       SET fecha_reposicion = CURRENT_DATE,
           monto_reposicion = $1,
           estado = 'repuesto',
           updated_at = NOW()
       WHERE id = $2`,
      [montoFinal, corteId]
    );

    // Restaurar estado usuario
    await client.query(
      'UPDATE usuarios SET estado_servicio = $1 WHERE id = $2',
      ['activo', usuario_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Reposición registrada correctamente',
      reposicion: {
        corte_id: corteId,
        fecha_reposicion: new Date().toISOString().split('T')[0],
        monto_reposicion: montoFinal
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando reposición:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});


module.exports = router;