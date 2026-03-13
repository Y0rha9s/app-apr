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

    res.json({ success: true, sheets: sheets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // esto se ejecuta SIEMPRE, incluso si hay throw
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

function normalizarPeriodo(nombreHoja) {
  if (!nombreHoja) {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  }

  // Si ya viene en formato YYYY-MM, devolverlo
  if (/^\d{4}-\d{2}$/.test(nombreHoja)) {
    return nombreHoja;
  }

  // Mapeo de nombres de meses en español
  const meses = {
    'ENERO': '01',
    'FEBRERO': '02',
    'MARZO': '03',
    'ABRIL': '04',
    'MAYO': '05',
    'JUNIO': '06',
    'JULIO': '07',
    'AGOSTO': '08',
    'SEPTIEMBRE': '09',
    'OCTUBRE': '10',
    'NOVIEMBRE': '11',
    'DICIEMBRE': '12'
  };

  // Extraer mes y año del nombre de la hoja
  const partes = nombreHoja.toUpperCase().trim().split(/\s+/);
  const nombreMes = partes[0];
  const año = partes[1] || new Date().getFullYear().toString();

  const numeroMes = meses[nombreMes];

  if (!numeroMes) {
    console.log(`⚠️ No se pudo parsear el periodo: "${nombreHoja}", usando actual`);
    return new Date().toISOString().substring(0, 7);
  }

  return `${año}-${numeroMes}`;
}

// Función para calcular total por tramos (ahora recibe las tarifas ya cargadas)
async function calcularTotalPorTramos(consumoM3, tipoUsuario = 'normal') {
  const result = await pool.query(
    'SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC'
  );

  const tarifas = result.rows;
  let total = 0;
  let m3Restantes = consumoM3;
  let m3ProcesadosTotal = 0;

  // Configuración de subsidio (primeros 15 m³ al 50% para usuarios subsidiados)
  const LIMITE_SUBSIDIO = 15;
  const DESCUENTO_SUBSIDIO = 0.5; // 50%

  for (const tarifa of tarifas) {
    if (m3Restantes <= 0) break;

    const desde = tarifa.tramo_desde;
    const hasta = tarifa.tramo_hasta || Infinity;
    const rangoTramo = hasta - desde + 1;

    // Cuántos m³ entran en este tramo
    const m3EnTramo = Math.min(m3Restantes, rangoTramo);

    // Aplicar descuento para usuarios subsidiados en primeros 15 m³
    let precioFinal = parseFloat(tarifa.precio_por_m3);

    if (tipoUsuario === 'subsidiado') {
      // Verificar cuántos m³ de este tramo están dentro del límite de subsidio
      const m3SubsidiablesEnTramo = Math.max(0, Math.min(
        LIMITE_SUBSIDIO - m3ProcesadosTotal,
        m3EnTramo
      ));

      if (m3SubsidiablesEnTramo > 0) {
        // Calcular parte con descuento
        const montoConDescuento = m3SubsidiablesEnTramo * precioFinal * DESCUENTO_SUBSIDIO;

        // Calcular parte sin descuento
        const m3SinDescuento = m3EnTramo - m3SubsidiablesEnTramo;
        const montoSinDescuento = m3SinDescuento * precioFinal;

        total += montoConDescuento + montoSinDescuento;

        console.log(`  💰 Tramo ${desde}-${hasta}: ${m3SubsidiablesEnTramo}m³ con desc. + ${m3SinDescuento}m³ normal`);
      } else {
        // Todos los m³ de este tramo sin descuento
        total += m3EnTramo * precioFinal;
      }
    } else {
      // Usuario normal o exento_iva (sin descuento en consumo)
      total += m3EnTramo * precioFinal;
    }

    m3ProcesadosTotal += m3EnTramo;
    m3Restantes -= m3EnTramo;
  }

  // Aplicar IVA para usuarios exentos (iglesias, juntas vecinales, colegios)
  let totalIVA = 0;
  if (tipoUsuario === 'exento_iva') {
    totalIVA = total * 0.19; // 19% IVA
    total = total + totalIVA;
    console.log(`  📊 IVA 19%: $${totalIVA.toFixed(0)}`);
  }

  return {
    subtotal: total - totalIVA,
    iva: totalIVA,
    total: total
  };
}

// Función para obtener o crear usuario
async function obtenerOCrearUsuario(row, client) {
  const rut = row.RUT;

  // Buscar usuario existente
  const resultUsuario = await client.query(
    'SELECT id FROM usuarios WHERE rut = $1',
    [rut]
  );

  if (resultUsuario.rows.length > 0) {
    return { id: resultUsuario.rows[0].id, esNuevo: false };
  }

  // Crear nuevo usuario
  const password = generarPassword(rut);
  const hashedPassword = await bcrypt.hash(password, 10);

  const resultNuevo = await client.query(
    `INSERT INTO usuarios (nombre, rut, direccion, email, password, rol) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      row.NOMBRE,
      rut,
      row.DOMICILIO,
      `${rut}@temp.com`,
      hashedPassword,
      'usuario'
    ]
  );

  return { id: resultNuevo.rows[0].id, esNuevo: true };
}

// Función principal - ACTUALIZADO para recibir nombre de hoja
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
    const sAnteriorIdx = headers.findIndex(h => h && (h === 'S. ANTERIOR' || h.includes('SALDO ANTERIOR')));
    const totalMesIdx = headers.findIndex(h => h && (h.includes('TOTAL MES') || h.includes('T. MES') || h.includes('MES')));
    const sPendienteIdx = headers.findIndex(h => h && (h === 'S.PENDIENTE' || h.includes('PENDIENTE')));
    const tMesIdx = headers.findIndex(h => h && (h === 'T. MES' || h.includes('TOTAL MES')));

    console.log('📍 Índices de columnas:', {
      nombre: nombreIdx,
      rut: rutIdx,
      domicilio: domicilioIdx,
      lAnterior: lAnteriorIdx,
      lActual: lActualIdx,
      m3: m3Idx,
      saldoAnterior: sAnteriorIdx, // ← Verificar que sea diferente de lAnteriorIdx
      totalMes: tMesIdx,
      abono: abonoIdx,
      total: totalIdx
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
        'SALDO ANTERIOR': parseFloat(String(row[sAnteriorIdx] || '0').replace(/[$,]/g, '')) || 0, // ← Importante
        'TOTAL MES': parseFloat(String(row[tMesIdx] || '0').replace(/[$,]/g, '')) || 0, // ← Importante
        'S.PENDIENTE': parseFloat(String(row[sPendienteIdx] || '0').replace(/[$,]/g, '')) || 0
      });
    }

    console.log('✅ Filas válidas después del mapeo:', dataFiltrada.length);
    if (dataFiltrada.length > 0) {
      console.log('📝 Primeras 3 filas mapeadas:', dataFiltrada.slice(0, 3));

      if (dataFiltrada.length > 0) {
        const primera = dataFiltrada[0];
        console.log('🔍 Verificación primera fila:');
        console.log('  L.ANTERIOR (lectura):', primera['L.ANTERIOR']);
        console.log('  SALDO ANTERIOR ($$):', primera['SALDO ANTERIOR']);
        console.log('  TOTAL MES:', primera['TOTAL MES']);
      }
    }

    const periodo = normalizarPeriodo(targetSheet);
    console.log('📅 Periodo normalizado:', periodo);

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

    // 1. Pre-cargar datos necesarios para optimizar
    const resultTarifas = await client.query('SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC');
    const tarifas = resultTarifas.rows;

    const resultMax = await client.query(`
      SELECT COALESCE(MAX(CAST(numero_cliente AS BIGINT)), 0) as max_actual 
      FROM usuarios 
      WHERE numero_cliente ~ '^[0-9]+$'
    `);
    let siguienteNumeroCliente = parseInt(resultMax.rows[0]?.max_actual || 0) + 1;

    // Obtener todos los RUTs de la data para buscar usuarios existentes de una sola vez
    const rutsEnExcel = dataFiltrada.map(r => r.RUT);
    const resultUsuariosExistentes = await client.query(
      'SELECT id, rut, numero_cliente FROM usuarios WHERE rut = ANY($1)',
      [rutsEnExcel]
    );

    // Mapa para búsqueda rápida de usuarios
    const usuariosMap = new Map();
    resultUsuariosExistentes.rows.forEach(u => usuariosMap.set(u.rut, u));

    // Obtener los saldos pendientes actuales de todos los usuarios
    const resultSaldos = await client.query(`
      SELECT DISTINCT ON (usuario_id) usuario_id, saldo_pendiente 
      FROM boletas 
      WHERE usuario_id = ANY($1)
      ORDER BY usuario_id, created_at DESC
    `, [Array.from(usuariosMap.values()).map(u => u.id)]);

    const saldosMap = new Map();
    resultSaldos.rows.forEach(s => saldosMap.set(s.usuario_id, parseFloat(s.saldo_pendiente)));

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

        // 2. Obtener tipo de usuario
        const tipoUsuarioResult = await client.query(
          'SELECT tipo_usuario FROM usuarios WHERE id = $1',
          [usuarioId]
        );
        const tipoUsuario = tipoUsuarioResult.rows[0]?.tipo_usuario || 'normal';

        // 3. Preparar datos de lectura
        const lecturaAnterior = parseInt(row['L.ANTERIOR']) || 0;
        const lecturaActual = parseInt(row['L.ACTUAL']) || 0;
        const consumoTemporal = Math.max(0, lecturaActual - lecturaAnterior);

        // 4. CALCULAR MONTO (SIEMPRE debe definirse aquí)
        let montoCalculado = 0; // ← INICIALIZAR SIEMPRE

        if (row['TOTAL MES'] && row['TOTAL MES'] > 0) {
          montoCalculado = row['TOTAL MES'];
          console.log(`  📋 Usando total del Excel: $${montoCalculado}`);
        } else {
          const calculoTotal = await calcularTotalPorTramos(consumoTemporal, tipoUsuario);
          montoCalculado = calculoTotal.total;
          console.log(`  💵 Total calculado: $${montoCalculado.toFixed(0)}`);
        }

        // 5. Insertar lectura
        const [anio, mes] = periodo.split('-').map(Number);
        const fechaPeriodo = new Date(anio, mes - 1, 1);
        const fechaVencimiento = new Date(fechaPeriodo);
        fechaVencimiento.setDate(fechaPeriodo.getDate() + 15);

        const resultLectura = await client.query(
          `INSERT INTO lecturas (usuario_id, lectura_anterior, lectura_actual, mes, anio, monto_calculado, fecha_lectura)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, consumo_m3`,
          [usuarioId, lecturaAnterior, lecturaActual, mes, anio, montoCalculado]
        );

        const lecturaId = resultLectura.rows[0].id;
        const consumoM3 = resultLectura.rows[0].consumo_m3;

        console.log(`📝 Fila ${i + 1}: ${row.NOMBRE}, consumo: ${consumoM3}m³`);
        console.log(`  👤 Tipo usuario: ${tipoUsuario}`);

        // 6. totalMes es igual a montoCalculado
        const totalMes = montoCalculado;

        // 7. Obtener saldo anterior
        let saldoAnterior = 0;

        if (row['SALDO ANTERIOR'] && row['SALDO ANTERIOR'] > 0) {
          saldoAnterior = row['SALDO ANTERIOR'];
          console.log(`  💰 Usando saldo anterior del Excel: $${saldoAnterior}`);
        } else {
          const resultSaldoAnterior = await client.query(
            `SELECT saldo_pendiente FROM boletas 
       WHERE usuario_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
            [usuarioId]
          );

          saldoAnterior = resultSaldoAnterior.rows.length > 0
            ? parseFloat(resultSaldoAnterior.rows[0].saldo_pendiente)
            : 0;
        }

        // 8. Calcular totales
        const totalAPagar = totalMes + saldoAnterior;
        const abono = parseFloat(row['ABONO']) || 0;
        const saldoPendiente = totalAPagar - abono;

        // 9. Determinar estado
        let estado = 'pendiente';
        if (abono >= totalAPagar) {
          estado = 'pagado';
        } else if (abono > 0) {
          estado = 'parcial';
        }

        // 10. Insertar boleta

        const resultBoleta = await client.query(
          `INSERT INTO boletas 
   (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, 
    total_a_pagar, saldo_pendiente, estado, descuento_subsidio, monto_iva, fecha_vencimiento)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            usuarioId,
            lecturaId,
            periodo,
            consumoM3,
            totalMes,
            saldoAnterior,
            totalAPagar,
            saldoPendiente,
            estado,
            0, // descuento_subsidio
            0, // monto_iva
            fechaVencimiento // ← Fecha de vencimiento calculada
          ]
        );

        const boletaId = resultBoleta.rows[0].id;

        // 11. Registrar pago si hay abono
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
        console.error(`❌ Error en fila ${i + 1}:`, error.message);
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

    res.status(500).json({
      success: false,
      error: error.message
    });

  } finally {
    client.release();
    // esto se ejecuta SIEMPRE, incluso si hay throw o crash
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

module.exports = router;