const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const fs = require('fs');

// Configurar multer
const upload = multer({ dest: 'uploads/' });

// Función para generar contraseña
function generarPassword(rut) {
  const digitos = rut.replace(/[^0-9]/g, '').substring(0, 4);
  return `apr${digitos}`;
}

// NUEVO: Endpoint para obtener las hojas del Excel
router.post('/get-sheets', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheets = workbook.SheetNames;

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({ success: true, sheets: sheets });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Función para calcular total por tramos
async function calcularTotalPorTramos(consumoM3) {
  const result = await pool.query(
    'SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC'
  );

  const tarifas = result.rows;
  let total = 0;
  let m3Restantes = consumoM3;

  for (const tarifa of tarifas) {
    if (m3Restantes <= 0) break;

    const desde = tarifa.tramo_desde;
    const hasta = tarifa.tramo_hasta || Infinity;
    const rangoTramo = hasta - desde + 1;

    const m3EnTramo = Math.min(m3Restantes, rangoTramo);
    total += m3EnTramo * parseFloat(tarifa.precio_por_m3);
    m3Restantes -= m3EnTramo;
  }

  return total;
}

// Función para obtener o crear usuario
async function obtenerOCrearUsuario(row, client) {
  const rut = row.RUT;

  const resultUsuario = await client.query(
    'SELECT id FROM usuarios WHERE rut = $1',
    [rut]
  );

  if (resultUsuario.rows.length > 0) {
    return { id: resultUsuario.rows[0].id, esNuevo: false };
  }

  const password = generarPassword(rut);
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generar número de cliente automáticamente
  // Buscamos el máximo actual y sumamos 1
  const resultMax = await client.query(`
    SELECT COALESCE(MAX(CAST(numero_cliente AS INTEGER)), 0) + 1 as siguiente 
    FROM usuarios 
    WHERE numero_cliente ~ '^[0-9]+$'
  `);
  
  let siguienteNumero = parseInt(resultMax.rows[0]?.siguiente || 1);
  // Formato: 001, 002... 999, 1000...
  const numeroCliente = siguienteNumero < 1000 
    ? siguienteNumero.toString().padStart(3, '0') 
    : siguienteNumero.toString();

  const resultNuevo = await client.query(
    `INSERT INTO usuarios (nombre, rut, direccion, email, password, rol, numero_cliente) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      row.NOMBRE,
      rut,
      row.DOMICILIO,
      `${rut}@temp.com`,
      hashedPassword,
      'socio', // Usamos 'socio' para consistencia con el resto del sistema
      numeroCliente
    ]
  );

  return { id: resultNuevo.rows[0].id, esNuevo: true };
}

// Endpoint principal - ACTUALIZADO para recibir nombre de hoja
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  const client = await pool.connect();

  try {
    const sheetName = req.body.sheetName || null; // Nombre de la hoja a procesar

    // Leer archivo Excel
    const workbook = XLSX.readFile(req.file.path);

    // Si no se especificó hoja, usar la primera
    const targetSheet = sheetName || workbook.SheetNames[0];

    // Verificar que la hoja existe
    if (!workbook.Sheets[targetSheet]) {
      throw new Error(`La hoja "${targetSheet}" no existe en el archivo`);
    }

    const sheet = workbook.Sheets[targetSheet];

    // Leer Excel como arrays (sin encabezados automáticos)
    const sheetData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,  // Leer como arrays
      defval: null,
      raw: false
    });

    console.log('📊 Total de filas en bruto:', sheetData.length);
    console.log('📝 Primeras 3 filas:', sheetData.slice(0, 3));

    // Buscar la fila de encabezados (la que tiene "NOMBRE", "RUT", etc.)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, sheetData.length); i++) {
      const row = sheetData[i];
      if (row && row.includes('NOMBRE') && row.includes('RUT')) {
        headerRowIndex = i;
        console.log(`✅ Encabezados encontrados en fila ${i}:`, row);
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('No se encontraron los encabezados (NOMBRE, RUT) en el archivo');
    }

    // Obtener los encabezados
    const headers = sheetData[headerRowIndex];
    console.log('� Encabezados:', headers);

    // Encontrar índices de las columnas importantes
    const nombreIdx = headers.indexOf('NOMBRE');
    const rutIdx = headers.indexOf('RUT');
    const domicilioIdx = headers.indexOf('DOMICILIO');
    const lAnteriorIdx = headers.indexOf('L.ANTERIOR');
    const lActualIdx = headers.indexOf('L.ACTUAL');
    const m3Idx = headers.indexOf('M3');
    const abonoIdx = headers.indexOf('ABONO');
    const mPagoIdx = headers.indexOf('M. PAGO');
    const totalIdx = headers.indexOf('TOTAL');
    const sPendienteIdx = headers.findIndex(h => h && h.includes('PENDIENTE'));

    console.log('� Índices de columnas:', {
      nombre: nombreIdx,
      rut: rutIdx,
      domicilio: domicilioIdx,
      lAnterior: lAnteriorIdx,
      lActual: lActualIdx,
      m3: m3Idx,
      abono: abonoIdx,
      total:  totalIdx
    });

    // Procesar filas de datos (después de los encabezados)
    const dataFiltrada = [];
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i];

      // Verificar que tenga datos válidos
      if (!row || !row[nombreIdx] || !row[rutIdx]) continue;

      // Saltar filas que parecen ser subtotales o encabezados repetidos
      if (row[rutIdx] === 'RUT' || row[nombreIdx] === 'NOMBRE') continue;

      dataFiltrada.push({
        NOMBRE: row[nombreIdx],
        RUT: row[rutIdx],
        DOMICILIO: row[domicilioIdx] || '',
        'L.ANTERIOR': parseInt(row[lAnteriorIdx]) || 0,
        'L.ACTUAL': parseInt(row[lActualIdx]) || 0,
        'M3': parseInt(row[m3Idx]) || 0,
        'ABONO': parseFloat(String(row[abonoIdx] || '0').replace(/[$,]/g, '')) || 0,
        'M. PAGO': row[mPagoIdx] || '',
        'TOTAL': parseFloat(String(row[totalIdx] || '0').replace(/[$,]/g, '')) || 0,
        'S.PENDIENTE': parseFloat(String(row[sPendienteIdx] || '0').replace(/[$,]/g, '')) || 0
      });
    }

    console.log('✅ Filas válidas después del mapeo:', dataFiltrada.length);
    if (dataFiltrada.length > 0) {
      console.log('📝 Primeras 3 filas mapeadas:', dataFiltrada.slice(0, 3));
    }

    const periodo = targetSheet || new Date().toISOString().substring(0, 7);

    // Parsear mes y año del periodo
    let mes, anio;
    const meses = {
      'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
      'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };

    // Intentar formato "MES AÑO" (ej: "ENERO 2026")
    const partesPeriodo = periodo.trim().toUpperCase().split(' ');
    if (partesPeriodo.length >= 2 && meses[partesPeriodo[0]]) {
      mes = meses[partesPeriodo[0]];
      anio = parseInt(partesPeriodo[partesPeriodo.length - 1]);
    } else {
      // Intentar formato YYYY-MM
      const fecha = new Date(periodo);
      if (!isNaN(fecha.getTime())) {
        mes = fecha.getMonth() + 1;
        anio = fecha.getFullYear();
      } else {
        // Fallback al mes actual si no se puede parsear
        const hoy = new Date();
        mes = hoy.getMonth() + 1;
        anio = hoy.getFullYear();
      }
    }
    
    // Formatear periodo para la BD (YYYY-MM) para cumplir con varchar(7)
    const periodoBD = `${anio}-${String(mes).padStart(2, '0')}`;

    const resultados = {
      exitosos: 0,
      errores: [],
      nuevosUsuarios: [],
      detalles: []
    };

    await client.query('BEGIN');

    for (let i = 0; i < dataFiltrada.length; i++) {
      const row = dataFiltrada[i];

      try {
        // 1. Obtener o crear usuario
        const usuario = await obtenerOCrearUsuario(row, client);
        const usuarioId = usuario.id;

        if (usuario.esNuevo) {
          resultados.nuevosUsuarios.push(row.NOMBRE);
        }

        // 2. Insertar lectura
        const lecturaAnterior = parseInt(row['L.ANTERIOR']) || 0;
        const lecturaActual = parseInt(row['L.ACTUAL']) || 0;
        const consumoM3 = Math.max(0, lecturaActual - lecturaAnterior);

        console.log(`📝 Fila ${i + 1}: ${row.NOMBRE}, consumo: ${consumoM3}`);

        // 3. Calcular total del mes (Mover antes de insertar lectura para guardar monto_calculado)
        const totalMes = await calcularTotalPorTramos(consumoM3);

        const resultLectura = await client.query(
          `INSERT INTO lecturas (usuario_id, lectura_anterior, lectura_actual, monto_calculado, mes, anio, fecha_lectura)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [usuarioId, lecturaAnterior, lecturaActual, totalMes, mes, anio]
        );

        const lecturaId = resultLectura.rows[0].id;

        // 4. Obtener saldo anterior
        const resultSaldoAnterior = await client.query(
          `SELECT saldo_pendiente FROM boletas 
           WHERE usuario_id = $1 
           ORDER BY created_at DESC LIMIT 1`,
          [usuarioId]
        );

        const saldoAnterior = resultSaldoAnterior.rows.length > 0
          ? parseFloat(resultSaldoAnterior.rows[0].saldo_pendiente)
          : 0;

        // 5. Calcular totales
        const totalAPagar = totalMes + saldoAnterior;
        const abono = parseFloat(row['ABONO']) || 0;
        const saldoPendiente = totalAPagar - abono;

        // 6. Determinar estado
        let estado = 'pendiente';
        if (abono >= totalAPagar) {
          estado = 'pagado';
        } else if (abono > 0) {
          estado = 'parcial';
        }

        // 7. Insertar boleta
        const resultBoleta = await client.query(
          `INSERT INTO boletas 
           (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, total_a_pagar, saldo_pendiente, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [usuarioId, lecturaId, periodoBD, consumoM3, totalMes, saldoAnterior, totalAPagar, saldoPendiente, estado]
        );

        const boletaId = resultBoleta.rows[0].id;

        // 8. Registrar pago si hay abono
        if (abono > 0) {
          await client.query(
            `INSERT INTO pagos (usuario_id, monto, metodo_pago, boleta_id, fecha_pago)
             VALUES ($1, $2, $3, $4, NOW())`,
            [usuarioId, abono, row['M. PAGO'] || 'efectivo', boletaId]
          );
        }

        resultados.exitosos++;
        resultados.detalles.push({
          fila: i + 1,
          nombre: row.NOMBRE,
          rut: row.RUT,
          consumo: consumoM3,
          total: totalAPagar,
          estado: estado
        });

      } catch (error) {
        resultados.errores.push({
          fila: i + 1,
          nombre: row.NOMBRE,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      mensaje: `Carga completada: ${resultados.exitosos} registros exitosos`,
      resultados: resultados
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en carga masiva:', error);

    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;