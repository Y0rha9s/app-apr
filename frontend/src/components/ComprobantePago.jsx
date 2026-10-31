import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';

const ESTILOS = `
  .recibo { background:#fff; border:2px solid #1d4f91; padding:18px 22px; font-family:Arial,Helvetica,sans-serif;
            color:#1e3a5f; width:100%; max-width:780px; margin:0 auto; box-sizing:border-box; }
  .recibo-cab { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .recibo-titulo { font-weight:bold; font-size:17px; line-height:1.3; text-align:center; }
  .recibo-titulo small { display:block; font-size:15px; }
  .recibo-sub { font-weight:bold; font-size:22px; text-decoration:underline; margin-top:8px; text-align:center; }
  .recibo-num { color:#d9531e; font-size:26px; font-weight:bold; white-space:nowrap; text-align:right; }
  .recibo-fecha { display:grid; grid-template-columns:repeat(3,1fr); border:2px solid #1d4f91; width:240px; text-align:center; margin-top:8px; margin-left:auto; }
  .recibo-fecha > div { border-left:1px solid #1d4f91; }
  .recibo-fecha > div:first-child { border-left:0; }
  .recibo-fecha .rot { font-size:10px; font-weight:bold; border-bottom:1px solid #1d4f91; padding:2px 0; }
  .recibo-fecha .val { font-size:20px; font-weight:bold; padding:6px 0; color:#111; }
  .recibo-cuerpo { border:2px solid #1d4f91; background:#cfe4f1; margin-top:12px; }
  .recibo-fila { display:flex; border-bottom:1px solid #1d4f91; min-height:48px; }
  .recibo-etiq { background:#fff; width:150px; flex-shrink:0; font-weight:bold; padding:8px 10px; border-right:2px solid #1d4f91; display:flex; align-items:center; font-size:15px; }
  .recibo-valor { flex:1; padding:8px 12px; display:flex; align-items:center; font-size:17px; color:#111; }
  .recibo-valor small { font-size:12px; color:#355; }
  .recibo-forma { font-weight:bold; letter-spacing:1px; text-transform:uppercase; }
  .recibo-pie { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; padding:14px; }
  .recibo-timbre { width:110px; height:90px; background:#fff; border:2px solid #1d4f91; flex-shrink:0; }
  .recibo-monto { border:2px solid #1d4f91; background:#fff; font-size:30px; font-weight:bold; padding:8px 16px; min-width:230px; color:#111; }
  .recibo-firma { flex:1; border-top:1px solid #1d4f91; text-align:center; font-size:11px; padding-top:4px; margin-bottom:8px; }
  .recibo-nota { font-size:11px; text-align:center; margin-top:8px; color:#456; }
  @media print {
    body * { visibility: hidden; }
    #recibo-imprimible, #recibo-imprimible * { visibility: visible; }
    #recibo-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
    .recibo, .recibo * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-imprimir { display: none !important; }
  }
`;

// Comprobante de pago ("recibo de dinero") imprimible. El backend entrega los datos ya armados
// (monto en palabras, concepto, forma de pago); si el recibo fue respaldado, es la copia exacta
// que se guardó al registrar el pago.
function ComprobantePago({ pagoId, titulo = '🧾 Comprobante de pago', onClose }) {
  const [comprobante, setComprobante] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/pagos/${pagoId}/comprobante`, { headers: authHeaders() })
      .then((res) => setComprobante(res.data.comprobante))
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar el comprobante'));
  }, [pagoId]);

  const c = comprobante;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto p-4" onClick={onClose}>
      <style>{ESTILOS}</style>
      <div className="max-w-3xl mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="no-imprimir bg-white rounded-xl p-4 mb-4 flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">{titulo}</h3>
            {c && (
              <p className={`text-sm font-semibold ${c.respaldado ? 'text-green-700' : 'text-gray-500'}`}>
                {c.respaldado ? '✔️ Respaldado en el sistema' : 'Generado en este momento (sin copia de respaldo)'}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              disabled={!c}
              className="px-5 py-3 text-lg font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              🖨️ Imprimir comprobante
            </button>
            <button onClick={onClose} className="px-5 py-3 text-lg font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">
              Cerrar
            </button>
          </div>
        </div>

        {!c && !error && <div className="bg-white rounded-xl p-8 text-center text-xl">⏳ Cargando comprobante...</div>}
        {error && <div className="bg-white rounded-xl p-8 text-center text-xl text-red-600 font-semibold">⚠️ {error}</div>}

        {c && (
          <div id="recibo-imprimible" className="recibo">
            <div className="recibo-cab">
              <div style={{ flex: 1 }}>
                <div className="recibo-titulo">
                  COMITÉ DE AGUA POTABLE
                  <small>SANTA FILOMENA PEDREGOSO</small>
                  <small>RUT: 71.810.200-6</small>
                </div>
                <div className="recibo-sub">RECIBO DE DINERO</div>
              </div>
              <div>
                <div className="recibo-num">N° {c.numero}</div>
                <div className="recibo-fecha">
                  <div><div className="rot">DÍA</div><div className="val">{c.dia}</div></div>
                  <div><div className="rot">MES</div><div className="val">{c.mes}</div></div>
                  <div><div className="rot">AÑO</div><div className="val">{c.anio}</div></div>
                </div>
              </div>
            </div>

            <div className="recibo-cuerpo">
              <div className="recibo-fila">
                <div className="recibo-etiq">RECIBÍ DE:</div>
                <div className="recibo-valor">
                  <div>
                    {c.nombre}
                    <small style={{ display: 'block' }}>
                      RUT {c.rut}{c.numero_cliente ? ` · N° cliente ${c.numero_cliente}` : ''}
                    </small>
                  </div>
                </div>
              </div>
              <div className="recibo-fila">
                <div className="recibo-etiq">LA SUMA DE:</div>
                <div className="recibo-valor">{c.monto_palabras}</div>
              </div>
              <div className="recibo-fila">
                <div className="recibo-etiq">CUENTA DE:</div>
                <div className="recibo-valor">{c.concepto}</div>
              </div>
              <div className="recibo-fila">
                <div className="recibo-etiq">FORMA DE PAGO:</div>
                <div className="recibo-valor recibo-forma">{c.forma_pago_etiqueta}</div>
              </div>
              {c.observaciones && (
                <div className="recibo-fila">
                  <div className="recibo-etiq">DETALLE:</div>
                  <div className="recibo-valor" style={{ fontSize: 15 }}>{c.observaciones}</div>
                </div>
              )}
              <div className="recibo-pie" style={{ borderTop: '1px solid #1d4f91' }}>
                <div className="recibo-timbre" />
                <div className="recibo-monto">$ {new Intl.NumberFormat('es-CL').format(c.monto)}</div>
                <div className="recibo-firma">
                  FIRMA
                  {c.recibido_por && <div>Recibido por: {c.recibido_por}</div>}
                </div>
              </div>
            </div>
            <div className="recibo-nota">Emitido el {c.fecha_hora} (hora de Chile) · Comprobante interno de pago</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ComprobantePago;
