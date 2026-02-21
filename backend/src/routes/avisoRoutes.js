const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const PDFDocument = require('pdfkit');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');
const os = require('os');

// Obtener plantillas de avisos
router.get('/plantillas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM plantillas_avisos WHERE activa = true ORDER BY nombre'
    );
    res.json({ success: true, plantillas: result.rows });
  } catch (error) {
    console.error('Error obteniendo plantillas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar plantilla
router.put('/plantillas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido, asunto } = req.body;
    
    const result = await pool.query(
      `UPDATE plantillas_avisos 
       SET contenido = $1, asunto = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [contenido, asunto, id]
    );
    
    res.json({ success: true, plantilla: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando plantilla:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener usuarios morosos para avisos
router.get('/morosos-para-avisos', async (req, res) => {
  try {
    const { dias_minimos = 60 } = req.query;
    
    const result = await pool.query(
      `SELECT 
        u.id,
        u.nombre,
        u.rut,
        u.direccion,
        u.telefono,
        u.email,
        COUNT(DISTINCT b.id) as boletas_pendientes,
        SUM(b.saldo_pendiente) as deuda_total,
        MIN(b.fecha_vencimiento) as fecha_vencimiento_mas_antigua,
        CURRENT_DATE - MIN(b.fecha_vencimiento) as dias_morosidad
       FROM usuarios u
       INNER JOIN boletas b ON u.id = b.usuario_id
       WHERE b.estado IN ('pendiente', 'parcial')
         AND b.saldo_pendiente > 0
         AND b.fecha_vencimiento < CURRENT_DATE
       GROUP BY u.id, u.nombre, u.rut, u.direccion, u.telefono, u.email
       HAVING CURRENT_DATE - MIN(b.fecha_vencimiento) >= $1
       ORDER BY dias_morosidad DESC`,
      [dias_minimos]
    );
    
    res.json({ success: true, morosos: result.rows });
  } catch (error) {
    console.error('Error obteniendo morosos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generar PDF de aviso individual
router.get('/generar-pdf/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const { plantilla_id = 1 } = req.query;
    
    // Obtener datos del usuario
    const usuarioResult = await pool.query(
      `SELECT 
        u.*,
        COUNT(DISTINCT b.id) as boletas_pendientes,
        SUM(b.saldo_pendiente) as deuda_total,
        MIN(b.fecha_vencimiento) as fecha_vencimiento_mas_antigua,
        CURRENT_DATE - MIN(b.fecha_vencimiento) as dias_morosidad
       FROM usuarios u
       INNER JOIN boletas b ON u.id = b.usuario_id
       WHERE u.id = $1
         AND b.estado IN ('pendiente', 'parcial')
         AND b.saldo_pendiente > 0
       GROUP BY u.id`,
      [usuario_id]
    );
    
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado o sin morosidad' });
    }
    
    const usuario = usuarioResult.rows[0];
    
    // Obtener plantilla
    const plantillaResult = await pool.query(
      'SELECT * FROM plantillas_avisos WHERE id = $1',
      [plantilla_id]
    );
    
    if (plantillaResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
    }
    
    const plantilla = plantillaResult.rows[0];
    
    // Calcular fechas
    const fechaHoy = new Date();
    const fechaCorte = new Date(fechaHoy);
    fechaCorte.setDate(fechaHoy.getDate() + 7); // Corte en 7 días
    
    // Reemplazar variables en el contenido
    let contenido = plantilla.contenido;
    contenido = contenido.replace('{nombre_cliente}', usuario.nombre);
    contenido = contenido.replace('{rut_cliente}', usuario.rut);
    contenido = contenido.replace('{dias_morosidad}', usuario.dias_morosidad);
    contenido = contenido.replace('{fecha_corte}', fechaCorte.toLocaleDateString('es-CL'));
    contenido = contenido.replace('{fecha_notificacion}', fechaHoy.toLocaleDateString('es-CL'));
    contenido = contenido.replace('{deuda_total}', `$${parseFloat(usuario.deuda_total).toLocaleString('es-CL')}`);
    
    // Generar PDF
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=aviso_corte_${usuario.rut}.pdf`);
    
    doc.pipe(res);
    
    // Logo (si existe)
    const logoPath = path.join(__dirname, '../assets/LogoApr.png');
    try {
      doc.image(logoPath, 50, 40, { width: 80 });
    } catch (error) {
      console.log('Logo no encontrado');
    }
    
    // Título centrado
    doc.fontSize(16).font('Helvetica-Bold')
       .text(plantilla.asunto, 150, 50, { align: 'center', width: 350 });
    
    // Fecha (derecha)
    doc.fontSize(10).font('Helvetica')
       .text(`Fecha: ${fechaHoy.toLocaleDateString('es-CL')}`, 450, 50, { width: 100 });
    
    doc.moveDown(4);
    
    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown();
    
    // Contenido del aviso
    doc.fontSize(11).font('Helvetica')
       .text(contenido, 50, doc.y, { width: 512, align: 'justify', lineGap: 5 });
    
    // Registrar aviso generado
    await pool.query(
      `INSERT INTO avisos_generados (usuario_id, plantilla_id, fecha_corte, dias_morosidad)
       VALUES ($1, $2, $3, $4)`,
      [usuario_id, plantilla_id, fechaCorte, usuario.dias_morosidad]
    );
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener historial de avisos generados
router.get('/historial', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ag.*,
        u.nombre as usuario_nombre,
        u.rut as usuario_rut,
        p.nombre as plantilla_nombre
       FROM avisos_generados ag
       JOIN usuarios u ON ag.usuario_id = u.id
       JOIN plantillas_avisos p ON ag.plantilla_id = p.id
       ORDER BY ag.fecha_generacion DESC
       LIMIT 100`
    );
    
    res.json({ success: true, historial: result.rows });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generar-masivo', async (req, res) => {
  try {
    const { usuario_ids, plantilla_id = 1 } = req.body;
    
    if (!usuario_ids || usuario_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No se proporcionaron usuarios' });
    }
    
    // Crear carpeta temporal
    const tempDir = path.join(os.tmpdir(), `avisos_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Obtener plantilla
    const plantillaResult = await pool.query(
      'SELECT * FROM plantillas_avisos WHERE id = $1',
      [plantilla_id]
    );
    
    if (plantillaResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
    }
    
    const plantilla = plantillaResult.rows[0];
    
    // Generar cada PDF
    for (const usuario_id of usuario_ids) {
      // Obtener datos del usuario
      const usuarioResult = await pool.query(
        `SELECT 
          u.*,
          COUNT(DISTINCT b.id) as boletas_pendientes,
          SUM(b.saldo_pendiente) as deuda_total,
          MIN(b.fecha_vencimiento) as fecha_vencimiento_mas_antigua,
          CURRENT_DATE - MIN(b.fecha_vencimiento) as dias_morosidad
         FROM usuarios u
         INNER JOIN boletas b ON u.id = b.usuario_id
         WHERE u.id = $1
           AND b.estado IN ('pendiente', 'parcial')
           AND b.saldo_pendiente > 0
         GROUP BY u.id`,
        [usuario_id]
      );
      
      if (usuarioResult.rows.length === 0) continue;
      
      const usuario = usuarioResult.rows[0];
      
      // Calcular fechas
      const fechaHoy = new Date();
      const fechaCorte = new Date(fechaHoy);
      fechaCorte.setDate(fechaHoy.getDate() + 7);
      
      // Reemplazar variables
      let contenido = plantilla.contenido;
      contenido = contenido.replace('{nombre_cliente}', usuario.nombre);
      contenido = contenido.replace('{rut_cliente}', usuario.rut);
      contenido = contenido.replace('{dias_morosidad}', usuario.dias_morosidad);
      contenido = contenido.replace('{fecha_corte}', fechaCorte.toLocaleDateString('es-CL'));
      contenido = contenido.replace('{fecha_notificacion}', fechaHoy.toLocaleDateString('es-CL'));
      contenido = contenido.replace('{deuda_total}', `$${parseFloat(usuario.deuda_total).toLocaleString('es-CL')}`);
      
      // Crear PDF
      const pdfPath = path.join(tempDir, `aviso_${usuario.rut.replace('-', '')}.pdf`);
      const pdfStream = fs.createWriteStream(pdfPath);
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      
      doc.pipe(pdfStream);
      
      // Logo
      const logoPath = path.join(__dirname, '../assets/LogoApr.png');
      try {
        doc.image(logoPath, 50, 40, { width: 80 });
      } catch (error) {
        console.log('Logo no encontrado');
      }
      
      // Título
      doc.fontSize(16).font('Helvetica-Bold')
         .text(plantilla.asunto, 150, 50, { align: 'center', width: 350 });
      
      // Fecha
      doc.fontSize(10).font('Helvetica')
         .text(`Fecha: ${fechaHoy.toLocaleDateString('es-CL')}`, 450, 50, { width: 100 });
      
      doc.moveDown(4);
      
      // Línea
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown();
      
      // Contenido
      doc.fontSize(11).font('Helvetica')
         .text(contenido, 50, doc.y, { width: 512, align: 'justify', lineGap: 5 });
      
      doc.end();
      
      // Esperar a que termine de escribirse
      await new Promise((resolve) => pdfStream.on('finish', resolve));
      
      // Registrar aviso
      await pool.query(
        `INSERT INTO avisos_generados (usuario_id, plantilla_id, fecha_corte, dias_morosidad)
         VALUES ($1, $2, $3, $4)`,
        [usuario_id, plantilla_id, fechaCorte, usuario.dias_morosidad]
      );
    }
    
    // Crear ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=avisos_masivos_${new Date().toISOString().split('T')[0]}.zip`);
    
    archive.pipe(res);
    archive.directory(tempDir, false);
    
    await archive.finalize();
    
    // Limpiar archivos temporales
    setTimeout(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }, 5000);
    
  } catch (error) {
    console.error('Error generando avisos masivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;