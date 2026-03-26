const pool = require('../config/database');
const PDFDocument = require('pdfkit');
const path = require('path');

// ─── GET /api/boletas?periodo=2025-03 ───────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { periodo, estado } = req.query;

    let query = `
      SELECT 
        b.*,
        u.nombre, u.rut, u.direccion, u.telefono, u.numero_cliente
      FROM boletas b
      JOIN usuarios u ON u.id = b.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (periodo) {
      params.push(periodo);
      query += ` AND b.periodo = $${params.length}`;
    }
    if (estado) {
      params.push(estado);
      query += ` AND b.estado = $${params.length}`;
    }

    query += ` ORDER BY u.numero_cliente ASC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
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
       FROM boletas b
       JOIN usuarios u ON u.id = b.usuario_id
       WHERE b.usuario_id = $1
       ORDER BY b.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener boletas del usuario' });
  }
};

// ─── POST /api/boletas/generar-masivo ───────────────────────────────────────
// Genera boletas para TODOS los usuarios activos con lectura en el periodo
const generarMasivo = async (req, res) => {
  const { periodo } = req.body;
  if (!periodo) return res.status(400).json({ error: 'Falta el periodo (ej: 2025-03)' });

  const [anio, mes] = periodo.split('-').map(Number);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: lecturas } = await client.query(`
      SELECT 
        l.*,
        u.id as usuario_id,
        u.nombre, u.rut, u.numero_cliente,
        COALESCE((
          SELECT b2.saldo_pendiente 
          FROM boletas b2 
          WHERE b2.usuario_id = u.id 
          ORDER BY b2.created_at DESC 
          LIMIT 1
        ), 0) AS saldo_anterior_calc
      FROM lecturas l
      JOIN usuarios u ON u.id = l.usuario_id
      WHERE l.mes = $1 AND l.anio = $2
        AND u.estado = 'activo'
        AND NOT EXISTS (
          SELECT 1 FROM boletas b 
          WHERE b.usuario_id = l.usuario_id AND b.periodo = $3
        )
    `, [mes, anio, periodo]);

    if (lecturas.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No hay lecturas nuevas para generar boletas', generadas: 0 });
    }

    // Traer tramos de tarifas
    const { rows: tramos } = await client.query(
      `SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC`
    );

    // Traer cargo fijo
    const { rows: configRows } = await client.query(
      `SELECT valor FROM configuracion_sistema WHERE clave = 'cargo_fijo' LIMIT 1`
    );
    const cargoFijo = configRows[0]?.valor ? parseFloat(configRows[0].valor) : 3000;

    const calcularMonto = (consumo) => {
      let restante = parseFloat(consumo || 0);
      let total = cargoFijo;
      tramos.forEach((t, i) => {
        if (restante <= 0) return;
        const hasta = t.tramo_hasta ? parseFloat(t.tramo_hasta) : Infinity;
        const efectivo_desde = i === 0 ? 0 : parseFloat(t.tramo_desde) - 1;
        const capacidad = hasta === Infinity ? restante : hasta - efectivo_desde;
        const consumido = Math.min(restante, capacidad);
        total += consumido * parseFloat(t.precio_por_m3);
        restante -= consumido;
      });
      return total;
    };

    let generadas = 0;
    for (const l of lecturas) {
      const consumo = parseFloat(l.consumo_m3 || 0);
      const saldo_anterior = parseFloat(l.saldo_anterior_calc || 0);
      const total_mes = calcularMonto(consumo);
      const total_a_pagar = total_mes + saldo_anterior;
      const fecha_vencimiento = new Date();
      fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 15);

      await client.query(`
        INSERT INTO boletas (
          usuario_id, lectura_id, periodo, consumo_m3,
          total_mes, saldo_anterior, total_a_pagar, saldo_pendiente,
          estado, fecha_vencimiento, fecha_emision
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9,NOW())
      `, [
        l.usuario_id, l.id, periodo, consumo,
        total_mes, saldo_anterior, total_a_pagar, total_a_pagar,
        fecha_vencimiento.toISOString().split('T')[0]
      ]);

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

// ─── PATCH /api/boletas/:id/estado ──────────────────────────────────────────
const actualizarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const validEstados = ['pendiente', 'pagada', 'anulada'];
    if (!validEstados.includes(estado))
      return res.status(400).json({ error: 'Estado inválido' });

    const fechaPago = estado === 'pagada' ? new Date().toISOString() : null;

    const { rows } = await pool.query(
      `UPDATE boletas SET estado=$1, fecha_pago=$2 WHERE id=$3 RETURNING *`,
      [estado, fechaPago, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

// ─── PATCH /api/boletas/:id/enviada ─────────────────────────────────────────
const marcarEnviada = async (req, res) => {
  try {
    const { id } = req.params;
    const { canal } = req.body; // 'whatsapp' | 'email'

    const campo = canal === 'whatsapp' ? 'enviada_whatsapp' : 'enviada_email';
    const { rows } = await pool.query(
      `UPDATE boletas SET ${campo}=TRUE WHERE id=$1 RETURNING *`,
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar boleta' });
  }
};

// ─── GET /api/boletas/pdf/:id ───────────────────────────────────────────────
const generarPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT 
        b.*,
        u.nombre, u.rut, u.direccion, u.telefono, u.numero_cliente,
        u.medidor,
        l.lectura_anterior, l.lectura_actual
      FROM boletas b
      JOIN usuarios u ON u.id = b.usuario_id
      LEFT JOIN lecturas l ON l.id = b.lectura_id
      WHERE b.id = $1
    `, [id]);

    if (!rows[0]) return res.status(404).json({ error: 'Boleta no encontrada' });

    const b = rows[0]; // ← PRIMERO se declara b

    const { rows: historial } = await pool.query(`
      SELECT b2.periodo, b2.consumo_m3
      FROM boletas b2
      WHERE b2.usuario_id = $1
      ORDER BY b2.created_at DESC
      LIMIT 6
    `, [b.usuario_id]);

    const { rows: tramos } = await pool.query(`
      SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC
    `);

    const calcularTramos = (consumo, tramos) => {
      let resultado = { tramo1: 0, tramo2: 0, tramo3: 0 };
      let restante = parseFloat(consumo || 0);

      tramos.forEach((t, i) => {
        if (restante <= 0) return;

        const hasta = t.tramo_hasta ? parseFloat(t.tramo_hasta) : Infinity;

        // Capacidad real de cada tramo:
        // Tramo 1: 0-15  → 15 m³ (hasta - desde = 15-0 = 15)
        // Tramo 2: 16-30 → 15 m³ (hasta - (desde-1) = 30-15 = 15)
        // Tramo 3: 31+   → lo que sobre
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

    const { tramo1, tramo2, tramo3 } = calcularTramos(b.consumo_m3, tramos);

    const { rows: config } = await pool.query(`
      SELECT clave, valor FROM configuracion_sistema 
      WHERE clave IN ('cargo_fijo', 'monto_corte', 'monto_reposicion')
    `);
    const cfg = Object.fromEntries(config.map(c => [c.clave, parseFloat(c.valor || 0)]));
    const cargoFijo = cfg.cargo_fijo || 3000;

    const QRCode = require('qrcode');
    const qrData = `APR SAFIP | Boleta #${b.numero_folio || b.id} | ${b.nombre} | Total: $${Number(b.total_a_pagar || 0).toLocaleString('es-CL')} | Período: ${b.periodo}`;
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 120, margin: 1 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=boleta-${b.numero_cliente}-${b.periodo}.pdf`);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    doc.pipe(res);

    const W = 595;
    const BLUE = '#0284c7';
    const ORANGE = '#f97316';
    const GRAY_LIGHT = '#f1f5f9';
    const GRAY_BORDER = '#cbd5e1';
    const TEXT_DARK = '#1e293b';
    const TEXT_MID = '#475569';
    const MARGIN = 40;

    // ── HEADER AZUL ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(BLUE);
    // Logo
    const logoPath = path.join(__dirname, '../assets/logoaprpedregoso.png');
    try {
      doc.image(logoPath, 18, 8, { width: 72, height: 72 });
    } catch {
      // Si no encuentra el logo, dibuja círculo placeholder
      doc.circle(75, 45, 32).fill('white');
      doc.fontSize(9).fillColor(BLUE).font('Helvetica-Bold')
        .text('APR', 57, 38)
        .text('SAFIP', 53, 48);
    }
    // Texto header
    doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
      .text('COMITE AGUA POTABLE RURAL', 105, 18);
    doc.font('Helvetica').fontSize(9)
      .text('SANTA FILOMENA PEDREGOSO  •  RUT: 71.810.200-6', 105, 40)
      .text(`SECTOR VILLA ALEGRE S/N VILLARRICA  •  Tel: ${b.telefono || '33554455'}`, 105, 54);

    // ── CAJA DATOS CLIENTE + BOLETA ──────────────────────────────────────────
    const boxY = 105;
    const boxH = 90;
    doc.rect(MARGIN, boxY, W - MARGIN * 2, boxH).fillAndStroke(GRAY_LIGHT, GRAY_BORDER);

    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10)
      .text(`Cliente: ${b.nombre}`, MARGIN + 14, boxY + 12)
      .text(`RUT: ${b.rut}`, MARGIN + 14, boxY + 28);
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
      .text('A partir de esta fecha se originarán intereses y se cobrará un cargo adicional por pago fuera de plazo.',
        MARGIN, boxY + boxH + 10, { width: W - MARGIN * 2 });

    // ── CONSUMO ───────────────────────────────────────────────────────────────
    let y = boxY + boxH + 35;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_DARK)
      .text('Consumo del periodo', MARGIN, y);
    y += 16;
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(TEXT_MID)
      .text(`Lectura Anterior: ${b.lectura_anterior ?? 0} m³`, MARGIN, y)
      .text(`Lectura Actual: ${b.lectura_actual ?? 0} m³`, W / 2, y);
    y += 14;
    doc.text(`Consumo Total: ${b.consumo_m3 ?? 0} m³`, MARGIN, y);

    if (parseFloat(b.descuento_subsidio || 0) > 0) {
      y += 18;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
        .text(`Subsidio aplicado: $${Number(b.descuento_subsidio).toLocaleString('es-CL')}`, MARGIN, y);
    }

    // ── TABLA CONCEPTOS ───────────────────────────────────────────────────────
    y += 28;
    const tableX = MARGIN;
    const tableW = W - MARGIN * 2;
    const colMonto = 140;
    const rowH = 22;

    const conceptos = [
      { label: `Cargo Fijo mensual`, valor: cargoFijo },
      { label: `Monto Base (≤${tramos[0]?.tramo_hasta ?? 15} m³) — $${tramos[0]?.precio_por_m3 ?? 700}/m³`, valor: tramo1 },
      { label: `Excedente (${tramos[1]?.tramo_desde ?? 16}-${tramos[1]?.tramo_hasta ?? 30} m³) — $${tramos[1]?.precio_por_m3 ?? 1050}/m³`, valor: tramo2 },
      { label: `Excedente (>${tramos[1]?.tramo_hasta ?? 30} m³) — $${tramos[2]?.precio_por_m3 ?? 1400}/m³`, valor: tramo3 },
      { label: 'Multa', valor: b.monto_multas || 0 },
      { label: 'Monto Corte', valor: b.monto_corte || 0 },
      { label: 'Cuota Préstamo', valor: b.cuota_prestamo || 0 },
      { label: 'Saldo Anterior', valor: b.saldo_anterior || 0 },
      { label: 'IVA', valor: b.monto_iva || 0 },
    ].filter(c => parseFloat(c.valor) !== 0 || c.label.includes('Cargo Fijo') || c.label.includes('Base'));

    doc.rect(tableX, y, tableW, rowH).fill(BLUE);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
      .text('Concepto', tableX + 10, y + 6)
      .text('Monto ($)', tableX + tableW - colMonto + 10, y + 6);
    y += rowH;

    conceptos.forEach((c, i) => {
      const bg = i % 2 === 0 ? 'white' : GRAY_LIGHT;
      doc.rect(tableX, y, tableW, rowH).fill(bg);
      doc.rect(tableX, y, tableW, rowH).stroke(GRAY_BORDER);
      doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)
        .text(c.label, tableX + 10, y + 6)
        .text(`$${Number(c.valor).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
      y += rowH;
    });

    doc.rect(tableX, y, tableW, rowH + 2).fill(GRAY_LIGHT);
    doc.rect(tableX, y, tableW, rowH + 2).stroke(GRAY_BORDER);
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10)
      .text('TOTAL A PAGAR', tableX + 10, y + 6)
      .text(`$${Number(b.total_a_pagar || 0).toLocaleString('es-CL')}`, tableX + tableW - colMonto + 10, y + 6);
    y += rowH + 10;

    // ── ESTADO ────────────────────────────────────────────────────────────────
    const estadoColor = b.estado === 'pagada' ? '#16a34a' : ORANGE;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(estadoColor)
      .text(`Estado: ${(b.estado || 'PENDIENTE').toUpperCase()}`, MARGIN, y);

    // ── GRÁFICO ───────────────────────────────────────────────────────────────
    y += 30;
    const chartX = MARGIN;
    const chartW = 280;
    const chartH = 100;
    const maxConsumo = Math.max(...historial.map(h => parseFloat(h.consumo_m3 || 0)), 1);
    const barW = historial.length > 0 ? (chartW / historial.length) - 8 : 30;

    [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
      const lineY = y + chartH - (ratio * chartH);
      doc.moveTo(chartX, lineY).lineTo(chartX + chartW, lineY)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(7)
        .text(Math.round(maxConsumo * ratio), chartX - 28, lineY - 4, { width: 25, align: 'right' });
    });

    [...historial].reverse().forEach((h, i) => {
      const barH = (parseFloat(h.consumo_m3 || 0) / maxConsumo) * chartH;
      const bx = chartX + i * (barW + 8);
      const by = y + chartH - barH;
      doc.rect(bx, by, barW, barH).fill(BLUE);
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(6)
        .text(h.periodo || '', bx, y + chartH + 4, { width: barW, align: 'center' });
    });

    // ── QR ────────────────────────────────────────────────────────────────────
    const qrX = W - MARGIN - 130;
    const qrY = y - 10;
    doc.image(qrBuffer, qrX, qrY, { width: 110, height: 110 });
    doc.fillColor(TEXT_MID).font('Helvetica').fontSize(7)
      .text('Escanea para verificar', qrX, qrY + 114, { width: 110, align: 'center' });

    // ── PIE ───────────────────────────────────────────────────────────────────
    const footerY = 780;
    doc.rect(0, footerY, W, 62).fill(GRAY_LIGHT);
    doc.moveTo(0, footerY).lineTo(W, footerY).strokeColor(GRAY_BORDER).lineWidth(1).stroke();
    doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8)
      .text('Pago por transferencia: Banco Estado  |  Cta. Corriente: 123456789  |  RUT: 71.810.200-6', MARGIN, footerY + 10, { align: 'center', width: W - MARGIN * 2 })
      .text('Sistema APR SAFIP  •  Santa Filomena Pedregoso  •  Villarrica', MARGIN, footerY + 26, { align: 'center', width: W - MARGIN * 2 })
      .text(`Documento generado el ${new Date().toLocaleDateString('es-CL')} — Solo válido como liquidación de cobro interno`, MARGIN, footerY + 42, { align: 'center', width: W - MARGIN * 2 });

    doc.end();
  } catch (err) {
    console.error('generarPDF:', err);
    res.status(500).json({ error: 'Error al generar PDF: ' + err.message });
  }
};

module.exports = { getAll, getByUsuario, generarMasivo, actualizarEstado, marcarEnviada, generarPDF };