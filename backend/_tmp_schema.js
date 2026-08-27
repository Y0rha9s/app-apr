const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4
});

(async () => {
  try {
    const cols = async (table) => {
      const r = await pool.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      console.log(`--- columns: ${table} ---`);
      console.log(r.rows);
    };
    await cols('boletas');
    await cols('pagos');
    await cols('lecturas');

    const fks = await pool.query(`
      SELECT
        tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND (tc.table_name = 'pagos' OR tc.table_name = 'boletas')
    `);
    console.log('--- FKs on pagos/boletas ---');
    console.log(fks.rows);

    const checks = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'boletas'::regclass AND contype = 'c'
    `);
    console.log('--- CHECK constraints on boletas ---');
    console.log(checks.rows);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
