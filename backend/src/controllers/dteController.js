const pool = require('../config/database');
const { generarXMLDTE34, generarEnvioDTE } = require('../services/dteService');
const { enviarDTE, consultarEstado } = require('../services/siiService');

// ─── POST /api/dte/emitir/:boletaId ──────────────────────────────────────────
const emitirDTE = async (req, res) => {
  try {
    const { boletaId } = req.params;

    // Traer boleta y usuario
    const { rows } = await pool.query(`
      SELECT b.*, u.rut, u.nombre, u.direccion
      FROM boletas b
      JOIN usuarios u ON u.id = b.usuario_id
      WHERE b.id = $1
    `, [boletaId]);

    if (!rows[0]) return res.status(404).json({ error: 'Boleta no encontrada' });
    const boleta = rows[0];

    // Verificar que no tenga DTE ya emitido
    const { rows: dteExistente } = await pool.query(
      `SELECT id FROM dte_emitidos WHERE boleta_id = $1 AND tipo_dte = 34`,
      [boletaId]
    );
    if (dteExistente[0]) return res.status(400).json({ error: 'Esta boleta ya tiene DTE emitido' });

    // Generar XML DTE
    const { xmlDteFirmado, folio } = await generarXMLDTE34(boleta, boleta);

    // Generar envío
    const rutEnvia = process.env.RUT_ENVIA || '71810200-6';
    const fchResol = process.env.SII_FECHA_RESOLUCION || '2024-01-01';
    const nroResol = process.env.SII_NRO_RESOLUCION || '0';

    const xmlEnvio = generarEnvioDTE([xmlDteFirmado], rutEnvia, fchResol, nroResol);

    // Enviar al SII
    const { trackId, estado, respuestaCompleta } = await enviarDTE(xmlEnvio, '71810200-6');

    // Guardar en BD
    await pool.query(`
      INSERT INTO dte_emitidos (
        tipo_dte, folio, rut_receptor, nombre_receptor,
        monto_total, fecha_emision, periodo, boleta_id,
        track_id, estado, xml_dte, xml_respuesta_sii
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      34, folio,
      boleta.rut, boleta.nombre,
      boleta.total_a_pagar,
      new Date().toISOString().split('T')[0],
      boleta.periodo, boletaId,
      trackId,
      estado === '0' ? 'enviado' : 'rechazado',
      xmlEnvio, respuestaCompleta
    ]);

    res.json({
      success: true,
      folio,
      trackId,
      estado,
      mensaje: estado === '0' ? 'DTE enviado correctamente al SII' : 'DTE rechazado por el SII'
    });

  } catch (err) {
    console.error('emitirDTE:', err);
    res.status(500).json({ error: 'Error al emitir DTE: ' + err.message });
  }
};

// ─── POST /api/dte/emitir-masivo ──────────────────────────────────────────────
const emitirMasivo = async (req, res) => {
  try {
    const { periodo } = req.body;
    if (!periodo) return res.status(400).json({ error: 'Falta el periodo' });

    // Traer boletas del período sin DTE
    const { rows: boletas } = await pool.query(`
      SELECT b.*, u.rut, u.nombre, u.direccion
      FROM boletas b
      JOIN usuarios u ON u.id = b.usuario_id
      WHERE b.periodo = $1
        AND b.estado != 'anulada'
        AND NOT EXISTS (
          SELECT 1 FROM dte_emitidos d 
          WHERE d.boleta_id = b.id AND d.tipo_dte = 34
        )
    `, [periodo]);

    if (boletas.length === 0)
      return res.json({ message: 'No hay boletas pendientes de emitir DTE', emitidos: 0 });

    const rutEnvia = process.env.RUT_ENVIA || '71810200-6';
    const fchResol = process.env.SII_FECHA_RESOLUCION || '2024-01-01';
    const nroResol = process.env.SII_NRO_RESOLUCION || '0';

    let emitidos = 0;
    let errores = 0;
    const resultados = [];

    for (const boleta of boletas) {
      try {
        const { xmlDteFirmado, folio } = await generarXMLDTE34(boleta, boleta);
        const xmlEnvio = generarEnvioDTE([xmlDteFirmado], rutEnvia, fchResol, nroResol);
        const { trackId, estado, respuestaCompleta } = await enviarDTE(xmlEnvio, '71810200-6');

        await pool.query(`
          INSERT INTO dte_emitidos (
            tipo_dte, folio, rut_receptor, nombre_receptor,
            monto_total, fecha_emision, periodo, boleta_id,
            track_id, estado, xml_dte, xml_respuesta_sii
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          34, folio, boleta.rut, boleta.nombre,
          boleta.total_a_pagar,
          new Date().toISOString().split('T')[0],
          periodo, boleta.id,
          trackId,
          estado === '0' ? 'enviado' : 'rechazado',
          xmlEnvio, respuestaCompleta
        ]);

        emitidos++;
        resultados.push({ nombre: boleta.nombre, folio, estado: 'enviado' });
      } catch (err) {
        errores++;
        resultados.push({ nombre: boleta.nombre, error: err.message });
      }
    }

    res.json({ message: `${emitidos} DTE emitidos, ${errores} errores`, emitidos, errores, resultados });
  } catch (err) {
    console.error('emitirMasivo:', err);
    res.status(500).json({ error: 'Error en emisión masiva: ' + err.message });
  }
};

// ─── GET /api/dte/estado/:trackId ────────────────────────────────────────────
const consultarEstadoDTE = async (req, res) => {
  try {
    const { trackId } = req.params;
    const { estado, glosa, respuestaCompleta } = await consultarEstado(trackId, '71810200-6');

    // Actualizar en BD
    await pool.query(
      `UPDATE dte_emitidos SET estado = $1, xml_respuesta_sii = $2 WHERE track_id = $3`,
      [estado === '0' ? 'aceptado' : 'rechazado', respuestaCompleta, trackId]
    );

    res.json({ trackId, estado, glosa });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar estado: ' + err.message });
  }
};

// ─── GET /api/dte?periodo=2026-03 ────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { periodo } = req.query;
    let query = `SELECT * FROM dte_emitidos WHERE 1=1`;
    const params = [];
    if (periodo) {
      params.push(periodo);
      query += ` AND periodo = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { emitirDTE, emitirMasivo, consultarEstadoDTE, getAll };