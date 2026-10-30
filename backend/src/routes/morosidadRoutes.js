const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { UMBRAL_BOLETAS_CORTE, NIVEL_CORTE, consultarMorosos } = require('../utils/morosidad');

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

// Obtener usuarios morosos ('abonada' es el estado real de pago parcial en este sistema,
// no 'parcial' -- el filtro anterior nunca calzaba con boletas parcialmente pagadas)
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
      WHERE b.estado IN ('pendiente', 'abonada', 'atrasada')
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

// Usuarios elegibles para corte: UMBRAL_BOLETAS_CORTE o mas boletas impagas (ver utils/morosidad.js).
// Antes se medía por 90 dias desde el vencimiento mas antiguo.
router.get('/para-corte', async (req, res) => {
  try {
    const morosos = await consultarMorosos(pool);
    const para_corte = morosos
      .filter((m) => m.nivel === NIVEL_CORTE)
      .map((m) => ({
        id: m.id, nombre: m.nombre, rut: m.rut, medidor: m.medidor, direccion: m.direccion,
        estado_servicio: m.estado_servicio, boletas_impagas: m.boletas_impagas,
        deuda_total: m.deuda_total,
        primera_fecha_vencida: m.fecha_vencimiento_mas_antigua,
        dias_morosidad: m.dias_mora
      }));

    res.json({ success: true, umbral_boletas_corte: UMBRAL_BOLETAS_CORTE, para_corte });
  } catch (error) {
    console.error('Error obteniendo para corte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clasificacion por niveles para el modulo Cobranza (calculado al consultar, sin cron).
// La regla vive en utils/morosidad.js (UMBRAL_BOLETAS_CORTE / clasificarNivelMorosidad):
// Nivel 1 = 1 boleta impaga (~30 dias, aviso)
// Nivel 2 = UMBRAL_BOLETAS_CORTE (2) o mas boletas impagas (~60 dias, elegible para aviso de corte / corte)
// Cada usuario trae aviso_enviado: si ya existe el aviso (canal app) de su nivel para su boleta
// impaga mas antigua. Es solo lectura; los avisos se registran con POST /api/notificaciones/avisos-mora.
router.get('/niveles', async (req, res) => {
  try {
    const morosos = await consultarMorosos(pool);

    let enviados = new Set();
    try {
      const { rows } = await pool.query(
        `SELECT usuario_id, tipo, clave_dedup FROM notificaciones
         WHERE canal = 'app' AND tipo IN ('aviso_mora', 'aviso_corte') AND usuario_id = ANY($1::int[])`,
        [morosos.map((m) => m.id)]
      );
      enviados = new Set(rows.map((r) => `${r.usuario_id}|${r.tipo}|${r.clave_dedup}`));
    } catch (e) {
      // La tabla notificaciones puede no existir todavia (migracion pendiente): se muestra sin marcas.
      if (e.code !== '42P01') throw e;
    }

    const niveles = { 1: [], 2: [] };
    for (const m of morosos) {
      const tipo = m.nivel === NIVEL_CORTE ? 'aviso_corte' : 'aviso_mora';
      niveles[m.nivel].push({
        ...m,
        aviso_enviado: enviados.has(`${m.id}|${tipo}|boleta:${m.boleta_mas_antigua_id}`)
      });
    }

    res.json({ success: true, umbral_boletas_corte: UMBRAL_BOLETAS_CORTE, niveles });
  } catch (error) {
    console.error('Error clasificando morosidad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;