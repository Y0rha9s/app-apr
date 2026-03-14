import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function AvisosPage() {
  const [morosos, setMorosos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diasMinimos, setDiasMinimos] = useState(60);
  const [mostrarEditorPlantilla, setMostrarEditorPlantilla] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Form editar plantilla
  const [formPlantilla, setFormPlantilla] = useState({
    asunto: '',
    contenido: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [diasMinimos]);

  const cargarDatos = async () => {
    try {
      const [morososRes, plantillasRes] = await Promise.all([
        api.get(`/avisos/morosos-para-avisos?dias_minimos=${diasMinimos}`),
        api.get('/avisos/plantillas')
      ]);

      setMorosos(morososRes.data.morosos || []);
      setPlantillas(plantillasRes.data.plantillas || []);

      if (plantillasRes.data.plantillas.length > 0 && !plantillaSeleccionada) {
        setPlantillaSeleccionada(plantillasRes.data.plantillas[0].id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      const response = await api.get('/avisos/historial');
      setHistorial(response.data.historial || []);
      setMostrarHistorial(true);
    } catch (error) {
      alert('❌ Error cargando historial: ' + error.message);
    }
  };

  const handleSeleccionarTodos = (e) => {
    if (e.target.checked) {
      setUsuariosSeleccionados(morosos.map(m => m.id));
    } else {
      setUsuariosSeleccionados([]);
    }
  };

  const handleSeleccionarUsuario = (usuarioId) => {
    if (usuariosSeleccionados.includes(usuarioId)) {
      setUsuariosSeleccionados(usuariosSeleccionados.filter(id => id !== usuarioId));
    } else {
      setUsuariosSeleccionados([...usuariosSeleccionados, usuarioId]);
    }
  };

  const handleGenerarIndividual = async (usuarioId) => {
    try {
      window.open(
        `${api.defaults.baseURL}/avisos/generar-pdf/${usuarioId}?plantilla_id=${plantillaSeleccionada}`,
        '_blank'
      );
      alert('✅ PDF generado correctamente');
    } catch (error) {
      alert('❌ Error generando PDF: ' + error.message);
    }
  };

  const handleGenerarMasivo = async () => {
    if (usuariosSeleccionados.length === 0) {
      alert('⚠️ Debe seleccionar al menos un usuario');
      return;
    }

    if (!window.confirm(`¿Generar ${usuariosSeleccionados.length} avisos de corte en un archivo ZIP?`)) return;

    try {
      const response = await api.post('/avisos/generar-masivo', {
        usuario_ids: usuariosSeleccionados,
        plantilla_id: plantillaSeleccionada
      }, {
        responseType: 'blob'
      });

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `avisos_masivos_${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(`✅ ZIP con ${usuariosSeleccionados.length} avisos descargado correctamente`);
      setUsuariosSeleccionados([]);
    } catch (error) {
      alert('❌ Error generando avisos masivos: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditarPlantilla = () => {
    const plantilla = plantillas.find(p => p.id === plantillaSeleccionada);
    if (plantilla) {
      setFormPlantilla({
        asunto: plantilla.asunto,
        contenido: plantilla.contenido
      });
      setMostrarEditorPlantilla(true);
    }
  };

  const handleGuardarPlantilla = async (e) => {
    e.preventDefault();

    try {
      await api.put(`/avisos/plantillas/${plantillaSeleccionada}`, formPlantilla);
      alert('✅ Plantilla actualizada correctamente');
      setMostrarEditorPlantilla(false);
      cargarDatos();
    } catch (error) {
      alert('❌ Error actualizando plantilla: ' + error.message);
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
        <h2 className="text-4xl font-bold text-gray-800">📄 Avisos Masivos de Corte</h2>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={cargarHistorial}>
            📜 Ver Historial
          </Button>
          <Button variant="primary" onClick={handleEditarPlantilla}>
            ✏️ Editar Plantilla
          </Button>
        </div>
      </div>

      {/* Editor de Plantilla */}
      {mostrarEditorPlantilla && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">✏️ Editar Plantilla de Aviso</h3>
              <button
                onClick={() => setMostrarEditorPlantilla(false)}
                className="text-3xl hover:text-red-600"
              >
                ✖️
              </button>
            </div>

            <form onSubmit={handleGuardarPlantilla} className="space-y-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Asunto/Título</label>
                <input
                  type="text"
                  value={formPlantilla.asunto}
                  onChange={(e) => setFormPlantilla({ ...formPlantilla, asunto: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Contenido del Aviso</label>
                <p className="text-sm text-gray-600 mb-2">
                  Variables disponibles: {'{nombre_cliente}'}, {'{rut_cliente}'}, {'{dias_morosidad}'}, {'{fecha_corte}'}, {'{fecha_notificacion}'}, {'{deuda_total}'}
                </p>
                <textarea
                  value={formPlantilla.contenido}
                  onChange={(e) => setFormPlantilla({ ...formPlantilla, contenido: e.target.value })}
                  rows="15"
                  className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" variant="success" className="flex-1">
                  ✅ Guardar Cambios
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setMostrarEditorPlantilla(false)}
                  className="flex-1"
                >
                  ❌ Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Historial */}
      {mostrarHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">📜 Historial de Avisos Generados</h3>
              <button
                onClick={() => setMostrarHistorial(false)}
                className="text-3xl hover:text-red-600"
              >
                ✖️
              </button>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-base font-semibold">Fecha</th>
                  <th className="p-3 text-base font-semibold">Usuario</th>
                  <th className="p-3 text-base font-semibold">RUT</th>
                  <th className="p-3 text-base font-semibold">Días Morosidad</th>
                  <th className="p-3 text-base font-semibold">Fecha Corte</th>
                  <th className="p-3 text-base font-semibold">Plantilla</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="p-3 text-sm">{formatearFecha(h.fecha_generacion)}</td>
                    <td className="p-3 text-sm font-semibold">{h.usuario_nombre}</td>
                    <td className="p-3 text-sm font-mono">{h.usuario_rut}</td>
                    <td className="p-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        {h.dias_morosidad} días
                      </span>
                    </td>
                    <td className="p-3 text-sm">{formatearFecha(h.fecha_corte)}</td>
                    <td className="p-3 text-sm">{h.plantilla_nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Días Mínimos de Morosidad
            </label>
            <select
              value={diasMinimos}
              onChange={(e) => setDiasMinimos(parseInt(e.target.value))}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option value="30">30+ días</option>
              <option value="60">60+ días</option>
              <option value="90">90+ días</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Plantilla de Aviso
            </label>
            <select
              value={plantillaSeleccionada || ''}
              onChange={(e) => setPlantillaSeleccionada(parseInt(e.target.value))}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            >
              {plantillas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700">Usuarios Morosos</h3>
          <p className="text-3xl font-bold text-red-700">{morosos.length}</p>
          <p className="text-sm text-gray-600 mt-2">{diasMinimos}+ días de mora</p>
        </Card>

        <Card className="bg-orange-50 border-l-4 border-orange-600">
          <h3 className="text-lg font-semibold text-gray-700">Seleccionados</h3>
          <p className="text-3xl font-bold text-orange-700">{usuariosSeleccionados.length}</p>
          <p className="text-sm text-gray-600 mt-2">Para generar avisos</p>
        </Card>

        <Card className="bg-yellow-50 border-l-4 border-yellow-600">
          <h3 className="text-lg font-semibold text-gray-700">Deuda Total</h3>
          <p className="text-3xl font-bold text-yellow-700">
            {formatearMonto(morosos.reduce((sum, m) => sum + parseFloat(m.deuda_total || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">En mora</p>
        </Card>

        <Card className="bg-purple-50 border-l-4 border-purple-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio Deuda</h3>
          <p className="text-3xl font-bold text-purple-700">
            {morosos.length > 0
              ? formatearMonto(morosos.reduce((sum, m) => sum + parseFloat(m.deuda_total || 0), 0) / morosos.length)
              : '$0'
            }
          </p>
          <p className="text-sm text-gray-600 mt-2">Por usuario</p>
        </Card>
      </div>

      {/* Acciones Masivas */}
      {morosos.length > 0 && (
        <Card className="mb-6 bg-blue-50">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-blue-800 mb-2">Acciones Masivas</h3>
              <p className="text-base text-gray-700">
                {usuariosSeleccionados.length} usuario(s) seleccionado(s)
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleGenerarMasivo}
              disabled={usuariosSeleccionados.length === 0}
            >
              📄 Generar {usuariosSeleccionados.length} Aviso(s)
            </Button>
          </div>
        </Card>
      )}

      {/* Tabla de Morosos */}
      <Card title={`⚠️ Usuarios Morosos (${diasMinimos}+ días)`}>
        {morosos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-2xl font-semibold text-gray-600">
              No hay usuarios con {diasMinimos}+ días de morosidad
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4">
                    <input
                      type="checkbox"
                      onChange={handleSeleccionarTodos}
                      checked={usuariosSeleccionados.length === morosos.length}
                      className="w-5 h-5"
                    />
                  </th>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">RUT</th>
                  <th className="p-4 text-lg font-semibold">Dirección</th>
                  <th className="p-4 text-lg font-semibold">Días Mora</th>
                  <th className="p-4 text-lg font-semibold">Boletas</th>
                  <th className="p-4 text-lg font-semibold">Deuda</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {morosos.map((moroso) => (
                  <tr key={moroso.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={usuariosSeleccionados.includes(moroso.id)}
                        onChange={() => handleSeleccionarUsuario(moroso.id)}
                        className="w-5 h-5"
                      />
                    </td>
                    <td className="p-4 text-base font-semibold">{moroso.nombre}</td>
                    <td className="p-4 text-base font-mono">{moroso.rut}</td>
                    <td className="p-4 text-base">{moroso.direccion || '-'}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${moroso.dias_morosidad > 90 ? 'bg-red-100 text-red-800' :
                          moroso.dias_morosidad > 60 ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                        {moroso.dias_morosidad} días
                      </span>
                    </td>
                    <td className="p-4 text-base text-center">{moroso.boletas_pendientes}</td>
                    <td className="p-4 text-base font-bold text-red-600">
                      {formatearMonto(moroso.deuda_total)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleGenerarIndividual(moroso.id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        📄 Generar PDF
                      </button>
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

export default AvisosPage;