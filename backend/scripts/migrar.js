// Ejecuta un archivo de backend/migrations dentro de una transaccion.
//   node scripts/migrar.js 2026-10-30_recibos_pago.sql            -> DRY-RUN: ejecuta todo y hace ROLLBACK
//   node scripts/migrar.js 2026-10-30_recibos_pago.sql --aplicar  -> ejecuta y hace COMMIT
// Verifica ademas que la migracion no cambie los conteos de las tablas existentes.
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

const archivo = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const aplicar = process.argv.includes('--aplicar');
if (!archivo) {
  console.error('Uso: node scripts/migrar.js <archivo.sql> [--aplicar]');
  process.exit(1);
}
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', archivo), 'utf8');

async function conteos(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`
  );
  const out = {};
  for (const { table_name } of rows) out[table_name] = parseInt((await client.query(`SELECT count(*) FROM "${table_name}"`)).rows[0].count, 10);
  return out;
}

(async () => {
  const client = await pool.connect();
  try {
    console.log(`Modo: ${aplicar ? 'APLICAR (commit)' : 'DRY-RUN (rollback)'} | ${archivo}`);
    const antes = await conteos(client);
    await client.query('BEGIN');
    await client.query(sql);
    const despues = await conteos(client);
    const nuevas = Object.keys(despues).filter((t) => !(t in antes));
    const alteradas = Object.keys(antes).filter((t) => antes[t] !== despues[t]);
    console.log('Tablas nuevas:', nuevas.join(', ') || '(ninguna)');
    if (alteradas.length) throw new Error(`La migracion altero filas de: ${alteradas.join(', ')}`);
    console.log('Filas de las tablas existentes: sin cambios');

    if (aplicar) {
      await client.query('COMMIT');
      console.log('COMMIT: migracion aplicada.');
    } else {
      await client.query('ROLLBACK');
      const sigue = (await conteos(client));
      console.log(`ROLLBACK: nada quedo en la base (tablas nuevas que siguen existiendo: ${nuevas.filter((t) => t in sigue).length}).`);
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
