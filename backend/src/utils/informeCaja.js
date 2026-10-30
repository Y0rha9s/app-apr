// Logica pura del informe de caja (sin acceso a la base) para poder probarla aparte.
// Las fechas llegan ya convertidas a hora de Chile como texto 'YYYY-MM-DD HH24:MI'
// (la conversion se hace en SQL), asi que aca solo se agrupan por dia/semana/mes.

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'abono'];
const CATEGORIAS_EGRESO = ['personal', 'materiales', 'transporte', 'servicios', 'otros'];

const redondear = (n) => Math.round(n * 100) / 100;

// Los datos historicos traen 'Efectivo', 'EFECTIVO', 'tranferencia', 'transferecia',
// 'tranfderencia', etc. Se normaliza solo al leer; la base no se toca.
function normalizarMetodoPago(metodo) {
  const m = String(metodo || '').trim().toLowerCase();
  if (m.startsWith('efec')) return 'efectivo';
  if (m.startsWith('tran')) return 'transferencia';
  if (m.startsWith('tarj')) return 'tarjeta';
  if (m.startsWith('abon')) return 'abono';
  return 'otro';
}

function normalizarCategoriaEgreso(categoria) {
  const c = String(categoria || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CATEGORIAS_EGRESO.includes(c) ? c : 'otros';
}

const aUTC = (dia) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

// Lunes de la semana a la que pertenece el dia (semana lunes-domingo).
function lunesDeSemana(dia) {
  const f = aUTC(dia);
  const offset = (f.getUTCDay() + 6) % 7;
  f.setUTCDate(f.getUTCDate() - offset);
  return aTexto(f);
}

function limitesPeriodo(vista, dia) {
  if (vista === 'semana') {
    const lunes = lunesDeSemana(dia);
    const domingo = aUTC(lunes);
    domingo.setUTCDate(domingo.getUTCDate() + 6);
    return { clave: lunes, desde: lunes, hasta: aTexto(domingo) };
  }
  if (vista === 'mes') {
    const [y, m] = dia.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { clave: `${y}-${mm}`, desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimo).padStart(2, '0')}` };
  }
  return { clave: dia, desde: dia, hasta: dia };
}

const vacioIngresos = () => ({ efectivo: 0, transferencia: 0, tarjeta: 0, abono: 0, otro: 0, total: 0 });
const vacioEgresos = () => ({ personal: 0, materiales: 0, transporte: 0, servicios: 0, otros: 0, total: 0 });

function cerrarTotales(obj) {
  for (const k of Object.keys(obj)) obj[k] = redondear(obj[k]);
  return obj;
}

// pagos: [{id, dia, fecha, monto, metodo_pago, observaciones, caja_id, usuario_nombre, numero_cliente}]
// egresos: [{id, dia, fecha, monto, categoria, descripcion, observaciones, caja_id}]
function construirInforme({ pagos, egresos, vista = 'dia' }) {
  const resumen = {
    ingresos: vacioIngresos(),
    egresos: vacioEgresos(),
    neto: 0,
    cantidad_pagos: 0,
    cantidad_egresos: 0
  };
  const sinCaja = { cantidad: 0, total: 0, por_metodo: vacioIngresos() };
  const periodos = new Map();

  const obtenerPeriodo = (dia) => {
    const lim = limitesPeriodo(vista, dia);
    if (!periodos.has(lim.clave)) {
      periodos.set(lim.clave, {
        ...lim, ingresos: 0, egresos: 0, neto: 0, cantidad_pagos: 0, cantidad_egresos: 0, movimientos: []
      });
    }
    return periodos.get(lim.clave);
  };

  for (const p of pagos) {
    const monto = parseFloat(p.monto) || 0;
    const metodo = normalizarMetodoPago(p.metodo_pago);

    // Pagos de la migracion historica (sin caja): se informan aparte y no suman a los totales de caja.
    if (p.caja_id === null || p.caja_id === undefined) {
      sinCaja.cantidad += 1;
      sinCaja.total += monto;
      sinCaja.por_metodo[metodo] += monto;
      sinCaja.por_metodo.total += monto;
      continue;
    }

    resumen.ingresos[metodo] += monto;
    resumen.ingresos.total += monto;
    resumen.cantidad_pagos += 1;

    const per = obtenerPeriodo(p.dia);
    per.ingresos += monto;
    per.cantidad_pagos += 1;
    per.movimientos.push({
      tipo: 'ingreso',
      fecha: p.fecha,
      usuario: p.usuario_nombre ? p.usuario_nombre.trim() : null,
      numero_cliente: p.numero_cliente || null,
      concepto: metodo,
      monto: redondear(monto),
      observaciones: p.observaciones || '',
      caja_id: p.caja_id
    });
  }

  for (const e of egresos) {
    const monto = parseFloat(e.monto) || 0;
    const categoria = normalizarCategoriaEgreso(e.categoria);

    resumen.egresos[categoria] += monto;
    resumen.egresos.total += monto;
    resumen.cantidad_egresos += 1;

    const per = obtenerPeriodo(e.dia);
    per.egresos += monto;
    per.cantidad_egresos += 1;
    per.movimientos.push({
      tipo: 'egreso',
      fecha: e.fecha,
      usuario: null,
      numero_cliente: null,
      concepto: categoria,
      monto: redondear(monto),
      observaciones: [e.descripcion, e.observaciones].filter(Boolean).join(' - '),
      caja_id: e.caja_id
    });
  }

  cerrarTotales(resumen.ingresos);
  cerrarTotales(resumen.egresos);
  resumen.neto = redondear(resumen.ingresos.total - resumen.egresos.total);
  sinCaja.total = redondear(sinCaja.total);
  cerrarTotales(sinCaja.por_metodo);

  const lista = [...periodos.values()]
    .sort((a, b) => (a.clave < b.clave ? 1 : -1))
    .map((per) => {
      per.ingresos = redondear(per.ingresos);
      per.egresos = redondear(per.egresos);
      per.neto = redondear(per.ingresos - per.egresos);
      per.movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      return per;
    });

  return { resumen, periodos: lista, sin_caja: sinCaja };
}

module.exports = {
  METODOS,
  CATEGORIAS_EGRESO,
  normalizarMetodoPago,
  normalizarCategoriaEgreso,
  lunesDeSemana,
  limitesPeriodo,
  construirInforme
};
