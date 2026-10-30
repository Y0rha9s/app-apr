// Migracion de la tabla `notificaciones`.
//   node scripts/migrarNotificaciones.js            -> DRY-RUN: ejecuta todo y hace ROLLBACK
//   node scripts/migrarNotificaciones.js --aplicar  -> ejecuta y hace COMMIT
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

const aplicar = process.argv.includes('--aplicar');
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '2026-10-28_notificaciones.sql'), 'utf8');

const CONTAR = [
  'usuarios', 'boletas', 'pagos', 'cajas', 'lecturas', 'historial_cortes', 'avisos_generados', 'notificaciones_enviadas'
];

async function conteos(client) {
  const out = {};
  for (const t of CONTAR) out[t] = parseInt((await client.query(`SELECT count(*) FROM ${t}`)).rows[0].count, 10);
  return out;
}

(async () => {
  const client = await pool.connect();
  try {
    const antes = await conteos(client);
    const existiaAntes = (await client.query(`SELECT to_regclass('public.notificaciones') AS t`)).rows[0].t !== null;
    console.log(`Modo: ${aplicar ? 'APLICAR (commit)' : 'DRY-RUN (rollback)'} | tabla notificaciones ya existia: ${existiaAntes}`);

    await client.query('BEGIN');
    await client.query(sql);

    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'notificaciones' ORDER BY ordinal_position`
    );
    console.table(cols.rows);
    const idx = await client.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'notificaciones' ORDER BY 1`);
    console.log('Indices:', idx.rows.map((r) => r.indexname).join(', '));
    const chk = await client.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'notificaciones'::regclass ORDER BY 1`
    );
    console.table(chk.rows);

    const despues = await conteos(client);
    const distintos = CONTAR.filter((t) => antes[t] !== despues[t]);
    if (distintos.length) throw new Error(`La migracion altero conteos de: ${distintos.join(', ')}`);
    console.log('Conteos de tablas existentes sin cambios:', JSON.stringify(despues));

    if (aplicar) {
      await client.query('COMMIT');
      console.log('COMMIT: migracion aplicada.');
    } else {
      await client.query('ROLLBACK');
      const sigue = (await client.query(`SELECT to_regclass('public.notificaciones') AS t`)).rows[0].t;
      console.log(`ROLLBACK: nada quedo en la base (to_regclass tras rollback = ${sigue}).`);
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
