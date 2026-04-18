const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const pool = require('../config/database');

// Rutas
router.get('/', usuarioController.getAll);
router.get('/:id', usuarioController.getById);
router.get('/:id/deuda', usuarioController.getDeuda);
router.get('/:id/info-completa', usuarioController.getInfoCompleta);
router.post('/', usuarioController.create);
router.put('/:id/suspender', usuarioController.suspender);
router.put('/:id/reponer', usuarioController.reponer);
router.put('/:id/tipo', async (req, res) => {
  try {
    const { tipo_usuario } = req.body;
    const { rows } = await pool.query(
      `UPDATE usuarios SET tipo_usuario = $1 WHERE id = $2 RETURNING *`,
      [tipo_usuario, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/:id/subsidio', async (req, res) => {
  try {
    const { tiene_subsidio } = req.body;
    const { rows } = await pool.query(
      `UPDATE usuarios SET tiene_subsidio = $1 WHERE id = $2 RETURNING *`,
      [tiene_subsidio, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;