const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Registrar corte de servicio. La evidencia (foto/video) se sube antes desde el
// frontend via /api/fotos/lectura (mismo bucket) y aca solo se guarda la URL.
// El GPS es opcional: si el operador no dio permiso o no hay señal, se guarda null.
router.post('/registrar-corte', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      usuario_id, motivo, monto_corte,
      evidencia_foto_url, evidencia_video_url, gps_lat, gps_lng
    } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ success: false, error: 'Se requiere usuario_id' });
    }

    await client.query('BEGIN');

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

    const montoCorteConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_corte'"
    );
    const montoFinal = monto_corte || parseFloat(montoCorteConfig.rows[0]?.valor || 15000);

    const resultCorte = await client.query(
      `INSERT INTO historial_cortes
       (usuario_id, fecha_corte, monto_corte, motivo, estado,
        evidencia_foto_url, evidencia_video_url, gps_lat, gps_lng)
       VALUES ($1, CURRENT_DATE, $2, $3, 'cortado', $4, $5, $6, $7)
       RETURNING id`,
      [
        usuario_id, montoFinal, motivo || 'Morosidad',
        evidencia_foto_url || null, evidencia_video_url || null,
        gps_lat ?? null, gps_lng ?? null
      ]
    );

    const corteId = resultCorte.rows[0].id;

    await client.query(
      `UPDATE usuarios SET estado_servicio = 'cortado' WHERE id = $1`,
      [usuario_id]
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

// Registrar reposición de servicio (el operador la marca manualmente eligiendo el
// usuario). El costo de reposición queda en historial_cortes.monto_reposicion sin
// boleta_reposicion_id asignado; se cobra automaticamente en la boleta siguiente
// que se genere para ese usuario (ver crear-con-boleta), igual que ya pasa hoy.
router.post('/registrar-reposicion', async (req, res) => {
  const client = await pool.connect();

  try {
    const { usuario_id, monto_reposicion, evidencia_foto_url, gps_lat, gps_lng } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ success: false, error: 'Se requiere usuario_id' });
    }

    await client.query('BEGIN');

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

    const montoReposicionConfig = await client.query(
      "SELECT valor FROM configuracion_sistema WHERE clave = 'monto_reposicion'"
    );
    const montoFinal = monto_reposicion || parseFloat(montoReposicionConfig.rows[0]?.valor || 15000);

    await client.query(
      `UPDATE historial_cortes
       SET fecha_reposicion = CURRENT_DATE,
           monto_reposicion = $1,
           estado = 'repuesto',
           reposicion_evidencia_foto_url = $2,
           reposicion_gps_lat = $3,
           reposicion_gps_lng = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [montoFinal, evidencia_foto_url || null, gps_lat ?? null, gps_lng ?? null, corteId]
    );

    await client.query(
      `UPDATE usuarios SET estado_servicio = 'activo' WHERE id = $1`,
      [usuario_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Reposición registrada correctamente. El costo se cobrará en la próxima boleta.',
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

// Historial de cortes de un usuario
router.get('/historial/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const result = await pool.query(
      `SELECT hc.*, u.nombre as usuario_nombre, u.rut as usuario_rut
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

// Usuarios actualmente cortados
router.get('/usuarios-cortados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id, u.nombre, u.rut, u.medidor, u.direccion,
        hc.id AS corte_id, hc.fecha_corte, hc.motivo, hc.monto_corte,
        hc.evidencia_foto_url, hc.evidencia_video_url, hc.gps_lat, hc.gps_lng,
        CURRENT_DATE - hc.fecha_corte as dias_cortado
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

module.exports = router;
