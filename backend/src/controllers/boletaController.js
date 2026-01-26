const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const pool = require('../config/database');
const path = require('path');

// Configuración APR
const APR_CONFIG = {
  nombre: 'COMITE AGUA POTABLE RURAL',
  subtitulo: 'SANTA FILOMENA PEDREGOSO',
  rut: '71.810.200-6',
  direccion: 'SECTOR VILLA ALEGRE S/N VILLARICA',
  telefono: '+56 9 375890'
};

// Tarifas
const TARIFAS = {
  cargoFijo: 3000,
  base0a15: 700,
  excedente16a30: 900,
  excedente30plus: 1200,
  iva: 0.19 // 19%
};

function calcularBoleta(lecturaAnterior, lecturaActual, saldoPendiente = 0, subsidio = 0, multa = 0, aplicarIVA = false) {
  const consumo = lecturaActual - lecturaAnterior;
  
  let montoBase = 0;
  let excedente16_30 = 0;
  let excedente30plus = 0;
  
  if (consumo <= 15) {
    montoBase = consumo * TARIFAS.base0a15;
  } else if (consumo <= 30) {
    montoBase = 15 * TARIFAS.base0a15;
    excedente16_30 = (consumo - 15) * TARIFAS.excedente16a30;
  } else {
    montoBase = 15 * TARIFAS.base0a15;
    excedente16_30 = 15 * TARIFAS.excedente16a30;
    excedente30plus = (consumo - 30) * TARIFAS.excedente30plus;
  }
  
  const subtotal = TARIFAS.cargoFijo + montoBase + excedente16_30 + excedente30plus + multa + saldoPendiente;
  const iva = aplicarIVA ? Math.round(subtotal * TARIFAS.iva) : 0;
  const total = subtotal + iva - subsidio;
  
  return {
    consumo,
    cargoFijo: TARIFAS.cargoFijo,
    montoBase,
    excedente16_30,
    excedente30plus,
    multa,
    saldoPendiente,
    subsidio,
    iva,
    total
  };
}

const boletaController = {
  generarPDF: async (req, res) => {
    try {
      const { usuarioId } = req.params;
      
      // Obtener datos del usuario
      const usuarioResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
      const usuario = usuarioResult.rows[0];
      
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Obtener últimas 3 lecturas para el gráfico
      const lecturasResult = await pool.query(
        'SELECT * FROM lecturas WHERE usuario_id = $1 ORDER BY fecha_lectura DESC LIMIT 3',
        [usuarioId]
      );
      
      const lecturas = lecturasResult.rows.reverse(); // Orden cronológico
      
      if (lecturas.length === 0) {
        return res.status(404).json({ error: 'No hay lecturas registradas para este usuario' });
      }
      
      const lecturaActual = lecturas[lecturas.length - 1];
      
      // Calcular deuda total
      const lecturasTotal = await pool.query(
        'SELECT COALESCE(SUM(monto_calculado), 0) as total FROM lecturas WHERE usuario_id = $1',
        [usuarioId]
      );
      
      const pagosTotal = await pool.query(
        'SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE usuario_id = $1',
        [usuarioId]
      );
      
      const deudaTotal = parseFloat(lecturasTotal.rows[0].total) - parseFloat(pagosTotal.rows[0].total);
      const saldoPendiente = deudaTotal > lecturaActual.monto_calculado ? deudaTotal - lecturaActual.monto_calculado : 0;
      
      const calculo = calcularBoleta(
        lecturaActual.lectura_anterior,
        lecturaActual.lectura_actual,
        saldoPendiente,
        0, // subsidio
        0, // multa
        false // IVA (cambiar a true si aplica)
      );
      
      const numeroBoletaGen = `${usuario.numero_cliente}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
      
      const boletaData = {
        numero: numeroBoletaGen,
        cliente: usuario.nombre,
        rut: usuario.rut,
        medidor: usuario.numero_cliente,
        lecturaAnterior: lecturaActual.lectura_anterior,
        lecturaActual: lecturaActual.lectura_actual,
        emision: new Date().toLocaleDateString('es-CL'),
        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'),
        calculo,
        estado: usuario.estado === 'moroso' ? 'PENDIENTE' : 'AL DÍA'
      };
      
      // Generar código QR
      const qrData = `https://miempresa.cl/pagar?boleta=${boletaData.numero}&monto=${boletaData.calculo.total}`;
      const qrImage = await QRCode.toDataURL(qrData);
      
      // Generar PDF
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=boleta_${usuario.numero_cliente}.pdf`);
      
      doc.pipe(res);
      
      // HEADER CON LOGO
      const logoPath = path.join(__dirname, '../assets/LogoApr.png');
      
      try {
        doc.image(logoPath, 50, 40, { width: 80 });
      } catch (error) {
        console.log('Logo no encontrado, usando texto');
      }
      
      doc.fontSize(16).font('Helvetica-Bold').text(APR_CONFIG.nombre, 150, 50, { width: 400 });
      doc.fontSize(11).font('Helvetica').text(`${APR_CONFIG.subtitulo} • RUT: ${APR_CONFIG.rut}`, 150, 70, { width: 400 });
      doc.fontSize(10).text(`${APR_CONFIG.direccion} • Tel: ${APR_CONFIG.telefono}`, 150, 85, { width: 400 });
      
      doc.moveDown(3);
      
      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown();
      
      // Información del cliente
      doc.fontSize(11).font('Helvetica-Bold').text('Cliente: ', { continued: true })
         .font('Helvetica').text(boletaData.cliente);
      doc.font('Helvetica-Bold').text('RUT: ', { continued: true })
         .font('Helvetica').text(boletaData.rut);
      doc.font('Helvetica-Bold').text('N° Cliente: ', { continued: true })
         .font('Helvetica').text(boletaData.medidor);
      doc.moveDown();
      
      // Información de la boleta con QR
      const infoY = doc.y;
      doc.font('Helvetica-Bold').text('Boleta #: ', 50, infoY, { continued: true })
         .font('Helvetica').text(boletaData.numero);
      doc.font('Helvetica-Bold').text('Emisión: ', 50, doc.y, { continued: true })
         .font('Helvetica').text(boletaData.emision);
      doc.font('Helvetica-Bold').text('Vencimiento: ', 50, doc.y, { continued: true })
         .font('Helvetica').text(boletaData.vencimiento);
      
      // QR Code
      doc.image(qrImage, 450, infoY - 10, { width: 80 });
      doc.fontSize(8).text('Pagar en línea', 450, infoY + 75, { width: 80, align: 'center' });
      
      doc.moveDown();
      
      doc.fontSize(9).fillColor('red')
         .text('A partir de esta fecha se originarán intereses y se cobrará un cargo adicional por pago fuera de plazo.', 50, doc.y, { width: 350 })
         .fillColor('black');
      doc.moveDown();
      
      // Consumo del periodo
      doc.fontSize(12).font('Helvetica-Bold').text('Consumo del periodo');
      doc.fontSize(10).font('Helvetica')
         .text(`Lectura Anterior: ${boletaData.lecturaAnterior} m³     Lectura Actual: ${boletaData.lecturaActual} m³`);
      doc.font('Helvetica-Bold').text(`Consumo Total: ${boletaData.calculo.consumo} m³`);
      doc.moveDown();
      
      // GRÁFICO DE CONSUMO
      if (lecturas.length > 1) {
        doc.fontSize(11).font('Helvetica-Bold').text('Historial de Consumo (últimos 3 meses)');
        doc.moveDown(0.5);
        
        const chartX = 50;
        const chartY = doc.y;
        const chartWidth = 500;
        const chartHeight = 100;
        const maxConsumo = Math.max(...lecturas.map(l => l.consumo_m3)) * 1.2;
        
        // Ejes
        doc.strokeColor('#666666').lineWidth(1);
        doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke(); // Eje X
        doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke(); // Eje Y
        
        // Barras
        const barWidth = chartWidth / lecturas.length / 2;
        const gap = chartWidth / lecturas.length;
        
        lecturas.forEach((lectura, index) => {
          const barHeight = (lectura.consumo_m3 / maxConsumo) * chartHeight;
          const x = chartX + (index * gap) + gap / 4;
          const y = chartY + chartHeight - barHeight;
          
          // Barra
          doc.rect(x, y, barWidth, barHeight).fillAndStroke('#0ea5e9', '#0369a1');
          
          // Valor encima
          doc.fontSize(9).fillColor('black').text(
            `${lectura.consumo_m3} m³`,
            x - 10,
            y - 15,
            { width: barWidth + 20, align: 'center' }
          );
          
          // Mes debajo
          const mes = new Date(lectura.anio, lectura.mes - 1).toLocaleString('es-CL', { month: 'short' });
          doc.fontSize(8).text(
            mes,
            x - 10,
            chartY + chartHeight + 5,
            { width: barWidth + 20, align: 'center' }
          );
        });
        
        doc.moveDown(4);
      }
      
      // Tabla de conceptos
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 400;
      
      doc.fontSize(11).font('Helvetica-Bold').fillColor('black');
      doc.text('Concepto', col1, tableTop);
      doc.text('Monto ($)', col2, tableTop);
      doc.moveDown(0.5);
      
      const conceptos = [
        { label: 'Cargo Fijo', valor: `$${boletaData.calculo.cargoFijo.toLocaleString('es-CL')}` },
        { label: 'Monto Base (0-15m³)', valor: `$${boletaData.calculo.montoBase.toLocaleString('es-CL')}` },
        { label: 'Excedente (16-30m³)', valor: `$${boletaData.calculo.excedente16_30.toLocaleString('es-CL')}` },
        { label: 'Excedente (>30m³)', valor: `$${boletaData.calculo.excedente30plus.toLocaleString('es-CL')}` },
        { label: 'Multa', valor: `$${boletaData.calculo.multa.toLocaleString('es-CL')}` },
        { label: 'Saldo Pendiente', valor: `$${boletaData.calculo.saldoPendiente.toLocaleString('es-CL')}` },
        { label: 'IVA (19%)', valor: `$${boletaData.calculo.iva.toLocaleString('es-CL')}` }
      ];
      
      doc.font('Helvetica');
      conceptos.forEach(item => {
        doc.text(item.label, col1, doc.y);
        doc.text(item.valor, col2, doc.y);
        doc.moveDown(0.5);
      });
      
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);
      
      // Total
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('TOTAL A PAGAR', col1, doc.y);
      doc.text(`$${boletaData.calculo.total.toLocaleString('es-CL')}`, col2, doc.y);
      doc.moveDown(2);
      
      // Estado
      doc.fontSize(12).text(`Estado: ${boletaData.estado}`, { align: 'center' });
      
      doc.end();
      
    } catch (error) {
      console.error('Error generando boleta:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = boletaController;