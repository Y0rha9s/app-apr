const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { calcularTotalPorTramos: calcularTotalPorTramosBase } = require('../utils/tarifas');
const { aplicarSaldoFavor } = require('../utils/saldoFavor');

// Wrapper para mantener la firma usada en este archivo (pool tomado del closure)
const calcularTotalPorTramos = (consumoM3, tipoUsuario = 'normal') =>
  calcularTotalPorTramosBase(pool, consumoM3, tipoUsuario);

// Crear lectura y generar boleta automáticamente
router.post('/crear-con-boleta', async (req, res) => {
  const client = await pool.connect();

  try {
    const { usuario_id, lectura_actual, mes, anio } = req.body;

    // Validar datos
    if (!usuario_id || !lectura_actual || !mes || !anio) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: usuario_id, lectura_actual, mes, anio'
      });
    }

    await client.query('BEGIN');

    // 1. Obtener tipo de usuario
    const userResult = await client.query(
      'SELECT tipo_usuario, nombre, saldo_favor FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const tipoUsuario = userResult.rows[0].tipo_usuario;
    const nombreUsuario = userResult.rows[0].nombre;
    const saldoFavorUsuario = userResult.rows[0].saldo_favor;

    // 2. Obtener última lectura para calcular consumo
    const ultimaLectura = await client.query(
      `SELECT lectura_actual 
       FROM lecturas 
       WHERE usuario_id = $1 
       ORDER BY anio DESC, mes DESC 
       LIMIT 1`,
      [usuario_id]
    );

    const lecturaAnterior = ultimaLectura.rows.length > 0
      ? parseInt(ultimaLectura.rows[0].lectura_actual)
      : 0;

    // 3. Calcular monto (tramos de consumo + cargo fijo mensual)
    const consumoTemporal = Math.max(0, parseInt(lectura_actual) - lecturaAnterior);
    const calculoTotal = await calcularTotalPorTramos(consumoTemporal, tipoUsuario);
    const cargoFijoResult = await client.query(
      `SELECT valor FROM configuracion_sistema WHERE clave = 'cargo_fijo'`
    );
    const cargoFijo = parseFloat(cargoFijoResult.rows[0]?.valor || 3000);
    const montoCalculado = calculoTotal.total + cargoFijo;

    // 4. Insertar lectura
    const resultLectura = await client.query(
      `INSERT INTO lecturas 
   (usuario_id, lectura_anterior, lectura_actual, mes, anio, monto_calculado, fecha_lectura, foto_url, operador_id)
   VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8) 
   RETURNING id, consumo_m3`,
      [usuario_id, lecturaAnterior, lectura_actual, mes, anio, montoCalculado,
        req.body.foto_url || null,
        req.body.operador_id || null]
    );

    const lecturaId = resultLectura.rows[0].id;
    const consumoM3 = resultLectura.rows[0].consumo_m3;

    // 5. Obtener saldo anterior
    const saldoResult = await client.query(
      `SELECT saldo_pendiente 
       FROM boletas 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [usuario_id]
    );

    const saldoAnterior = saldoResult.rows.length > 0
      ? parseFloat(saldoResult.rows[0].saldo_pendiente)
      : 0;

    let montoCorte = 0;
    let montoReposicion = 0;

    const cortesResult = await client.query(
      `SELECT id, monto_corte, monto_reposicion, fecha_corte, fecha_reposicion, boleta_corte_id, boleta_reposicion_id
      FROM historial_cortes 
      WHERE usuario_id = $1 
      AND (boleta_corte_id IS NULL OR boleta_reposicion_id IS NULL)
      ORDER BY fecha_corte DESC`,
      [usuario_id]
    );

    for (const corte of cortesResult.rows) {
      // Agregar cargo de corte si no se ha cobrado
      if (!corte.boleta_corte_id && corte.fecha_corte) {
        montoCorte += parseFloat(corte.monto_corte);
      }
      // Agregar cargo de reposición si no se ha cobrado
      if (!corte.boleta_reposicion_id && corte.fecha_reposicion) {
        montoReposicion += parseFloat(corte.monto_reposicion);
      }
    }

    let cuotaRepactacion = 0;
    let repactacionId = null;

    const repactacionResult = await client.query(
      `SELECT id, cuota_mensual 
   FROM repactaciones 
   WHERE usuario_id = $1 
     AND estado = 'activa'
   ORDER BY created_at DESC 
   LIMIT 1`,
      [usuario_id]
    );

    if (repactacionResult.rows.length > 0) {
      cuotaRepactacion = parseFloat(repactacionResult.rows[0].cuota_mensual);
      repactacionId = repactacionResult.rows[0].id;
    }

    // 6. Calcular totales de boleta (aplicando saldo a favor, si tiene, sin perder el excedente)
    const totalMes = montoCalculado;
    const montoAntesDeCredito = totalMes + saldoAnterior + montoCorte + montoReposicion + cuotaRepactacion;
    const { totalAPagar, creditoAplicado, saldoFavorRestante } = aplicarSaldoFavor(montoAntesDeCredito, saldoFavorUsuario);
    const saldoPendiente = totalAPagar;

    // 7. Calcular fecha de vencimiento (15 días después)
    const fechaPeriodo = new Date(anio, mes - 1, 1);
    const fechaVencimiento = new Date(fechaPeriodo);
    fechaVencimiento.setDate(fechaPeriodo.getDate() + 15);

    // 8. Crear periodo en formato YYYY-MM
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    // 9. Insertar boleta
    const resultBoleta = await client.query(
      `INSERT INTO boletas 
   (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, 
    monto_corte, monto_reposicion, cuota_repactacion,
    total_a_pagar, saldo_pendiente, estado, descuento_subsidio, monto_iva, fecha_vencimiento)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
   RETURNING id`,
      [
        usuario_id,
        lecturaId,
        periodo,
        consumoM3,
        totalMes,
        saldoAnterior,
        montoCorte,
        montoReposicion,
        cuotaRepactacion,  // ← NUEVO
        totalAPagar,
        saldoPendiente,
        'pendiente',
        tipoUsuario === 'subsidiado' ? calculoTotal.subtotal * 0.5 : 0,
        calculoTotal.iva,
        fechaVencimiento
      ]
    );

    const boletaId = resultBoleta.rows[0].id;

    if (montoCorte > 0 || montoReposicion > 0) {
      for (const corte of cortesResult.rows) {
        if (!corte.boleta_corte_id && corte.fecha_corte) {
          await client.query(
            'UPDATE historial_cortes SET boleta_corte_id = $1 WHERE id = $2',
            [boletaId, corte.id]
          );
        }
        if (!corte.boleta_reposicion_id && corte.fecha_reposicion) {
          await client.query(
            'UPDATE historial_cortes SET boleta_reposicion_id = $1 WHERE id = $2',
            [boletaId, corte.id]
          );
        }
      }
    }

    if (creditoAplicado > 0) {
      await client.query('UPDATE usuarios SET saldo_favor = $1 WHERE id = $2', [saldoFavorRestante, usuario_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: `Lectura y boleta creadas para ${nombreUsuario}`,
      lectura: {
        id: lecturaId,
        consumo_m3: consumoM3,
        monto_calculado: montoCalculado
      },
      boleta: {
        id: boletaId,
        total_a_pagar: totalAPagar,
        fecha_vencimiento: fechaVencimiento
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando lectura con boleta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Obtener todas las lecturas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*,
        u.nombre AS usuario_nombre,
        u.rut AS usuario_rut,
        op.nombre AS operador_nombre
      FROM lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      LEFT JOIN usuarios op ON l.operador_id = op.id
      ORDER BY l.fecha_lectura DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo lecturas:', error);
    res.status(500).json({ error: error.message });
  }
});

const lecturaController = require('../controllers/lecturaController');

router.get('/simple', lecturaController.getAll); // Listado simple
router.get('/usuario/:usuarioId', lecturaController.getByUsuario);
router.get('/:id/historial', lecturaController.getHistorial); // HISTORIAL DE CAMBIOS
router.put('/:id', lecturaController.update); // ACTUALIZAR CON AUDITORÍA

module.exports = router;