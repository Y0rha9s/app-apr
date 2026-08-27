// Cálculo de monto por tramos de consumo (compartido por creación de lecturas y edición con recálculo)
async function calcularTotalPorTramos(pool, consumoM3, tipoUsuario = 'normal') {
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

module.exports = { calcularTotalPorTramos };
