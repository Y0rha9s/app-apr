const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo JPG, PNG, WEBP o PDF'));
    }
  }
});

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// POST /api/comprobantes — socio sube comprobante
router.post('/', upload.single('comprobante'), async (req, res) => {
  try {
    const { usuario_id, boleta_id, monto_declarado, numero_operacion } = req.body;

    if (!usuario_id || !monto_declarado) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    let imagen_url = null;

    if (req.file) {
      const supabase = getSupabase();
      const timestamp = Date.now();
      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const fileName = `comprobante_${usuario_id}_${timestamp}${ext}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lecturas-fotos')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('lecturas-fotos')
        .getPublicUrl(filePath);

      imagen_url = urlData.publicUrl;
    }

    const { rows } = await pool.query(
      `INSERT INTO comprobantes_pago 
       (usuario_id, boleta_id, monto_declarado, numero_operacion, imagen_url, estado)
       VALUES ($1, $2, $3, $4, $5, 'pendiente')
       RETURNING *`,
      [
        parseInt(usuario_id),
        boleta_id ? parseInt(boleta_id) : null,
        parseFloat(monto_declarado),
        numero_operacion || null,
        imagen_url
      ]
    );

    // Actualizar boleta a estado comprobante_enviado
    if (boleta_id) {
      await pool.query(
        `UPDATE boletas SET estado = 'comprobante_enviado' WHERE id = $1`,
        [parseInt(boleta_id)]
      );
    }

    res.json({ success: true, comprobante: rows[0] });

  } catch (error) {
    console.error('Error subiendo comprobante:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/comprobantes/pendientes — admin/recaudador ve pendientes
router.get('/pendientes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        u.nombre AS usuario_nombre,
        u.rut AS usuario_rut,
        u.numero_cliente,
        b.periodo,
        b.total_a_pagar,
        b.saldo_pendiente
      FROM comprobantes_pago c
      JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN boletas b ON c.boleta_id = b.id
      WHERE c.estado = 'pendiente'
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/comprobantes/usuario/:id — socio ve sus comprobantes
router.get('/usuario/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        b.periodo,
        b.total_a_pagar
      FROM comprobantes_pago c
      LEFT JOIN boletas b ON c.boleta_id = b.id
      WHERE c.usuario_id = $1
      ORDER BY c.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/comprobantes/:id/validar — admin/recaudador valida
router.put('/:id/validar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { accion, observaciones, validado_por, monto_aplicar } = req.body;
    // accion: 'validar' o 'rechazar'

    await client.query('BEGIN');

    const { rows: compRows } = await client.query(
      'SELECT * FROM comprobantes_pago WHERE id = $1',
      [req.params.id]
    );

    if (!compRows[0]) throw new Error('Comprobante no encontrado');
    const comp = compRows[0];

    const nuevoEstado = accion === 'validar' ? 'validado' : 'rechazado';

    await client.query(
      `UPDATE comprobantes_pago 
       SET estado = $1, observaciones = $2, validado_por = $3, fecha_validacion = NOW()
       WHERE id = $4`,
      [nuevoEstado, observaciones || null, validado_por, req.params.id]
    );

    if (accion === 'validar' && comp.boleta_id) {
      const monto = parseFloat(monto_aplicar || comp.monto_declarado);

      // Registrar pago
      await client.query(
        `INSERT INTO pagos (usuario_id, boleta_id, monto, metodo_pago, fecha_pago, observaciones)
         VALUES ($1, $2, $3, 'transferencia', NOW(), $4)`,
        [comp.usuario_id, comp.boleta_id, monto, `Comprobante validado #${comp.id}`]
      );

      // Actualizar boleta
      await client.query(
        `UPDATE boletas 
         SET saldo_pendiente = GREATEST(0, saldo_pendiente - $1),
             estado = CASE 
               WHEN saldo_pendiente - $1 <= 0 THEN 'pagado'
               ELSE 'parcial'
             END
         WHERE id = $2`,
        [monto, comp.boleta_id]
      );
    } else if (accion === 'rechazar' && comp.boleta_id) {
      // Volver boleta a pendiente
      await client.query(
        `UPDATE boletas SET estado = 'pendiente' WHERE id = $1`,
        [comp.boleta_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, estado: nuevoEstado });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error validando comprobante:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;