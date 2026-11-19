// Monto del mes de una boleta. Unico calculo para generacion masiva, individual, lecturas del operador
// y recalculo al corregir una lectura.

const calcularMontoTramos = (tramos, cargoFijo, consumo, tieneSubsidio) => {
  let restante = parseFloat(consumo || 0);
  let totalConsumo = 0;
  let tramo1Monto = 0;
  tramos.forEach((t, i) => {
    if (restante <= 0) return;
    const hasta = t.tramo_hasta ? parseFloat(t.tramo_hasta) : Infinity;
    const efectivo_desde = i === 0 ? 0 : parseFloat(t.tramo_desde) - 1;
    const capacidad = hasta === Infinity ? restante : hasta - efectivo_desde;
    const consumido = Math.min(restante, capacidad);
    const monto = consumido * parseFloat(t.precio_por_m3);
    if (i === 0) tramo1Monto = monto;
    else totalConsumo += monto;
    restante -= consumido;
  });
  return Math.round(tieneSubsidio ? (cargoFijo + tramo1Monto) / 2 + totalConsumo : cargoFijo + tramo1Monto + totalConsumo);
};

// u = fila con precio_m3_plano, cargo_fijo_personalizado y tiene_subsidio.
const cargoFijoDe = (u, cargoFijoGlobal) =>
  u?.cargo_fijo_personalizado != null ? parseFloat(u.cargo_fijo_personalizado) : cargoFijoGlobal;

const calcularMontoMes = (tramos, cargoFijoGlobal, consumo, u) => {
  const cargoFijo = cargoFijoDe(u, cargoFijoGlobal);
  if (u?.precio_m3_plano != null) {
    return Math.round(cargoFijo + parseFloat(consumo || 0) * parseFloat(u.precio_m3_plano));
  }
  return calcularMontoTramos(tramos, cargoFijo, consumo, u?.tiene_subsidio);
};

const calcularDescuentoSubsidio = (tramos, cargoFijo, consumo, tieneSubsidio) => {
  if (!tieneSubsidio) return 0;
  return Math.round((cargoFijo + Math.min(consumo, parseFloat(tramos[0]?.tramo_hasta || 15)) * parseFloat(tramos[0]?.precio_por_m3 || 700)) / 2);
};

module.exports = { calcularMontoTramos, cargoFijoDe, calcularMontoMes, calcularDescuentoSubsidio };
