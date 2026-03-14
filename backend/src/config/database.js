const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const poolConfig = {
  connectionString: connectionString,
};

// Habilitar SSL si es producción O si nos conectamos a Supabase (requiere SSL)
if ((isProduction || (connectionString && connectionString.includes('supabase.co'))) && connectionString) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool({
  ...poolConfig,
  family: 4
});

// Probar conexión
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error conectando a la base de datos:', err.stack);
  }
  console.log('✓ Conectado a PostgreSQL');
  release();
});

module.exports = pool;
