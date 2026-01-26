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
    
    const subsidio = 0; // Por ahora en 0, después agregar lógica
    
    const calculo = calcularBoleta(
      lecturaActual.lectura_anterior,
      lecturaActual.lectura_actual,
      saldoPendiente,
      subsidio,
      0, // multa
      false // IVA
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
      subsidio,
      estado: usuario.estado === 'moroso' ? 'PENDIENTE' : 'AL DÍA'
    };
    
    // Generar código QR
    const qrData = `https://miempresa.cl/pagar?boleta=${boletaData.numero}&monto=${boletaData.calculo.total}`;
    const qrImage = await QRCode.toDataURL(qrData);
    
    // Generar PDF
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=boleta_${usuario.numero_cliente}.pdf`);
    
    doc.pipe(res);
    
    // HEADER CON LOGO (compacto)
    const logoPath = path.join(__dirname, '../assets/LogoApr.png');
    
    try {
      doc.image(logoPath, 40, 30, { width: 60 });
    } catch (error) {
      console.log('Logo no encontrado');
    }
    
    doc.fontSize(14).font('Helvetica-Bold').text(APR_CONFIG.nombre, 110, 35, { width: 450 });
    doc.fontSize(9).font('Helvetica').text(`${APR_CONFIG.subtitulo} • RUT: ${APR_CONFIG.rut}`, 110, 52, { width: 450 });
    doc.fontSize(8).text(`${APR_CONFIG.direccion} • Tel: ${APR_CONFIG.telefono}`, 110, 65, { width: 450 });
    
    doc.moveDown(2);
    
    // Línea separadora
    doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke();
    doc.moveDown(0.5);
    
    // Información del cliente e info de boleta en 2 columnas
    const infoY = doc.y;
    
    // Columna izquierda - Cliente
    doc.fontSize(10).font('Helvetica-Bold').text('Cliente: ', 40, infoY, { continued: true })
       .font('Helvetica').text(boletaData.cliente);
    doc.font('Helvetica-Bold').text('RUT: ', 40, doc.y, { continued: true })
       .font('Helvetica').text(boletaData.rut);
    doc.font('Helvetica-Bold').text('N° Cliente: ', 40, doc.y, { continued: true })
       .font('Helvetica').text(boletaData.medidor);
    
    // Columna derecha - Boleta info
    doc.font('Helvetica-Bold').text('Boleta #: ', 320, infoY, { continued: true })
       .font('Helvetica').text(boletaData.numero);
    doc.font('Helvetica-Bold').text('Emisión: ', 320, infoY + 12, { continued: true })
       .font('Helvetica').text(boletaData.emision);
    doc.font('Helvetica-Bold').text('Vencimiento: ', 320, infoY + 24, { continued: true })
       .font('Helvetica').text(boletaData.vencimiento);
    
    doc.moveDown(2);
    
    doc.fontSize(8).fillColor('red')
       .text('A partir de esta fecha se originarán intereses y se cobrará un cargo adicional por pago fuera de plazo.', 40, doc.y, { width: 530 })
       .fillColor('black');
    doc.moveDown(0.5);
    
    // Consumo del periodo (compacto)
    doc.fontSize(10).font('Helvetica-Bold').text('Consumo del periodo');
    doc.fontSize(9).font('Helvetica')
       .text(`Lectura Anterior: ${boletaData.lecturaAnterior} m³  •  Lectura Actual: ${boletaData.lecturaActual} m³  •  Consumo Total: ${boletaData.calculo.consumo} m³`);
    if (boletaData.subsidio > 0) {
      doc.text(`Subsidio aplicado: $${boletaData.subsidio.toLocaleString('es-CL')}`);
    }
    doc.moveDown(0.5);
    
    // GRÁFICO DE CONSUMO (más pequeño)
    if (lecturas.length > 1) {
      doc.fontSize(9).font('Helvetica-Bold').text('Historial de Consumo (últimos 3 meses)');
      doc.moveDown(0.3);
      
      const chartX = 40;
      const chartY = doc.y;
      const chartWidth = 250;
      const chartHeight = 60;
      const maxConsumo = Math.max(...lecturas.map(l => l.consumo_m3)) * 1.2;
      
      // Ejes
      doc.strokeColor('#666666').lineWidth(0.5);
      doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();
      doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke();
      
      // Barras
      const barWidth = chartWidth / lecturas.length / 2.5;
      const gap = chartWidth / lecturas.length;
      
      lecturas.forEach((lectura, index) => {
        const barHeight = (lectura.consumo_m3 / maxConsumo) * chartHeight;
        const x = chartX + (index * gap) + gap / 4;
        const y = chartY + chartHeight - barHeight;
        
        doc.rect(x, y, barWidth, barHeight).fillAndStroke('#0ea5e9', '#0369a1');
        
        doc.fontSize(7).fillColor('black').text(
          `${lectura.consumo_m3}m³`,
          x - 5,
          y - 12,
          { width: barWidth + 10, align: 'center' }
        );
        
        const mes = new Date(lectura.anio, lectura.mes - 1).toLocaleString('es-CL', { month: 'short' });
        doc.fontSize(7).text(
          mes,
          x - 5,
          chartY + chartHeight + 3,
          { width: barWidth + 10, align: 'center' }
        );
      });
      
      doc.moveDown(3);
    }
    
    // TABLA DE CONCEPTOS CON BORDES
    const tableTop = doc.y;
    const tableLeft = 40;
    const tableWidth = 270;
    const colLabel = tableLeft + 5;
    const colMonto = tableLeft + tableWidth - 80;
    const rowHeight = 18;
    
    // Header de tabla
    doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fillAndStroke('#e5e7eb', '#9ca3af');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
    doc.text('Concepto', colLabel, tableTop + 5);
    doc.text('Monto ($)', colMonto, tableTop + 5);
    
    const conceptos = [
      { label: 'Cargo Fijo', valor: boletaData.calculo.cargoFijo },
      { label: 'Consumo (0-15m³)', valor: boletaData.calculo.montoBase },
      { label: 'Excedente (16-30m³)', valor: boletaData.calculo.excedente16_30 },
      { label: 'Excedente (>30m³)', valor: boletaData.calculo.excedente30plus },
      { label: 'Multa', valor: boletaData.calculo.multa },
      { label: 'Saldo Pendiente', valor: boletaData.calculo.saldoPendiente },
      { label: 'Subsidio', valor: -boletaData.subsidio },
      { label: 'IVA (19%)', valor: boletaData.calculo.iva }
    ];
    
    let currentY = tableTop + rowHeight;
    
    doc.font('Helvetica').fontSize(9);
    conceptos.forEach((item, index) => {
      // Fondo alternado
      if (index % 2 === 0) {
        doc.rect(tableLeft, currentY, tableWidth, rowHeight).fill('#f9fafb');
      }
      
      // Bordes de celda
      doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke('#d1d5db');
      
      // Texto
      doc.fillColor('black');
      doc.text(item.label, colLabel, currentY + 5, { width: tableWidth - 90 });
      const montoText = item.valor < 0 ? 
        `-$${Math.abs(item.valor).toLocaleString('es-CL')}` : 
        `$${item.valor.toLocaleString('es-CL')}`;
      doc.text(montoText, colMonto, currentY + 5, { width: 75, align: 'right' });
      
      currentY += rowHeight;
    });
    
    // Fila de TOTAL (más destacada)
    doc.rect(tableLeft, currentY, tableWidth, rowHeight + 5).fillAndStroke('#1e40af', '#1e3a8a');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
    doc.text('TOTAL A PAGAR', colLabel, currentY + 7);
    doc.text(`$${boletaData.calculo.total.toLocaleString('es-CL')}`, colMonto, currentY + 7, { width: 75, align: 'right' });
    
    // Estado
    doc.fillColor('black');
    doc.fontSize(10).text(`Estado: ${boletaData.estado}`, tableLeft, currentY + rowHeight + 15);
    
    // QR CODE AL FINAL (esquina inferior derecha)
    doc.image(qrImage, 450, tableTop + 50, { width: 100 });
    doc.fontSize(8).fillColor('black').text('Escanea para', 450, tableTop + 155, { width: 100, align: 'center' });
    doc.text('pagar en línea', 450, tableTop + 165, { width: 100, align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando boleta:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = boletaController;