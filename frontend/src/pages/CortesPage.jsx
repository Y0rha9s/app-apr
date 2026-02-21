import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function CortesPage() {
  const [usuariosCortados, setUsuariosCortados] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormCorte, setMostrarFormCorte] = useState(false);
  const [historialUsuario, setHistorialUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // Form de nuevo corte
  const [formCorte, setFormCorte] = useState({
    usuario_id: '',
    motivo: '',
    monto_corte: 15000
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [cortadosRes, usuariosRes] = await Promise.all([
        api.get('/cortes/usuarios-cortados'),
        api.get('/usuarios')
      ]);

      setUsuariosCortados(cortadosRes.data.cortados || []);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const handleRegistrarCorte = async (e) => {
    e.preventDefault();

    if (!formCorte.usuario_id) {
      alert('⚠️ Debe seleccionar un usuario');
      return;
    }

    try {
      await api.post('/cortes/registrar-corte', formCorte);
      alert('✅ Corte registrado exitosamente');
      setMostrarFormCorte(false);
      setFormCorte({ usuario_id: '', motivo: '', monto_corte: 15000 });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRegistrarReposicion = async (usuarioId) => {
    if (!window.confirm('¿Está seguro de registrar la reposición del servicio?')) return;

    try {
      await api.post('/cortes/registrar-reposicion', { usuario_id: usuarioId });
      alert('✅ Reposición registrada exitosamente');
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleVerHistorial = async (usuarioId) => {
    try {
      const response = await api.get(`/cortes/historial/${usuarioId}`);
      setHistorialUsuario(response.data.historial || []);
      setUsuarioSeleccionado(usuarioId);
    } catch (error) {
      alert('❌ Error cargando historial: ' + error.message);
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-gray-800">🚫 Gestión de Cortes y Reposiciones</h2>
        <Button variant="danger" onClick={() => setMostrarFormCorte(!mostrarFormCorte)}>
          {mostrarFormCorte ? '✖️ Cancelar' : '➕ Registrar Corte'}
        </Button>
      </div>

      {/* Formulario Nuevo Corte */}
      {mostrarFormCorte && (
        <Card className="mb-8 bg-red-50">
          <h3 className="text-2xl font-bold mb-6 text-red-800">Registrar Nuevo Corte</h3>
          <form onSubmit={handleRegistrarCorte} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario *</label>
                <select
                  value={formCorte.usuario_id}
                  onChange={(e) => setFormCorte({ ...formCorte, usuario_id: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                  required
                >
                  <option value="">-- Seleccione usuario --</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.rut})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Monto Corte</label>
                <input
                  type="number"
                  value={formCorte.monto_corte}
                  onChange={(e) => setFormCorte({ ...formCorte, monto_corte: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Motivo</label>
                <textarea
                  value={formCorte.motivo}
                  onChange={(e) => setFormCorte({ ...formCorte, motivo: e.target.value })}
                  placeholder="Ej: Morosidad superior a 60 días"
                  rows="3"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <Button type="submit" variant="danger" className="w-full">
              🚫 Registrar Corte de Servicio
            </Button>
          </form>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700">Usuarios Cortados</h3>
          <p className="text-3xl font-bold text-red-700">{usuariosCortados.length}</p>
          <p className="text-sm text-gray-600 mt-2">Servicios suspendidos actualmente</p>
        </Card>

        <Card className="bg-yellow-50 border-l-4 border-yellow-600">
          <h3 className="text-lg font-semibold text-gray-700">Cobros Pendientes</h3>
          <p className="text-3xl font-bold text-yellow-700">
            {formatearMonto(usuariosCortados.reduce((sum, u) => sum + (parseFloat(u.monto_corte) || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Por cortes activos</p>
        </Card>

        <Card className="bg-orange-50 border-l-4 border-orange-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio Días Cortado</h3>
          <p className="text-3xl font-bold text-orange-700">
            {usuariosCortados.length > 0
              ? Math.round(usuariosCortados.reduce((sum, u) => sum + (u.dias_cortado || 0), 0) / usuariosCortados.length)
              : 0} días
          </p>
          <p className="text-sm text-gray-600 mt-2">Tiempo promedio</p>
        </Card>
      </div>

      {/* Tabla de Usuarios Cortados */}
      <Card title="🚫 Usuarios con Servicio Cortado">
        {usuariosCortados.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-2xl font-semibold text-gray-600">No hay usuarios cortados actualmente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">RUT</th>
                  <th className="p-4 text-lg font-semibold">Dirección</th>
                  <th className="p-4 text-lg font-semibold">Fecha Corte</th>
                  <th className="p-4 text-lg font-semibold">Días Cortado</th>
                  <th className="p-4 text-lg font-semibold">Motivo</th>
                  <th className="p-4 text-lg font-semibold">Monto Corte</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosCortados.map((corte) => (
                  <tr key={corte.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">{corte.nombre}</td>
                    <td className="p-4 text-base font-mono">{corte.rut}</td>
                    <td className="p-4 text-base">{corte.direccion || '-'}</td>
                    <td className="p-4 text-base">{formatearFecha(corte.fecha_corte)}</td>
                    <td className="p-4 text-base">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${corte.dias_cortado > 30 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {corte.dias_cortado} días
                      </span>
                    </td>
                    <td className="p-4 text-base">{corte.motivo || '-'}</td>
                    <td className="p-4 text-base font-bold text-red-600">
                      {formatearMonto(corte.monto_corte)}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleRegistrarReposicion(corte.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          ✅ Reponer
                        </button>
                        <button
                          onClick={() => handleVerHistorial(corte.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          📜 Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Historial */}
      {usuarioSeleccionado && historialUsuario.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">📜 Historial de Cortes</h3>
              <button
                onClick={() => {
                  setUsuarioSeleccionado(null);
                  setHistorialUsuario([]);
                }}
                className="text-3xl hover:text-red-600"
              >
                ✖️
              </button>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-base font-semibold">Fecha Corte</th>
                  <th className="p-3 text-base font-semibold">Fecha Reposición</th>
                  <th className="p-3 text-base font-semibold">Monto Corte</th>
                  <th className="p-3 text-base font-semibold">Monto Reposición</th>
                  <th className="p-3 text-base font-semibold">Estado</th>
                  <th className="p-3 text-base font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historialUsuario.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="p-3 text-sm">{formatearFecha(h.fecha_corte)}</td>
                    <td className="p-3 text-sm">{h.fecha_reposicion ? formatearFecha(h.fecha_reposicion) : '-'}</td>
                    <td className="p-3 text-sm font-bold text-red-600">{formatearMonto(h.monto_corte)}</td>
                    <td className="p-3 text-sm font-bold text-green-600">
                      {h.monto_reposicion ? formatearMonto(h.monto_reposicion) : '-'}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${h.estado === 'repuesto' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {h.estado}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{h.motivo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default CortesPage;