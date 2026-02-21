const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

// Configurar multer para subir archivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Procesar Excel de lecturas simples
router.post('/procesar-lecturas', upload.single('archivo'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { mes, anio } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
    }
    
    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Debe especificar mes y año' });
    }
    
    // Leer archivo Excel
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, error: 'El archivo está vacío' });
    }
    
    const resultados = {
      exitosos: [],
      errores: [],
      total: data.length
    };
    
    await client.query('BEGIN');
    
    for (let i = 0; i < data.length; i++) {
      const fila = data[i];
      const numeroFila = i + 2; // Excel empieza en fila 2 (después del header)
      
      try {
        // Validar campos requeridos
        if (!fila.RUT && !fila['Nro Medidor']) {
          throw new Error('Debe proporcionar RUT o Nro Medidor');
        }
        
        if (!fila['Lectura Actual'] && fila['Lectura Actual'] !== 0) {
          throw new Error('Lectura Actual es requerida');
        }
        
        // Buscar usuario por RUT o Número de Medidor
        let usuario = null;
        
        if (fila.RUT) {
          const rutResult = await client.query(
            'SELECT * FROM usuarios WHERE rut = $1 AND rol = $2',
            [fila.RUT.toString().trim(), 'usuario']
          );
          usuario = rutResult.rows[0];
        }
        
        // Si no encontró por RUT, buscar por número de medidor
        if (!usuario && fila['Nro Medidor']) {
          const medidorResult = await client.query(
            'SELECT * FROM usuarios WHERE numero_medidor = $1 AND rol = $2',
            [fila['Nro Medidor'].toString().trim(), 'usuario']
          );
          usuario = medidorResult.rows[0];
        }
        
        if (!usuario) {
          throw new Error(`Usuario no encontrado (RUT: ${fila.RUT || 'N/A'}, Medidor: ${fila['Nro Medidor'] || 'N/A'})`);
        }
        
        // Actualizar número de medidor si cambió
        if (fila['Nro Medidor'] && fila['Nro Medidor'] !== usuario.numero_medidor) {
          await client.query(
            'UPDATE usuarios SET numero_medidor = $1, updated_at = NOW() WHERE id = $2',
            [fila['Nro Medidor'].toString().trim(), usuario.id]
          );
        }
        
        // Obtener última lectura del usuario
        const ultimaLecturaResult = await client.query(
          `SELECT lectura_actual 
           FROM lecturas 
           WHERE usuario_id = $1 
           ORDER BY fecha_lectura DESC 
           LIMIT 1`,
          [usuario.id]
        );
        
        const lecturaAnterior = ultimaLecturaResult.rows.length > 0 
          ? parseFloat(ultimaLecturaResult.rows[0].lectura_actual) 
          : 0;
        
        const lecturaActual = parseFloat(fila['Lectura Actual']);
        const consumo = lecturaActual - lecturaAnterior;
        
        if (consumo < 0) {
          throw new Error(`Consumo negativo detectado (Anterior: ${lecturaAnterior}, Actual: ${lecturaActual})`);
        }
        
        // Verificar si ya existe lectura para este mes
        const lecturaExistenteResult = await client.query(
          `SELECT id FROM lecturas 
           WHERE usuario_id = $1 
             AND EXTRACT(MONTH FROM fecha_lectura) = $2
             AND EXTRACT(YEAR FROM fecha_lectura) = $3`,
          [usuario.id, mes, anio]
        );
        
        if (lecturaExistenteResult.rows.length > 0) {
          throw new Error(`Ya existe lectura para ${mes}/${anio}`);
        }
        
        // Crear fecha de lectura (primer día del mes)
        const fechaLectura = new Date(anio, mes - 1, 1);
        
        // Crear lectura
        const lecturaResult = await client.query(
          `INSERT INTO lecturas 
           (usuario_id, lectura_anterior, lectura_actual, consumo_m3, fecha_lectura, mes, anio, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            usuario.id,
            lecturaAnterior,
            lecturaActual,
            consumo,
            fechaLectura,
            mes,
            anio,
            `Carga masiva - ${fila.Nombre || usuario.nombre}`
          ]
        );
        
        // Calcular monto de la boleta (consumo * tarifa, ejemplo $1000 por m³)
        const tarifa = 1000; // Ajustar según tu tarifa real
        const montoConsumo = consumo * tarifa;
        const cargoFijo = 5000; // Ajustar según tu cargo fijo
        const totalMes = montoConsumo + cargoFijo;
        
        // Crear boleta
        const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
        const fechaVencimiento = new Date(anio, mes - 1, 15); // Vence el 15 del mes
        
        await client.query(
          `INSERT INTO boletas 
           (usuario_id, periodo, consumo_m3, cargo_fijo, total_mes, total_a_pagar, saldo_pendiente, estado, fecha_vencimiento)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            usuario.id,
            periodo,
            consumo,
            cargoFijo,
            totalMes,
            totalMes,
            totalMes,
            'pendiente',
            fechaVencimiento
          ]
        );
        
        resultados.exitosos.push({
          fila: numeroFila,
          nombre: fila.Nombre || usuario.nombre,
          rut: usuario.rut,
          medidor: fila['Nro Medidor'] || usuario.numero_medidor,
          lectura_anterior: lecturaAnterior,
          lectura_actual: lecturaActual,
          consumo: consumo,
          monto: totalMes
        });
        
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          nombre: fila.Nombre || 'N/A',
          rut: fila.RUT || 'N/A',
          medidor: fila['Nro Medidor'] || 'N/A',
          error: error.message
        });
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      mensaje: `Procesamiento completado: ${resultados.exitosos.length} exitosos, ${resultados.errores.length} errores`,
      resultados: resultados
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error procesando carga masiva:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Descargar template Excel
router.get('/descargar-template', (req, res) => {
  try {
    // Crear workbook
    const wb = xlsx.utils.book_new();
    
    // Datos de ejemplo
    const datos = [
      {
        'Nombre': 'Juan Pérez',
        'RUT': '12345678-9',
        'Nro Medidor': 'MED-001',
        'Lectura Actual': 1250
      },
      {
        'Nombre': 'María López',
        'RUT': '98765432-1',
        'Nro Medidor': 'MED-002',
        'Lectura Actual': 890
      }
    ];
    
    // Crear hoja
    const ws = xlsx.utils.json_to_sheet(datos);
    
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 20 }, // Nombre
      { wch: 15 }, // RUT
      { wch: 15 }, // Nro Medidor
      { wch: 15 }  // Lectura Actual
    ];
    
    // Agregar hoja al workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Lecturas');
    
    // Generar buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template_lecturas.xlsx');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generando template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Descargar Excel con usuarios reales para llenar lecturas
router.get('/descargar-usuarios', async (req, res) => {
  try {
    const { mes, anio } = req.query;
    
    // Obtener todos los usuarios activos
    const result = await pool.query(
      `SELECT 
        u.nombre,
        u.rut,
        u.numero_medidor,
        u.numero_cliente,
        l.lectura_actual as ultima_lectura
       FROM usuarios u
       LEFT JOIN LATERAL (
         SELECT lectura_actual 
         FROM lecturas 
         WHERE usuario_id = u.id 
         ORDER BY fecha_lectura DESC 
         LIMIT 1
       ) l ON true
       WHERE u.rol = 'usuario' 
         AND u.estado = 'activo'
       ORDER BY u.nombre`
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No hay usuarios activos en el sistema' 
      });
    }
    
    // Preparar datos para Excel
    const datos = result.rows.map(u => ({
      'Nombre': u.nombre,
      'RUT': u.rut,
      'Nro Medidor': u.numero_medidor || `MED-${u.numero_cliente}`,
      'Lectura Actual': '' // Vacío para que lo llenen
    }));
    
    // Crear workbook
    const wb = xlsx.utils.book_new();
    
    // Crear hoja
    const ws = xlsx.utils.json_to_sheet(datos);
    
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 25 }, // Nombre
      { wch: 15 }, // RUT
      { wch: 15 }, // Nro Medidor
      { wch: 15 }  // Lectura Actual
    ];
    
    // Agregar hoja al workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Lecturas');
    
    // Generar buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Nombre del archivo
    const nombreArchivo = mes && anio 
      ? `lecturas_${mes}_${anio}.xlsx`
      : `lecturas_usuarios_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${nombreArchivo}`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generando Excel de usuarios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;