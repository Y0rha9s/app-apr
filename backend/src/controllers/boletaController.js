const PDFDocument = require('pdfkit');
const pool = require('../config/database');

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
  excedente30plus: 1200
};

function calcularBoleta(lecturaAnterior, lecturaActual, saldoPendiente = 0, subsidio = 0, multa = 0) {
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
  const total = subtotal - subsidio;
  
  return {
    consumo,
    cargoFijo: TARIFAS.cargoFijo,
    montoBase,
    excedente16_30,
    excedente30plus,
    multa,
    saldoPendiente,
    subsidio,
    iva: 0,
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
      
      // Obtener última lectura
      const lecturaResult = await pool.query(
        'SELECT * FROM lecturas WHERE usuario_id = $1 ORDER BY fecha_lectura DESC LIMIT 1',
        [usuarioId]
      );
      
      const lectura = lecturaResult.rows[0];
      
      if (!lectura) {
        return res.status(404).json({ error: 'No hay lecturas registradas para este usuario' });
      }
      
      // Calcular deuda (lecturas - pagos)
      const lecturasTotal = await pool.query(
        'SELECT COALESCE(SUM(monto_calculado), 0) as total FROM lecturas WHERE usuario_id = $1',
        [usuarioId]
      );
      
      const pagosTotal = await pool.query(
        'SELECT COALESCE(SUM(monto), 0) as total FROM pagos WHERE usuario_id = $1',
        [usuarioId]
      );
      
      const saldoPendiente = parseFloat(lecturasTotal.rows[0].total) - parseFloat(pagosTotal.rows[0].total);
      
      const calculo = calcularBoleta(
        lectura.lectura_anterior,
        lectura.lectura_actual,
        saldoPendiente > lectura.monto_calculado ? saldoPendiente - lectura.monto_calculado : 0,
        0, // subsidio
        0  // multa
      );
      
      const boletaData = {
        numero: `${usuario.numero_cliente}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`,
        cliente: usuario.nombre,
        rut: usuario.rut,
        medidor: usuario.numero_cliente,
        lecturaAnterior: lectura.lectura_anterior,
        lecturaActual: lectura.lectura_actual,
        emision: new Date().toLocaleDateString('es-CL'),
        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL'),
        calculo,
        estado: usuario.estado === 'moroso' ? 'PENDIENTE' : 'AL DÍA'
      };
      
      // Generar PDF
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=boleta_${usuario.numero_cliente}.pdf`);
      
      doc.pipe(res);
      
      // Encabezado
      doc.fontSize(16).font('Helvetica-Bold').text(APR_CONFIG.nombre, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(APR_CONFIG.subtitulo, { align: 'center' });
      doc.fontSize(10).text(`RUT: ${APR_CONFIG.rut}`, { align: 'center' });
      doc.text(`${APR_CONFIG.direccion} • Tel: ${APR_CONFIG.telefono}`, { align: 'center' });
      doc.moveDown(2);
      
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
      
      // Información de la boleta
      doc.font('Helvetica-Bold').text('Boleta #: ', { continued: true })
         .font('Helvetica').text(boletaData.numero);
      doc.font('Helvetica-Bold').text('Emisión: ', { continued: true })
         .font('Helvetica').text(boletaData.emision);
      doc.font('Helvetica-Bold').text('Vencimiento: ', { continued: true })
         .font('Helvetica').text(boletaData.vencimiento);
      doc.moveDown();
      
      doc.fontSize(9).fillColor('red')
         .text('A partir de esta fecha se originarán intereses y se cobrará un cargo adicional por pago fuera de plazo.')
         .fillColor('black');
      doc.moveDown();
      
      // Consumo del periodo
      doc.fontSize(12).font('Helvetica-Bold').text('Consumo del periodo');
      doc.fontSize(10).font('Helvetica')
         .text(`Lectura Anterior: ${boletaData.lecturaAnterior} m³     Lectura Actual: ${boletaData.lecturaActual} m³`);
      doc.font('Helvetica-Bold').text(`Consumo Total: ${boletaData.calculo.consumo} m³`);
      doc.moveDown();
      
      // Tabla de conceptos
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 400;
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Concepto', col1, tableTop);
      doc.text('Monto ($)', col2, tableTop);
      doc.moveDown(0.5);
      
      const conceptos = [
        { label: 'Cargo Fijo', valor: `$${boletaData.calculo.cargoFijo.toLocaleString('es-CL')}` },
        { label: 'Monto Base (0-15m³)', valor: `$${boletaData.calculo.montoBase.toLocaleString('es-CL')}` },
        { label: 'Excedente (16-30m³)', valor: `$${boletaData.calculo.excedente16_30.toLocaleString('es-CL')}` },
        { label: 'Excedente (>30m³)', valor: `$${boletaData.calculo.excedente30plus.toLocaleString('es-CL')}` },
        { label: 'Multa', valor: `$${boletaData.calculo.multa.toLocaleString('es-CL')}` },
        { label: 'Saldo Pendiente', valor: `$${boletaData.calculo.saldoPendiente.toLocaleString('es-CL')}` }
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