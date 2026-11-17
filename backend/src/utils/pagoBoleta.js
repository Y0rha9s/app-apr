// Caja: pago de UNA boleta elegida por el cajero, con "¿es abono?" y vuelto.
//
// Reglas acordadas con el APR (ver INFORME_CAJA_PAGOS_ANALISIS.md, seccion 0):
// - El cajero elige LIBREMENTE cualquier boleta impaga de los ultimos 3 meses (periodo >= mes actual - 3,
//   hora de Chile). No hay orden obligatorio.
// - Deuda arrastrada hacia adelante: lo que se paga de una boleta se descuenta del saldo_anterior de las
//   boletas siguientes que lo traen (septiembre -> octubre -> noviembre), sin cobrarlo dos veces.
// - Deuda arrastrada hacia atras: el saldo de una boleta puede traer deuda de meses anteriores impagos
//   (su saldo_anterior). Lo pagado cubre primero el consumo propio de esa boleta; si sobra, cubre la
//   deuda de los meses anteriores (del mas reciente al mas antiguo) y esas boletas bajan su saldo.
// - Abono con excedente: el excedente va a saldo a favor y se usa en la PROXIMA boleta que se genere.
//   No se recalculan boletas ya emitidas.
// - Sin abono: si paga de mas, vuelto (solo efectivo). Si paga de menos, se registra igual como
//   abono parcial (la pantalla avisa antes).
// - pagos.monto = lo que queda en caja (aplicado + saldo a favor). El vuelto nunca es ingreso.
const pool = require('../config/database');
const { marcarCuotaConvenioPagada } = require('./convenios');
const { guardarReciboSeguro } = require('./recibos');

const ESTADOS_PAGABLES = ['pendiente', 'abonada', 'atrasada'];
const MESES_VENTANA = 3;
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'abono'];

const LIMITE_SQL = `to_char((NOW() AT TIME ZONE 'America/Santiago') - INTERVAL '${MESES_VENTANA} months', 'YYYY-MM')`;

class ErrorPago extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

const redondear = (n) => Math.round(Number(n) || 0);
const pagable = (b) => ESTADOS_PAGABLES.includes(b.estado) && parseFloat(b.saldo_pendiente) > 0;

// Cuanto del saldo de la boleta en la posicion i (lista del socio ordenada por periodo, sin anuladas)
// es deuda de la boleta anterior todavia impaga (venia en su saldo_anterior).
function incluidoDeAnteriores(lista, i) {
  if (i == null || i <= 0) return 0;
  const b = lista[i];
  const prev = lista[i - 1];
  const sa = redondear(b.saldo_anterior);
  if (sa <= 0 || !pagable(prev)) return 0;
  return Math.min(redondear(prev.saldo_pendiente), sa, redondear(b.saldo_pendiente));
}

// Lista para la pantalla de Caja: boletas impagas del socio, marcando cual se puede elegir.
async function boletasElegibles(db, usuarioId) {
  const { rows: [{ limite }] } = await db.query(`SELECT ${LIMITE_SQL} AS limite`);
  const { rows } = await db.query(
    `SELECT id, periodo, estado, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente,
            to_char(fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento
     FROM boletas
     WHERE usuario_id = $1 AND estado = ANY($2) AND saldo_pendiente > 0
     ORDER BY periodo ASC, id ASC`,
    [usuarioId, ESTADOS_PAGABLES]
  );
  const { rows: u } = await db.query('SELECT COALESCE(saldo_favor, 0) AS saldo_favor FROM usuarios WHERE id = $1', [usuarioId]);

  const { rows: todas } = await db.query(
    `SELECT id, estado, saldo_anterior, saldo_pendiente FROM boletas
     WHERE usuario_id = $1 AND estado <> 'anulada' ORDER BY periodo ASC, id ASC`,
    [usuarioId]
  );
  const posicion = new Map(todas.map((b, i) => [b.id, i]));

  const boletas = rows.map((b) => {
    const enVentana = b.periodo >= limite;
    const incluye = incluidoDeAnteriores(todas, posicion.get(b.id));
    return {
      ...b,
      en_ventana: enVentana,
      seleccionable: enVentana,
      incluye_anterior: incluye, // parte del saldo que es deuda de meses anteriores impagos
      motivo: enVentana ? null : `Más de ${MESES_VENTANA} meses: su deuda va incluida en el saldo de las boletas siguientes`
    };
  });

  // Deuda real: la suma de saldos cuenta dos veces la deuda arrastrada (la boleta siguiente ya la trae
  // en su saldo_anterior). Se descuenta de cada boleta lo que ya va incluido en la siguiente.
  const siguienteDe = new Map(todas.map((b, i) => [b.id, todas[i + 1] || null]));
  let deudaReal = 0;
  for (const b of rows) {
    const sp = redondear(b.saldo_pendiente);
    const sig = siguienteDe.get(b.id);
    deudaReal += sp - Math.min(sp, sig ? Math.max(0, redondear(sig.saldo_anterior)) : 0);
  }

  return {
    limite_periodo: limite,
    deuda_real: deudaReal,
    saldo_favor: parseFloat(u[0]?.saldo_favor || 0),
    deuda_fuera_ventana: boletas.some((b) => !b.en_ventana),
    boletas
  };
}

// Calculo puro (sin base de datos): cuanto va a la boleta, a saldo a favor y de vuelto.
function calcularPago({ saldo, recibido, esAbono, metodo }) {
  const S = redondear(saldo);
  const R = redondear(recibido);
  if (R <= 0) throw new ErrorPago(400, 'El monto recibido debe ser mayor a 0');

  if (esAbono) {
    const aplicado = Math.min(R, S);
    return { aplicado, aFavor: R - aplicado, vuelto: 0, aviso: null };
  }
  if (R >= S) {
    const extra = R - S;
    if (extra > 0 && metodo !== 'efectivo') {
      throw new ErrorPago(400, `Con ${metodo} no se da vuelto. Ingrese el monto exacto de la boleta ($${S}) o márquelo como abono para dejar el excedente como saldo a favor.`);
    }
    return { aplicado: S, aFavor: 0, vuelto: extra, aviso: null };
  }
  return {
    aplicado: R, aFavor: 0, vuelto: 0,
    aviso: `El monto ($${R}) es menor al saldo de la boleta ($${S}). Se registró como abono parcial; quedan $${S - R} pendientes.`
  };
}

// Valida y normaliza lo que llega de la pantalla.
function normalizarDatos(datos) {
  const usuarioId = parseInt(datos.usuario_id, 10);
  const boletaId = parseInt(datos.boleta_id, 10);
  const cajaId = parseInt(datos.caja_id, 10);
  const metodo = String(datos.metodo_pago || '').toLowerCase();
  const esAbono = datos.es_abono === true;
  const recibido = redondear(datos.monto_recibido);
  const solicitudId = datos.solicitud_id || null;
  const observaciones = datos.observaciones ? String(datos.observaciones).trim() : null;
  const numeroOperacion = datos.numero_operacion != null && String(datos.numero_operacion).trim() !== ''
    ? String(datos.numero_operacion).trim().slice(0, 100) : null;

  if (!usuarioId || !boletaId || !cajaId) throw new ErrorPago(400, 'Faltan usuario, boleta o caja');
  if (!METODOS.includes(metodo)) throw new ErrorPago(400, 'Método de pago inválido');
  if (solicitudId && !/^[0-9a-f-]{36}$/i.test(solicitudId)) throw new ErrorPago(400, 'solicitud_id inválido');
  return { usuarioId, boletaId, cajaId, metodo, esAbono, recibido, solicitudId, observaciones, numeroOperacion };
}

// Todo el pago dentro de una transaccion ya abierta por quien llama (client).
async function aplicarPagoBoleta(client, d) {
  const { usuarioId, boletaId, cajaId, metodo, esAbono, recibido, solicitudId, observaciones, numeroOperacion } = d;

    const { rows: caja } = await client.query(
      "SELECT id FROM cajas WHERE id = $1 AND estado = 'abierta' FOR UPDATE", [cajaId]);
    if (!caja.length) throw new ErrorPago(409, 'La caja no está abierta');

    // Se bloquean todas las boletas del socio: el pago toca la elegida y las que arrastran su deuda.
    const { rows: boletas } = await client.query(
      `SELECT id, periodo, estado, saldo_anterior, total_a_pagar, saldo_pendiente, prestamo_cuota_id,
              (fecha_vencimiento < (NOW() AT TIME ZONE 'America/Santiago')::date) AS vencida
       FROM boletas WHERE usuario_id = $1 AND estado <> 'anulada'
       ORDER BY periodo ASC, id ASC FOR UPDATE`,
      [usuarioId]
    );
    const idx = boletas.findIndex((b) => b.id === boletaId);
    if (idx === -1) throw new ErrorPago(404, 'La boleta no existe o no es de este socio');
    const elegida = boletas[idx];
    if (!pagable(elegida)) throw new ErrorPago(409, 'La boleta ya no tiene saldo pendiente');

    const { rows: [{ limite }] } = await client.query(`SELECT ${LIMITE_SQL} AS limite`);
    if (elegida.periodo < limite) throw new ErrorPago(409, `Solo se pueden elegir boletas desde ${limite}`);

    const saldoAntes = redondear(elegida.saldo_pendiente);
    const { aplicado, aFavor, vuelto, aviso } = calcularPago({ saldo: saldoAntes, recibido, esAbono, metodo });
    const montoCaja = aplicado + aFavor;

    // 1. El pago (pagos.monto = lo que queda en caja).
    const { rows: [pago] } = await client.query(
      `INSERT INTO pagos (usuario_id, caja_id, monto, metodo_pago, observaciones, numero_operacion, boleta_id,
                          monto_recibido, vuelto, es_abono, saldo_boleta_antes, aplicado_boleta, a_saldo_favor, solicitud_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [usuarioId, cajaId, montoCaja, metodo, observaciones, numeroOperacion, boletaId,
        recibido, vuelto, esAbono, saldoAntes, aplicado, aFavor, solicitudId]
    );

    // 2. La boleta elegida.
    const saldoNuevo = saldoAntes - aplicado;
    const estadoNuevo = saldoNuevo <= 0 ? (elegida.vencida ? 'atrasada' : 'pagada') : 'abonada';
    await client.query(
      'UPDATE boletas SET saldo_pendiente = $1, estado = $2, fecha_pago = NOW() WHERE id = $3',
      [saldoNuevo, estadoNuevo, boletaId]
    );
    if (saldoNuevo <= 0 && elegida.prestamo_cuota_id) {
      await marcarCuotaConvenioPagada(client, elegida.prestamo_cuota_id, boletaId);
    }

    // 3. Deuda arrastrada hacia adelante: lo pagado sale del saldo_anterior de las boletas siguientes.
    let credito = 0; // si una boleta siguiente ya estaba pagada, lo descontado vuelve como saldo a favor
    let arrastre = aplicado;
    for (let i = idx + 1; i < boletas.length && arrastre > 0; i++) {
      const n = boletas[i];
      const saldoAnt = redondear(n.saldo_anterior);
      if (saldoAnt <= 0 || n.estado === 'congelada') break;
      const d = Math.min(arrastre, saldoAnt);
      const sp = redondear(n.saldo_pendiente);
      const spNuevo = Math.max(0, sp - d);
      credito += d - (sp - spNuevo);
      let estadoN = n.estado;
      if (ESTADOS_PAGABLES.includes(n.estado) && spNuevo <= 0) estadoN = n.vencida ? 'atrasada' : 'pagada';
      await client.query(
        `UPDATE boletas SET saldo_anterior = saldo_anterior - $1, total_a_pagar = total_a_pagar - $1,
                saldo_pendiente = $2, estado = $3 WHERE id = $4`,
        [d, spNuevo, estadoN, n.id]
      );
      if (spNuevo <= 0 && sp > 0 && n.prestamo_cuota_id) await marcarCuotaConvenioPagada(client, n.prestamo_cuota_id, n.id);
      arrastre = d;
    }

    // 4. Deuda arrastrada hacia atras: lo pagado cubre primero el consumo propio de la elegida; lo que
    //    pase de eso pago deuda de meses anteriores (que venia en su saldo), y esas boletas bajan su saldo,
    //    de la mas reciente a la mas antigua. Se usan los saldos de antes del pago (boletas no se modifica).
    const propioElegida = saldoAntes - incluidoDeAnteriores(boletas, idx);
    let resto = Math.max(0, aplicado - propioElegida);
    for (let i = idx - 1; i >= 0 && resto > 0; i--) {
      const p = boletas[i];
      if (!pagable(p)) break;
      const spP = redondear(p.saldo_pendiente);
      const propioP = spP - incluidoDeAnteriores(boletas, i);
      const d = Math.min(resto, spP);
      const spNuevoP = spP - d;
      const estadoP = spNuevoP <= 0 ? (p.vencida ? 'atrasada' : 'pagada') : 'abonada';
      await client.query(
        'UPDATE boletas SET saldo_pendiente = $1, estado = $2, fecha_pago = NOW() WHERE id = $3',
        [spNuevoP, estadoP, p.id]
      );
      if (spNuevoP <= 0 && p.prestamo_cuota_id) await marcarCuotaConvenioPagada(client, p.prestamo_cuota_id, p.id);
      resto = Math.max(0, d - propioP);
    }

    // 5. Saldo a favor (para la proxima boleta que se genere).
    if (aFavor + credito > 0) {
      await client.query('UPDATE usuarios SET saldo_favor = COALESCE(saldo_favor, 0) + $1 WHERE id = $2',
        [aFavor + credito, usuarioId]);
    }

    await guardarReciboSeguro(client, pago.id);
    return { pago, repetido: false, aviso };
}

async function registrarPagoBoleta(datos) {
  const d = normalizarDatos(datos);
  const { solicitudId } = d;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Doble clic / reintento: la misma solicitud devuelve el pago ya registrado.
    if (solicitudId) {
      const { rows } = await client.query('SELECT * FROM pagos WHERE solicitud_id = $1', [solicitudId]);
      if (rows.length) { await client.query('ROLLBACK'); return { pago: rows[0], repetido: true, aviso: null }; }
    }
    const resultado = await aplicarPagoBoleta(client, d);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505' && solicitudId) {
      const { rows } = await pool.query('SELECT * FROM pagos WHERE solicitud_id = $1', [solicitudId]);
      if (rows.length) return { pago: rows[0], repetido: true, aviso: null };
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { boletasElegibles, registrarPagoBoleta, aplicarPagoBoleta, normalizarDatos, calcularPago, ErrorPago, ESTADOS_PAGABLES };
