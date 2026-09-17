const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { calcularPeriodoDestino } = require('../utils/multas');

// ─── TIPOS DE MULTA (catalogo administrable) ─────────────────────────────────
router.get('/tipos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_multa ORDER BY activo DESC, nombre ASC');
    res.json({ success: true, tipos: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tipos', async (req, res) => {
  try {
    const { nombre, monto_sugerido } = req.body;
    if (!nombre) return res.status(400).json({ success: false, error: 'Falta el nombre del tipo de multa' });

    const result = await pool.query(
      'INSERT INTO tipos_multa (nombre, monto_sugerido) VALUES ($1, $2) RETURNING *',
      [nombre, parseFloat(monto_sugerido) || 0]
    );
    res.json({ success: true, tipo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/tipos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, monto_sugerido, activo } = req.body;

    const result = await pool.query(
      `UPDATE tipos_multa SET
         nombre = COALESCE($1, nombre),
         monto_sugerido = COALESCE($2, monto_sugerido),
         activo = COALESCE($3, activo)
       WHERE id = $4 RETURNING *`,
      [nombre, monto_sugerido !== undefined ? parseFloat(monto_sugerido) : null, activo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tipo de multa no encontrado' });
    res.json({ success: true, tipo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── MULTAS ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const params = [];
    let where = '';
    if (estado) { params.push(estado); where = `WHERE m.estado = $${params.length}`; }

    const result = await pool.query(
      `SELECT m.*, u.nombre AS usuario_nombre, u.rut AS usuario_rut,
        t.nombre AS tipo_nombre,
        b.periodo AS boleta_periodo
       FROM multas m
       JOIN usuarios u ON u.id = m.usuario_id
       LEFT JOIN tipos_multa t ON t.id = m.tipo_multa_id
       LEFT JOIN boletas b ON b.id = m.boleta_id
       ${where}
       ORDER BY m.fecha DESC, m.id DESC`,
      params
    );
    res.json({ success: true, multas: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuario_id, tipo_multa_id, monto, motivo, fecha } = req.body;

    if (!usuario_id || !monto) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos: usuario_id, monto' });
    }

    const fechaMulta = fecha ? new Date(fecha) : new Date();
    const periodoDestino = calcularPeriodoDestino(fechaMulta);

    const result = await pool.query(
      `INSERT INTO multas (usuario_id, tipo_multa_id, monto, motivo, fecha, periodo_destino, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'activa')
       RETURNING *`,
      [usuario_id, tipo_multa_id || null, parseFloat(monto), motivo || null, fechaMulta.toISOString().split('T')[0], periodoDestino]
    );

    res.json({
      success: true,
      mensaje: `Multa creada, se cobrará en la boleta del período ${periodoDestino}`,
      multa: result.rows[0]
    });
  } catch (error) {
    console.error('Error creando multa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Anular multa. Si ya estaba vinculada a una boleta generada (boleta_id no nulo),
// se le devuelve el monto al usuario como saldo a favor, porque ya se le cobro.
router.post('/:id/anular', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM multas WHERE id = $1', [id]);
    if (rows.length === 0) throw new Error('Multa no encontrada');
    const multa = rows[0];

    if (multa.estado === 'anulada') throw new Error('Esta multa ya estaba anulada');

    await client.query(
      `UPDATE multas SET estado = 'anulada', anulada_motivo = $1, anulada_at = NOW() WHERE id = $2`,
      [motivo || null, id]
    );

    let saldoFavorGenerado = false;
    if (multa.boleta_id) {
      await client.query(
        `UPDATE usuarios SET saldo_favor = COALESCE(saldo_favor, 0) + $1 WHERE id = $2`,
        [parseFloat(multa.monto), multa.usuario_id]
      );
      saldoFavorGenerado = true;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      mensaje: saldoFavorGenerado
        ? `Multa anulada. Como ya estaba cobrada en una boleta, se agregó ${multa.monto} como saldo a favor del usuario.`
        : 'Multa anulada (todavía no había sido cobrada en ninguna boleta).',
      saldo_favor_generado: saldoFavorGenerado
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error anulando multa:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
