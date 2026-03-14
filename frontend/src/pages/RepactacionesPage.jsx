import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function RepactacionesPage() {
  const [repactacionesActivas, setRepactacionesActivas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [historialUsuario, setHistorialUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // Form de nueva repactación
  const [formRepactacion, setFormRepactacion] = useState({
    usuario_id: '',
    num_cuotas: 3,
    notas: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [repactacionesRes, usuariosRes] = await Promise.all([
        api.get('/repactaciones/activas'),
        api.get('/usuarios')
      ]);
      
      setRepactacionesActivas(repactacionesRes.data.repactaciones || []);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const handleCrearRepactacion = async (e) => {
    e.preventDefault();
    
    if (!formRepactacion.usuario_id) {
      alert('⚠️ Debe seleccionar un usuario');
      return;
    }

    try {
      const response = await api.post('/repactaciones/crear', formRepactacion);
      alert(`✅ ${response.data.mensaje}\n\nDeuda: $${response.data.repactacion.monto_original.toLocaleString()}\nCuotas: ${response.data.repactacion.num_cuotas}\nCuota mensual: $${response.data.repactacion.cuota_mensual.toLocaleString()}`);
      setMostrarFormulario(false);
      setFormRepactacion({ usuario_id: '', num_cuotas: 3, notas: '' });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePagarCuota = async (repactacionId) => {
    if (!window.confirm('¿Confirmar pago de cuota?')) return;

    try {
      const response = await api.post('/repactaciones/pagar-cuota', { repactacion_id: repactacionId });
      alert(`✅ ${response.data.mensaje}`);
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleMarcarIncumplida = async (repactacionId) => {
    if (!window.confirm('⚠️ ¿Está seguro de marcar esta repactación como incumplida?\n\nEsto programará el corte del servicio.')) return;

    try {
      const response = await api.post('/repactaciones/marcar-incumplida', { repactacion_id: repactacionId });
      alert(`✅ ${response.data.mensaje}`);
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleVerHistorial = async (usuarioId) => {
    try {
      const response = await api.get(`/repactaciones/usuario/${usuarioId}`);
      setHistorialUsuario(response.data.repactaciones || []);
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
        <h2 className="text-4xl font-bold text-gray-800">💳 Gestión de Repactaciones</h2>
        <Button variant="primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
          {mostrarFormulario ? '✖️ Cancelar' : '➕ Nueva Repactación'}
        </Button>
      </div>

      {/* Formulario Nueva Repactación */}
      {mostrarFormulario && (
        <Card className="mb-8 bg-blue-50">
          <h3 className="text-2xl font-bold mb-6 text-blue-800">Crear Nueva Repactación</h3>
          <form onSubmit={handleCrearRepactacion} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario con Deuda *</label>
                <select
                  value={formRepactacion.usuario_id}
                  onChange={(e) => setFormRepactacion({...formRepactacion, usuario_id: e.target.value})}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
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
                <label className="block text-lg font-semibold text-gray-700 mb-2">Número de Cuotas (1-6) *</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={formRepactacion.num_cuotas}
                  onChange={(e) => setFormRepactacion({...formRepactacion, num_cuotas: e.target.value})}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-sm text-gray-600 mt-1">Máximo 6 cuotas permitidas</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={formRepactacion.notas}
                  onChange={(e) => setFormRepactacion({...formRepactacion, notas: e.target.value})}
                  placeholder="Observaciones sobre esta repactación..."
                  rows="3"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <p className="text-base font-semibold text-yellow-800">ℹ️ Información importante:</p>
              <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                <li>Se calculará automáticamente la cuota mensual según la deuda total</li>
                <li>Las cuotas se agregarán automáticamente a las boletas mensuales</li>
                <li>El incumplimiento de pago puede resultar en corte de servicio</li>
              </ul>
            </div>

            <Button type="submit" variant="primary" className="w-full">
              💳 Crear Repactación
            </Button>
          </form>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Repactaciones Activas</h3>
          <p className="text-3xl font-bold text-blue-700">{repactacionesActivas.length}</p>
          <p className="text-sm text-gray-600 mt-2">Usuarios con plan de pago</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Deuda Repactada</h3>
          <p className="text-3xl font-bold text-green-700">
            {formatearMonto(repactacionesActivas.reduce((sum, r) => sum + parseFloat(r.monto_original || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Total en planes de pago</p>
        </Card>

        <Card className="bg-purple-50 border-l-4 border-purple-600">
          <h3 className="text-lg font-semibold text-gray-700">Cuotas Mensuales</h3>
          <p className="text-3xl font-bold text-purple-700">
            {formatearMonto(repactacionesActivas.reduce((sum, r) => sum + parseFloat(r.cuota_mensual || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Ingreso mensual esperado</p>
        </Card>
      </div>

      {/* Tabla de Repactaciones Activas */}
      <Card title="💳 Repactaciones Activas">
        {repactacionesActivas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-2xl font-semibold text-gray-600">No hay repactaciones activas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">RUT</th>
                  <th className="p-4 text-lg font-semibold">Deuda Original</th>
                  <th className="p-4 text-lg font-semibold">Cuota Mensual</th>
                  <th className="p-4 text-lg font-semibold">Progreso</th>
                  <th className="p-4 text-lg font-semibold">Saldo Pendiente</th>
                  <th className="p-4 text-lg font-semibold">Fecha Inicio</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {repactacionesActivas.map((rep) => (
                  <tr key={rep.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">{rep.usuario_nombre}</td>
                    <td className="p-4 text-base font-mono">{rep.usuario_rut}</td>
                    <td className="p-4 text-base font-bold text-gray-700">
                      {formatearMonto(rep.monto_original)}
                    </td>
                    <td className="p-4 text-base font-bold text-blue-600">
                      {formatearMonto(rep.cuota_mensual)}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">
                          {rep.cuotas_pagadas}/{rep.num_cuotas} cuotas
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${(rep.cuotas_pagadas / rep.num_cuotas) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-base font-bold text-red-600">
                      {formatearMonto(rep.saldo_pendiente)}
                    </td>
                    <td className="p-4 text-base">{formatearFecha(rep.fecha_inicio)}</td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handlePagarCuota(rep.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          ✅ Pagar Cuota
                        </button>
                        <button
                          onClick={() => handleVerHistorial(rep.usuario_id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          📜 Historial
                        </button>
                        <button
                          onClick={() => handleMarcarIncumplida(rep.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          ⚠️ Incumplida
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
              <h3 className="text-2xl font-bold">📜 Historial de Repactaciones</h3>
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
                  <th className="p-3 text-base font-semibold">Fecha Inicio</th>
                  <th className="p-3 text-base font-semibold">Monto Original</th>
                  <th className="p-3 text-base font-semibold">Cuotas</th>
                  <th className="p-3 text-base font-semibold">Pagadas</th>
                  <th className="p-3 text-base font-semibold">Estado</th>
                  <th className="p-3 text-base font-semibold">Fecha Fin</th>
                </tr>
              </thead>
              <tbody>
                {historialUsuario.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="p-3 text-sm">{formatearFecha(h.fecha_inicio)}</td>
                    <td className="p-3 text-sm font-bold">{formatearMonto(h.monto_original)}</td>
                    <td className="p-3 text-sm">{h.num_cuotas}</td>
                    <td className="p-3 text-sm">{h.cuotas_pagadas}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        h.estado === 'activa' ? 'bg-blue-100 text-blue-800' :
                        h.estado === 'completada' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {h.estado}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{h.fecha_fin ? formatearFecha(h.fecha_fin) : '-'}</td>
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

export default RepactacionesPage;