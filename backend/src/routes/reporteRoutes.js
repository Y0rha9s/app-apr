const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const ExcelJS = require('exceljs');

// GET /api/reporte/lecturas-excel?mes=3&anio=2026
router.get('/lecturas-excel', async (req, res) => {
  try {
    const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    const { rows } = await pool.query(`
      SELECT
        u.numero_cliente,
        u.nombre,
        u.direccion,
        u.medidor,
        u.estado_servicio,
        l.lectura_anterior,
        l.lectura_actual,
        l.consumo_m3,
        l.monto_calculado,
        b.total_a_pagar,
        b.saldo_pendiente,
        b.estado AS estado_boleta,
        b.fecha_vencimiento,
        op.nombre AS operador,
        l.foto_url
      FROM lecturas l
      JOIN usuarios u ON l.usuario_id = u.id
      LEFT JOIN boletas b ON b.lectura_id = l.id
      LEFT JOIN usuarios op ON l.operador_id = op.id
      WHERE l.mes = $1 AND l.anio = $2
      ORDER BY u.numero_cliente ASC NULLS LAST, u.nombre ASC
    `, [mes, anio]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APR';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Lecturas ${periodo}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true }
    });

    // Título
    sheet.mergeCells('A1:O1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `COMITÉ DE AGUA POTABLE RURAL DE SANTA FILOMENA PEDREGOSO — Lecturas ${periodo}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F66' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Fecha generación
    sheet.mergeCells('A2:O2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Generado el ${new Date().toLocaleDateString('es-CL')} — Total socios: ${rows.length}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF444444' } };
    subCell.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 18;

    // Encabezados
    const headers = [
      'N° Cliente', 'Nombre', 'Dirección', 'Medidor',
      'Estado Servicio', 'Lect. Anterior', 'Lect. Actual',
      'Consumo m³', 'Monto Mes', 'Total a Pagar',
      'Saldo Pendiente', 'Estado Boleta', 'Vencimiento',
      'Operador', 'Foto'
    ];

    const headerRow = sheet.getRow(3);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        right: { style: 'thin', color: { argb: 'FFBFDBFE' } }
      };
    });
    headerRow.height = 36;

    // Anchos de columna
    const anchos = [12, 30, 28, 14, 16, 14, 14, 12, 14, 14, 14, 14, 14, 20, 10];
    anchos.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    // Colores
    const ROJO_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDD5D5' } };
    const AZUL_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAFF' } };
    const BLANCO_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const ROJO_FONT   = { color: { argb: 'FF9B1C1C' }, size: 10 };
    const AZUL_FONT   = { color: { argb: 'FF1E3A5F' }, size: 10 };
    const NEGRO_FONT  = { color: { argb: 'FF1F2937' }, size: 10 };

    // Filas de datos
    rows.forEach((r, idx) => {
      const rowNum = idx + 4;
      const row = sheet.getRow(rowNum);

      const lecturaAlta = r.lectura_actual > r.lectura_anterior * 1.5 && r.consumo_m3 > 30;
      const cortadoSinPago = r.estado_servicio === 'cortado' && r.saldo_pendiente > 0;
      const pendiente = r.estado_boleta === 'pendiente' && !cortadoSinPago && !lecturaAlta;

      let fillColor = BLANCO_FILL;
      let fontColor = NEGRO_FONT;

      if (lecturaAlta || cortadoSinPago) {
        fillColor = ROJO_FILL;
        fontColor = ROJO_FONT;
      } else if (pendiente) {
        fillColor = AZUL_FILL;
        fontColor = AZUL_FONT;
      }

      const valores = [
        r.numero_cliente || '—',
        r.nombre,
        r.direccion || '—',
        r.medidor || '—',
        r.estado_servicio || '—',
        r.lectura_anterior,
        r.lectura_actual,
        r.consumo_m3,
        r.monto_calculado ? `$${Number(r.monto_calculado).toLocaleString('es-CL')}` : '—',
        r.total_a_pagar  ? `$${Number(r.total_a_pagar).toLocaleString('es-CL')}` : '—',
        r.saldo_pendiente ? `$${Number(r.saldo_pendiente).toLocaleString('es-CL')}` : '$0',
        r.estado_boleta || '—',
        r.fecha_vencimiento ? new Date(r.fecha_vencimiento).toLocaleDateString('es-CL') : '—',
        r.operador || '—',
        r.foto_url ? 'Ver foto' : 'Sin foto'
      ];

      valores.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.fill = fillColor;
        cell.font = fontColor;
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        // Link en celda foto
        if (i === 14 && r.foto_url) {
          cell.value = { text: 'Ver foto', hyperlink: r.foto_url };
          cell.font = { ...fontColor, underline: true, color: { argb: 'FF1D4ED8' } };
        }
      });

      row.height = 22;
    });

    // Leyenda
    const leyendaRow = rows.length + 5;
    sheet.mergeCells(`A${leyendaRow}:O${leyendaRow}`);
    const leyenda = sheet.getCell(`A${leyendaRow}`);
    leyenda.value = '🔴 Rojo = Lectura anormalmente alta O usuario cortado con deuda   🔵 Azul = Boleta pendiente de pago';
    leyenda.font = { italic: true, size: 10, color: { argb: 'FF374151' } };
    leyenda.alignment = { horizontal: 'left' };

    // Enviar archivo
    const nombreArchivo = `Lecturas_APR_${periodo}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;