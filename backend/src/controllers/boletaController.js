const pool = require('../config/database');
const PDFDocument = require('pdfkit');
const path = require('path');
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { aplicarSaldoFavor } = require('../utils/saldoFavor');
const { obtenerProximaCuotaConvenio, marcarCuotaConvenioPagada } = require('../utils/convenios');
const { clasificarBoletaVisual } = require('../utils/clasificacionVisual');

// ─── HELPER: cálculo de monto por tramos (compartido por generación masiva e individual) ───
const calcularMontoTramos = (tramos, cargoFijo, consumo, tieneSubsidio) => {
  let restante = parseFloat(consumo || 0);
  let totalConsumo = 0;
  let tramo1Monto = 0;
  tramos.forEach((t, i) => {
    if (restante <= 0) return;
    const hasta = t.tramo_hasta ? parseFloat(t.tramo_hasta) : Infinity;
    const efectivo_desde = i === 0 ? 0 : parseFloat(t.tramo_desde) - 1;
    const capacidad = hasta === Infinity ? restante : hasta - efectivo_desde;
    const consumido = Math.min(restante, capacidad);
    const monto = consumido * parseFloat(t.precio_por_m3);
    if (i === 0) tramo1Monto = monto;
    else totalConsumo += monto;
    restante -= consumido;
  });
  return tieneSubsidio ? (cargoFijo + tramo1Monto) / 2 + totalConsumo : cargoFijo + tramo1Monto + totalConsumo;
};

const calcularDescuentoSubsidio = (tramos, cargoFijo, consumo, tieneSubsidio) => {
  if (!tieneSubsidio) return 0;
  return (cargoFijo + Math.min(consumo, parseFloat(tramos[0]?.tramo_hasta || 15)) * parseFloat(tramos[0]?.precio_por_m3 || 700)) / 2;
};

// ─── GET /api/boletas ───────────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { periodo, estado } = req.query;
    let query = `
      SELECT b.*, u.nombre, u.rut, u.direccion, u.telefono, u.numero_cliente
      FROM boletas b
      JOIN usuarios u ON u.id = b.usuario_id
      WHERE 1=1
    `;
    const params = [];
    if (periodo) { params.push(periodo); query += ` AND b.periodo = $${params.length}`; }
    if (estado) { params.push(estado); query += ` AND b.estado = $${params.length}`; }
    query += ` ORDER BY u.numero_cliente ASC`;
    const { rows } = await pool.query(query, params);
    res.json(rows.map(b => ({ ...b, estado_visual: clasificarBoletaVisual(b) })));
  } catch (err) {
    console.error('getAll boletas:', err);
    res.status(500).json({ error: 'Error al obtener boletas' });
  }
};

// ─── GET /api/boletas/usuario/:id ───────────────────────────────────────────
const getByUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT b.*, u.nombre, u.rut, u.numero_cliente
       FROM boletas b JOIN usuarios u ON u.id = b.usuario_id
       WHERE b.usuario_id = $1 ORDER BY b.created_at DESC`, [id]
    );
    res.json(rows.map(b => ({ ...b, estado_visual: clasificarBoletaVisual(b) })));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener boletas del usuario' });
  }
};

// ─── POST /api/boletas/generar-masivo ───────────────────────────────────────
const generarMasivo = async (req, res) => {
  const { periodo } = req.body;
  if (!periodo) return res.status(400).json({ error: 'Falta el periodo (ej: 2025-03)' });
  const [anio, mes] = periodo.split('-').map(Number);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: lecturas } = await client.query(`
      SELECT l.*, u.id as usuario_id, u.nombre, u.rut, u.numero_cliente, u.tiene_subsidio, u.saldo_favor,
        COALESCE((
          SELECT b2.saldo_pendiente FROM boletas b2
          WHERE b2.usuario_id = u.id ORDER BY b2.created_at DESC LIMIT 1
        ), 0) AS saldo_anterior_calc
      FROM lecturas l JOIN usuarios u ON u.id = l.usuario_id
      WHERE l.mes = $1 AND l.anio = $2 AND u.estado = 'activo'
        AND NOT EXISTS (SELECT 1 FROM boletas b WHERE b.usuario_id = l.usuario_id AND b.periodo = $3)
    `, [mes, anio, periodo]);

    if (lecturas.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No hay lecturas nuevas para generar boletas', generadas: 0 });
    }

    const { rows: tramos } = await client.query(`SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC`);
    const { rows: configRows } = await client.query(`SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('cargo_fijo', 'subsidio_porcentaje')`);
    const cfg = Object.fromEntries(configRows.map(c => [c.clave, parseFloat(c.valor || 0)]));
    const cargoFijo = cfg.cargo_fijo || 3000;

    let generadas = 0;
    for (const l of lecturas) {
      const consumo = parseFloat(l.consumo_m3 || 0);
      const saldo_anterior = parseFloat(l.saldo_anterior_calc || 0);
      const total_mes = calcularMontoTramos(tramos, cargoFijo, consumo, l.tiene_subsidio);
      const cuotaConvenio = await obtenerProximaCuotaConvenio(client, l.usuario_id);
      const cuota_prestamo = cuotaConvenio ? cuotaConvenio.monto : 0;
      const { totalAPagar: total_a_pagar, creditoAplicado, saldoFavorRestante } =
        aplicarSaldoFavor(total_mes + saldo_anterior + cuota_prestamo, l.saldo_favor);
      const fecha_vencimiento = new Date();
      fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 15);
      const descuento_subsidio = calcularDescuentoSubsidio(tramos, cargoFijo, consumo, l.tiene_subsidio);
      await client.query(`
        INSERT INTO boletas (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente, estado, fecha_vencimiento, fecha_emision, descuento_subsidio, cuota_prestamo, prestamo_cuota_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9,NOW(),$10,$11,$12)
      `, [l.usuario_id, l.id, periodo, consumo, total_mes, saldo_anterior, total_a_pagar, total_a_pagar, fecha_vencimiento.toISOString().split('T')[0], descuento_subsidio, cuota_prestamo, cuotaConvenio ? cuotaConvenio.cuotaId : null]);
      if (creditoAplicado > 0) {
        await client.query(`UPDATE usuarios SET saldo_favor = $1 WHERE id = $2`, [saldoFavorRestante, l.usuario_id]);
      }
      generadas++;
    }
    await client.query('COMMIT');
    res.json({ message: `${generadas} boletas generadas correctamente`, generadas });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('generarMasivo:', err);
    res.status(500).json({ error: 'Error en generación masiva: ' + err.message });
  } finally {
    client.release();
  }
};

// ─── POST /api/boletas/generar-individual ───────────────────────────────────
const generarIndividual = async (req, res) => {
  const { usuario_id, periodo } = req.body;
  if (!usuario_id || !periodo) return res.status(400).json({ error: 'Falta usuario_id o periodo' });
  const [anio, mes] = periodo.split('-').map(Number);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existe } = await client.query(
      `SELECT id FROM boletas WHERE usuario_id = $1 AND periodo = $2`,
      [usuario_id, periodo]
    );
    if (existe.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ya existe una boleta para este usuario en este período' });
    }

    const { rows: lecturas } = await client.query(
      `SELECT l.*, u.tiene_subsidio, u.saldo_favor
       FROM lecturas l JOIN usuarios u ON u.id = l.usuario_id
       WHERE l.usuario_id = $1 AND l.mes = $2 AND l.anio = $3
       ORDER BY l.id DESC LIMIT 1`,
      [usuario_id, mes, anio]
    );
    if (lecturas.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Este usuario no tiene una lectura registrada para ese período' });
    }
    const l = lecturas[0];

    const { rows: saldoRows } = await client.query(
      `SELECT saldo_pendiente FROM boletas WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [usuario_id]
    );
    const saldo_anterior = saldoRows.length > 0 ? parseFloat(saldoRows[0].saldo_pendiente) : 0;

    const { rows: tramos } = await client.query(`SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC`);
    const { rows: configRows } = await client.query(`SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('cargo_fijo', 'subsidio_porcentaje')`);
    const cfg = Object.fromEntries(configRows.map(c => [c.clave, parseFloat(c.valor || 0)]));
    const cargoFijo = cfg.cargo_fijo || 3000;

    const consumo = parseFloat(l.consumo_m3 || 0);
    const total_mes = calcularMontoTramos(tramos, cargoFijo, consumo, l.tiene_subsidio);
    const cuotaConvenio = await obtenerProximaCuotaConvenio(client, usuario_id);
    const cuota_prestamo = cuotaConvenio ? cuotaConvenio.monto : 0;
    const { totalAPagar: total_a_pagar, creditoAplicado, saldoFavorRestante } =
      aplicarSaldoFavor(total_mes + saldo_anterior + cuota_prestamo, l.saldo_favor);
    const descuento_subsidio = calcularDescuentoSubsidio(tramos, cargoFijo, consumo, l.tiene_subsidio);
    const fecha_vencimiento = new Date();
    fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 15);

    const { rows: creada } = await client.query(`
      INSERT INTO boletas (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente, estado, fecha_vencimiento, fecha_emision, descuento_subsidio, cuota_prestamo, prestamo_cuota_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9,NOW(),$10,$11,$12)
      RETURNING *
    `, [usuario_id, l.id, periodo, consumo, total_mes, saldo_anterior, total_a_pagar, total_a_pagar, fecha_vencimiento.toISOString().split('T')[0], descuento_subsidio, cuota_prestamo, cuotaConvenio ? cuotaConvenio.cuotaId : null]);

    if (creditoAplicado > 0) {
      await client.query(`UPDATE usuarios SET saldo_favor = $1 WHERE id = $2`, [saldoFavorRestante, usuario_id]);
    }

    await client.query('COMMIT');
    res.json({ success: true, boleta: creada[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('generarIndividual:', err);
    res.status(500).json({ error: 'Error al generar boleta individual: ' + err.message });
  } finally {
    client.release();
  }
};

// ─── DELETE /api/boletas/:id ─────────────────────────────────────────────────
const eliminarBoleta = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT estado FROM boletas WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Boleta no encontrada' });
    if (rows[0].estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede eliminar una boleta pagada. Anúlala si necesitas revertirla.' });
    }
    await pool.query('DELETE FROM boletas WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('eliminarBoleta:', err);
    res.status(500).json({ error: 'Error al eliminar boleta: ' + err.message });
  }
};

// ─── DELETE /api/boletas/periodo/:periodo ───────────────────────────────────
const eliminarPorPeriodo = async (req, res) => {
  try {
    const { periodo } = req.params;
    const { rows: pagadas } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM boletas WHERE periodo = $1 AND estado = 'pagada'`,
      [periodo]
    );
    const { rows: eliminadas } = await pool.query(
      `DELETE FROM boletas WHERE periodo = $1 AND estado != 'pagada' RETURNING id`,
      [periodo]
    );
    const omitidas = pagadas[0].total;
    res.json({
      success: true,
      eliminadas: eliminadas.length,
      omitidas_pagadas: omitidas,
      message: `${eliminadas.length} boleta(s) eliminada(s)` + (omitidas > 0 ? `. ${omitidas} boleta(s) pagada(s) se conservaron.` : '')
    });
  } catch (err) {
    console.error('eliminarPorPeriodo:', err);
    res.status(500).json({ error: 'Error al eliminar boletas del período: ' + err.message });
  }
};

// ─── PATCH /api/boletas/:id/estado ──────────────────────────────────────────
const actualizarEstado = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const validEstados = ['pendiente', 'pagada', 'anulada', 'abonada', 'congelada'];
    if (!validEstados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    const fechaPago = estado === 'pagada' ? new Date().toISOString() : null;

    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE boletas
      SET estado = CASE
            WHEN $1::text = 'pagada' THEN
              CASE WHEN CURRENT_DATE > fecha_vencimiento THEN 'atrasada' ELSE 'pagada' END
            ELSE $1::text
          END,
          fecha_pago=$2,
          saldo_pendiente = CASE
            WHEN $1::text = 'pagada' THEN 0
            WHEN $1::text = 'anulada' THEN 0
            WHEN $1::text = 'pendiente' THEN total_a_pagar
            ELSE saldo_pendiente
          END
      WHERE id=$3 RETURNING *
    `, [estado, fechaPago, id]);
    if ((rows[0]?.estado === 'pagada' || rows[0]?.estado === 'atrasada') && rows[0]?.prestamo_cuota_id) {
      await marcarCuotaConvenioPagada(client, rows[0].prestamo_cuota_id, rows[0].id);
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('actualizarEstado:', err);
    res.status(500).json({ error: 'Error al actualizar estado' });
  } finally {
    client.release();
  }
};

// ─── PATCH /api/boletas/:id/enviada ─────────────────────────────────────────
const marcarEnviada = async (req, res) => {
  try {
    const { id } = req.params;
    const { canal } = req.body;
    const campo = canal === 'whatsapp' ? 'enviada_whatsapp' : 'enviada_email';
    const { rows } = await pool.query(`UPDATE boletas SET ${campo}=TRUE WHERE id=$1 RETURNING *`, [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar boleta' });
  }
};

// ─── HELPER: renderizar PDF ──────────────────────────────────────────────────
const renderPDF = (doc, b, tramos, cargoFijo, historial, qrBuffer) => {
  const W = 595;
  const BLUE = '#0284c7';
  const ORANGE = '#f97316';
  const GRAY_LIGHT = '#f1f5f9';
  const GRAY_BORDER = '#cbd5e1';
  const TEXT_DARK = '#1e293b';
  const TEXT_MID = '#475569';
  const MARGIN = 40;

  // Calcular tramos brutos
  const calcularTramos = (consumo) => {
    let resultado = { tramo1: 0, tramo2: 0, tramo3: 0 };
    let restante = parseFloat(consumo || 0);
    tramos.forEach((t, i) => {
      if (restante <= 0) return;
      const hasta = t.tramo_hasta ? parseFloat(t.tramo_hasta) : Infinity;
      const efectivo_desde = i === 0 ? 0 : parseFloat(t.tramo_desde) - 1;
      const capacidad = hasta === Infinity ? restante : hasta - efectivo_desde;
      const consumido = Math.min(restante, capacidad);
      const monto = consumido * parseFloat(t.precio_por_m3);
      if (i === 0) resultado.tramo1 = monto;
      else if (i === 1) resultado.tramo2 = monto;
      else resultado.tramo3 = monto;
      restante -= consumido;
    });
    return resultado;
  };

  const { tramo1, tramo2, tramo3 } = calcularTramos(b.consumo_m3);
  const tieneSubsidio = b.tiene_subsidio;

  // HEADER
  doc.rect(0, 0, W, 90).fill(BLUE);
  const logoPath = path.join(__dirname, '../assets/logoaprpedregoso.png');
  try { doc.image(logoPath, 18, 8, { width: 72, height: 72 }); } catch {
    doc.circle(75, 45, 32).fill('white');
    doc.fontSize(9).fillColor(BLUE).font('Helvetica-Bold').text('APR', 57, 38).text('SAFIP', 53, 48);
  }
  doc.fillColor('white').font('Helvetica-Bold').fontSize(16).text('COMITE AGUA POTABLE RURAL', 105, 18);
  doc.font('Helvetica').fontSize(9)
    .text('SANTA FILOMENA PEDREGOSO  •  RUT: 71.810.200-6', 105, 40)
    .text(`SECTOR VILLA ALEGRE S/N VILLARRICA  •  Tel: ${b.telefono || '33554455'}`, 105, 54);

  // CAJA CLIENTE
  const boxY = 105, boxH = 90;
  doc.rect(MARGIN, boxY, W - MARGIN * 2, boxH).fillAndStroke(GRAY_LIGHT, GRAY_BORDER);
  const nombreFontSize = b.nombre.length > 35 ? 8 : 10;
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(nombreFontSize)
    .text(`Cliente: ${b.nombre}`, MARGIN + 14, boxY + 12, { width: (W / 2) - MARGIN - 20 });
  doc.fontSize(10).text(`RUT: ${b.rut}`, MARGIN + 14, boxY + 28);
  doc.font('Helvetica').fontSize(10)
    .text(`Medidor N°: ${b.medidor || '-'}`, MARGIN + 14, boxY + 44)
    .text(`Dirección: ${b.direccion || '-'}`, MARGIN + 14, boxY + 60);
  const col2X = W / 2 + 20;
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`Boleta #: ${b.numero_folio || b.id}`, col2X, boxY + 12)
    .text(`Período: ${b.periodo}`, col2X, boxY + 28);
  doc.font('Helvetica').fontSize(10)
    .text(`Emisión: ${b.fecha_emision ? new Date(b.fecha_emision).toLocaleDateString('es-CL') : '-'}`, col2X, boxY + 44)
    .text(`Vencimiento: ${b.fecha_vencimiento ? new Date(b.fecha_vencimiento).toLocaleDateString('es-CL') : '-'}`, col2X, boxY + 60);
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(TEXT_MID)
    .text('A partir de esta fecha se originarán intereses y se cobrará un cargo adicional por pago fuera de plazo.', MARGIN, boxY + boxH + 10, { width: W - MARGIN * 2 });

  // CONSUMO
  let y = boxY + boxH + 35;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_DARK).text('Consumo del periodo', MARGIN, y);
  y += 16;
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(TEXT_MID)
    .text(`Lectura Anterior: ${b.lectura_anterior ?? 0} m³`, MARGIN, y)
    .text(`Lectura Actual: ${b.lectura_actual ?? 0} m³`, W / 2, y);
  y += 14;
  doc.text(`Consumo Total: ${b.consumo_m3 ?? 0} m³`, MARGIN, y);

  // TABLA
  y += 28;
  const tableX = MARGIN, tableW = W - MARGIN * 2, colMonto = 140, rowH = 22;

  const conceptos = [
    { label: 'Cargo Fijo mensual', valor: cargoFijo },
    { label: `Monto Base (≤${tramos[0]?.tramo_hasta ?? 15} m³) — $${tramos[0]?.precio_por_m3 ?? 700}/m³`, valor: tramo1 },
    tieneSubsidio ? { label: 'Subsidio 50% aplicado', valor: -(parseFloat(b.descuento_subsidio || 0)) } : null,
    { label: `Excedente (${tramos[1]?.tramo_desde ?? 16}-${tramos[1]?.tramo_hasta ?? 30} m³) — $${tramos[1]?.precio_por_m3 ?? 1050}/m³`, valor: tramo2 },
    { label: `Excedente (>${tramos[1]?.tramo_hasta ?? 30} m³) — $${tramos[2]?.precio_por_m3 ?? 1400}/m³`, valor: tramo3 },
    parseFloat(b.saldo_favor || 0) > 0 ? { label: 'Saldo a favor', valor: -(parseFloat(b.saldo_favor || 0)) } : null,
    { label: 'Multa', valor: b.monto_multas || 0 },
    { label: 'Monto Corte', valor: b.monto_corte || 0 },
    { label: 'Cuota Préstamo', valor: b.cuota_prestamo || 0 },
    { label: 'IVA', valor: b.monto_iva || 0 },
  ].filter(c => c !== null && (parseFloat(c.valor) !== 0 || c.label.includes('Cargo Fijo') || c.label.includes('Base')));

  const subtotalMes = conceptos.reduce((acc, c) => acc + parseFloat(c.valor), 0);
  const saldoAnterior = parseFloat(b.saldo_anterior || 0);

  doc.rect(tableX, y, tableW, rowH).fill(BLUE);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
    .text('Concepto', tableX + 10, y + 6)
    .text('Monto ($)', tableX + tableW - colMonto + 10, y + 6);
  y += rowH;

  conceptos.forEach((c, i) => {
    doc.rect(tableX, y, tableW, rowH).fill(i % 2 === 0 ? 'white' : GRAY_LIGHT);
    doc.rect(tableX, y, tableW, rowH).stroke(GRAY_BORDER);
    const esDescuento = parseFloat(c.valor) < 0;
    doc.fillColor(esDescuento ? '#16a34a' : TEXT_DARK)
      .font(esDescuento ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .text(c.label, tableX + 10, y + 6)
      .text(`${esDescuento ? '-' : ''}$${Math.abs(Number(c.valor)).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
    y += rowH;
  });

  doc.rect(tableX, y, tableW, rowH).fill(GRAY_LIGHT);
  doc.rect(tableX, y, tableW, rowH).stroke(GRAY_BORDER);
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(9)
    .text('Subtotal del mes', tableX + 10, y + 6)
    .text(`$${Math.round(subtotalMes).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
  y += rowH;

  if (saldoAnterior !== 0) {
    doc.rect(tableX, y, tableW, rowH).fill('white');
    doc.rect(tableX, y, tableW, rowH).stroke(GRAY_BORDER);
    doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)
      .text('Saldo Anterior', tableX + 10, y + 6)
      .text(`$${Math.round(saldoAnterior).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
    y += rowH;
  }

  doc.rect(tableX, y, tableW, rowH + 2).fill(GRAY_LIGHT);
  doc.rect(tableX, y, tableW, rowH + 2).stroke(GRAY_BORDER);
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10)
    .text('TOTAL A PAGAR', tableX + 10, y + 6)
    .text(`$${Number(b.total_a_pagar || 0).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
  y += rowH + 10;

  // ESTADO
  const estadoColor = b.estado === 'pagada' ? '#16a34a' : ORANGE;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(estadoColor)
    .text(`Estado: ${(b.estado || 'PENDIENTE').toUpperCase()}`, MARGIN, y);

  // GRÁFICO
  if (historial && historial.length > 0) {
    y += 30;
    const chartX = MARGIN, chartW = 280, chartH = 100;
    const maxConsumo = Math.max(...historial.map(h => parseFloat(h.consumo_m3 || 0)), 1);
    const barW = (chartW / historial.length) - 8;
    [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
      const lineY = y + chartH - (ratio * chartH);
      doc.moveTo(chartX, lineY).lineTo(chartX + chartW, lineY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(7).text(Math.round(maxConsumo * ratio), chartX - 28, lineY - 4, { width: 25, align: 'right' });
    });
    [...historial].reverse().forEach((h, i) => {
      const barH = (parseFloat(h.consumo_m3 || 0) / maxConsumo) * chartH;
      const bx = chartX + i * (barW + 8);
      doc.rect(bx, y + chartH - barH, barW, barH).fill(BLUE);
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(6).text(h.periodo || '', bx, y + chartH + 4, { width: barW, align: 'center' });
    });
  }

  // QR
  const qrX = W - MARGIN - 130, qrY = y - 10;
  doc.image(qrBuffer, qrX, qrY, { width: 110, height: 110 });
  doc.fillColor(TEXT_MID).font('Helvetica').fontSize(7).text('Escanea para verificar', qrX, qrY + 114, { width: 110, align: 'center' });

  // PIE
  const footerY = 780;
  doc.rect(0, footerY, W, 62).fill(GRAY_LIGHT);
  doc.moveTo(0, footerY).lineTo(W, footerY).strokeColor(GRAY_BORDER).lineWidth(1).stroke();
  doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8)
    .text('Banco Estado  |  Cuenta Vista N°: 64570672906  |  RUT: 71.810.200-6  |  safipapr@gmail.com', MARGIN, footerY + 10, { align: 'center', width: W - MARGIN * 2 })
    .text('Sistema APR SAFIP  •  Santa Filomena Pedregoso  •  Villarrica', MARGIN, footerY + 26, { align: 'center', width: W - MARGIN * 2 })
    .text(`Documento generado el ${new Date().toLocaleDateString('es-CL')} — Solo válido como liquidación de cobro interno`, MARGIN, footerY + 42, { align: 'center', width: W - MARGIN * 2 });
};

// ─── GET /api/boletas/pdf/:id ───────────────────────────────────────────────
const generarPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT b.*, u.nombre, u.rut, u.direccion, u.telefono, u.numero_cliente,
        u.medidor, u.tiene_subsidio, u.saldo_favor,
        l.lectura_anterior, l.lectura_actual
      FROM boletas b JOIN usuarios u ON u.id = b.usuario_id
      LEFT JOIN lecturas l ON l.id = b.lectura_id
      WHERE b.id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Boleta no encontrada' });
    const b = rows[0];
    console.log('saldo_favor:', b.saldo_favor, 'rut:', b.rut);

    const { rows: historial } = await pool.query(`
      SELECT b2.periodo, b2.consumo_m3 FROM boletas b2
      WHERE b2.usuario_id = $1 ORDER BY b2.created_at DESC LIMIT 6
    `, [b.usuario_id]);

    const { rows: tramos } = await pool.query(`SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC`);
    const { rows: config } = await pool.query(`SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('cargo_fijo', 'monto_corte', 'monto_reposicion', 'subsidio_porcentaje')`);
    const cfg = Object.fromEntries(config.map(c => [c.clave, parseFloat(c.valor || 0)]));
    const cargoFijo = cfg.cargo_fijo || 3000;

    const QRCode = require('qrcode');
    const qrData = `APR SAFIP | Boleta #${b.numero_folio || b.id} | ${b.nombre} | Total: $${Number(b.total_a_pagar || 0).toLocaleString('es-CL')} | Período: ${b.periodo}`;
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 120, margin: 1 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=boleta-${b.numero_cliente}-${b.periodo}.pdf`);
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);
    renderPDF(doc, b, tramos, cargoFijo, historial, qrBuffer);
    doc.end();
  } catch (err) {
    console.error('generarPDF:', err);
    res.status(500).json({ error: 'Error al generar PDF: ' + err.message });
  }
};

// ─── GET /api/boletas/zip/:periodo ──────────────────────────────────────────
const generarZIP = async (req, res) => {
  try {
    const { periodo } = req.params;
    const QRCode = require('qrcode');
    const archiver = require('archiver');

    const { rows: boletas } = await pool.query(`
      SELECT b.*, u.nombre, u.rut, u.direccion, u.telefono, u.numero_cliente, u.medidor,
        u.tiene_subsidio, u.saldo_favor, l.lectura_anterior, l.lectura_actual
      FROM boletas b JOIN usuarios u ON u.id = b.usuario_id
      LEFT JOIN lecturas l ON l.id = b.lectura_id
      WHERE b.periodo = $1 ORDER BY u.numero_cliente ASC
    `, [periodo]);
    if (boletas.length === 0) return res.status(404).json({ error: 'No hay boletas para este período' });

    const { rows: tramos } = await pool.query(`SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC`);
    const { rows: configRows } = await pool.query(`SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('cargo_fijo', 'subsidio_porcentaje')`);
    const cargoFijo = parseFloat(configRows.find(c => c.clave === 'cargo_fijo')?.valor || 3000);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=boletas-${periodo}.zip`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const b of boletas) {
      const qrData = `APR SAFIP | Boleta #${b.numero_folio || b.id} | ${b.nombre} | Total: $${Number(b.total_a_pagar || 0).toLocaleString('es-CL')} | Período: ${b.periodo}`;
      const qrBuffer = await QRCode.toBuffer(qrData, { width: 120, margin: 1 });

      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        renderPDF(doc, b, tramos, cargoFijo, [], qrBuffer);
        doc.end();
      });

      const nombreArchivo = `boleta-${String(b.numero_cliente).padStart(3, '0')}-${b.nombre.replace(/\s+/g, '_')}.pdf`;
      archive.append(pdfBuffer, { name: nombreArchivo });
    }

    await archive.finalize();
  } catch (err) {
    console.error('generarZIP:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar ZIP: ' + err.message });
  }
};

// ─── POST /api/boletas/:id/enviar-whatsapp ──────────────────────────────────
const enviarWhatsapp = async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono } = req.body; // formato: +56937405890

    if (!telefono) return res.status(400).json({ error: 'Falta el teléfono destino' });

    const { rows } = await pool.query(
      `SELECT b.*, u.nombre FROM boletas b JOIN usuarios u ON u.id = b.usuario_id WHERE b.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Boleta no encontrada' });
    const b = rows[0];

    const pdfUrl = `https://apr-safip-xtxh.onrender.com/api/boletas/pdf/${id}`;

    const mensaje = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${telefono}`,
      body: `Hola ${b.nombre}, aquí está tu boleta del período ${b.periodo}. Total a pagar: $${Number(b.total_a_pagar).toLocaleString('es-CL')}`,
      // mediaUrl: [pdfUrl],  // ← comentá esta línea por ahora
    });

    res.json({ success: true, sid: mensaje.sid });
  } catch (err) {
    console.error('enviarWhatsapp:', err);
    res.status(500).json({ error: 'Error al enviar WhatsApp: ' + err.message });
  }
};

// ─── GET /api/boletas/pdf-usuario/:usuarioId ────────────────────────────────
const generarPDFPorUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const { rows } = await pool.query(
      `SELECT id FROM boletas WHERE usuario_id = $1 ORDER BY periodo DESC, created_at DESC LIMIT 1`,
      [usuarioId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Este usuario no tiene boletas generadas' });
    }

    // Reusa la misma lógica de generarPDF, redirigiendo con el id real de boleta
    req.params.id = rows[0].id;
    return generarPDF(req, res);

  } catch (err) {
    console.error('generarPDFPorUsuario:', err);
    res.status(500).json({ error: 'Error al generar PDF: ' + err.message });
  }
};

module.exports = { getAll, getByUsuario, generarMasivo, generarIndividual, eliminarBoleta, eliminarPorPeriodo, actualizarEstado, marcarEnviada, generarPDF, generarZIP, enviarWhatsapp, generarPDFPorUsuario };