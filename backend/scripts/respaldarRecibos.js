// Respalda en `recibos_pago` los recibos de los pagos registrados por Caja que aun no tienen copia.
//   node scripts/respaldarRecibos.js            -> DRY-RUN: inserta y hace ROLLBACK
//   node scripts/respaldarRecibos.js --aplicar  -> inserta y hace COMMIT
// Solo agrega filas a recibos_pago; NO modifica pagos, boletas ni usuarios. Los pagos sin caja
// (migracion historica, Mercado Pago, comprobantes, carga masiva) se dejan fuera a proposito.
// Los recibos de pagos antiguos son una reconstruccion: las boletas que cubrieron se deducen por fecha.
const pool = require('../src/config/database');
const { guardarRecibo } = require('../src/utils/recibos');

const aplicar = process.argv.includes('--aplicar');

(async () => {
  const client = await pool.connect();
  try {
    console.log(`Modo: ${aplicar ? 'APLICAR (commit)' : 'DRY-RUN (rollback)'}`);
    const antes = (await client.query(
      `SELECT (SELECT count(*) FROM pagos) pagos, (SELECT count(*) FROM boletas) boletas, (SELECT count(*) FROM usuarios) usuarios, (SELECT count(*) FROM recibos_pago) recibos`
    )).rows[0];

    await client.query('BEGIN');
    const { rows: pendientes } = await client.query(
      `SELECT p.id FROM pagos p
       WHERE p.caja_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM recibos_pago r WHERE r.pago_id = p.id)
       ORDER BY p.id`
    );
    console.log(`Pagos de Caja sin recibo respaldado: ${pendientes.length}`);

    let insertados = 0;
    for (const { id } of pendientes) {
      if (await guardarRecibo(client, id)) insertados++;
    }

    const resumen = (await client.query(
      `SELECT forma_pago, count(*)::int AS n, sum(monto) AS total,
              count(*) FILTER (WHERE cardinality(periodos) = 0)::int AS sin_boletas_identificadas
       FROM recibos_pago GROUP BY 1 ORDER BY 1`
    )).rows;
    console.log(`Recibos insertados: ${insertados}`);
    console.table(resumen);

    const despues = (await client.query(
      `SELECT (SELECT count(*) FROM pagos) pagos, (SELECT count(*) FROM boletas) boletas, (SELECT count(*) FROM usuarios) usuarios`
    )).rows[0];
    if (despues.pagos !== antes.pagos || despues.boletas !== antes.boletas || despues.usuarios !== antes.usuarios) {
      throw new Error('Cambiaron los conteos de pagos/boletas/usuarios; se aborta');
    }
    console.log('pagos, boletas y usuarios: sin cambios');

    if (aplicar) {
      await client.query('COMMIT');
      console.log('COMMIT: recibos respaldados.');
    } else {
      await client.query('ROLLBACK');
      const quedan = (await client.query('SELECT count(*) FROM recibos_pago')).rows[0].count;
      console.log(`ROLLBACK: nada quedo guardado (recibos_pago tiene ${quedan} filas).`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR, se hizo ROLLBACK:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
