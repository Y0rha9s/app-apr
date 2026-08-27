const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4
});

(async () => {
  try {
    const r = await pool.query(`SELECT id, nombre, numero_cliente, rol, estado FROM usuarios WHERE rol = 'socio'`);
    console.log(`--- usuarios con rol='socio' (${r.rows.length}) ---`);
    console.log(r.rows);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
