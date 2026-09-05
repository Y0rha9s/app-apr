const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4
});

const DRY_RUN = process.env.DRY_RUN !== 'false';
const USUARIO_ID = 58; // Debora Luiza Muñoz Barra
const CARGO_FIJO_NUEVO = 99000;
const BOLETA_AGOSTO_ID = 2657;

(async () => {
  const client = await pool.connect();
  const log = { fecha: new Date().toISOString(), dry_run: DRY_RUN };
  try {
    await client.query('BEGIN');

    // 1. Columna cargo_fijo_personalizado en usuarios (NULL = usa el valor global de configuracion_sistema)
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo_fijo_personalizado NUMERIC NULL
    `);

    // 2. Setear el valor para Debora (medidor compartido de 33 familias, temporal hasta que la APR
    //    instale medidores individuales por proyecto)
    const { rows: usuarioAntes } = await client.query(
      `SELECT id, nombre, cargo_fijo_personalizado FROM usuarios WHERE id = $1`, [USUARIO_ID]
    );
    log.usuario_antes = usuarioAntes[0];

    await client.query(
      `UPDATE usuarios SET cargo_fijo_personalizado = $1 WHERE id = $2`,
      [CARGO_FIJO_NUEVO, USUARIO_ID]
    );

    const { rows: usuarioDespues } = await client.query(
      `SELECT id, nombre, cargo_fijo_personalizado FROM usuarios WHERE id = $1`, [USUARIO_ID]
    );
    log.usuario_despues = usuarioDespues[0];

    // 3. Corregir la boleta de agosto (2657): recalcular total_mes con el cargo fijo nuevo
    //    (reemplaza los 3.000 globales por 99.000) y poner saldo_anterior en 0
    const { rows: boletaAntes } = await client.query(
      `SELECT id, periodo, consumo_m3, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente, estado,
              cuota_prestamo, monto_corte, monto_reposicion, cuota_repactacion, monto_multas, monto_iva
       FROM boletas WHERE id = $1 AND usuario_id = $2`,
      [BOLETA_AGOSTO_ID, USUARIO_ID]
    );
    if (boletaAntes.length === 0) throw new Error('Boleta de agosto no encontrada para este usuario');
    const b = boletaAntes[0];
    log.boleta_antes = b;

    const CARGO_FIJO_VIEJO = 3000;
    const nuevoTotalMes = parseFloat(b.total_mes) - CARGO_FIJO_VIEJO + CARGO_FIJO_NUEVO;
    const nuevoSaldoAnterior = 0;
    const extras = parseFloat(b.cuota_prestamo || 0) + parseFloat(b.monto_corte || 0)
      + parseFloat(b.monto_reposicion || 0) + parseFloat(b.cuota_repactacion || 0)
      + parseFloat(b.monto_multas || 0) + parseFloat(b.monto_iva || 0);
    const nuevoTotalAPagar = nuevoTotalMes + nuevoSaldoAnterior + extras;
    // Nada se ha pagado todavia sobre esta boleta (saldo_pendiente == total_a_pagar), asi que el nuevo
    // saldo pendiente es el mismo nuevo total a pagar
    const nuevoSaldoPendiente = nuevoTotalAPagar;

    log.calculo = { nuevoTotalMes, nuevoSaldoAnterior, extras, nuevoTotalAPagar, nuevoSaldoPendiente };

    const { rows: boletaDespuesRows } = await client.query(
      `UPDATE boletas
       SET total_mes = $1, saldo_anterior = $2, total_a_pagar = $3, saldo_pendiente = $4
       WHERE id = $5
       RETURNING id, periodo, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente, estado`,
      [nuevoTotalMes, nuevoSaldoAnterior, nuevoTotalAPagar, nuevoSaldoPendiente, BOLETA_AGOSTO_ID]
    );
    log.boleta_despues = boletaDespuesRows[0];

    fs.writeFileSync('_tmp_resultado_cargo_fijo_debora.json', JSON.stringify(log, null, 2));

    console.log('=== USUARIO ===');
    console.log('Antes:', log.usuario_antes);
    console.log('Despues:', log.usuario_despues);
    console.log('\n=== BOLETA AGOSTO (2657) ===');
    console.log('Antes:', b);
    console.log('Despues:', log.boleta_despues);

    if (DRY_RUN) {
      console.log('\n>>> DRY_RUN activo: haciendo ROLLBACK. Nada se guardo. <<<');
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      console.log('\n>>> COMMIT aplicado. <<<');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
