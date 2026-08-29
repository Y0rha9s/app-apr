// Aplica el saldo a favor de un usuario a un monto a pagar, sin perder el excedente no usado.
// El crédito nunca supera lo que realmente se debe, y lo que sobra queda disponible para el próximo período.
function aplicarSaldoFavor(montoAntesDeCredito, saldoFavorDisponible) {
  const disponible = Math.max(0, parseFloat(saldoFavorDisponible || 0));
  const monto = Math.max(0, parseFloat(montoAntesDeCredito || 0));
  const creditoAplicado = Math.min(disponible, monto);
  return {
    totalAPagar: monto - creditoAplicado,
    creditoAplicado,
    saldoFavorRestante: disponible - creditoAplicado
  };
}

module.exports = { aplicarSaldoFavor };
