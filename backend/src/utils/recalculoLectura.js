// Lecturas no tomadas y recalculo al corregir una lectura.
//
// Regla del APR: si el operador no pudo acceder al medidor ingresa 1. Ese 1 no es una lectura real:
// se guarda la lectura anterior como actual (consumo 0, solo cargo fijo) y queda marcada no_tomada
// hasta que administracion ingrese la lectura real en el modulo de lecturas.
//
// Al corregir una lectura se recalcula: su monto, su boleta, el saldo arrastrado en las boletas
// siguientes y la lectura del mes siguiente, que parte desde la lectura corregida.

const { calcularMontoMes, cargoFijoDe, calcularDescuentoSubsidio } = require('./montoMes');

const LECTURA_NO_TOMADA = 1;
const ESTADOS_RECALCULABLES = ['pendiente', 'abonada', 'pagada', 'atrasada'];

const entero = (n) => Math.round(Number(n) || 0);
const consumoCobrable = (anterior, actual) => Math.max(0, actual - anterior);

function resolverLecturaActual(ingresada, anterior) {
  const valor = Number(ingresada);
  if (valor === LECTURA_NO_TOMADA) return { lecturaActual: Number(anterior) || 0, noTomada: true };
  return { lecturaActual: valor, noTomada: false };
}

const ordenLectura = (a, b) => (a.anio - b.anio) || (a.mes - b.mes) || (a.id - b.id);
const ordenBoleta = (a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : a.id - b.id);

// Calculo puro, sin base de datos. No modifica lo recibido.
// cambio: { lecturaId, lecturaAnterior, lecturaActual } con lo ingresado por administracion.
function planificarCambioLectura({ lecturas, boletas, usuario, tramos, cargoFijo, cambio }) {
  const ls = lecturas.map((l) => ({
    ...l, lectura_anterior: entero(l.lectura_anterior), lectura_actual: entero(l.lectura_actual),
    monto_calculado: entero(l.monto_calculado), no_tomada: !!l.no_tomada
  })).sort(ordenLectura);
  const bs = boletas.filter((b) => b.estado !== 'anulada').map((b) => ({
    ...b, total_mes: entero(b.total_mes), saldo_anterior: entero(b.saldo_anterior),
    total_a_pagar: entero(b.total_a_pagar), saldo_pendiente: entero(b.saldo_pendiente),
    saldo_favor_aplicado: entero(b.saldo_favor_aplicado)
  })).sort(ordenBoleta);

  const lecturasCambiadas = new Map();
  const boletasCambiadas = new Map();
  const avisos = [];
  let saldoFavor = Math.max(0, entero(usuario.saldo_favor));

  const montoDe = (consumo) => calcularMontoMes(tramos, cargoFijo, consumo, usuario);

  // Ajusta el total de una boleta respetando lo ya pagado y sigue por las que arrastran su saldo.
  function ajustarBoleta(b, deltaMes, deltaAnterior, usarSaldoFavor) {
    const delta = deltaMes + deltaAnterior;
    boletasCambiadas.set(b.id, b);
    if (!delta) return;
    const saldoAntes = b.saldo_pendiente;
    const pagado = Math.max(0, b.total_a_pagar - saldoAntes);
    let total = Math.max(0, b.total_a_pagar + delta);
    let saldo = total - pagado;
    if (saldo < 0) { saldoFavor += -saldo; saldo = 0; }

    if (usarSaldoFavor && delta > 0 && saldo > 0 && saldoFavor > 0) {
      const credito = Math.min(saldoFavor, saldo);
      saldoFavor -= credito; saldo -= credito; total -= credito;
      b.saldo_favor_aplicado += credito;
    }

    b.total_mes += deltaMes;
    b.saldo_anterior += deltaAnterior;
    b.total_a_pagar = total;
    b.saldo_pendiente = saldo;
    if (saldo > 0) b.estado = pagado > 0 ? 'abonada' : 'pendiente';
    else if (b.estado === 'pendiente' || b.estado === 'abonada') b.estado = 'pagada';
    boletasCambiadas.set(b.id, b);

    const variacion = saldo - saldoAntes;
    const sig = bs[bs.indexOf(b) + 1];
    if (!variacion || !sig || saldoAntes <= 0 || sig.saldo_anterior <= 0) return;
    if (!ESTADOS_RECALCULABLES.includes(sig.estado)) return;
    ajustarBoleta(sig, 0, Math.max(variacion, -sig.saldo_anterior), false);
  }

  function aplicarLectura(l, anterior, actual, noTomada) {
    const actualAntes = l.lectura_actual;
    const consumoAntes = consumoCobrable(l.lectura_anterior, actualAntes);
    const consumo = consumoCobrable(anterior, actual);
    const hubo = anterior !== l.lectura_anterior || actual !== actualAntes || noTomada !== l.no_tomada;

    l.lectura_anterior = anterior;
    l.lectura_actual = actual;
    l.no_tomada = noTomada;
    if (consumo !== consumoAntes) l.monto_calculado = montoDe(consumo);
    if (hubo || consumo !== consumoAntes) lecturasCambiadas.set(l.id, l);
    if (actual < anterior) avisos.push(`La lectura ${l.mes}/${l.anio} quedó menor que la anterior (${actual} < ${anterior}). Se cobra solo el cargo fijo; revísala.`);

    const b = bs.find((x) => x.lectura_id === l.id && ESTADOS_RECALCULABLES.includes(x.estado));
    if (b) {
      const consumoBoleta = actual - anterior;
      if (Number(b.consumo_m3) !== consumoBoleta) { b.consumo_m3 = consumoBoleta; boletasCambiadas.set(b.id, b); }
      if (consumo !== consumoAntes) {
        b.descuento_subsidio = calcularDescuentoSubsidio(tramos, cargoFijoDe(usuario, cargoFijo), consumo, usuario.tiene_subsidio);
        ajustarBoleta(b, montoDe(consumo) - b.total_mes, 0, true);
      }
    }

    if (actual === actualAntes) return;
    const sig = ls.slice(ls.indexOf(l) + 1).find((x) => x.lectura_anterior === actualAntes);
    if (sig) aplicarLectura(sig, actual, sig.no_tomada ? actual : sig.lectura_actual, sig.no_tomada);
  }

  const l = ls.find((x) => x.id === cambio.lecturaId);
  if (!l) throw new Error('Lectura no encontrada');

  const anterior = entero(cambio.lecturaAnterior);
  const ingresada = entero(cambio.lecturaActual);
  const sinCambiarValor = ingresada === l.lectura_actual;
  let { lecturaActual, noTomada } = resolverLecturaActual(ingresada, anterior);
  // Una lectura no tomada sigue siendolo mientras no se ingrese un valor real.
  if (l.no_tomada && sinCambiarValor) { lecturaActual = anterior; noTomada = true; }

  aplicarLectura(l, anterior, lecturaActual, noTomada);
  return { lecturas: [...lecturasCambiadas.values()], boletas: [...boletasCambiadas.values()], saldoFavor, avisos, lectura: l };
}

// Aplica el cambio dentro de la transaccion abierta por quien llama.
async function aplicarCambioLectura(client, cambio) {
  const { rows: [base] } = await client.query('SELECT usuario_id FROM lecturas WHERE id = $1', [cambio.lecturaId]);
  if (!base) throw new Error('Lectura no encontrada');

  const { rows: [usuario] } = await client.query(
    `SELECT id, saldo_favor, tiene_subsidio, precio_m3_plano, cargo_fijo_personalizado
     FROM usuarios WHERE id = $1 FOR UPDATE`, [base.usuario_id]);
  const { rows: lecturas } = await client.query('SELECT * FROM lecturas WHERE usuario_id = $1', [usuario.id]);
  const { rows: boletas } = await client.query('SELECT * FROM boletas WHERE usuario_id = $1 FOR UPDATE', [usuario.id]);
  const { rows: tramos } = await client.query('SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC');
  const { rows: cfg } = await client.query(`SELECT valor FROM configuracion_sistema WHERE clave = 'cargo_fijo'`);

  const plan = planificarCambioLectura({
    lecturas, boletas, usuario, tramos, cargoFijo: parseFloat(cfg[0]?.valor || 3000), cambio
  });
  const antes = new Map(lecturas.map((l) => [l.id, l]));

  for (const l of plan.lecturas) {
    await client.query(
      `UPDATE lecturas SET lectura_anterior = $1, lectura_actual = $2, monto_calculado = $3, no_tomada = $4 WHERE id = $5`,
      [l.lectura_anterior, l.lectura_actual, l.monto_calculado, l.no_tomada, l.id]
    );
  }
  for (const b of plan.boletas) {
    await client.query(
      `UPDATE boletas SET consumo_m3 = $1, total_mes = $2, saldo_anterior = $3, total_a_pagar = $4, saldo_pendiente = $5,
         estado = $6, saldo_favor_aplicado = $7, descuento_subsidio = $8 WHERE id = $9`,
      [b.consumo_m3, b.total_mes, b.saldo_anterior, b.total_a_pagar, b.saldo_pendiente, b.estado,
        b.saldo_favor_aplicado, b.descuento_subsidio, b.id]
    );
  }
  if (plan.saldoFavor !== Math.max(0, entero(usuario.saldo_favor))) {
    await client.query('UPDATE usuarios SET saldo_favor = $1 WHERE id = $2', [plan.saldoFavor, usuario.id]);
  }
  return { ...plan, antes, usuarioId: usuario.id };
}

module.exports = { LECTURA_NO_TOMADA, resolverLecturaActual, planificarCambioLectura, aplicarCambioLectura };
