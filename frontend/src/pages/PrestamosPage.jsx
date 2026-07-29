import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function PrestamosPage() {
  const [prestamosActivos, setPrestamosActivos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormPrestamo, setMostrarFormPrestamo] = useState(false);
  const [mostrarFormInsumo, setMostrarFormInsumo] = useState(false);
  const [historialUsuario, setHistorialUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [prestamoExpandido, setPrestamoExpandido] = useState(null);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  // Form de nuevo préstamo
  const [formPrestamo, setFormPrestamo] = useState({
    usuario_id: '',
    insumo_id: '',
    cantidad: 1,
    num_cuotas: 6,
    notas: ''
  });

  // Form de nuevo insumo
  const [formInsumo, setFormInsumo] = useState({
    nombre: '',
    descripcion: '',
    precio_unitario: '',
    stock_disponible: 0,
    categoria: 'accesorios',
    unidad_medida: 'unidad'
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [prestamosRes, insumosRes, usuariosRes] = await Promise.all([
        api.get('/prestamos/activos'),
        api.get('/prestamos/insumos'),
        api.get('/usuarios')
      ]);

      setPrestamosActivos(prestamosRes.data.prestamos || []);
      setInsumos(insumosRes.data.insumos || []);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const prestamosFiltrados = useMemo(() => {
    return prestamosActivos.filter((p) => {
      const coincideBusqueda = busqueda.trim() === '' ||
        p.usuario_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.usuario_rut?.toLowerCase().includes(busqueda.toLowerCase());
      const completado = p.cuotas_pagadas >= p.num_cuotas;
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'pagados' && completado) ||
        (filtroEstado === 'pendientes' && !completado);
      return coincideBusqueda && coincideEstado;
    });
  }, [prestamosActivos, busqueda, filtroEstado]);

  const handleCrearPrestamo = async (e) => {
    e.preventDefault();

    if (!formPrestamo.usuario_id || !formPrestamo.insumo_id) {
      alert('⚠️ Debe seleccionar usuario e insumo');
      return;
    }

    try {
      const response = await api.post('/prestamos/crear', formPrestamo);
      alert(`✅ ${response.data.mensaje}\n\nInsumo: ${response.data.prestamo.insumo}\nCantidad: ${response.data.prestamo.cantidad}\nTotal: $${response.data.prestamo.monto_total.toLocaleString()}\nCuotas: ${response.data.prestamo.num_cuotas}\nCuota mensual: $${response.data.prestamo.cuota_mensual.toLocaleString()}`);
      setMostrarFormPrestamo(false);
      setFormPrestamo({ usuario_id: '', insumo_id: '', cantidad: 1, num_cuotas: 6, notas: '' });
      cargarDatos();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCrearInsumo = async (e) => {
    e.preventDefault();

    try {
      await api.post('/prestamos/insumos', formInsumo);
      alert('✅ Insumo creado exitosamente');
      setMostrarFormInsumo(false);
      setFormInsumo({
        nombre: '',
        descripcion: '',
        precio_unitario: '',
        stock_disponible: 0,
        categoria: 'accesorios',
        unidad_medida: 'unidad'
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

  const calcularMontoTotal = () => {
    const insumo = insumos.find(i => i.id === parseInt(formPrestamo.insumo_id));
    if (!insumo) return 0;
    return parseFloat(insumo.precio_unitario) * parseInt(formPrestamo.cantidad);
  };

  const calcularCuotaMensual = () => {
    const total = calcularMontoTotal();
    if (!formPrestamo.num_cuotas) return 0;
    return Math.ceil(total / parseInt(formPrestamo.num_cuotas));
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

  const extraerFechaOriginal = (notas) => {
    if (!notas) return null;
    const match = notas.match(/Fecha original Excel: (.+)/);
    return match ? match[1] : null;
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
        <h2 className="text-4xl font-bold text-gray-800">🔧 Gestión de Préstamos de Insumos</h2>
        <div className="flex gap-4">
          <Button variant="success" onClick={() => setMostrarFormInsumo(!mostrarFormInsumo)}>
            {mostrarFormInsumo ? '✖️ Cancelar' : '📦 Nuevo Insumo'}
          </Button>
          <Button variant="primary" onClick={() => setMostrarFormPrestamo(!mostrarFormPrestamo)}>
            {mostrarFormPrestamo ? '✖️ Cancelar' : '➕ Nuevo Préstamo'}
          </Button>
        </div>
      </div>

      {/* Formulario Nuevo Insumo */}
      {mostrarFormInsumo && (
        <Card className="mb-8 bg-purple-50">
          <h3 className="text-2xl font-bold mb-6 text-purple-800">Agregar Nuevo Insumo al Catálogo</h3>
          <form onSubmit={handleCrearInsumo} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  value={formInsumo.nombre}
                  onChange={(e) => setFormInsumo({ ...formInsumo, nombre: e.target.value })}
                  placeholder="Ej: Estanque 1000L"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Categoría *</label>
                <select
                  value={formInsumo.categoria}
                  onChange={(e) => setFormInsumo({ ...formInsumo, categoria: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="estanques">Estanques</option>
                  <option value="bombas">Bombas</option>
                  <option value="tuberias">Tuberías</option>
                  <option value="accesorios">Accesorios</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Precio Unitario *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formInsumo.precio_unitario}
                  onChange={(e) => setFormInsumo({ ...formInsumo, precio_unitario: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Stock Inicial</label>
                <input
                  type="number"
                  value={formInsumo.stock_disponible}
                  onChange={(e) => setFormInsumo({ ...formInsumo, stock_disponible: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Unidad de Medida *</label>
                <select
                  value={formInsumo.unidad_medida}
                  onChange={(e) => setFormInsumo({ ...formInsumo, unidad_medida: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="unidad">Unidad</option>
                  <option value="metro">Metro</option>
                  <option value="litro">Litro</option>
                  <option value="kilo">Kilogramo</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={formInsumo.descripcion}
                  onChange={(e) => setFormInsumo({ ...formInsumo, descripcion: e.target.value })}
                  placeholder="Descripción del insumo..."
                  rows="3"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <Button type="submit" variant="secondary" className="w-full">
              📦 Agregar al Catálogo
            </Button>
          </form>
        </Card>
      )}

      {/* Formulario Nuevo Préstamo */}
      {mostrarFormPrestamo && (
        <Card className="mb-8 bg-blue-50">
          <h3 className="text-2xl font-bold mb-6 text-blue-800">Crear Nuevo Préstamo de Insumo</h3>
          <form onSubmit={handleCrearPrestamo} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario *</label>
                <select
                  value={formPrestamo.usuario_id}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, usuario_id: e.target.value })}
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
                <label className="block text-lg font-semibold text-gray-700 mb-2">Insumo *</label>
                <select
                  value={formPrestamo.insumo_id}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, insumo_id: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Seleccione insumo --</option>
                  {insumos.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} - {formatearMonto(i.precio_unitario)} (Stock: {i.stock_disponible})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  value={formPrestamo.cantidad}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, cantidad: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Número de Cuotas (1-24) *</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formPrestamo.num_cuotas}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, num_cuotas: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Notas</label>
                <textarea
                  value={formPrestamo.notas}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, notas: e.target.value })}
                  placeholder="Observaciones sobre este préstamo..."
                  rows="2"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Resumen del préstamo */}
            {formPrestamo.insumo_id && formPrestamo.cantidad && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <p className="text-base font-semibold text-green-800 mb-2">💡 Resumen del Préstamo:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-700">Monto Total:</p>
                  <p className="font-bold text-green-700">{formatearMonto(calcularMontoTotal())}</p>
                  <p className="text-gray-700">Cuota Mensual:</p>
                  <p className="font-bold text-blue-700">{formatearMonto(calcularCuotaMensual())}</p>
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full">
              🔧 Crear Préstamo
            </Button>
          </form>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Préstamos Activos</h3>
          <p className="text-3xl font-bold text-blue-700">{prestamosActivos.length}</p>
          <p className="text-sm text-gray-600 mt-2">En curso</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Valor Prestado</h3>
          <p className="text-3xl font-bold text-green-700">
            {formatearMonto(prestamosActivos.reduce((sum, p) => sum + parseFloat(p.monto_total || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Total en préstamos</p>
        </Card>

        <Card className="bg-purple-50 border-l-4 border-purple-600">
          <h3 className="text-lg font-semibold text-gray-700">Cuotas Mensuales</h3>
          <p className="text-3xl font-bold text-purple-700">
            {formatearMonto(prestamosActivos.reduce((sum, p) => sum + parseFloat(p.cuota_mensual || 0), 0))}
          </p>
          <p className="text-sm text-gray-600 mt-2">Ingreso mensual esperado</p>
        </Card>

        <Card className="bg-orange-50 border-l-4 border-orange-600">
          <h3 className="text-lg font-semibold text-gray-700">Insumos Disponibles</h3>
          <p className="text-3xl font-bold text-orange-700">{insumos.filter(i => i.stock_disponible > 0).length}</p>
          <p className="text-sm text-gray-600 mt-2">Con stock</p>
        </Card>
      </div>

      {/* Catálogo de Insumos */}
      <Card className="mb-8">
        <button
          onClick={() => setMostrarCatalogo(!mostrarCatalogo)}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="text-2xl font-bold text-gray-800">📦 Catálogo de Insumos</h3>
          <span className="text-2xl">{mostrarCatalogo ? '▲' : '▼'}</span>
        </button>

        {mostrarCatalogo && (
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Insumo</th>
                  <th className="p-4 text-lg font-semibold">Categoría</th>
                  <th className="p-4 text-lg font-semibold">Precio Unitario</th>
                  <th className="p-4 text-lg font-semibold">Stock</th>
                  <th className="p-4 text-lg font-semibold">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr key={insumo.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">{insumo.nombre}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                        {insumo.categoria}
                      </span>
                    </td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(insumo.precio_unitario)}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${insumo.stock_disponible > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {insumo.stock_disponible}
                      </span>
                    </td>
                    <td className="p-4 text-base">{insumo.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tabla de Préstamos Activos */}
      <Card title="🔧 Préstamos Activos">
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
        {prestamosActivos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-2xl font-semibold text-gray-600">No hay préstamos activos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold w-10"></th>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">Insumo</th>
                  <th className="p-4 text-lg font-semibold">Cantidad</th>
                  <th className="p-4 text-lg font-semibold">Monto Total</th>
                  <th className="p-4 text-lg font-semibold">Cuota Mensual</th>
                  <th className="p-4 text-lg font-semibold">Progreso</th>
                  <th className="p-4 text-lg font-semibold">Saldo Pendiente</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestamosFiltrados.map((prestamo) => (
                  <>
                    <tr key={prestamo.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setPrestamoExpandido(
                            prestamoExpandido === prestamo.id ? null : prestamo.id
                          )}
                          className="text-xl hover:text-blue-600"
                        >
                          {prestamoExpandido === prestamo.id ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-4 text-base font-semibold">
                        {prestamo.usuario_nombre}
                        {prestamo.sin_usuario_vinculado && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                            sin RUT
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-base">{prestamo.insumo_nombre}</td>
                      <td className="p-4 text-base text-center">
                        {prestamo.cantidad} {prestamo.unidad_medida}
                      </td>
                      <td className="p-4 text-base font-bold text-gray-700">
                        {formatearMonto(prestamo.monto_total)}
                      </td>
                      <td className="p-4 text-base font-bold text-blue-600">
                        {formatearMonto(prestamo.cuota_mensual)}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">
                            {prestamo.cuotas_pagadas}/{prestamo.num_cuotas} cuotas
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(prestamo.cuotas_pagadas / prestamo.num_cuotas) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-base font-bold text-red-600">
                        {formatearMonto(prestamo.saldo_pendiente)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handlePagarCuota(prestamo.id)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                          >
                            ✅ Pagar Cuota
                          </button>
                          {prestamo.usuario_id && (
                            <button
                              onClick={() => handleVerHistorial(prestamo.usuario_id)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              📜 Historial
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {prestamoExpandido === prestamo.id && (
                      <tr className="bg-gray-50 border-b">
                        <td colSpan="9" className="p-4">
                          <div className="text-sm font-semibold text-gray-600 mb-2">
                            Detalle de cuotas — {prestamo.usuario_nombre}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {(prestamo.cuotas || []).map((c) => (
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
                                {extraerFechaOriginal(c.notas) && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {extraerFechaOriginal(c.notas)}
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
              <h3 className="text-2xl font-bold">📜 Historial de Préstamos</h3>
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
                  <th className="p-3 text-base font-semibold">Insumo</th>
                  <th className="p-3 text-base font-semibold">Cantidad</th>
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
                    <td className="p-3 text-sm font-semibold">{h.insumo_nombre}</td>
                    <td className="p-3 text-sm">{h.cantidad} {h.unidad_medida}</td>
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

export default PrestamosPage;