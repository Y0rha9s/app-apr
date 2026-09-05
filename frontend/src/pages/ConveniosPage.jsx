import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const TIPO_CONVENIO_LABEL = {
  incorporacion: 'Derecho de Incorporación',
  arranque: 'Arranque',
};

const TIPO_CONVENIO_COLOR = {
  incorporacion: 'bg-purple-100 text-purple-800',
  arranque: 'bg-cyan-100 text-cyan-800',
};

function ConveniosPage() {
  const [convenios, setConvenios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [historialUsuario, setHistorialUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [convenioExpandido, setConvenioExpandido] = useState(null);

  // Form de nuevo convenio
  const [formConvenio, setFormConvenio] = useState({
    usuario_id: '',
    tipo_convenio: 'incorporacion',
    cuota_mensual: '',
    num_cuotas: 12,
    fecha_inicio: new Date().toISOString().split('T')[0],
    notas: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [conveniosRes, usuariosRes] = await Promise.all([
        api.get('/prestamos/activos', { params: { tipo_convenio: 'incorporacion,arranque' } }),
        api.get('/usuarios')
      ]);

      setConvenios(conveniosRes.data.prestamos || []);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando convenios:', error);
      setLoading(false);
    }
  };

  const conveniosFiltrados = useMemo(() => {
    return convenios.filter((c) => {
      const coincideBusqueda = busqueda.trim() === '' ||
        c.usuario_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.usuario_rut?.toLowerCase().includes(busqueda.toLowerCase());
      const completado = c.cuotas_pagadas >= c.num_cuotas;
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'pagados' && completado) ||
        (filtroEstado === 'pendientes' && !completado);
      return coincideBusqueda && coincideEstado;
    });
  }, [convenios, busqueda, filtroEstado]);

  const handleCrearConvenio = async (e) => {
    e.preventDefault();

    if (!formConvenio.usuario_id || !formConvenio.cuota_mensual || !formConvenio.num_cuotas) {
      alert('⚠️ Debe completar usuario, cuota mensual y número de cuotas');
      return;
    }

    try {
      const response = await api.post('/prestamos/convenios/crear', formConvenio);
      alert(`✅ ${response.data.mensaje}\n\nMonto Total: $${response.data.prestamo.monto_total.toLocaleString()}\nCuotas: ${response.data.prestamo.num_cuotas}\nCuota mensual: $${response.data.prestamo.cuota_mensual.toLocaleString()}`);
      setMostrarForm(false);
      setFormConvenio({
        usuario_id: '',
        tipo_convenio: 'incorporacion',
        cuota_mensual: '',
        num_cuotas: 12,
        fecha_inicio: new Date().toISOString().split('T')[0],
        notas: ''
      });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePagarCuota = async (prestamoId) => {
    if (!window.confirm('¿Confirmar pago de cuota?')) return;

    try {
      const response = await api.post('/prestamos/pagar-cuota', { prestamo_id: prestamoId });
      alert(`✅ ${response.data.mensaje}`);
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleVerHistorial = async (usuarioId) => {
    try {
      const response = await api.get(`/prestamos/usuario/${usuarioId}`);
      setHistorialUsuario(response.data.prestamos || []);
      setUsuarioSeleccionado(usuarioId);
    } catch (error) {
      alert('❌ Error cargando historial: ' + error.message);
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const colorEstadoCuota = (estado) => {
    switch (estado) {
      case 'pagada': return 'bg-green-100 text-green-800';
      case 'vencida': return 'bg-red-100 text-red-800';
      case 'pendiente': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  const montoTotalEstimado = formConvenio.cuota_mensual && formConvenio.num_cuotas
    ? parseFloat(formConvenio.cuota_mensual) * parseInt(formConvenio.num_cuotas)
    : 0;

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-gray-800">🤝 Gestión de Convenios</h2>
        <Button variant="primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? '✖️ Cancelar' : '➕ Nuevo Convenio'}
        </Button>
      </div>

      {/* Formulario Nuevo Convenio */}
      {mostrarForm && (
        <Card className="mb-8 bg-blue-50">
          <h3 className="text-2xl font-bold mb-6 text-blue-800">Crear Nuevo Convenio</h3>
          <form onSubmit={handleCrearConvenio} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario *</label>
                <select
                  value={formConvenio.usuario_id}
                  onChange={(e) => setFormConvenio({ ...formConvenio, usuario_id: e.target.value })}
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
                <label className="block text-lg font-semibold text-gray-700 mb-2">Tipo de Convenio *</label>
                <select
                  value={formConvenio.tipo_convenio}
                  onChange={(e) => setFormConvenio({ ...formConvenio, tipo_convenio: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="incorporacion">Derecho de Incorporación</option>
                  <option value="arranque">Arranque</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Cuota Mensual *</label>
                <input
                  type="number"
                  min="1"
                  value={formConvenio.cuota_mensual}
                  onChange={(e) => setFormConvenio({ ...formConvenio, cuota_mensual: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Número de Cuotas (1-60) *</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formConvenio.num_cuotas}
                  onChange={(e) => setFormConvenio({ ...formConvenio, num_cuotas: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Fecha de Inicio *</label>
                <input
                  type="date"
                  value={formConvenio.fecha_inicio}
                  onChange={(e) => setFormConvenio({ ...formConvenio, fecha_inicio: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={formConvenio.notas}
                  onChange={(e) => setFormConvenio({ ...formConvenio, notas: e.target.value })}
                  placeholder="Observaciones sobre este convenio..."
                  rows="2"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Resumen del convenio */}
            {montoTotalEstimado > 0 && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <p className="text-base font-semibold text-green-800 mb-2">💡 Resumen del Convenio:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-700">Monto Total:</p>
                  <p className="font-bold text-green-700">{formatearMonto(montoTotalEstimado)}</p>
                  <p className="text-gray-700">Cuota Mensual:</p>
                  <p className="font-bold text-blue-700">{formatearMonto(formConvenio.cuota_mensual || 0)}</p>
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full">
              🤝 Crear Convenio
            </Button>
          </form>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Convenios Activos</h3>
          <p className="text-3xl font-bold text-blue-700">{convenios.length}</p>
          <p className="text-sm text-gray-600 mt-2">En curso</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Valor Comprometido</h3>
          <p className="text-3xl font-bold text-green-700">
            {formatearMonto(convenios.reduce((sum, c) => sum + parseFloat(c.monto_total || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Total en convenios</p>
        </Card>

        <Card className="bg-purple-50 border-l-4 border-purple-600">
          <h3 className="text-lg font-semibold text-gray-700">Cuotas Mensuales</h3>
          <p className="text-3xl font-bold text-purple-700">
            {formatearMonto(convenios.reduce((sum, c) => sum + parseFloat(c.cuota_mensual || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Ingreso mensual esperado</p>
        </Card>
      </div>

      {/* Tabla de Convenios */}
      <Card title="🤝 Convenios Activos">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar por nombre o RUT..."
            className="flex-1 px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="pagados">Pagados</option>
            <option value="pendientes">Pendientes</option>
          </select>
        </div>
        {convenios.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤝</div>
            <p className="text-2xl font-semibold text-gray-600">No hay convenios activos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold w-10"></th>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">Tipo</th>
                  <th className="p-4 text-lg font-semibold">Monto Total</th>
                  <th className="p-4 text-lg font-semibold">Cuota Mensual</th>
                  <th className="p-4 text-lg font-semibold">Progreso</th>
                  <th className="p-4 text-lg font-semibold">Saldo Pendiente</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conveniosFiltrados.map((convenio) => (
                  <>
                    <tr key={convenio.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setConvenioExpandido(
                            convenioExpandido === convenio.id ? null : convenio.id
                          )}
                          className="text-xl hover:text-blue-600"
                        >
                          {convenioExpandido === convenio.id ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-4 text-base font-semibold">
                        {convenio.usuario_nombre}
                        {convenio.sin_usuario_vinculado && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                            sin RUT
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${TIPO_CONVENIO_COLOR[convenio.tipo_convenio] || 'bg-gray-100 text-gray-700'}`}>
                          {TIPO_CONVENIO_LABEL[convenio.tipo_convenio] || convenio.tipo_convenio}
                        </span>
                      </td>
                      <td className="p-4 text-base font-bold text-gray-700">
                        {formatearMonto(convenio.monto_total)}
                      </td>
                      <td className="p-4 text-base font-bold text-blue-600">
                        {formatearMonto(convenio.cuota_mensual)}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">
                            {convenio.cuotas_pagadas}/{convenio.num_cuotas} cuotas
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(convenio.cuotas_pagadas / convenio.num_cuotas) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-base font-bold text-red-600">
                        {formatearMonto(convenio.saldo_pendiente)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handlePagarCuota(convenio.id)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                          >
                            ✅ Pagar Cuota
                          </button>
                          {convenio.usuario_id && (
                            <button
                              onClick={() => handleVerHistorial(convenio.usuario_id)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              📜 Historial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {convenioExpandido === convenio.id && (
                      <tr className="bg-gray-50 border-b">
                        <td colSpan="8" className="p-4">
                          <div className="text-sm font-semibold text-gray-600 mb-2">
                            Detalle de cuotas — {convenio.usuario_nombre}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {(convenio.cuotas || []).map((c) => (
                              <div
                                key={c.numero_cuota}
                                className="border rounded-lg p-3 bg-white shadow-sm"
                              >
                                <div className="text-xs font-semibold text-gray-500">
                                  Cuota {c.numero_cuota}
                                </div>
                                <div className="text-sm font-bold text-gray-800 mt-1">
                                  {formatearMonto(c.monto_esperado)}
                                </div>
                                {c.estado === 'pagada' && c.monto_pagado !== c.monto_esperado && (
                                  <div className="text-xs text-gray-500">
                                    Pagado: {formatearMonto(c.monto_pagado)}
                                  </div>
                                )}
                                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${colorEstadoCuota(c.estado)}`}>
                                  {c.estado}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
              <h3 className="text-2xl font-bold">📜 Historial de Financiamiento</h3>
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
                  <th className="p-3 text-base font-semibold">Tipo</th>
                  <th className="p-3 text-base font-semibold">Monto Total</th>
                  <th className="p-3 text-base font-semibold">Cuotas</th>
                  <th className="p-3 text-base font-semibold">Pagadas</th>
                  <th className="p-3 text-base font-semibold">Estado</th>
                  <th className="p-3 text-base font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {historialUsuario.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="p-3 text-sm font-semibold">
                      {h.insumo_nombre || TIPO_CONVENIO_LABEL[h.tipo_convenio] || h.tipo_convenio}
                    </td>
                    <td className="p-3 text-sm font-bold">{formatearMonto(h.monto_total)}</td>
                    <td className="p-3 text-sm">{h.num_cuotas}</td>
                    <td className="p-3 text-sm">{h.cuotas_pagadas}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${h.estado === 'activo' ? 'bg-blue-100 text-blue-800' :
                        h.estado === 'completado' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {h.estado}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{formatearFecha(h.fecha_inicio)}</td>
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

export default ConveniosPage;
