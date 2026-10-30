const { UMBRAL_BOLETAS_CORTE, NIVEL_CORTE } = require('./morosidad');

const TIPOS = ['aviso_mora', 'aviso_corte', 'corte', 'reconexion', 'prestamo', 'otro'];
// 'whatsapp' queda como valor valido para registrar un segundo aviso del mismo caso,
// pero NO hay envio implementado: hoy solo el canal 'app' llega al socio.
const CANALES = ['app', 'whatsapp'];

const formatearCLP = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(parseFloat(n) || 0);

// Control de duplicados: una fila por (usuario, tipo, canal, clave). La clave identifica el caso
// ('boleta:<id>' para avisos de mora/corte, 'corte:<id>', 'reposicion:<id>'). Otro canal = otra fila.
const claveBoleta = (boletaId) => `boleta:${boletaId}`;

function construirAvisoMora(moroso) {
  const esCorte = moroso.nivel === NIVEL_CORTE;
  const n = moroso.boletas_impagas;
  const deuda = formatearCLP(moroso.deuda_total);
  const desde = moroso.vencimiento_mas_antiguo_txt;
  if (esCorte) {
    return {
      tipo: 'aviso_corte',
      titulo: 'Aviso de corte de servicio',
      mensaje:
        `Tienes ${n} boletas impagas vencidas por un total de ${deuda} (la más antigua venció el ${desde}). ` +
        `Al acumular ${UMBRAL_BOLETAS_CORTE} o más boletas impagas tu servicio queda elegible para corte. ` +
        `Regulariza tu pago a la brevedad para evitarlo.`
    };
  }
  return {
    tipo: 'aviso_mora',
    titulo: 'Aviso de mora',
    mensaje:
      `Tienes 1 boleta impaga vencida por ${deuda} (venció el ${desde}). ` +
      `Te pedimos regularizar tu pago para evitar el corte del servicio.`
  };
}

// db puede ser un pool o un client. Devuelve { creada, notificacion } (notificacion = null si ya existia).
async function registrarNotificacion(db, datos) {
  const {
    usuario_id, tipo, canal = 'app', titulo, mensaje,
    generada_por = null, boleta_id = null, nivel = null, clave_dedup = null
  } = datos;
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo de notificacion invalido: ${tipo}`);
  if (!CANALES.includes(canal)) throw new Error(`Canal de notificacion invalido: ${canal}`);

  const { rows } = await db.query(
    `INSERT INTO notificaciones (usuario_id, tipo, canal, titulo, mensaje, generada_por, boleta_id, nivel, clave_dedup)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (usuario_id, tipo, canal, clave_dedup) WHERE clave_dedup IS NOT NULL DO NOTHING
     RETURNING *`,
    [usuario_id, tipo, canal, titulo, mensaje, generada_por, boleta_id, nivel, clave_dedup]
  );
  return { creada: rows.length > 0, notificacion: rows[0] || null };
}

// Para usar dentro de una transaccion ajena (corte/reposicion): si falla (ej. la tabla aun no
// existe) se revierte solo este insert con un savepoint y NO se rompe el corte.
async function registrarNotificacionSegura(client, datos) {
  await client.query('SAVEPOINT sp_notificacion');
  try {
    const r = await registrarNotificacion(client, datos);
    await client.query('RELEASE SAVEPOINT sp_notificacion');
    return r;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp_notificacion');
    console.error('No se pudo registrar la notificacion (se ignora):', err.message);
    return { creada: false, notificacion: null, error: err.message };
  }
}

module.exports = { TIPOS, CANALES, claveBoleta, construirAvisoMora, registrarNotificacion, registrarNotificacionSegura, formatearCLP };
