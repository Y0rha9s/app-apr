// Regla de morosidad por cantidad de boletas impagas (se calcula al consultar, sin cron).
//   Nivel 1: 1 boleta impaga (~30 dias)  -> aviso
//   Nivel 2: UMBRAL_BOLETAS_CORTE o mas  -> elegible para aviso de corte / corte
// Para cambiar cuando se adelanta (o atrasa) el corte, modificar SOLO esta constante.
const UMBRAL_BOLETAS_CORTE = 2;

const NIVEL_AVISO = 1;
const NIVEL_CORTE = 2;

// 0 = sin mora; 1 = aviso; 2 = elegible para corte
function clasificarNivelMorosidad(boletasImpagas) {
  const n = parseInt(boletasImpagas, 10) || 0;
  if (n <= 0) return 0;
  return n >= UMBRAL_BOLETAS_CORTE ? NIVEL_CORTE : NIVEL_AVISO;
}

// Usuarios con boletas vencidas y con saldo. Acepta un pool o un client (para usarlo dentro de una transaccion).
async function consultarMorosos(db) {
  const { rows } = await db.query(`
    SELECT
      u.id, u.nombre, u.rut, u.numero_cliente, u.telefono, u.direccion, u.medidor, u.estado_servicio,
      COUNT(b.id)::int AS boletas_impagas,
      SUM(b.saldo_pendiente) AS deuda_total,
      MIN(b.fecha_vencimiento) AS fecha_vencimiento_mas_antigua,
      to_char(MIN(b.fecha_vencimiento), 'DD/MM/YYYY') AS vencimiento_mas_antiguo_txt,
      (CURRENT_DATE - MIN(b.fecha_vencimiento)::date) AS dias_mora,
      (array_agg(b.id ORDER BY b.fecha_vencimiento ASC, b.id ASC))[1] AS boleta_mas_antigua_id
    FROM usuarios u
    JOIN boletas b ON b.usuario_id = u.id
    WHERE b.estado IN ('pendiente', 'abonada', 'atrasada')
      AND b.saldo_pendiente > 0
      AND b.fecha_vencimiento < CURRENT_DATE
    GROUP BY u.id, u.nombre, u.rut, u.numero_cliente, u.telefono, u.direccion, u.medidor, u.estado_servicio
    ORDER BY boletas_impagas DESC, dias_mora DESC
  `);
  return rows.map((r) => ({ ...r, nivel: clasificarNivelMorosidad(r.boletas_impagas) }));
}

module.exports = { UMBRAL_BOLETAS_CORTE, NIVEL_AVISO, NIVEL_CORTE, clasificarNivelMorosidad, consultarMorosos };
