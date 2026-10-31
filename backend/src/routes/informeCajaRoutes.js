const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, soloRoles } = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');
const { construirInforme, normalizarMetodoPago } = require('../utils/informeCaja');
const { ETIQUETA_FORMA_PAGO } = require('../utils/recibos');

// Solo lectura. Solo admin y cajero (rol 'recaudador') pueden ver el informe.
router.use(authMiddleware, soloRoles('admin', 'recaudador'));

const VISTAS = ['dia', 'semana', 'mes'];
const MAX_DIAS_RANGO = 400;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Las columnas de fecha son 'timestamp without time zone' guardadas en UTC; se pasan a hora de
// Chile en SQL para que el corte de dia no dependa de la zona horaria del servidor.
const FECHA_CHILE = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')`;

const FORMATEADOR_CHILE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
});
const hoyChile = () => FORMATEADOR_CHILE.format(new Date());

const esFechaValida = (s) => RE_FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// GET /api/informe-caja?vista=dia|semana|mes&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const vista = req.query.vista || 'dia';
    if (!VISTAS.includes(vista)) {
      return res.status(400).json({ error: 'Vista invalida. Use dia, semana o mes' });
    }

    const hoy = hoyChile();
    const hasta = req.query.hasta || hoy;
    const desde = req.query.desde || `${hoy.slice(0, 8)}01`;
    if (!esFechaValida(desde) || !esFechaValida(hasta)) {
      return res.status(400).json({ error: 'Fechas invalidas. Use el formato YYYY-MM-DD' });
    }
    if (desde > hasta) {
      return res.status(400).json({ error: 'La fecha Desde no puede ser posterior a Hasta' });
    }
    const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
    if (dias > MAX_DIAS_RANGO) {
      return res.status(400).json({ error: `El rango no puede superar ${MAX_DIAS_RANGO} dias` });
    }

    const fechaPago = FECHA_CHILE('p.fecha_pago');
    const { rows: pagos } = await pool.query(
      `SELECT p.id, p.monto, p.metodo_pago, p.observaciones, p.caja_id,
              u.nombre AS usuario_nombre, u.numero_cliente,
              to_char(${fechaPago}, 'YYYY-MM-DD') AS dia,
              to_char(${fechaPago}, 'YYYY-MM-DD HH24:MI') AS fecha
       FROM pagos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE ${fechaPago}::date BETWEEN $1::date AND $2::date`,
      [desde, hasta]
    );

    const fechaEgreso = FECHA_CHILE('e.fecha_egreso');
    const { rows: egresos } = await pool.query(
      `SELECT e.id, e.monto, e.categoria, e.descripcion, e.observaciones, e.caja_id,
              to_char(${fechaEgreso}, 'YYYY-MM-DD') AS dia,
              to_char(${fechaEgreso}, 'YYYY-MM-DD HH24:MI') AS fecha
       FROM egresos_caja e
       WHERE ${fechaEgreso}::date BETWEEN $1::date AND $2::date`,
      [desde, hasta]
    );

    res.json({ vista, desde, hasta, ...construirInforme({ pagos, egresos, vista }) });
  } catch (error) {
    console.error('informe-caja:', error);
    res.status(500).json({ error: 'Error al generar el informe de caja' });
  }
});


// ─── Historial de pagos del mes o del año (para descargar a Excel) ───────────────────────────
// Solo admin. Incluye TODOS los pagos del periodo (con o sin caja) y marca los que no tienen caja.
const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function rangoDelPeriodo(query) {
  const anio = parseInt(query.anio, 10);
  if (!anio || anio < 2000 || anio > 2100) return { error: 'Año invalido' };
  const mes = query.mes === undefined || query.mes === '' || query.mes === 'todos' ? null : parseInt(query.mes, 10);
  if (mes !== null && (!mes || mes < 1 || mes > 12)) return { error: 'Mes invalido' };
  if (mes === null) return { anio, mes, desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { anio, mes, desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

async function consultarPagosDelPeriodo(rango) {
  const fecha = FECHA_CHILE('p.fecha_pago');
  const { rows } = await pool.query(
    `SELECT p.id, p.monto, p.metodo_pago, p.observaciones, p.caja_id,
            to_char(${fecha}, 'YYYY-MM-DD HH24:MI') AS fecha,
            u.rut, u.nombre, u.numero_cliente
     FROM pagos p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE ${fecha}::date BETWEEN $1::date AND $2::date
     ORDER BY p.fecha_pago ASC, p.id ASC`,
    [rango.desde, rango.hasta]
  );

  const pagos = rows.map((r) => {
    const forma = normalizarMetodoPago(r.metodo_pago);
    return {
      numero: r.id,
      fecha: r.fecha,
      rut: r.rut,
      nombre: (r.nombre || '').trim(),
      numero_cliente: r.numero_cliente || '',
      forma_pago: forma,
      forma_pago_etiqueta: ETIQUETA_FORMA_PAGO[forma],
      monto: parseFloat(r.monto),
      comentario: r.observaciones || '',
      caja_id: r.caja_id
    };
  });

  const por_forma = {};
  let total = 0;
  for (const p of pagos) {
    por_forma[p.forma_pago] = por_forma[p.forma_pago] || { cantidad: 0, total: 0 };
    por_forma[p.forma_pago].cantidad += 1;
    por_forma[p.forma_pago].total = Math.round((por_forma[p.forma_pago].total + p.monto) * 100) / 100;
    total += p.monto;
  }
  return { pagos, resumen: { cantidad: pagos.length, total: Math.round(total * 100) / 100, por_forma, sin_caja: pagos.filter((p) => !p.caja_id).length } };
}

// GET /api/informe-caja/pagos?anio=2026&mes=10   (sin mes = todo el año)
router.get('/pagos', soloRoles('admin'), async (req, res) => {
  try {
    const rango = rangoDelPeriodo(req.query);
    if (rango.error) return res.status(400).json({ error: rango.error });
    const datos = await consultarPagosDelPeriodo(rango);
    res.json({ success: true, anio: rango.anio, mes: rango.mes, ...datos });
  } catch (error) {
    console.error('historial de pagos:', error);
    res.status(500).json({ error: 'Error al obtener el historial de pagos' });
  }
});

// GET /api/informe-caja/pagos/excel?anio=2026&mes=10   (descarga .xlsx)
router.get('/pagos/excel', soloRoles('admin'), async (req, res) => {
  try {
    const rango = rangoDelPeriodo(req.query);
    if (rango.error) return res.status(400).json({ error: rango.error });
    const { pagos, resumen } = await consultarPagosDelPeriodo(rango);

    const titulo = rango.mes ? `${MESES_NOMBRE[rango.mes - 1]} ${rango.anio}` : `Año ${rango.anio}`;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema APR';
    wb.created = new Date();

    const hoja = wb.addWorksheet('Pagos', { views: [{ state: 'frozen', ySplit: 3 }] });
    const COLUMNAS = [
      { header: 'N° Recibo', key: 'numero', width: 11 },
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'RUT', key: 'rut', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 38 },
      { header: 'N° Cliente', key: 'numero_cliente', width: 14 },
      { header: 'Forma de pago', key: 'forma', width: 16 },
      { header: 'Monto', key: 'monto', width: 14 },
      { header: 'Comentario', key: 'comentario', width: 50 },
      { header: 'Caja', key: 'caja', width: 20 }
    ];
    hoja.columns = COLUMNAS.map(({ key, width }) => ({ key, width }));

    hoja.mergeCells(1, 1, 1, COLUMNAS.length);
    const t = hoja.getCell(1, 1);
    t.value = `COMITÉ DE AGUA POTABLE RURAL DE SANTA FILOMENA PEDREGOSO — Pagos ${titulo}`;
    t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F66' } };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    hoja.getRow(1).height = 28;

    hoja.mergeCells(2, 1, 2, COLUMNAS.length);
    const sub = hoja.getCell(2, 1);
    sub.value = `Generado el ${new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} — ${resumen.cantidad} pagos — fechas en hora de Chile`;
    sub.font = { italic: true, size: 10, color: { argb: 'FF444444' } };
    sub.alignment = { horizontal: 'center' };

    const cab = hoja.getRow(3);
    COLUMNAS.forEach((c, i) => {
      const cell = cab.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    cab.height = 22;

    pagos.forEach((p, i) => {
      const fila = hoja.getRow(4 + i);
      fila.getCell(1).value = p.numero;
      fila.getCell(2).value = p.fecha;
      fila.getCell(3).value = p.rut;
      fila.getCell(4).value = p.nombre;
      fila.getCell(5).value = p.numero_cliente;
      fila.getCell(6).value = p.forma_pago_etiqueta;
      fila.getCell(7).value = p.monto;
      fila.getCell(7).numFmt = '#,##0';
      fila.getCell(8).value = p.comentario;
      fila.getCell(9).value = p.caja_id ? `Caja ${p.caja_id}` : 'Sin caja (migración)';
      if (i % 2 === 1) {
        for (let c = 1; c <= COLUMNAS.length; c++) {
          fila.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        }
      }
    });

    const filaTotal = hoja.getRow(4 + pagos.length);
    filaTotal.getCell(6).value = 'TOTAL';
    filaTotal.getCell(6).font = { bold: true };
    filaTotal.getCell(7).value = pagos.length ? { formula: `SUM(G4:G${3 + pagos.length})`, result: resumen.total } : 0;
    filaTotal.getCell(7).numFmt = '#,##0';
    filaTotal.getCell(7).font = { bold: true };
    hoja.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COLUMNAS.length } };

    const res2 = wb.addWorksheet('Resumen');
    res2.columns = [{ width: 24 }, { width: 12 }, { width: 16 }];
    res2.getRow(1).values = ['Forma de pago', 'Cantidad', 'Total'];
    res2.getRow(1).font = { bold: true };
    let fila = 2;
    for (const forma of Object.keys(ETIQUETA_FORMA_PAGO)) {
      const dato = resumen.por_forma[forma];
      if (!dato) continue;
      res2.getRow(fila).values = [ETIQUETA_FORMA_PAGO[forma], dato.cantidad, dato.total];
      res2.getRow(fila).getCell(3).numFmt = '#,##0';
      fila++;
    }
    res2.getRow(fila).values = ['TOTAL', resumen.cantidad, resumen.total];
    res2.getRow(fila).font = { bold: true };
    res2.getRow(fila).getCell(3).numFmt = '#,##0';
    res2.getRow(fila + 2).values = [`Pagos sin caja (migración histórica): ${resumen.sin_caja}`];

    const nombreArchivo = `pagos_${rango.anio}${rango.mes ? '-' + String(rango.mes).padStart(2, '0') : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('excel de pagos:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar el Excel de pagos' });
  }
});

module.exports = router;
