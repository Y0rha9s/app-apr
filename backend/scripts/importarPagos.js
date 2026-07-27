const pool = require('../src/config/database');
const XLSX = require('xlsx');
const path = require('path');

const archivos = [
  { file: 'pagos.xlsx', hoja: 'JUNIO 2026', periodo: '2026-06', filaHeader: 1 },
];


const limpiarMonto = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/[$\.\s]/g, '').replace(',', '.')) || 0;
};

const importar = async () => {
  console.log('🚀 Iniciando importación...\n');

  for (const { file, hoja, periodo, filaHeader } of archivos) {
    const filePath = path.join(__dirname, 'datos', file);
    console.log(`📄 Procesando "${hoja}" → ${periodo}...`);

    let filas = [];

    if (file.endsWith('.csv')) {
      const fs = require('fs');
      const contenido = fs.readFileSync(path.join(__dirname, 'datos', file), 'utf8');
      const workbook2 = XLSX.read(contenido, { type: 'string' });
      const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
      const raw2 = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
      const headers = raw2[filaHeader].map(h => String(h).trim());

      // Buscar segunda tabla
      const segundaHeaderIdx = raw2.findIndex((fila, idx) =>
        idx > filaHeader + 1 && String(fila[1] || '').trim() === 'NOMBRE'
      );

      // Primera tabla (hasta la segunda cabecera o hasta el final)
      const finPrimera = segundaHeaderIdx !== -1 ? segundaHeaderIdx : raw2.length;
      filas = raw2.slice(filaHeader + 1, finPrimera)
        .filter(fila => fila.some(c => c !== ''))
        .map(fila => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = String(fila[i] ?? '').trim(); });
          return obj;
        });

      // Segunda tabla si existe
      if (segundaHeaderIdx !== -1) {
        const headers2 = raw2[segundaHeaderIdx].map(h => String(h).trim());
        const filas2 = raw2.slice(segundaHeaderIdx + 1)
          .filter(fila => fila.some(c => c !== ''))
          .map(fila => {
            const obj = {};
            headers2.forEach((h, i) => { obj[h] = String(fila[i] ?? '').trim(); });
            return obj;
          });
        filas = [...filas, ...filas2];
      }
    } else {
      const workbook = XLSX.readFile(path.join(__dirname, 'datos', file));
      console.log('Hojas disponibles:', workbook.SheetNames);
      const hojaReal = workbook.SheetNames.find(
        name => name.trim().toUpperCase() === hoja.trim().toUpperCase()
      );
      if (!hojaReal) {
        console.log(`⚠️  Hoja no encontrada. Disponibles: ${workbook.SheetNames.join(' | ')}\n`);
        continue;
      }
      const sheet = workbook.Sheets[hojaReal];
      if (!sheet) {
        console.log(`⚠️  Sheet vacío para hoja "${hojaReal}"\n`);
        continue;
      }
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      console.log('Primeras 5 filas:');
      raw.slice(0, 5).forEach((fila, i) => console.log(`Fila ${i}:`, fila.slice(0, 5)));
      const headers = raw[filaHeader];
      filas = raw.slice(filaHeader + 1)
        .filter(fila => fila.some(c => c !== ''))
        .map(fila => {
          const obj = {};
          headers.forEach((h, i) => { obj[String(h).trim()] = fila[i] ?? ''; });
          return obj;
        });
    }
    let actualizadas = 0, sinBoleta = 0, sinRut = 0;

    for (const fila of filas) {
      const rut = String(fila['RUT'] || '').trim();
      const nombre = String(fila['NOMBRE'] || '').trim();
      const abono = limpiarMonto(fila['ABONO']);
      const saldoPend = limpiarMonto(fila['S.PENDIENTE'] ?? fila['S. PENDIENTE']) ||
        (abono === 0 ? limpiarMonto(fila['TOTAL']) : 0);
      if (rut === '6.915.508-1') {
        console.log('ABONO raw:', JSON.stringify(fila['ABONO']));
        console.log('S. PENDIENTE raw:', JSON.stringify(fila['S. PENDIENTE']));
        console.log('S.PENDIENTE raw:', JSON.stringify(fila['S.PENDIENTE']));
        console.log('TOTAL raw:', JSON.stringify(fila['TOTAL']));
        console.log('abono calculado:', limpiarMonto(fila['ABONO']));
        console.log('saldoPend calculado:', saldoPend);
      }
      const medioPago = String(fila['M. PAGO'] || '').trim() || null;

      if (!rut) {
        if (nombre) console.log(`  ⚠️  Sin RUT: ${nombre}`);
        sinRut++;
        continue;
      }

      const estado = (abono > 0 && saldoPend === 0) ? 'pagada' : 'pendiente';

      const { rows: usuarios } = await pool.query(
        `SELECT id FROM usuarios WHERE rut = $1 LIMIT 1`, [rut]
      );

      if (!usuarios[0]) {
        console.log(`  ❌ No en BD: ${nombre} (${rut})`);
        sinBoleta++;
        continue;
      }

      const { rows: boletas } = await pool.query(
        `SELECT id FROM boletas WHERE usuario_id = $1 AND periodo = $2 LIMIT 1`,
        [usuarios[0].id, periodo]
      );

      if (!boletas[0]) {
        console.log(`  ⚠️  Sin boleta ${periodo}: ${nombre} (${rut})`);
        sinBoleta++;
        continue;
      }

      const fechaPago = estado === 'pagada' ? new Date().toISOString() : null;
      const obs = medioPago
        ? `${medioPago}${abono > 0 ? ` — Abono: $${abono.toLocaleString('es-CL')}` : ''}`
        : null;

      await pool.query(`
        UPDATE boletas SET
          estado          = $1,
          saldo_pendiente = $2,
          fecha_pago      = $3,
          observaciones   = $4
        WHERE id = $5
      `, [estado, saldoPend, fechaPago, obs, boletas[0].id]);

      console.log(`  ✅ ${nombre} (${rut}) → ${estado} | saldo: $${saldoPend.toLocaleString('es-CL')}${medioPago ? ` | ${medioPago}` : ''}`);
      actualizadas++;
    }

    console.log(`\n📊 ${periodo}: ✅ ${actualizadas} | ❌ ${sinBoleta} sin boleta | ⚠️ ${sinRut} sin RUT\n`);
  }

  console.log('✅ Listo.');
  process.exit(0);
};

importar().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});