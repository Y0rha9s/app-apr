const pool = require('../src/config/database');
const XLSX = require('xlsx');
const path = require('path');

const archivos = [
  { file: 'pagos.xlsx', hoja: 'ENERO 2026',    periodo: '2026-01', filaHeader: 1 },
  { file: 'pagos.xlsx', hoja: ' FEBRERO 2026', periodo: '2026-02', filaHeader: 1 },
  { file: 'pagos.xlsx', hoja: 'MARZO 2026',    periodo: '2026-03', filaHeader: 2 },
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

    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames.includes(hoja)) {
      console.log(`⚠️  Hoja no encontrada. Disponibles: ${workbook.SheetNames.join(' | ')}\n`);
      continue;
    }

    const sheet = workbook.Sheets[hoja];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headers = raw[filaHeader];
    console.log('  Headers:', headers.filter(h => String(h).trim() !== ''));

    const filas = raw.slice(filaHeader + 1)
      .filter(fila => fila.some(c => c !== ''))
      .map(fila => {
        const obj = {};
        headers.forEach((h, i) => { obj[String(h).trim()] = fila[i] ?? ''; });
        return obj;
      });

    let actualizadas = 0, sinBoleta = 0, sinRut = 0;

    for (const fila of filas) {
      const rut       = String(fila['RUT'] || '').trim();
      const nombre    = String(fila['NOMBRE'] || '').trim();
      const abono     = limpiarMonto(fila['ABONO']);
      const saldoPend = limpiarMonto(fila['S.PENDIENTE']);
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