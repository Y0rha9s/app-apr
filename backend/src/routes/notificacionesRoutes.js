const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const { consultarMorosos } = require('../utils/morosidad');
const { TIPOS, CANALES, claveBoleta, construirAvisoMora, registrarNotificacion } = require('../utils/notificaciones');

router.use(authMiddleware);

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_CHILE = `((n.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')`;
const LIMITE_MAXIMO = 500;

const COLUMNAS_LISTADO = `
  n.id, n.usuario_id, n.tipo, n.canal, n.titulo, n.mensaje, n.leida, n.boleta_id, n.nivel, n.generada_por,
  to_char(${FECHA_CHILE}, 'YYYY-MM-DD HH24:MI') AS fecha,
  u.nombre AS usuario_nombre, u.rut AS usuario_rut, u.numero_cliente,
  g.nombre AS generada_por_nombre`;

// ─── POST /api/notificaciones/avisos-mora ───────────────────────────────────
// Registra el aviso (nivel 1 = aviso_mora, nivel 2 = aviso_corte) para un usuario ({usuario_id})
// o para todos los de un nivel ({nivel}). El nivel y los montos se recalculan aca al momento de
// enviar (no se confia en lo que muestra la pantalla). No envia nada por fuera: solo registra.
router.post('/avisos-mora', soloRoles('admin', 'operador'), async (req, res) => {
  const { usuario_id, nivel } = req.body;
  const canal = req.body.canal || 'app';
  if (!CANALES.includes(canal)) return res.status(400).json({ error: 'Canal invalido' });
  if (!usuario_id && !nivel) return res.status(400).json({ error: 'Indica usuario_id o nivel' });
  if (usuario_id && nivel) return res.status(400).json({ error: 'Indica usuario_id o nivel, no ambos' });
  if (nivel && ![1, 2].includes(parseInt(nivel, 10))) return res.status(400).json({ error: 'Nivel invalido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const morosos = await consultarMorosos(client);
    const objetivo = usuario_id
      ? morosos.filter((m) => m.id === parseInt(usuario_id, 10))
      : morosos.filter((m) => m.nivel === parseInt(nivel, 10));

    if (usuario_id && objetivo.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El usuario no tiene boletas impagas vencidas' });
    }

    let creadas = 0;
    let duplicadas = 0;
    for (const m of objetivo) {
      const aviso = construirAvisoMora(m);
      const { creada } = await registrarNotificacion(client, {
        usuario_id: m.id,
        tipo: aviso.tipo,
        canal,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        generada_por: req.usuario.id,
        boleta_id: m.boleta_mas_antigua_id,
        nivel: m.nivel,
        clave_dedup: claveBoleta(m.boleta_mas_antigua_id)
      });
      if (creada) creadas += 1; else duplicadas += 1;
    }
    await client.query('COMMIT');
    res.json({ success: true, total: objetivo.length, creadas, duplicadas });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('avisos-mora:', error);
    res.status(500).json({ error: 'Error al registrar los avisos' });
  } finally {
    client.release();
  }
});

// ─── GET /api/notificaciones  (listado global, solo admin) ──────────────────
// Filtros: tipo, canal, usuario_id, desde, hasta (dias en hora de Chile), leida, limit
router.get('/', soloRoles('admin'), async (req, res) => {
  try {
    const { tipo, canal, usuario_id, desde, hasta, leida } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, LIMITE_MAXIMO);
    const where = [];
    const params = [];
    const agregar = (cond, valor) => { params.push(valor); where.push(cond.replace('?', `$${params.length}`)); };

    if (tipo) {
      if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo invalido' });
      agregar('n.tipo = ?', tipo);
    }
    if (canal) {
      if (!CANALES.includes(canal)) return res.status(400).json({ error: 'Canal invalido' });
      agregar('n.canal = ?', canal);
    }
    if (usuario_id) agregar('n.usuario_id = ?', parseInt(usuario_id, 10));
    if (desde) {
      if (!RE_FECHA.test(desde)) return res.status(400).json({ error: 'Fecha desde invalida' });
      agregar(`${FECHA_CHILE}::date >= ?::date`, desde);
    }
    if (hasta) {
      if (!RE_FECHA.test(hasta)) return res.status(400).json({ error: 'Fecha hasta invalida' });
      agregar(`${FECHA_CHILE}::date <= ?::date`, hasta);
    }
    if (leida === 'true' || leida === 'false') agregar('n.leida = ?', leida === 'true');

    params.push(limit);
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_LISTADO}
       FROM notificaciones n
       JOIN usuarios u ON u.id = n.usuario_id
       LEFT JOIN usuarios g ON g.id = n.generada_por
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY n.fecha DESC, n.id DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, notificaciones: rows });
  } catch (error) {
    console.error('listar notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener las notificaciones' });
  }
});

// ─── GET /api/notificaciones/usuario/:id  (ficha del socio) ─────────────────
router.get('/usuario/:id', soloRoles('admin', 'operador'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_LISTADO}
       FROM notificaciones n
       JOIN usuarios u ON u.id = n.usuario_id
       LEFT JOIN usuarios g ON g.id = n.generada_por
       WHERE n.usuario_id = $1
       ORDER BY n.fecha DESC, n.id DESC`,
      [parseInt(req.params.id, 10)]
    );
    res.json({ success: true, notificaciones: rows });
  } catch (error) {
    console.error('notificaciones de usuario:', error);
    res.status(500).json({ error: 'Error al obtener las notificaciones del usuario' });
  }
});

// ─── GET /api/notificaciones/mis  (bandeja del socio) ───────────────────────
// Solo canal 'app': otros canales no se entregan en la aplicacion.
router.get('/mis', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.tipo, n.titulo, n.mensaje, n.leida,
              to_char(((n.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago'), 'YYYY-MM-DD HH24:MI') AS fecha
       FROM notificaciones n
       WHERE n.usuario_id = $1 AND n.canal = 'app'
       ORDER BY n.leida ASC, n.fecha DESC, n.id DESC
       LIMIT 100`,
      [req.usuario.id]
    );
    res.json({ success: true, no_leidas: rows.filter((r) => !r.leida).length, notificaciones: rows });
  } catch (error) {
    console.error('mis notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener tus notificaciones' });
  }
});

router.patch('/mis/leidas', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE notificaciones SET leida = TRUE, fecha_lectura = NOW()
       WHERE usuario_id = $1 AND canal = 'app' AND leida = FALSE`,
      [req.usuario.id]
    );
    res.json({ success: true, marcadas: rowCount });
  } catch (error) {
    console.error('marcar todas leidas:', error);
    res.status(500).json({ error: 'Error al marcar las notificaciones' });
  }
});

// Solo se puede marcar como leida una notificacion propia.
router.patch('/:id/leida', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE notificaciones SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, NOW())
       WHERE id = $1 AND usuario_id = $2`,
      [parseInt(req.params.id, 10), req.usuario.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Notificacion no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('marcar leida:', error);
    res.status(500).json({ error: 'Error al marcar la notificacion' });
  }
});

module.exports = router;
