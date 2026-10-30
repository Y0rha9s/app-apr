import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';
import Card from '../components/Card';

// El umbral de corte viene del backend (UMBRAL_BOLETAS_CORTE en utils/morosidad.js).
const armarNiveles = (umbral) => [
  {
    n: 1,
    titulo: 'Nivel 1 — 1 boleta impaga',
    subtitulo: '~30 días de mora · aviso',
    color: 'yellow',
    icon: '🟡',
    etiquetaAviso: 'aviso de mora'
  },
  {
    n: 2,
    titulo: `Nivel 2 — ${umbral} o más boletas impagas`,
    subtitulo: '~60 días de mora · elegible para aviso de corte / corte',
    color: 'red',
    icon: '🔴',
    etiquetaAviso: 'aviso de corte'
  }
];

const COLOR_CLASSES = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' },
  red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800', badge: 'bg-red-100 text-red-800' }
};

function MorosidadNivelesPage() {
  const [niveles, setNiveles] = useState({ 1: [], 2: [] });
  const [umbral, setUmbral] = useState(2);
  const [loading, setLoading] = useState(true);
  const [nivelAbierto, setNivelAbierto] = useState(2);
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const response = await api.get('/morosidad/niveles');
      setNiveles(response.data.niveles || { 1: [], 2: [] });
      setUmbral(response.data.umbral_boletas_corte || 2);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando morosidad:', error);
      setLoading(false);
    }
  };

  const formatearMonto = (monto) => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(monto || 0);

  // Registra el aviso (queda en el historial del socio). El backend recalcula nivel y evita duplicados.
  const enviarAviso = async (cuerpo, clave, confirmacion) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setEnviando(clave);
    try {
      const res = await api.post('/notificaciones/avisos-mora', cuerpo, { headers: authHeaders() });
      const { creadas, duplicadas } = res.data;
      alert(
        `✅ ${creadas} aviso(s) registrado(s)` +
        (duplicadas > 0 ? `\nℹ️ ${duplicadas} ya tenía(n) este aviso y no se duplicó` : '')
      );
      cargarDatos();
    } catch (error) {
      alert('❌ ' + (error.response?.data?.error || error.message));
    } finally {
      setEnviando(null);
    }
  };

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  const NIVELES = armarNiveles(umbral);

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-2">⚠️ Morosidad por Niveles</h2>
      <p className="text-gray-600 mb-8">
        Clasificación automática según cantidad de boletas impagas, calculada al consultar (sin tareas programadas).
        Los avisos quedan registrados en el historial de notificaciones del socio.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {NIVELES.map(nv => (
          <Card key={nv.n} className={`${COLOR_CLASSES[nv.color].bg} border-l-4 ${COLOR_CLASSES[nv.color].border}`}>
            <h3 className="text-lg font-semibold text-gray-700">{nv.icon} {nv.titulo}</h3>
            <p className={`text-3xl font-bold ${COLOR_CLASSES[nv.color].text}`}>{niveles[nv.n]?.length || 0}</p>
            <p className="text-sm text-gray-600 mt-2">{nv.subtitulo}</p>
          </Card>
        ))}
      </div>

      {NIVELES.map(nv => {
        const lista = niveles[nv.n] || [];
        const pendientes = lista.filter(u => !u.aviso_enviado).length;
        return (
          <Card key={nv.n} className="mb-6">
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <button
                onClick={() => setNivelAbierto(nivelAbierto === nv.n ? null : nv.n)}
                className="flex-1 flex justify-between items-center text-left"
              >
                <h3 className="text-2xl font-bold text-gray-800">{nv.icon} {nv.titulo} ({lista.length})</h3>
                <span className="text-2xl">{nivelAbierto === nv.n ? '▲' : '▼'}</span>
              </button>
              <button
                disabled={pendientes === 0 || enviando === `nivel-${nv.n}`}
                onClick={() => enviarAviso(
                  { nivel: nv.n },
                  `nivel-${nv.n}`,
                  `¿Registrar ${nv.etiquetaAviso} a los ${pendientes} usuario(s) del nivel ${nv.n} que aún no lo tienen?`
                )}
                className="px-4 py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando === `nivel-${nv.n}` ? '⏳ Enviando...' : `📨 Enviar aviso a todos (${pendientes})`}
              </button>
            </div>

            {nivelAbierto === nv.n && (
              <div className="overflow-x-auto mt-6">
                {lista.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Sin usuarios en este nivel</p>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="p-3 text-base font-semibold">Usuario</th>
                        <th className="p-3 text-base font-semibold">RUT</th>
                        <th className="p-3 text-base font-semibold">Teléfono</th>
                        <th className="p-3 text-base font-semibold text-center">Boletas Impagas</th>
                        <th className="p-3 text-base font-semibold text-center">Días de Mora</th>
                        <th className="p-3 text-base font-semibold">Deuda Total</th>
                        <th className="p-3 text-base font-semibold">Servicio</th>
                        <th className="p-3 text-base font-semibold">Aviso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(u => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-semibold">{u.nombre}</td>
                          <td className="p-3 font-mono text-sm">{u.rut}</td>
                          <td className="p-3 text-sm">{u.telefono || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${COLOR_CLASSES[nv.color].badge}`}>
                              {u.boletas_impagas}
                            </span>
                          </td>
                          <td className="p-3 text-center">{u.dias_mora} días</td>
                          <td className="p-3 font-bold text-red-600">{formatearMonto(u.deuda_total)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.estado_servicio === 'cortado' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {u.estado_servicio === 'cortado' ? 'Cortado' : 'Activo'}
                            </span>
                          </td>
                          <td className="p-3">
                            {u.aviso_enviado ? (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">✔️ Enviado</span>
                            ) : (
                              <button
                                disabled={enviando === `u-${u.id}`}
                                onClick={() => enviarAviso({ usuario_id: u.id }, `u-${u.id}`)}
                                className="px-3 py-1 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                              >
                                {enviando === `u-${u.id}` ? '⏳' : '📨 Enviar aviso'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default MorosidadNivelesPage;
