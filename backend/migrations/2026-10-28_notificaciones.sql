-- Historial de notificaciones (aviso de mora/corte, corte, reconexion, prestamo, otro).
-- Solo crea objetos nuevos: no modifica ni lee datos de tablas existentes.

CREATE TABLE IF NOT EXISTS notificaciones (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo          VARCHAR(20)  NOT NULL
                CHECK (tipo IN ('aviso_mora', 'aviso_corte', 'corte', 'reconexion', 'prestamo', 'otro')),
  -- 'whatsapp' es un valor valido pero hoy NO hay envio implementado: solo 'app' se entrega.
  canal         VARCHAR(20)  NOT NULL DEFAULT 'app'
                CHECK (canal IN ('app', 'whatsapp')),
  titulo        VARCHAR(200) NOT NULL,
  mensaje       TEXT         NOT NULL,
  fecha         TIMESTAMP    NOT NULL DEFAULT NOW(),   -- UTC, igual que el resto de las tablas
  generada_por  INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  leida         BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_lectura TIMESTAMP,
  boleta_id     INTEGER      REFERENCES boletas(id) ON DELETE SET NULL,
  nivel         SMALLINT,
  -- Identifica el "caso" para no duplicar (ej. 'boleta:3352', 'corte:12'). NULL = sin control.
  clave_dedup   VARCHAR(100),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Un mismo caso (clave) puede tener una fila por canal, pero no dos del mismo tipo+canal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_dedup
  ON notificaciones (usuario_id, tipo, canal, clave_dedup)
  WHERE clave_dedup IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON notificaciones (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones (tipo);
