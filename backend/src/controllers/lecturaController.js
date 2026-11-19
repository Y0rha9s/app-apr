const lecturaModel = require('../models/lecturaModel');
const pool = require('../config/database');
const { aplicarCambioLectura } = require('../utils/recalculoLectura');

const lecturaController = {
  // Obtener todas las lecturas
  getAll: async (req, res) => {
    try {
      const lecturas = await lecturaModel.getAll();
      res.json(lecturas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener lecturas por usuario
  getByUsuario: async (req, res) => {
    try {
      const { usuarioId } = req.params;
      const lecturas = await lecturaModel.getByUsuario(usuarioId);
      res.json(lecturas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Crear lectura
  create: async (req, res) => {
    try {
      const nuevaLectura = await lecturaModel.create(req.body);
      res.status(201).json(nuevaLectura);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar lectura CON auditoría
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { lectura_anterior, lectura_actual, observaciones, razon_modificacion, usuario_modificador_id, medidor } = req.body;

      if (!razon_modificacion) {
        return res.status(400).json({ error: 'Debe proporcionar una razón para la modificación' });
      }

      if (!Number.isInteger(parseInt(lectura_anterior)) || !Number.isInteger(parseInt(lectura_actual))) {
        return res.status(400).json({ error: 'Las lecturas deben ser números válidos' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const { rows: [actualEnBase] } = await client.query('SELECT usuario_id FROM lecturas WHERE id = $1', [id]);
        if (!actualEnBase) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Lectura no encontrada' });
        }

        let medidorAnterior = null;
        if (typeof medidor === 'string') {
          const usuarioRes = await client.query('SELECT medidor FROM usuarios WHERE id = $1', [actualEnBase.usuario_id]);
          medidorAnterior = usuarioRes.rows[0]?.medidor ?? null;
        }

        // Recalcula la lectura, su boleta, el saldo arrastrado y la lectura del mes siguiente.
        const plan = await aplicarCambioLectura(client, {
          lecturaId: parseInt(id),
          lecturaAnterior: parseInt(lectura_anterior),
          lecturaActual: parseInt(lectura_actual)
        });

        const { rows: [lectura] } = await client.query(
          'UPDATE lecturas SET observaciones = $1 WHERE id = $2 RETURNING *', [observaciones, id]
        );

        if (typeof medidor === 'string') {
          const nuevoMedidor = medidor.trim() || null;
          if (nuevoMedidor !== medidorAnterior) {
            await client.query('UPDATE usuarios SET medidor = $1 WHERE id = $2', [nuevoMedidor, actualEnBase.usuario_id]);
          }
        }

        const razonFinal = typeof medidor === 'string'
          ? `${razon_modificacion} | Medidor: ${medidorAnterior || '—'} -> ${(medidor || '').trim() || '—'}`
          : razon_modificacion;

        // Auditoria de la lectura editada y de las ajustadas en cadena
        const modificador = req.usuario?.id || usuario_modificador_id;
        const auditadas = plan.lecturas.some((l) => l.id === lectura.id) ? plan.lecturas : [plan.lectura, ...plan.lecturas];
        for (const l of auditadas) {
          const previa = plan.antes.get(l.id);
          await client.query(
            `INSERT INTO auditoria_lecturas
             (lectura_id, usuario_modificador_id,
              lectura_anterior_old, lectura_actual_old, monto_calculado_old,
              lectura_anterior_new, lectura_actual_new, monto_calculado_new,
              razon)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [l.id, modificador, previa.lectura_anterior, previa.lectura_actual, previa.monto_calculado,
              l.lectura_anterior, l.lectura_actual, l.monto_calculado,
              l.id === lectura.id ? razonFinal : `Ajuste automático por corrección de la lectura ${lectura.id}`]
          );
        }

        await client.query('COMMIT');
        res.json({ ...lectura, avisos: plan.avisos });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener historial de modificaciones de una lectura
  getHistorial: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT a.*, u.nombre as modificado_por 
         FROM auditoria_lecturas a
         LEFT JOIN usuarios u ON a.usuario_modificador_id = u.id
         WHERE a.lectura_id = $1
         ORDER BY a.fecha_modificacion DESC`,
        [id]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = lecturaController;
