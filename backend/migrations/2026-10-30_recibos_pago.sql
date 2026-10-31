-- Respaldo de los recibos de dinero (comprobantes) emitidos al registrar un pago en Caja.
-- Guarda una copia exacta de lo que se imprime, para que no cambie aunque despues se modifiquen
-- boletas o datos del usuario. Solo crea objetos nuevos: no modifica ni lee datos existentes.

CREATE TABLE IF NOT EXISTS recibos_pago (
  id              SERIAL PRIMARY KEY,
  -- Si algun dia se borra el pago, el respaldo del recibo se conserva (pago_id queda NULL)
  pago_id         INTEGER UNIQUE REFERENCES pagos(id) ON DELETE SET NULL,
  numero          INTEGER NOT NULL,            -- N° impreso en el recibo (= id del pago)
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre          VARCHAR(200) NOT NULL,
  rut             VARCHAR(20),
  numero_cliente  VARCHAR(30),
  monto           NUMERIC(12, 2) NOT NULL,
  monto_palabras  TEXT NOT NULL,
  forma_pago      VARCHAR(30) NOT NULL,        -- efectivo / transferencia / tarjeta / abono / otro
  concepto        TEXT NOT NULL,               -- "Cuenta de"
  observaciones   TEXT,
  periodos        TEXT[],                      -- periodos de las boletas que cubrio el pago
  fecha_pago      TIMESTAMP NOT NULL,          -- UTC, igual que el resto de las tablas
  caja_id         INTEGER,
  recibido_por    VARCHAR(200),
  datos           JSONB NOT NULL,              -- copia completa de lo que se imprimio
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recibos_pago_usuario ON recibos_pago (usuario_id);
CREATE INDEX IF NOT EXISTS idx_recibos_pago_fecha ON recibos_pago (fecha_pago);
