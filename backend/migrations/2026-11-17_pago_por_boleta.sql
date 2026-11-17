-- Caja: pago por boleta elegida, con abono y vuelto.
-- Solo columnas nuevas y opcionales: los pagos antiguos quedan con NULL y siguen funcionando igual.
-- pagos.monto sigue siendo "lo que queda en caja" (aplicado a la boleta + saldo a favor), asi el
-- cierre de caja y el Informe de Caja no cambian. El vuelto nunca cuenta como ingreso.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_recibido     NUMERIC(12,2); -- lo que entrego el socio
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS vuelto             NUMERIC(12,2); -- solo efectivo
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS es_abono           BOOLEAN;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS saldo_boleta_antes NUMERIC(12,2); -- saldo de la boleta antes del pago
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS aplicado_boleta    NUMERIC(12,2); -- lo que se descontó de la boleta
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS a_saldo_favor      NUMERIC(12,2); -- excedente del abono -> proxima boleta
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS solicitud_id       UUID;          -- evita pagos duplicados por doble clic

CREATE UNIQUE INDEX IF NOT EXISTS pagos_solicitud_id_unico ON pagos (solicitud_id) WHERE solicitud_id IS NOT NULL;
