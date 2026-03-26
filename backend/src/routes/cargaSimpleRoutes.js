const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');

// Función para calcular total por tramos (reutilizar del upload.js)
async function calcularTotalPorTramos(consumoM3, tipoUsuario = 'normal') {
  const result = await pool.query(
    'SELECT * FROM tarifas WHERE activo = true ORDER BY tramo_desde ASC'
  );

  const tarifas = result.rows;
  let total = 0;
  let m3Restantes = consumoM3;
  let m3ProcesadosTotal = 0;

  const LIMITE_SUBSIDIO = 15;
  const DESCUENTO_SUBSIDIO = 0.5;

  for (const tarifa of tarifas) {
    if (m3Restantes <= 0) break;

    const desde = tarifa.tramo_desde;
    const hasta = tarifa.tramo_hasta || Infinity;
    const rangoTramo = hasta - desde + 1;
    const m3EnTramo = Math.min(m3Restantes, rangoTramo);
    let precioFinal = parseFloat(tarifa.precio_por_m3);

    if (tipoUsuario === 'subsidiado') {
      const m3SubsidiablesEnTramo = Math.max(0, Math.min(
        LIMITE_SUBSIDIO - m3ProcesadosTotal,
        m3EnTramo
      ));

      if (m3SubsidiablesEnTramo > 0) {
        const montoConDescuento = m3SubsidiablesEnTramo * precioFinal * DESCUENTO_SUBSIDIO;
        const m3SinDescuento = m3EnTramo - m3SubsidiablesEnTramo;
        const montoSinDescuento = m3SinDescuento * precioFinal;
        total += montoConDescuento + montoSinDescuento;
      } else {
        total += m3EnTramo * precioFinal;
      }
    } else {
      total += m3EnTramo * precioFinal;
    }

    m3ProcesadosTotal += m3EnTramo;
    m3Restantes -= m3EnTramo;
  }

  let totalIVA = 0;
  if (tipoUsuario === 'exento_iva') {
    totalIVA = total * 0.19;
    total = total + totalIVA;
  }

  return {
    subtotal: total - totalIVA,
    iva: totalIVA,
    total: total
  };
}

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
      conflictos: [],
      total: data.length
    };

    await client.query('BEGIN');

    for (let i = 0; i < data.length; i++) {
      const fila = data[i];
      const numeroFila = i + 2; // Excel empieza en fila 2 (después del header)

      try {
        // Normalizar y limpiar datos de entrada para evitar errores "NaN"
        const nombreFila = fila.Nombre ? fila.Nombre.toString().trim() : '';
        const rutFila = fila.RUT ? fila.RUT.toString().trim() : '';
        const medidorFila = fila['Nro Medidor'] ? fila['Nro Medidor'].toString().trim() : '';

        // Limpiar lectura actual (quitar caracteres no numéricos y parsear)
        const lecturaActualStr = fila['Lectura Actual'] ? fila['Lectura Actual'].toString().replace(/[^0-9.-]/g, '') : '0';
        const lecturaActual = parseFloat(lecturaActualStr) || 0;

        // Validar campos requeridos mínimos
        if (!rutFila && !medidorFila && !nombreFila) {
          throw new Error('Debe proporcionar al menos un identificador (RUT, Nro Medidor o Nombre)');
        }

        // Buscar usuario por RUT, Medidor/Nº Cliente o Nombre
        let usuario = null;

        // 1. Buscar por RUT
        if (rutFila) {
          const rutResult = await client.query(
            'SELECT * FROM usuarios WHERE rut = $1',
            [rutFila]
          );
          usuario = rutResult.rows[0];
        }

        // 2. Si no encontró por RUT, buscar por medidor o número de cliente
        if (!usuario && medidorFila) {
          const medidorResult = await client.query(
            'SELECT * FROM usuarios WHERE medidor = $1 OR numero_cliente = $1',
            [medidorFila]
          );
          usuario = medidorResult.rows[0];
        }

        // 3. Si no encontró, buscar por nombre exacto
        if (!usuario && nombreFila) {
          const nombreResult = await client.query(
            'SELECT * FROM usuarios WHERE nombre ILIKE $1',
            [nombreFila]
          );
          usuario = nombreResult.rows[0];
        }

        // 4. Si SIGUE sin encontrar, CREAR usuario nuevo
        if (!usuario) {
          console.log(`👤 Creando usuario nuevo: ${nombreFila || 'Usuario Temporal'}`);

          let rutFinal = rutFila;

          // Si no hay RUT, generar uno ficticio 00.000.XXX-1
          if (!rutFinal) {
            const resultMaxFicticio = await client.query(
              "SELECT rut FROM usuarios WHERE rut LIKE '00.000.%-1' ORDER BY rut DESC LIMIT 1"
            );

            let siguienteNumero = 1;
            if (resultMaxFicticio.rows.length > 0) {
              const ultimoRut = resultMaxFicticio.rows[0].rut;
              const match = ultimoRut.match(/00\.000\.(\d+)-1/);
              if (match) {
                siguienteNumero = parseInt(match[1]) + 1;
              }
            }

            rutFinal = `00.000.${siguienteNumero.toString().padStart(3, '0')}-1`;
            console.log(`🆔 Generando RUT ficticio: ${rutFinal}`);
          }

          // Generar contraseña: apr + 4 primeros dígitos RUT, o apr123 si no hay RUT
          let passwordStr = 'apr123';
          if (rutFila) {
            const digitos = rutFila.replace(/[^0-9]/g, '').substring(0, 4);
            if (digitos) passwordStr = `apr${digitos}`;
          }

          const hashedPassword = await bcrypt.hash(passwordStr, 10);
          const emailTemp = rutFinal ? `${rutFinal.replace(/[^0-9a-zA-Z]/g, '')}@temp.com` : `user_${Date.now()}@temp.com`;

          const maxResult = await client.query("SELECT COALESCE(MAX(CAST(numero_cliente AS BIGINT)), 0) + 1 as sig FROM usuarios WHERE numero_cliente ~ '^[0-9]+$'");
          const nroClienteFinal = maxResult.rows[0].sig.toString().padStart(3, '0');

          const nuevoUsuarioRes = await client.query(
            `INSERT INTO usuarios (nombre, rut, email, password, rol, numero_cliente, medidor, direccion, es_socio) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
            [
              nombreFila || 'Usuario Nuevo',
              rutFinal,
              emailTemp,
              hashedPassword,
              'socio',
              nroClienteFinal,
              medidorFila || null,
              'Dirección pendiente'
            ]
          );
          usuario = nuevoUsuarioRes.rows[0];
        }

        // Actualizar medidor si viene en el Excel
        if (medidorFila && medidorFila !== usuario.medidor) {
          await client.query(
            'UPDATE usuarios SET medidor = $1, updated_at = NOW() WHERE id = $2',
            [medidorFila, usuario.id]
          );
          usuario.medidor = medidorFila;
        }

        // Obtener última lectura del usuario
        const ultimaLecturaResult = await client.query(
          `SELECT lectura_actual 
           FROM lecturas 
           WHERE usuario_id = $1 
           ORDER BY fecha_lectura DESC, id DESC 
           LIMIT 1`,
          [usuario.id]
        );

        const lecturaAnterior = ultimaLecturaResult.rows.length > 0
          ? parseFloat(ultimaLecturaResult.rows[0].lectura_actual)
          : 0;

        let consumo = lecturaActual - lecturaAnterior;
        let observacionesExtra = '';

        // Manejar consumo negativo
        if (consumo < 0) {
          console.log(`⚠️ Consumo negativo detectado para ${usuario.nombre}: ${consumo}`);
          observacionesExtra = ` (ATENCIÓN: Consumo negativo detectado. Anterior: ${lecturaAnterior}, Actual: ${lecturaActual})`;
          // Lo guardamos igual, el administrador decidirá qué hacer
        }

        // Verificar si ya existe lectura para este mes/año
        const lecturaExistenteResult = await client.query(
          `SELECT id, lectura_anterior, lectura_actual, fecha_lectura 
           FROM lecturas 
           WHERE usuario_id = $1 
             AND mes = $2
             AND anio = $3
           ORDER BY fecha_lectura DESC, id DESC
           LIMIT 1`,
          [usuario.id, mes, anio]
        );

        if (lecturaExistenteResult.rows.length > 0) {
          const existente = lecturaExistenteResult.rows[0];
          const lecturaExistenteActual = parseFloat(existente.lectura_actual) || 0;

          if (lecturaExistenteActual === lecturaActual) {
            resultados.exitosos.push({
              fila: numeroFila,
              nombre: usuario.nombre,
              rut: usuario.rut || 'N/A',
              medidor: usuario.medidor || '—',
              lectura_actual: lecturaActual,
              saltado: true,
              motivo: `Lectura ya registrada para ${mes}/${anio} (sin cambios)`
            });
            continue;
          }

          resultados.conflictos.push({
            fila: numeroFila,
            usuario_id: usuario.id,
            nombre: usuario.nombre,
            rut: usuario.rut || 'N/A',
            medidor: usuario.medidor || '—',
            mes: parseInt(mes),
            anio: parseInt(anio),
            lectura_id_existente: existente.id,
            lectura_existente: lecturaExistenteActual,
            lectura_nueva: lecturaActual
          });
          continue;
        }

        // Crear fecha de lectura (primer día del mes seleccionado)
        const fechaLectura = new Date(anio, mes - 1, 1);

        // Calcular monto de la boleta (si el consumo es negativo, el monto se basa en consumo 0 o el mínimo)
        const consumoParaMonto = Math.max(0, consumo);
        const calculoTotal = await calcularTotalPorTramos(consumoParaMonto, usuario.tipo_usuario || 'normal');
        const montoCalculado = calculoTotal.total;

        // Crear lectura
        const lecturaResult = await client.query(
          `INSERT INTO lecturas 
           (usuario_id, lectura_anterior, lectura_actual, mes, anio, monto_calculado, fecha_lectura, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, consumo_m3`,
          [
            usuario.id,
            lecturaAnterior,
            lecturaActual,
            mes,
            anio,
            montoCalculado,
            fechaLectura,
            `Carga masiva simple - ${nombreFila}${observacionesExtra}`
          ]
        );

        const lecturaId = lecturaResult.rows[0].id;
        const consumoM3 = lecturaResult.rows[0].consumo_m3; // consumo real guardado (puede ser negativo)

        // Obtener saldo anterior de la última boleta
        const resultSaldoAnterior = await client.query(
          `SELECT saldo_pendiente FROM boletas 
           WHERE usuario_id = $1 
           ORDER BY created_at DESC LIMIT 1`,
          [usuario.id]
        );

        const saldoAnterior = resultSaldoAnterior.rows.length > 0
          ? parseFloat(resultSaldoAnterior.rows[0].saldo_pendiente)
          : 0;

        const totalMes = montoCalculado;
        const totalAPagar = totalMes + saldoAnterior;
        const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
        const fechaVencimiento = new Date(anio, mes - 1, 20); // Vence el 20 del mes

        // Crear boleta
        await client.query(
          `INSERT INTO boletas 
           (usuario_id, lectura_id, periodo, consumo_m3, total_mes, saldo_anterior, 
            total_a_pagar, saldo_pendiente, estado, descuento_subsidio, monto_iva, fecha_vencimiento)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            usuario.id,
            lecturaId,
            periodo,
            consumoM3,
            totalMes,
            saldoAnterior,
            totalAPagar,
            totalAPagar,
            'pendiente',
            0,
            calculoTotal.iva,
            fechaVencimiento
          ]
        );

        resultados.exitosos.push({
          fila: numeroFila,
          nombre: usuario.nombre,
          rut: usuario.rut || 'N/A',
          medidor: usuario.medidor || '—',
          lectura_anterior: lecturaAnterior,
          lectura_actual: lecturaActual,
          consumo: consumoM3,
          monto: totalAPagar,
          observaciones: observacionesExtra
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
      mensaje: `Procesamiento completado: ${resultados.exitosos.length} exitosos, ${resultados.conflictos.length} conflictos, ${resultados.errores.length} errores`,
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

// Resolver conflicto de lectura existente
router.put('/resolver-conflicto', async (req, res) => {
  const client = await pool.connect();
  try {
    const { lectura_id, lectura_actual } = req.body;

    if (!lectura_id && lectura_id !== 0) {
      return res.status(400).json({ success: false, error: 'lectura_id es requerido' });
    }

    const lecturaActualNum = parseFloat(lectura_actual) || 0;

    await client.query('BEGIN');

    const lecturaResult = await client.query(
      `SELECT l.*, u.tipo_usuario
       FROM lecturas l
       JOIN usuarios u ON u.id = l.usuario_id
       WHERE l.id = $1`,
      [parseInt(lectura_id)]
    );

    if (lecturaResult.rows.length === 0) {
      throw new Error('Lectura no encontrada');
    }

    const lectura = lecturaResult.rows[0];
    const lecturaAnterior = parseFloat(lectura.lectura_anterior) || 0;
    const usuarioId = lectura.usuario_id;
    const tipoUsuario = lectura.tipo_usuario || 'normal';

    const consumoParaMonto = Math.max(0, lecturaActualNum - lecturaAnterior);
    const calculoTotal = await calcularTotalPorTramos(consumoParaMonto, tipoUsuario);
    const montoCalculado = calculoTotal.total;

    const updateLectura = await client.query(
      `UPDATE lecturas
       SET lectura_actual = $1,
           monto_calculado = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, consumo_m3, mes, anio`,
      [lecturaActualNum, montoCalculado, parseInt(lectura_id)]
    );

    const consumoM3 = updateLectura.rows[0].consumo_m3;

    const boletaResult = await client.query(
      `SELECT * FROM boletas WHERE lectura_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [parseInt(lectura_id)]
    );

    if (boletaResult.rows.length > 0) {
      const boleta = boletaResult.rows[0];
      const saldoAnterior = parseFloat(boleta.saldo_anterior) || 0;
      const totalAPagar = montoCalculado + saldoAnterior;

      const pagosResult = await client.query(
        `SELECT COALESCE(SUM(monto), 0) AS pagado
         FROM pagos
         WHERE boleta_id = $1`,
        [boleta.id]
      );
      const pagado = parseFloat(pagosResult.rows[0]?.pagado) || 0;
      const saldoPendiente = Math.max(0, totalAPagar - pagado);
      const nuevoEstado = saldoPendiente <= 0 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';

      await client.query(
        `UPDATE boletas
         SET consumo_m3 = $1,
             total_mes = $2,
             total_a_pagar = $3,
             saldo_pendiente = $4,
             estado = $5,
             monto_iva = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [consumoM3, montoCalculado, totalAPagar, saldoPendiente, nuevoEstado, calculoTotal.iva, boleta.id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      lectura_id: parseInt(lectura_id),
      lectura_actual: lecturaActualNum,
      consumo_m3: consumoM3,
      monto_calculado: montoCalculado
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolviendo conflicto:', error);
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
        'Nro Medidor': '001',
        'Lectura Actual': 1250
      },
      {
        'Nombre': 'María López',
        'RUT': '98765432-1',
        'Nro Medidor': '002',
        'Lectura Actual': 890
      },
      {
        'Nombre': 'Carlos Ruiz',
        'RUT': '',
        'Nro Medidor': '',
        'Lectura Actual': 450
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
        u.medidor,
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
      'Nro Medidor': u.medidor || '',
      'Lectura Actual': ''
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

// POST /api/carga-simple/actualizar-contactos
router.post('/actualizar-contactos', upload.single('archivo'), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No se subió archivo' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) return res.status(400).json({ success: false, error: 'Archivo vacío' });

    const resultados = { actualizados: [], noEncontrados: [], total: data.length };

    await client.query('BEGIN');

    for (const fila of data) {
      const nombre = fila.NOMBRE?.toString().trim() || '';
      const telefono = fila.TELEFONO?.toString().trim() || '';
      const rut = fila.RUT?.toString().trim() || '';
      const domicilio = fila.DOMICILIO?.toString().trim() || '';

      let usuario = null;

      // Buscar por RUT primero
      if (rut) {
        const res = await client.query(
          'SELECT id, nombre, telefono, direccion FROM usuarios WHERE rut = $1',
          [rut]
        );
        usuario = res.rows[0];
      }

      // Si no encontró por RUT, buscar por nombre
      if (!usuario && nombre) {
        const res = await client.query(
          'SELECT id, nombre, telefono, direccion FROM usuarios WHERE nombre ILIKE $1',
          [nombre]
        );
        usuario = res.rows[0];
      }

      if (!usuario) {
        resultados.noEncontrados.push({ nombre, rut });
        continue;
      }

      // Teléfono: reemplazar siempre
      // Domicilio: solo si está vacío o es 'Dirección pendiente'
      const nuevaDireccion = (domicilio && (!usuario.direccion || usuario.direccion === 'Dirección pendiente'))
        ? domicilio
        : usuario.direccion;

      await client.query(
        `UPDATE usuarios 
         SET telefono = $1,
             direccion = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [telefono || usuario.telefono, nuevaDireccion, usuario.id]
      );

      resultados.actualizados.push({ nombre: usuario.nombre, telefono, domicilio: nuevaDireccion });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: `${resultados.actualizados.length} usuarios actualizados, ${resultados.noEncontrados.length} no encontrados`,
      resultados
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando contactos:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
