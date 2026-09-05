const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const getDias = (rango) => {
  const rangos = { '7d': 7, '15d': 15, '30d': 30, '3m': 90, '6m': 180, '1y': 365 };
  return rangos[rango] || 90;
};

router.get('/kpis', async (req, res) => {
  try {
    const dias = getDias(req.query.rango);

    const usuariosTotal  = await pool.query(`SELECT COUNT(*) as total FROM usuarios WHERE rol = $1`, ['usuario']);
    const usuariosActivos = await pool.query(`SELECT COUNT(*) as total FROM usuarios WHERE rol = $1 AND estado = $2`, ['usuario', 'activo']);
    const usuariosMorosos = await pool.query(
      `SELECT COUNT(DISTINCT u.id) as total FROM usuarios u
       INNER JOIN boletas b ON u.id = b.usuario_id
       WHERE b.estado IN ('pendiente', 'parcial') AND b.saldo_pendiente > 0 AND b.fecha_vencimiento < CURRENT_DATE`
    );
    const deudaTotal = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) as total FROM boletas
       WHERE estado IN ('pendiente', 'parcial') AND saldo_pendiente > 0`
    );
    const consumoPromedio = await pool.query(
      `SELECT AVG(consumo_m3) as promedio FROM lecturas
       WHERE fecha_lectura >= CURRENT_DATE - ($1 * INTERVAL '1 day')`, [dias]
    );
    const ingresosMes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM pagos
       WHERE fecha_pago >= CURRENT_DATE - ($1 * INTERVAL '1 day')`, [dias]
    );

    res.json({
      success: true,
      kpis: {
        total_usuarios: parseInt(usuariosTotal.rows[0].total),
        usuarios_activos: parseInt(usuariosActivos.rows[0].total),
        usuarios_morosos: parseInt(usuariosMorosos.rows[0].total),
        tasa_morosidad: ((parseInt(usuariosMorosos.rows[0].total) / parseInt(usuariosTotal.rows[0].total)) * 100).toFixed(1),
        deuda_total: parseFloat(deudaTotal.rows[0].total),
        consumo_promedio: parseFloat(consumoPromedio.rows[0].promedio || 0).toFixed(1),
        ingresos_mes_actual: parseFloat(ingresosMes.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error KPIs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/top-consumidores', async (req, res) => {
  try {
    const dias = getDias(req.query.rango);
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.numero_cliente,
        AVG(l.consumo_m3) as consumo_promedio,
        SUM(l.consumo_m3) as consumo_total
       FROM usuarios u
       INNER JOIN lecturas l ON u.id = l.usuario_id
       WHERE l.fecha_lectura >= CURRENT_DATE - ($1 * INTERVAL '1 day')
       GROUP BY u.id, u.nombre, u.numero_cliente
       ORDER BY consumo_total DESC LIMIT 10`, [dias]
    );
    res.json({ success: true, consumidores: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/top-deudores', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.numero_cliente, u.rut,
        SUM(b.saldo_pendiente) as deuda_total,
        COUNT(b.id) as boletas_pendientes,
        MIN(b.fecha_vencimiento) as fecha_primera_deuda,
        CURRENT_DATE - MIN(b.fecha_vencimiento) as dias_morosidad
       FROM usuarios u
       INNER JOIN boletas b ON u.id = b.usuario_id
       WHERE b.estado IN ('pendiente', 'parcial') AND b.saldo_pendiente > 0
       GROUP BY u.id, u.nombre, u.numero_cliente, u.rut
       ORDER BY deuda_total DESC LIMIT 10`
    );
    res.json({ success: true, deudores: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const getMesesAtras = (rango) => {
  const rangos = { '7d': 1, '15d': 1, '30d': 1, '3m': 3, '6m': 6, '1y': 12 };
  return rangos[rango] || 3;
};

router.get('/evolucion-consumo', async (req, res) => {
  try {
    const mesesAtras = getMesesAtras(req.query.rango);
    // Se agrupa por los campos mes/anio (el período real de facturación), no por
    // fecha_lectura: cargas masivas históricas dejaron fecha_lectura con la fecha
    // de la carga, no la del período, lo que mezclaba meses distintos en un mismo punto.
    const result = await pool.query(
      `SELECT
        TO_CHAR(TO_DATE(anio || '-' || LPAD(mes::text, 2, '0'), 'YYYY-MM'), 'Mon YYYY') as mes,
        AVG(consumo_m3) as consumo_promedio,
        SUM(consumo_m3) as consumo_total,
        COUNT(*) as lecturas_totales
       FROM lecturas
       WHERE (anio * 12 + mes) > (EXTRACT(YEAR FROM CURRENT_DATE)::int * 12 + EXTRACT(MONTH FROM CURRENT_DATE)::int - $1)
       GROUP BY anio, mes
       ORDER BY anio ASC, mes ASC`, [mesesAtras]
    );
    res.json({ success: true, evolucion: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/alertas', async (req, res) => {
  try {
    const dias = getDias(req.query.rango);

    const nuevosMorosos = await pool.query(
      `SELECT u.nombre, u.numero_cliente, b.periodo, b.saldo_pendiente, b.fecha_vencimiento
       FROM usuarios u INNER JOIN boletas b ON u.id = b.usuario_id
       WHERE b.estado IN ('pendiente', 'parcial') AND b.saldo_pendiente > 0
         AND b.fecha_vencimiento >= CURRENT_DATE - ($1 * INTERVAL '1 day')
         AND b.fecha_vencimiento < CURRENT_DATE
       ORDER BY b.fecha_vencimiento DESC LIMIT 5`, [dias]
    );

    const consumoAnormal = await pool.query(
      `WITH promedios AS (
        SELECT usuario_id, AVG(consumo_m3) as promedio FROM lecturas
        WHERE fecha_lectura >= CURRENT_DATE - ($1 * INTERVAL '1 day')
        GROUP BY usuario_id HAVING AVG(consumo_m3) > 0
      ),
      ultimas_lecturas AS (
        SELECT DISTINCT ON (usuario_id) usuario_id, consumo_m3, fecha_lectura
        FROM lecturas ORDER BY usuario_id, fecha_lectura DESC
      )
      SELECT u.nombre, u.numero_cliente,
        ul.consumo_m3 as consumo_actual, p.promedio as consumo_promedio,
        ((ul.consumo_m3 - p.promedio) / NULLIF(p.promedio, 0) * 100) as variacion_porcentaje
      FROM ultimas_lecturas ul
      JOIN promedios p ON ul.usuario_id = p.usuario_id
      JOIN usuarios u ON ul.usuario_id = u.id
      WHERE ABS((ul.consumo_m3 - p.promedio) / NULLIF(p.promedio, 0) * 100) > 30
      ORDER BY ABS((ul.consumo_m3 - p.promedio) / NULLIF(p.promedio, 0) * 100) DESC LIMIT 5`, [dias]
    );

    const cortesProximos = await pool.query(
      `SELECT u.nombre, u.numero_cliente, hc.fecha_corte, hc.motivo, hc.monto_corte
       FROM historial_cortes hc JOIN usuarios u ON hc.usuario_id = u.id
       WHERE hc.estado = 'cortado' AND hc.fecha_corte <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY hc.fecha_corte ASC LIMIT 5`
    );

    res.json({
      success: true,
      alertas: {
        nuevos_morosos: nuevosMorosos.rows,
        consumo_anormal: consumoAnormal.rows,
        cortes_proximos: cortesProximos.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;