// backend/src/controllers/cortesController.js
const pool = require('../config/database');

// Listar todos los cortes (con info de usuario)
const getCortes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        u.nombre AS usuario_nombre, 
        u.rut AS usuario_rut,
        u.direccion AS usuario_direccion
      FROM cortes c
      JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.fecha_corte DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cortes' });
  }
};

// Obtener cortes de un usuario específico
const getCortesByUsuario = async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM cortes WHERE usuario_id = $1 ORDER BY fecha_corte DESC`,
      [usuarioId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cortes del usuario' });
  }
};

// Registrar nuevo corte
const registrarCorte = async (req, res) => {
  const { usuario_id, motivo } = req.body;
  const creado_por = req.user.id;

  try {
    // Verificar que no tenga ya un corte activo
    const activo = await pool.query(
      `SELECT id FROM cortes WHERE usuario_id = $1 AND estado = 'cortado'`,
      [usuario_id]
    );
    if (activo.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya tiene un corte activo' });
    }

    // Registrar el corte
    const result = await pool.query(
      `INSERT INTO cortes (usuario_id, motivo, creado_por)
       VALUES ($1, $2, $3) RETURNING *`,
      [usuario_id, motivo, creado_por]
    );

    // Cambiar estado del usuario a 'suspendido'
    await pool.query(
      `UPDATE usuarios SET estado = 'suspendido' WHERE id = $1`,
      [usuario_id]
    );

    // Agregar cobro de corte a boleta pendiente o crear registro de deuda
    await pool.query(
      `INSERT INTO transacciones (usuario_id, tipo, monto, descripcion, fecha)
       VALUES ($1, 'cargo', 15000, 'Cobro por corte de servicio', NOW())`,
      [usuario_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar corte' });
  }
};

// Registrar reposición
const registrarReposicion = async (req, res) => {
  const { corteId } = req.params;
  const repuesto_por = req.user.id;

  try {
    const corte = await pool.query(
      `SELECT * FROM cortes WHERE id = $1 AND estado = 'cortado'`,
      [corteId]
    );

    if (corte.rows.length === 0) {
      return res.status(404).json({ error: 'Corte no encontrado o ya fue repuesto' });
    }

    const { usuario_id } = corte.rows[0];

    // Actualizar corte
    const result = await pool.query(
      `UPDATE cortes 
       SET estado = 'repuesto', fecha_reposicion = NOW(), repuesto_por = $1
       WHERE id = $2 RETURNING *`,
      [repuesto_por, corteId]
    );

    // Restaurar estado del usuario
    await pool.query(
      `UPDATE usuarios SET estado = 'activo' WHERE id = $1`,
      [usuario_id]
    );

    // Cobro por reposición
    await pool.query(
      `INSERT INTO transacciones (usuario_id, tipo, monto, descripcion, fecha)
       VALUES ($1, 'cargo', 15000, 'Cobro por reposición de servicio', NOW())`,
      [usuario_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar reposición' });
  }
};

module.exports = { getCortes, getCortesByUsuario, registrarCorte, registrarReposicion };