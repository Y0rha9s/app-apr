import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import FormularioNuevaLectura from '../components/FormularioNuevaLectura';

function LecturasPage() {
  const { usuario } = useAuth();
  const [lecturas, setLecturas] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  const [busqueda, setBusqueda] = useState('');
  const [fotoModal, setFotoModal] = useState(null); // URL de la foto a mostrar

  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);
  const [razonModificacion, setRazonModificacion] = useState('');

  const handleNuevaLectura = () => setMostrarFormulario(true);
  const handleCerrarFormulario = () => setMostrarFormulario(false);
  const handleLecturaCreada = (data) => {
    cargarDatos();
    alert(`✅ ${data.mensaje}\n\nConsumo: ${data.lectura.consumo_m3} m³\nTotal a pagar: $${data.boleta.total_a_pagar.toLocaleString()}`);
  };

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      const [lecturasRes, usuariosRes] = await Promise.all([
        api.get('/lecturas'),
        api.get('/usuarios')
      ]);
      setLecturas(lecturasRes.data);
      setUsuarios(usuariosRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const formatearMonto = (monto) => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0
  }).format(monto);

  const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CL');

  const getNombreUsuario = (usuarioId) => {
    const u = usuarios.find(u => u.id === usuarioId);
    return u ? u.nombre : 'Desconocido';
  };

  const getMedidorUsuario = (usuarioId) => {
    const u = usuarios.find(u => u.id === usuarioId);
    return u?.medidor || u?.numero_medidor || '—';
  };

  const getRutUsuario = (usuarioId) => {
    const u = usuarios.find(u => u.id === usuarioId);
    return u?.rut || '';
  };

  const descargarExcel = () => {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reporte/lecturas-excel?mes=${mesFiltro}&anio=${anioFiltro}`;
    window.open(url, '_blank');
  };

  const handleEditar = (lectura) => {
    setEditando(lectura.id);
    setFormEdit({
      medidor: lectura.usuario_medidor || getMedidorUsuario(lectura.usuario_id),
      lectura_anterior: lectura.lectura_anterior,
      lectura_actual: lectura.lectura_actual,
      observaciones: lectura.observaciones || '',
      fecha_lectura: lectura.fecha_lectura.split('T')[0]
    });
  };

  const handleCancelarEdicion = () => {
    setEditando(null);
    setFormEdit({});
    setMostrarModalEdicion(false);
    setRazonModificacion('');
  };

  const handleGuardarConRazon = async () => {
    if (!razonModificacion.trim()) {
      alert('⚠️ Debe ingresar una razón para modificar la lectura');
      return;
    }
    try {
      await api.put(`/lecturas/${editando}`, {
        medidor: (formEdit.medidor || '').toString().trim(),
        lectura_anterior: parseInt(formEdit.lectura_anterior),
        lectura_actual: parseInt(formEdit.lectura_actual),
        observaciones: formEdit.observaciones,
        razon_modificacion: razonModificacion,
        usuario_modificador_id: usuario.id
      });
      alert('✅ Lectura actualizada correctamente');
      setEditando(null);
      setMostrarModalEdicion(false);
      setRazonModificacion('');
      setFormEdit({});
      cargarDatos();
    } catch (error) {
      alert('❌ Error al actualizar lectura: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSolicitarGuardar = () => {
    const consumoNuevo = parseInt(formEdit.lectura_actual) - parseInt(formEdit.lectura_anterior);
    if (consumoNuevo < 0) {
      alert('⚠️ La lectura actual no puede ser menor que la anterior');
      return;
    }
    setMostrarModalEdicion(true);
  };

  const clienteKey = (numeroCliente) => {
    if (!numeroCliente) return { prefix: 'ZZZ', num: Number.POSITIVE_INFINITY, raw: '' };
    const raw = numeroCliente.toString().trim();
    const match = raw.match(/^([A-Z]+)-0*(\d+)$/i);
    if (match) return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10), raw };
    const onlyNum = raw.match(/^0*(\d+)$/);
    if (onlyNum) return { prefix: '', num: parseInt(onlyNum[1], 10), raw };
    return { prefix: 'ZZZ', num: Number.POSITIVE_INFINITY, raw };
  };

  const lecturasFiltradas = lecturas
    .filter(l => l.mes === parseInt(mesFiltro) && l.anio === parseInt(anioFiltro))
    .filter(l => {
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      const nombre = (l.usuario_nombre || getNombreUsuario(l.usuario_id)).toLowerCase();
      const medidor = (l.usuario_medidor || getMedidorUsuario(l.usuario_id)).toLowerCase();
      const rut = getRutUsuario(l.usuario_id).toLowerCase();
      return nombre.includes(q) || medidor.includes(q) || rut.includes(q);
    });

  const consumoTotal = lecturasFiltradas.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);

  const lecturasOrdenadas = lecturasFiltradas.slice().sort((a, b) => {
    const ak = clienteKey(a.usuario_numero_cliente);
    const bk = clienteKey(b.usuario_numero_cliente);
    if (ak.prefix !== bk.prefix) return ak.prefix.localeCompare(bk.prefix);
    if (ak.num !== bk.num) return ak.num - bk.num;
    return (a.usuario_nombre || '').localeCompare(b.usuario_nombre || '', 'es', { sensitivity: 'base' });
  });

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) return <div className="text-center text-3xl py-12">⏳ Cargando lecturas...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-4xl font-bold text-gray-800">💧 Gestión de Lecturas</h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-300 shadow-sm">
            <label className="text-sm font-bold text-gray-600">Mes:</label>
            <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer font-semibold text-blue-600">
              {meses.map((mes, idx) => <option key={idx} value={idx + 1}>{mes}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-300 shadow-sm">
            <label className="text-sm font-bold text-gray-600">Año:</label>
            <select value={anioFiltro} onChange={(e) => setAnioFiltro(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer font-semibold text-blue-600">
              {anios.map(anio => <option key={anio} value={anio}>{anio}</option>)}
            </select>
          </div>
          <button onClick={descargarExcel}
            className="px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 flex items-center gap-2">
            📥 Excel
          </button>
          <button onClick={handleNuevaLectura}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
            ➕ Nueva Lectura
          </button>
        </div>
        {mostrarFormulario && (
          <FormularioNuevaLectura onClose={handleCerrarFormulario} onSuccess={handleLecturaCreada} />
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Lecturas Filtradas</h3>
          <p className="text-3xl font-bold text-blue-700">{lecturasFiltradas.length}</p>
          <p className="text-sm text-gray-600 mt-2">{meses[mesFiltro - 1]} {anioFiltro}</p>
        </Card>
        <Card className="bg-cyan-50 border-l-4 border-cyan-600">
          <h3 className="text-lg font-semibold text-gray-700">Consumo Total</h3>
          <p className="text-3xl font-bold text-cyan-700">{consumoTotal} m³</p>
          <p className="text-sm text-gray-600 mt-2">Metros cúbicos del periodo</p>
        </Card>
        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio por Usuario</h3>
          <p className="text-3xl font-bold text-green-700">
            {lecturasFiltradas.length > 0 ? Math.round(consumoTotal / lecturasFiltradas.length) : 0} m³
          </p>
          <p className="text-sm text-gray-600 mt-2">Consumo promedio</p>
        </Card>
      </div>

      {/* Tabla */}
      <Card title={`📋 Historial de Lecturas - ${meses[mesFiltro - 1]} ${anioFiltro}`}>
        {/* Buscador */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre, RUT o N° medidor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
          />
          {busqueda && (
            <span className="ml-3 text-sm text-gray-500">
              {lecturasFiltradas.length} resultado(s)
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">Nº Medidor</th>
                <th className="p-4 text-lg font-semibold">Usuario</th>
                <th className="p-4 text-lg font-semibold">Fecha</th>
                <th className="p-4 text-lg font-semibold text-center">L. Anterior</th>
                <th className="p-4 text-lg font-semibold text-center">L. Actual</th>
                <th className="p-4 text-lg font-semibold text-center">Consumo</th>
                <th className="p-4 text-lg font-semibold">Monto</th>
                <th className="p-4 text-lg font-semibold">Operador</th>
                <th className="p-4 text-lg font-semibold text-center">Foto</th>
                <th className="p-4 text-lg font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lecturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-xl text-gray-500">
                    {busqueda ? 'No se encontraron resultados para la búsqueda' : 'No hay lecturas registradas para este periodo'}
                  </td>
                </tr>
              ) : (
                lecturasOrdenadas.map((lectura) => (
                  <tr key={lectura.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-mono">
                      {editando === lectura.id ? (
                        <input type="text" value={formEdit.medidor}
                          onChange={(e) => setFormEdit({ ...formEdit, medidor: e.target.value })}
                          className="w-28 px-2 py-1 border rounded font-mono" />
                      ) : (
                        lectura.usuario_medidor || getMedidorUsuario(lectura.usuario_id)
                      )}
                    </td>
                    <td className="p-4 text-base font-semibold">{lectura.usuario_nombre || getNombreUsuario(lectura.usuario_id)}</td>
                    <td className="p-4 text-base">{formatearFecha(lectura.fecha_lectura)}</td>
                    <td className="p-4 text-base text-center font-mono">
                      {editando === lectura.id ? (
                        <input type="number" value={formEdit.lectura_anterior}
                          onChange={(e) => setFormEdit({ ...formEdit, lectura_anterior: e.target.value })}
                          className="w-24 px-2 py-1 border rounded" />
                      ) : lectura.lectura_anterior}
                    </td>
                    <td className="p-4 text-base text-center font-mono font-bold text-blue-600">
                      {editando === lectura.id ? (
                        <input type="number" value={formEdit.lectura_actual}
                          onChange={(e) => setFormEdit({ ...formEdit, lectura_actual: e.target.value })}
                          className="w-24 px-2 py-1 border rounded" />
                      ) : lectura.lectura_actual}
                    </td>
                    <td className="p-4 text-base text-center">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {lectura.consumo_m3} m³
                      </span>
                    </td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(lectura.monto_calculado)}
                    </td>
                    <td className="p-4 text-base text-gray-500">{lectura.operador_nombre || '—'}</td>
                    <td className="p-4 text-center">
                      {lectura.foto_url ? (
                        <button
                          onClick={() => setFotoModal(lectura.foto_url)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 font-semibold"
                        >
                          📷 Ver
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {editando === lectura.id ? (
                        <div className="flex gap-2">
                          <button onClick={handleSolicitarGuardar}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                            ✅ Guardar
                          </button>
                          <button onClick={handleCancelarEdicion}
                            className="text-red-600 hover:text-red-800 font-bold">
                            ❌
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEditar(lectura)}
                          className="text-blue-600 hover:text-blue-800 font-bold">
                          ✏️ Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal foto */}
      {fotoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setFotoModal(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold hover:text-gray-300"
            >
              ✕ Cerrar
            </button>
            <img
              src={fotoModal}
              alt="Foto medidor"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Modal edición */}
      {mostrarModalEdicion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">⚠️ Confirmar Modificación</h3>
            <p className="text-lg mb-4">
              Está a punto de modificar una lectura. Por razones de auditoría, debe indicar el motivo:
            </p>
            <textarea
              value={razonModificacion}
              onChange={(e) => setRazonModificacion(e.target.value)}
              placeholder="Ej: Lectura tomada incorrectamente, el medidor marcaba 12345 en lugar de 12356"
              rows="4"
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex gap-4">
              <Button variant="success" onClick={handleGuardarConRazon} className="flex-1">
                ✅ Confirmar Cambios
              </Button>
              <Button variant="secondary" onClick={() => { setMostrarModalEdicion(false); setRazonModificacion(''); }} className="flex-1">
                ❌ Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default LecturasPage;