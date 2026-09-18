import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function MultasPage() {
  const [multas, setMultas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('activa');
  const [mostrarFormMulta, setMostrarFormMulta] = useState(false);
  const [mostrarFormTipo, setMostrarFormTipo] = useState(false);
  const [mostrarTipos, setMostrarTipos] = useState(false);

  const [formMulta, setFormMulta] = useState({
    usuario_id: '',
    tipo_multa_id: '',
    monto: '',
    motivo: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [formTipo, setFormTipo] = useState({ nombre: '', monto_sugerido: '' });

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado]);

  const cargarDatos = async () => {
    try {
      const [multasRes, tiposRes, usuariosRes] = await Promise.all([
        api.get('/multas', { params: filtroEstado !== 'todas' ? { estado: filtroEstado } : {} }),
        api.get('/multas/tipos'),
        api.get('/usuarios')
      ]);
      setMultas(multasRes.data.multas || []);
      setTipos(tiposRes.data.tipos || []);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando multas:', error);
      setLoading(false);
    }
  };

  const handleSeleccionarTipo = (tipoId) => {
    const tipo = tipos.find(t => t.id === parseInt(tipoId));
    setFormMulta(prev => ({
      ...prev,
      tipo_multa_id: tipoId,
      monto: tipo?.monto_sugerido ? tipo.monto_sugerido : prev.monto
    }));
  };

  const handleCrearMulta = async (e) => {
    e.preventDefault();
    if (!formMulta.usuario_id || !formMulta.monto) {
      alert('⚠️ Debe seleccionar usuario e ingresar el monto');
      return;
    }
    try {
      const response = await api.post('/multas', formMulta);
      alert(`✅ ${response.data.mensaje}`);
      setMostrarFormMulta(false);
      setFormMulta({ usuario_id: '', tipo_multa_id: '', monto: '', motivo: '', fecha: new Date().toISOString().split('T')[0] });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCrearTipo = async (e) => {
    e.preventDefault();
    if (!formTipo.nombre) {
      alert('⚠️ Debe ingresar un nombre');
      return;
    }
    try {
      await api.post('/multas/tipos', formTipo);
      alert('✅ Tipo de multa creado');
      setFormTipo({ nombre: '', monto_sugerido: '' });
      setMostrarFormTipo(false);
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleToggleTipoActivo = async (tipo) => {
    try {
      await api.put(`/multas/tipos/${tipo.id}`, { activo: !tipo.activo });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAnularMulta = async (multa) => {
    const motivo = window.prompt('Motivo de la anulación (opcional):');
    if (motivo === null) return;
    if (!window.confirm('¿Anular esta multa?')) return;

    try {
      const response = await api.post(`/multas/${multa.id}/anular`, { motivo });
      alert(`✅ ${response.data.mensaje}`);
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatearMonto = (monto) => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(monto || 0);

  const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CL');

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <h2 className="text-4xl font-bold text-gray-800">🚨 Gestión de Multas</h2>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={() => setMostrarFormTipo(!mostrarFormTipo)}>
            {mostrarFormTipo ? '✖️ Cancelar' : '🏷️ Nuevo Tipo'}
          </Button>
          <Button variant="primary" onClick={() => setMostrarFormMulta(!mostrarFormMulta)}>
            {mostrarFormMulta ? '✖️ Cancelar' : '➕ Nueva Multa'}
          </Button>
        </div>
      </div>

      {/* Formulario Nuevo Tipo de Multa */}
      {mostrarFormTipo && (
        <Card className="mb-8 bg-purple-50">
          <h3 className="text-2xl font-bold mb-6 text-purple-800">Nuevo Tipo de Multa</h3>
          <form onSubmit={handleCrearTipo} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Nombre *</label>
              <input
                type="text"
                value={formTipo.nombre}
                onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })}
                placeholder="Ej: Daño a medidor"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Monto Sugerido</label>
              <input
                type="number" min="0"
                value={formTipo.monto_sugerido}
                onChange={(e) => setFormTipo({ ...formTipo, monto_sugerido: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary" className="w-full">🏷️ Crear Tipo de Multa</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Formulario Nueva Multa */}
      {mostrarFormMulta && (
        <Card className="mb-8 bg-red-50">
          <h3 className="text-2xl font-bold mb-6 text-red-800">Registrar Nueva Multa</h3>
          <form onSubmit={handleCrearMulta} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario *</label>
                <select
                  value={formMulta.usuario_id}
                  onChange={(e) => setFormMulta({ ...formMulta, usuario_id: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                  required
                >
                  <option value="">-- Seleccione usuario --</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.rut})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Tipo de Multa</label>
                <select
                  value={formMulta.tipo_multa_id}
                  onChange={(e) => handleSeleccionarTipo(e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Sin tipo específico --</option>
                  {tipos.filter(t => t.activo).map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Monto *</label>
                <input
                  type="number" min="1"
                  value={formMulta.monto}
                  onChange={(e) => setFormMulta({ ...formMulta, monto: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Fecha *</label>
                <input
                  type="date"
                  value={formMulta.fecha}
                  onChange={(e) => setFormMulta({ ...formMulta, fecha: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Motivo</label>
                <textarea
                  value={formMulta.motivo}
                  onChange={(e) => setFormMulta({ ...formMulta, motivo: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-800">
              📅 Si la fecha es antes del día 20 del mes, la multa se cobra en la boleta de ese mismo mes.
              Si es el 20 o después, se cobra en la boleta del mes siguiente.
            </div>

            <Button type="submit" variant="danger" className="w-full">🚨 Registrar Multa</Button>
          </form>
        </Card>
      )}

      {/* Catálogo de Tipos */}
      <Card className="mb-8">
        <button onClick={() => setMostrarTipos(!mostrarTipos)} className="w-full flex justify-between items-center text-left">
          <h3 className="text-2xl font-bold text-gray-800">🏷️ Tipos de Multa</h3>
          <span className="text-2xl">{mostrarTipos ? '▲' : '▼'}</span>
        </button>
        {mostrarTipos && (
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-3 text-base font-semibold">Nombre</th>
                  <th className="p-3 text-base font-semibold">Monto Sugerido</th>
                  <th className="p-3 text-base font-semibold">Estado</th>
                  <th className="p-3 text-base font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold">{t.nombre}</td>
                    <td className="p-3">{formatearMonto(t.monto_sugerido)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleToggleTipoActivo(t)} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                        {t.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {tipos.length === 0 && (
                  <tr><td colSpan="4" className="p-6 text-center text-gray-500">No hay tipos de multa creados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Listado de Multas */}
      <Card title="🚨 Multas">
        <div className="mb-6">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
          >
            <option value="activa">Activas</option>
            <option value="anulada">Anuladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>

        {multas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-2xl font-semibold text-gray-600">No hay multas en este filtro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">Tipo</th>
                  <th className="p-4 text-lg font-semibold">Monto</th>
                  <th className="p-4 text-lg font-semibold">Fecha</th>
                  <th className="p-4 text-lg font-semibold">Período Destino</th>
                  <th className="p-4 text-lg font-semibold">Boleta</th>
                  <th className="p-4 text-lg font-semibold">Estado</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {multas.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-semibold">{m.usuario_nombre}</td>
                    <td className="p-4">{m.tipo_nombre || 'Sin tipo'}</td>
                    <td className="p-4 font-bold text-red-600">{formatearMonto(m.monto)}</td>
                    <td className="p-4">{formatearFecha(m.fecha)}</td>
                    <td className="p-4 font-mono text-sm">{m.periodo_destino}</td>
                    <td className="p-4 text-sm">
                      {m.boleta_id
                        ? <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Cobrada ({m.boleta_periodo})</span>
                        : <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Pendiente</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.estado === 'activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.estado}
                      </span>
                    </td>
                    <td className="p-4">
                      {m.estado === 'activa' && (
                        <button onClick={() => handleAnularMulta(m)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                          🚫 Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default MultasPage;
