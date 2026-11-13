const lecturaModel = require('../models/lecturaModel');
const pool = require('../config/database');
const { calcularTotalPorTramos, obtenerTarifaEspecial, montoTarifaEspecial } = require('../utils/tarifas');

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

      // Obtener valores actuales antes de modificar (incluye tipo_usuario para recalcular el monto)
      const lecturaActualResult = await pool.query(
        `SELECT l.*, u.tipo_usuario FROM lecturas l JOIN usuarios u ON u.id = l.usuario_id WHERE l.id = $1`,
        [id]
      );

      if (lecturaActualResult.rows.length === 0) {
        return res.status(404).json({ error: 'Lectura no encontrada' });
      }

      const lecturaAnterior = lecturaActualResult.rows[0];

      let medidorAnterior = null;
      if (typeof medidor === 'string') {
        const usuarioRes = await pool.query('SELECT medidor FROM usuarios WHERE id = $1', [lecturaAnterior.usuario_id]);
        medidorAnterior = usuarioRes.rows[0]?.medidor ?? null;
      }

      // Recalcular el monto en base a las lecturas nuevas: nunca confiar en el monto que manda el frontend,
      // ya que no se recalculaba al cambiar lectura_anterior/lectura_actual
      const consumoNuevo = Math.max(0, parseInt(lectura_actual) - parseInt(lectura_anterior));
      const calculo = await calcularTotalPorTramos(pool, consumoNuevo, lecturaAnterior.tipo_usuario || 'normal');
      const cargoFijoResult = await pool.query(`SELECT valor FROM configuracion_sistema WHERE clave = 'cargo_fijo'`);
      const cargoFijo = parseFloat(cargoFijoResult.rows[0]?.valor || 3000);
      const especial = await obtenerTarifaEspecial(pool, lecturaAnterior.usuario_id);
      const monto_calculado = especial
        ? montoTarifaEspecial(especial, consumoNuevo).total
        : Math.round(calculo.total + cargoFijo);

      // Actualizar lectura
      const result = await pool.query(
       `UPDATE lecturas
       SET lectura_anterior = $1,
       lectura_actual = $2,
       monto_calculado = $3,
       observaciones = $4
       WHERE id = $5
       RETURNING *`,
        [lectura_anterior, lectura_actual, monto_calculado, observaciones, id]
      );

      if (typeof medidor === 'string') {
        const nuevoMedidor = medidor.trim() || null;
        if (nuevoMedidor !== medidorAnterior) {
          await pool.query(
            'UPDATE usuarios SET medidor = $1 WHERE id = $2',
            [nuevoMedidor, lecturaAnterior.usuario_id]
          );
        }
      }

      const razonFinal = typeof medidor === 'string'
        ? `${razon_modificacion} | Medidor: ${medidorAnterior || '—'} -> ${(medidor || '').trim() || '—'}`
        : razon_modificacion;

      // Registrar en auditoría
      await pool.query(
        `INSERT INTO auditoria_lecturas 
         (lectura_id, usuario_modificador_id, 
          lectura_anterior_old, lectura_actual_old, monto_calculado_old,
          lectura_anterior_new, lectura_actual_new, monto_calculado_new,
          razon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          usuario_modificador_id,
          lecturaAnterior.lectura_anterior,
          lecturaAnterior.lectura_actual,
          lecturaAnterior.monto_calculado,
          lectura_anterior,
          lectura_actual,
          monto_calculado,
          razonFinal
        ]
      );

      // Sincronizar la boleta asociada: ajustar por la diferencia de monto,
      // sin tocar lo que ya se pagó (saldo_pendiente refleja los abonos ya aplicados)
      const boletaResult = await pool.query(
        `SELECT * FROM boletas WHERE lectura_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [id]
      );

      if (boletaResult.rows.length > 0) {
        const boleta = boletaResult.rows[0];
        const consumoM3Nuevo = result.rows[0].consumo_m3;
        const delta = monto_calculado - parseFloat(lecturaAnterior.monto_calculado || 0);

        // Lo que ya se pagó de esta boleta se respeta: el nuevo saldo es el nuevo total
        // menos lo pagado. Si lo pagado supera el nuevo total, el excedente va a saldo a
        // favor; si queda deuda y el usuario tiene saldo a favor, se descuenta de ahí.
        const totalAPagarAnterior = Math.round(parseFloat(boleta.total_a_pagar || 0));
        const pagado = Math.max(0, totalAPagarAnterior - Math.round(parseFloat(boleta.saldo_pendiente || 0)));
        const nuevoTotalMes = Math.round(parseFloat(boleta.total_mes || 0) + delta);
        let nuevoTotalAPagar = Math.max(0, totalAPagarAnterior + Math.round(delta));
        let nuevoSaldoPendiente = nuevoTotalAPagar - pagado;
        let excedente = 0;
        let credito = 0;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          if (nuevoSaldoPendiente < 0) {
            excedente = -nuevoSaldoPendiente;
            nuevoSaldoPendiente = 0;
          } else if (nuevoSaldoPendiente > 0) {
            const { rows: u } = await client.query(
              'SELECT saldo_favor FROM usuarios WHERE id = $1 FOR UPDATE', [boleta.usuario_id]
            );
            const disponible = Math.round(Math.max(0, parseFloat(u[0]?.saldo_favor || 0)));
            credito = Math.min(disponible, nuevoSaldoPendiente);
            nuevoSaldoPendiente -= credito;
            nuevoTotalAPagar -= credito;
          }

          // Estado coherente con el saldo (no se tocan boletas congeladas/anuladas)
          let nuevoEstado = boleta.estado;
          if (['pendiente', 'abonada', 'pagada', 'atrasada'].includes(boleta.estado)) {
            if (nuevoSaldoPendiente > 0) {
              nuevoEstado = pagado > 0 ? 'abonada' : 'pendiente';
            } else if (boleta.estado === 'pendiente' || boleta.estado === 'abonada') {
              nuevoEstado = 'pagada';
            }
          }

          await client.query(
            `UPDATE boletas SET consumo_m3 = $1, total_mes = $2, total_a_pagar = $3, saldo_pendiente = $4,
               estado = $5, saldo_favor_aplicado = COALESCE(saldo_favor_aplicado, 0) + $6
             WHERE id = $7`,
            [consumoM3Nuevo, nuevoTotalMes, nuevoTotalAPagar, nuevoSaldoPendiente, nuevoEstado, credito, boleta.id]
          );

          if (excedente > 0 || credito > 0) {
            await client.query(
              'UPDATE usuarios SET saldo_favor = COALESCE(saldo_favor, 0) - $1 + $2 WHERE id = $3',
              [credito, excedente, boleta.usuario_id]
            );
          }

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      res.json(result.rows[0]);
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
