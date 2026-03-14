const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Obtener tipo de usuario
router.get('/:id/tipo', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT tipo_usuario FROM usuarios WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ tipo_usuario: result.rows[0].tipo_usuario });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar tipo de usuario
router.put('/:id/tipo', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_usuario } = req.body;
    
    // Validar tipo
    const tiposValidos = ['normal', 'subsidiado', 'exento_iva'];
    if (!tiposValidos.includes(tipo_usuario)) {
      return res.status(400).json({ 
        error: 'Tipo de usuario inválido',
        validos: tiposValidos
      });
    }
    
    const result = await pool.query(
      'UPDATE usuarios SET tipo_usuario = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [tipo_usuario, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ 
      success: true,
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de tipos de usuario
router.get('/stats/tipos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        tipo_usuario,
        COUNT(*) as cantidad
      FROM usuarios
      WHERE rol = 'usuario'
      GROUP BY tipo_usuario
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;