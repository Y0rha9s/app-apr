-- Marca las lecturas en que el operador no pudo acceder al medidor (ingreso 1).
-- Debe ejecutarse ANTES de desplegar el codigo que la usa.
ALTER TABLE lecturas ADD COLUMN IF NOT EXISTS no_tomada boolean NOT NULL DEFAULT false;
