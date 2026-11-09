-- Permite anular un corte registrado por error: nuevo estado 'anulado' + quien/cuando/por que.
-- historial_cortes no tiene filas al momento de escribir esta migracion; no se modifica ningun dato existente.
ALTER TABLE historial_cortes DROP CONSTRAINT IF EXISTS historial_cortes_estado_check;
ALTER TABLE historial_cortes
  ADD CONSTRAINT historial_cortes_estado_check CHECK (estado::text = ANY (ARRAY['cortado','repuesto','anulado']::text[]));
ALTER TABLE historial_cortes ADD COLUMN IF NOT EXISTS anulado_motivo TEXT;
ALTER TABLE historial_cortes ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMP;
ALTER TABLE historial_cortes ADD COLUMN IF NOT EXISTS anulado_por INTEGER;
