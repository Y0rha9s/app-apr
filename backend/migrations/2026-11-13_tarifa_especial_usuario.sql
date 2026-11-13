-- Tarifa especial por usuario (excepciones acordadas con la APR).
-- precio_m3_plano: si tiene valor, TODO el consumo se cobra a ese precio, sin tramos.
-- cargo_fijo_personalizado: cargo fijo propio del usuario (si es NULL se usa el global).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS precio_m3_plano NUMERIC(12,2);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo_fijo_personalizado NUMERIC(12,2);

-- Débora Luiza Muñoz Barra (SAFIP-0058): $700 por m³ + $99.000 fijo (confirmado por la APR)
UPDATE usuarios SET precio_m3_plano = 700, cargo_fijo_personalizado = 99000 WHERE id = 58 AND numero_cliente = 'SAFIP-0058';
