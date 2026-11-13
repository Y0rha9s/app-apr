-- Saldo a favor que se descontó en cada boleta, para mostrarlo en el PDF.
-- usuarios.saldo_favor es lo que le queda disponible al socio; esto es lo que se aplicó en esa boleta.
ALTER TABLE boletas ADD COLUMN IF NOT EXISTS saldo_favor_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0;
