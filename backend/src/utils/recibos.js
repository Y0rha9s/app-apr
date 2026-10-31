// Recibo de dinero (comprobante) de un pago de Caja: armado de los datos, respaldo en la base y lectura.
const { montoEnPalabras } = require('./numeroEnPalabras');
const { normalizarMetodoPago } = require('./informeCaja');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ETIQUETA_FORMA_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', abono: 'Abono', otro: 'Otro' };

// Las columnas de fecha son 'timestamp without time zone' guardadas en UTC: se pasan a hora de Chile.
const FECHA_CHILE = "((p.fecha_pago AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')";

const etiquetaPeriodo = (periodo) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

// "Cuenta de": el concepto del pago. Si se sabe a que boletas se aplico las nombra; si no, es generico.
function conceptoDelPago(periodos, formaPago) {
  const nombres = periodos.map(etiquetaPeriodo);
  if (nombres.length === 1) return `Pago de boleta de agua potable — ${nombres[0]}`;
  if (nombres.length > 1) {
    return `Pago de boletas de agua potable — ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }
  return formaPago === 'abono' ? 'Abono a cuenta de agua potable' : 'Pago de cuenta de agua potable';
}

// Arma los datos del recibo leyendo el pago. db puede ser un pool o un client (dentro de la transaccion
// del pago). Las boletas que cubrio se reconstruyen por fecha: pagoModel.create marca las boletas y el
// pago con el mismo NOW() dentro de una transaccion, asi que boleta.fecha_pago = pago.fecha_pago.
async function construirRecibo(db, pagoId) {
  const { rows } = await db.query(
    `SELECT p.id, p.monto, p.metodo_pago, p.observaciones, p.caja_id, p.usuario_id,
            to_char(${FECHA_CHILE}, 'DD') AS dia, to_char(${FECHA_CHILE}, 'MM') AS mes,
            to_char(${FECHA_CHILE}, 'YYYY') AS anio, to_char(${FECHA_CHILE}, 'DD/MM/YYYY HH24:MI') AS fecha_hora,
            to_char(p.fecha_pago, 'YYYY-MM-DD HH24:MI:SS.US') AS fecha_pago_utc,
            u.nombre, u.rut, u.numero_cliente,
            cajero.nombre AS recibido_por
     FROM pagos p
     JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN cajas c ON c.id = p.caja_id
     LEFT JOIN usuarios cajero ON cajero.id = c.usuario_id
     WHERE p.id = $1`,
    [pagoId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];

  const boletas = await db.query(
    `SELECT b.periodo FROM boletas b
     JOIN pagos p ON p.id = $1 AND b.usuario_id = p.usuario_id AND b.fecha_pago = p.fecha_pago
     ORDER BY b.periodo`,
    [pagoId]
  );
  const periodos = boletas.rows.map((b) => b.periodo);
  const forma = normalizarMetodoPago(r.metodo_pago);
  const monto = parseFloat(r.monto);

  return {
    numero: r.id,
    pago_id: r.id,
    usuario_id: r.usuario_id,
    dia: r.dia, mes: r.mes, anio: r.anio, fecha_hora: r.fecha_hora,
    fecha_pago_utc: r.fecha_pago_utc,
    nombre: (r.nombre || '').trim(),
    rut: r.rut,
    numero_cliente: r.numero_cliente,
    monto,
    monto_palabras: montoEnPalabras(monto),
    forma_pago: forma,
    forma_pago_etiqueta: ETIQUETA_FORMA_PAGO[forma],
    concepto: conceptoDelPago(periodos, forma),
    observaciones: r.observaciones || '',
    recibido_por: r.recibido_por ? r.recibido_por.trim() : null,
    caja_id: r.caja_id,
    periodos
  };
}

// Guarda la copia del recibo. Devuelve true si se inserto (false si ya existia o no hay pago).
async function guardarRecibo(db, pagoId) {
  const c = await construirRecibo(db, pagoId);
  if (!c) return false;
  const { rowCount } = await db.query(
    `INSERT INTO recibos_pago
       (pago_id, numero, usuario_id, nombre, rut, numero_cliente, monto, monto_palabras, forma_pago, concepto,
        observaciones, periodos, fecha_pago, caja_id, recibido_por, datos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamp, $14, $15, $16)
     ON CONFLICT (pago_id) DO NOTHING`,
    [c.pago_id, c.numero, c.usuario_id, c.nombre, c.rut, c.numero_cliente, c.monto, c.monto_palabras, c.forma_pago,
      c.concepto, c.observaciones, c.periodos, c.fecha_pago_utc, c.caja_id, c.recibido_por, JSON.stringify(c)]
  );
  return rowCount > 0;
}

// Para usar dentro de la transaccion del pago: si el respaldo falla (ej. la tabla aun no existe) se
// revierte solo este insert con un savepoint y NO se rompe el registro del pago.
async function guardarReciboSeguro(client, pagoId) {
  await client.query('SAVEPOINT sp_recibo');
  try {
    const guardado = await guardarRecibo(client, pagoId);
    await client.query('RELEASE SAVEPOINT sp_recibo');
    return guardado;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp_recibo');
    console.error('No se pudo respaldar el recibo (se ignora):', err.message);
    return false;
  }
}

// Devuelve el recibo respaldado si existe (lo que se imprimio en su momento); si no, lo arma en el
// momento (pagos anteriores a esta funcion o ingresados por otras vias). `respaldado` lo indica.
async function obtenerRecibo(db, pagoId) {
  try {
    const { rows } = await db.query('SELECT datos FROM recibos_pago WHERE pago_id = $1', [pagoId]);
    if (rows.length > 0) return { ...rows[0].datos, respaldado: true };
  } catch (err) {
    if (err.code !== '42P01') throw err; // 42P01: la tabla aun no existe (migracion pendiente)
  }
  const c = await construirRecibo(db, pagoId);
  return c ? { ...c, respaldado: false } : null;
}

module.exports = { construirRecibo, guardarRecibo, guardarReciboSeguro, obtenerRecibo, conceptoDelPago, ETIQUETA_FORMA_PAGO };
