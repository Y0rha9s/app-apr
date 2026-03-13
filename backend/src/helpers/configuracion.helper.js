const pool = require('../config/database');

async function getConfig(clave) {
  const { rows } = await pool.query(
    'SELECT valor, tipo FROM configuracion_sistema WHERE clave = $1',
    [clave]
  );
  if (!rows[0]) return null;
  const { valor, tipo } = rows[0];
  if (tipo === 'numero') return parseInt(valor);
  if (tipo === 'boolean') return valor === 'true';
  return valor;
}

async function getCicloFechas() {
  const [inicioLecturas, finLecturas, entregaBoletas, reporteMensual] = await Promise.all([
    getConfig('dia_inicio_lecturas'),
    getConfig('dia_fin_lecturas'),
    getConfig('dia_entrega_boletas'),
    getConfig('dia_reporte_mensual'),
  ]);
  return { inicioLecturas, finLecturas, entregaBoletas, reporteMensual };
}

async function estaEnPeriodoLecturas() {
  const hoy = new Date().getDate();
  const { inicioLecturas, finLecturas } = await getCicloFechas();
  return hoy >= inicioLecturas && hoy <= finLecturas;
}

module.exports = { getConfig, getCicloFechas, estaEnPeriodoLecturas };