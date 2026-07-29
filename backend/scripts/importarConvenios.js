const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Mapeo de capacidad -> insumo_id
const INSUMO_POR_CAPACIDAD = {
    '500': 6,
    '1.000': 7, '1000': 7,
    '1.300': 8, '1300': 8,
    '2.000': 9, '2000': 9,
    '3.400': 10, '3400': 10,
};

const limpiarMonto = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(String(val).replace(/[$\.\s]/g, '').replace(',', '.').replace('c/u', '').replace('lts', '')) || 0;
    return Math.min(num, 99999999.99); // proteger contra overflow numeric(10,2)
};

const limpiarCapacidad = (val) => {
    const match = String(val || '').match(/[\d.]+/);
    return match ? match[0].replace('.', '') : null;
};

const iconv = require('iconv-lite');

const leerCSV = (nombreArchivo) => {
    const filePath = path.join(__dirname, 'datos', nombreArchivo);
    const buffer = fs.readFileSync(filePath);
    const contenido = iconv.decode(buffer, 'win1252');
    const workbook = XLSX.read(contenido, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const mapEstadoColor = (colorNombre) => {
    switch (colorNombre) {
        case 'VERDE': return 'pagada';
        case 'SALMON': return 'vencida';
        case 'BLANCO': return 'pendiente';
        default: return null; // NEGRO -> no aplica
    }
};

const parsearValorCelda = (valorCelda) => {
    const str = String(valorCelda || '').trim();
    if (!str) return { fechaTexto: null, monto: 0 };

    // Si es texto puro sin números relevantes (ej. "pagado total"), no es una cuota real
    if (/^[a-zA-Z\s]+$/.test(str)) {
        return { fechaTexto: str, monto: 0 };
    }

    const partes = str.split('/');
    if (partes.length >= 2) {
        const fechaTexto = partes[0].trim();
        const monto = limpiarMonto(partes.slice(1).join('/'));
        return { fechaTexto, monto };
    }
    const monto = limpiarMonto(str);
    return { fechaTexto: monto === 0 ? str : null, monto };
};

const importar = async () => {
    console.log('🚀 Iniciando importación de convenios de estanques...\n');

    const filas1 = leerCSV('nomina_1compra.csv').map(f => ({ ...f, lote: '1° Compra' }));
    const filas2 = leerCSV('nomina_2compra.csv').map(f => ({ ...f, lote: '2° Compra' }));
    const filasBase = [...filas1, ...filas2];

    const mapeoColores = leerCSV('MapeoColores.csv');

    // Agrupar cuotas por nombre y Fila_Origen (cada Fila_Origen = un convenio/préstamo distinto)
    const bloquesPorNombre = {};
    for (const c of mapeoColores) {
        const nombreC = String(c['Nombre'] || '').trim();
        const filaOrigen = c['Fila_Origen'];
        if (!nombreC) continue;
        if (!bloquesPorNombre[nombreC]) bloquesPorNombre[nombreC] = {};
        if (!bloquesPorNombre[nombreC][filaOrigen]) bloquesPorNombre[nombreC][filaOrigen] = [];
        bloquesPorNombre[nombreC][filaOrigen].push(c);
    }
    // Convertir cada nombre a un array de bloques ordenados por Fila_Origen ascendente
    for (const nombreC in bloquesPorNombre) {
        bloquesPorNombre[nombreC] = Object.keys(bloquesPorNombre[nombreC])
            .sort((a, b) => Number(a) - Number(b))
            .map(fo => bloquesPorNombre[nombreC][fo]);
    }

    let prestamosCreados = 0, sinUsuario = 0, cuotasCreadas = 0, errores = 0;

    for (const fila of filasBase) {
        const nombre = String(fila['Nombre'] || '').trim();
        if (!nombre) continue;

        const rut = String(fila['Rut'] || '').trim();
        const capacidadTexto = String(fila['Capacidad'] || '').trim();
        const capacidadNum = limpiarCapacidad(capacidadTexto);
        const insumoId = INSUMO_POR_CAPACIDAD[capacidadNum];
        const cantidad = parseInt(fila['Cantidad '] || fila['Cantidad'] || 1) || 1;
        const precio = limpiarMonto(fila['Precio']);
        const numCuotas = parseInt(String(fila['Cantidad de Cuotas'] || '').replace(/\D/g, '')) || 0;
        const valorCuota = limpiarMonto(fila['Valor Cuota']);
        const lote = fila.lote;

        if (!insumoId) {
            console.log(`  ⚠️  Sin insumo para capacidad "${capacidadTexto}": ${nombre}`);
            errores++;
            continue;
        }

        // Buscar usuario por RUT
        let usuarioId = null;
        if (rut) {
            const { rows } = await pool.query('SELECT id FROM usuarios WHERE rut = $1 LIMIT 1', [rut]);
            if (rows[0]) usuarioId = rows[0].id;
        }
        if (!usuarioId) sinUsuario++;

        const notas = usuarioId ? `Convenio estanque - ${lote}` : `Convenio estanque - ${lote} - SIN USUARIO VINCULADO: ${nombre}`;

        try {
            const { rows: prestamoRows } = await pool.query(`
        INSERT INTO prestamos (usuario_id, insumo_id, cantidad, monto_total, num_cuotas, cuota_mensual, cuotas_pagadas, estado, fecha_inicio, notas, lote)
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'activo', CURRENT_DATE, $7, $8)
        RETURNING id
      `, [usuarioId, insumoId, cantidad, precio, numCuotas || 1, valorCuota, notas, lote]);

            const prestamoId = prestamoRows[0].id;
            prestamosCreados++;

            // Buscar las cuotas de este socio en MapeoColores (match por nombre)
            const cuotasDeSocio = (bloquesPorNombre[nombre] || []).shift() || [];

            let cuotasPagadasCount = 0;

            for (const cuota of cuotasDeSocio) {
                const numeroCuota = parseInt(cuota['Numero_Cuota']);
                const colorNombre = String(cuota['Color_Nombre'] || '').trim();
                const estado = mapEstadoColor(colorNombre);

                if (!estado) continue; // NEGRO, fuera de rango

                const { fechaTexto, monto } = parsearValorCelda(cuota['Valor_Celda']);

                await pool.query(`
          INSERT INTO prestamo_cuotas (prestamo_id, numero_cuota, fecha_pago, monto_esperado, monto_pagado, estado, notas)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                    prestamoId,
                    numeroCuota,
                    estado === 'pagada' ? null : null, // fecha real no confiable, se guarda en notas
                    valorCuota || monto,
                    estado === 'pagada' ? monto : 0,
                    estado,
                    fechaTexto ? `Fecha original Excel: ${fechaTexto}` : null
                ]);

                cuotasCreadas++;
                if (estado === 'pagada') cuotasPagadasCount++;
            }

            // Actualizar cuotas_pagadas en el préstamo
            await pool.query(`UPDATE prestamos SET cuotas_pagadas = $1 WHERE id = $2`, [cuotasPagadasCount, prestamoId]);

            console.log(`  ✅ ${nombre} (${lote}) → préstamo #${prestamoId}, ${cuotasDeSocio.length} cuotas, usuario_id: ${usuarioId || 'SIN VINCULAR'}`);

        } catch (err) {
            console.log(`  ❌ Error con ${nombre}: ${err.message}`);
            errores++;
        }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   Préstamos creados: ${prestamosCreados}`);
    console.log(`   Sin usuario vinculado: ${sinUsuario}`);
    console.log(`   Cuotas creadas: ${cuotasCreadas}`);
    console.log(`   Errores: ${errores}`);
    console.log('\n✅ Listo.');
    process.exit(0);
};

importar().catch(err => {
    console.error('❌ Error general:', err.message);
    process.exit(1);
});