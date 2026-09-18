import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';

const NIVELES = [
  {
    n: 1,
    titulo: 'Nivel 1 — 1 boleta impaga',
    subtitulo: '~30 días de mora · sin acción todavía',
    color: 'yellow',
    icon: '🟡'
  },
  {
    n: 2,
    titulo: 'Nivel 2 — 2 boletas impagas',
    subtitulo: '~60 días de mora · notificación de aviso',
    color: 'orange',
    icon: '🟠'
  },
  {
    n: 3,
    titulo: 'Nivel 3 — 3 o más boletas impagas',
    subtitulo: '~90 días de mora · aviso de corte',
    color: 'red',
    icon: '🔴'
  }
];

const COLOR_CLASSES = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800' },
  red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800', badge: 'bg-red-100 text-red-800' }
};

function MorosidadNivelesPage() {
  const [niveles, setNiveles] = useState({ 1: [], 2: [], 3: [] });
  const [loading, setLoading] = useState(true);
  const [nivelAbierto, setNivelAbierto] = useState(3);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const response = await api.get('/morosidad/niveles');
      setNiveles(response.data.niveles || { 1: [], 2: [], 3: [] });
      setLoading(false);
    } catch (error) {
      console.error('Error cargando morosidad:', error);
      setLoading(false);
    }
  };

  const formatearMonto = (monto) => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(monto || 0);

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-2">⚠️ Morosidad por Niveles</h2>
      <p className="text-gray-600 mb-8">
        Clasificación automática según cantidad de boletas impagas, calculada al consultar (sin tareas programadas).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {NIVELES.map(nv => (
          <Card key={nv.n} className={`${COLOR_CLASSES[nv.color].bg} border-l-4 ${COLOR_CLASSES[nv.color].border}`}>
            <h3 className="text-lg font-semibold text-gray-700">{nv.icon} {nv.titulo}</h3>
            <p className={`text-3xl font-bold ${COLOR_CLASSES[nv.color].text}`}>{niveles[nv.n]?.length || 0}</p>
            <p className="text-sm text-gray-600 mt-2">{nv.subtitulo}</p>
          </Card>
        ))}
      </div>

      {NIVELES.map(nv => (
        <Card key={nv.n} className="mb-6">
          <button
            onClick={() => setNivelAbierto(nivelAbierto === nv.n ? null : nv.n)}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-2xl font-bold text-gray-800">{nv.icon} {nv.titulo} ({niveles[nv.n]?.length || 0})</h3>
            <span className="text-2xl">{nivelAbierto === nv.n ? '▲' : '▼'}</span>
          </button>

          {nivelAbierto === nv.n && (
            <div className="overflow-x-auto mt-6">
              {(niveles[nv.n] || []).length === 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {niveles[nv.n].map(u => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default MorosidadNivelesPage;
