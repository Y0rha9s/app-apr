import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function AbrirCajaPage() {
  const { usuario } = useAuth();
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [saldoInicial, setSaldoInicial] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Para registrar pagos
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [deudaUsuario, setDeudaUsuario] = useState(0);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [observacionesPago, setObservacionesPago] = useState('');
  const [pagosHoy, setPagosHoy] = useState([]);
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [numeroOperacion, setNumeroOperacion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const buscadorRef = useRef(null);

  // Para registrar egresos
  const [categoriaEgreso, setCategoriaEgreso] = useState('');
  const [montoEgreso, setMontoEgreso] = useState('');
  const [descripcionEgreso, setDescripcionEgreso] = useState('');
  const [observacionesEgreso, setObservacionesEgreso] = useState('');
  const [egresosHoy, setEgresosHoy] = useState([]);
  const [registrandoEgreso, setRegistrandoEgreso] = useState(false);

  useEffect(() => {
    verificarCajaAbierta();
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (cajaAbierta) {
      cargarPagosHoy();
      cargarEgresosHoy();
    }
  }, [cajaAbierta]);

  useEffect(() => {
    if (usuarioSeleccionado) {
      calcularDeudaUsuario(usuarioSeleccionado);
    }
  }, [usuarioSeleccionado]);

  // Cerrar buscador al hacer clic fuera
  useEffect(() => {
    const handleClickAfuera = (event) => {
      if (buscadorRef.current && !buscadorRef.current.contains(event.target)) {
        setMostrarResultados(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  const verificarCajaAbierta = async () => {
    try {
      const response = await api.get('/cajas/abierta');
      setCajaAbierta(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error verificando caja:', error);
      setLoading(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      // Asegurar que filtramos por rol 'socio' o 'usuario' según como esté en tu DB
      const filtrados = response.data.filter(u => u.rol === 'socio' || u.rol === 'usuario');
      console.log('Usuarios cargados para caja:', filtrados.length);
      setUsuarios(filtrados);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const term = busqueda.toLowerCase();
    return u.nombre.toLowerCase().includes(term) || u.rut.toLowerCase().includes(term);
  });

  const handleSeleccionarUsuario = (u) => {
    setUsuarioSeleccionado(u.id);
    setBusqueda(`${u.nombre} (${u.rut})`);
    setMostrarResultados(false);
  };

  const cargarPagosHoy = async () => {
    try {
      const response = await api.get(`/pagos/caja/${cajaAbierta.id}`);
      setPagosHoy(response.data);
    } catch (error) {
      console.error('Error cargando pagos:', error);
    }
  };

  const calcularDeudaUsuario = async (usuarioId) => {
    try {
      const response = await api.get(`/usuarios/${usuarioId}/deuda`);
      setDeudaUsuario(response.data.deuda);
    } catch (error) {
      console.error('Error calculando deuda:', error);
      setDeudaUsuario(0);
    }
  };

  const handleAbrirCaja = async (e) => {
    e.preventDefault();
    setEnviando(true);

    try {
      await api.post('/cajas/abrir', {
        usuario_id: usuario.id,
        saldo_inicial: parseFloat(saldoInicial),
        observaciones_apertura: observaciones
      });

      alert('✅ Caja abierta exitosamente');
      verificarCajaAbierta();
      setSaldoInicial('');
      setObservaciones('');
    } catch (error) {
      alert('❌ Error al abrir caja: ' + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();

    if (!usuarioSeleccionado) {
      alert('Debe seleccionar un usuario');
      return;
    }

    setRegistrandoPago(true);

    try {
      await api.post('/pagos', {
        usuario_id: parseInt(usuarioSeleccionado),
        caja_id: cajaAbierta.id,
        monto: parseFloat(montoPago),
        metodo_pago: metodoPago,
        numero_operacion: numeroOperacion || null,
        observaciones: observacionesPago
      });

      alert('✅ Pago registrado exitosamente');

      // Limpiar formulario
      setUsuarioSeleccionado('');
      setBusqueda('');
      setDeudaUsuario(0);
      setMontoPago('');
      setMetodoPago('efectivo');
      setNumeroOperacion('');
      setObservacionesPago('');

      // Recargar pagos
      cargarPagosHoy();
    } catch (error) {
      alert('❌ Error al registrar pago: ' + error.message);
    } finally {
      setRegistrandoPago(false);
    }
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-CL');
  };

  const getNombreUsuario = (usuarioId) => {
    const usuario = usuarios.find(u => u.id === usuarioId);
    return usuario ? `${usuario.nombre} (${usuario.rut})` : 'Desconocido';
  };

  const cargarEgresosHoy = async () => {
    try {
      const response = await api.get(`/egresos-caja/caja/${cajaAbierta.id}`);
      setEgresosHoy(response.data);
    } catch (error) {
      console.error('Error cargando egresos:', error);
    }
  };

  const handleRegistrarEgreso = async (e) => {
    e.preventDefault();

    if (!categoriaEgreso) {
      alert('Debe seleccionar una categoría');
      return;
    }

    setRegistrandoEgreso(true);

    try {
      await api.post('/egresos-caja', {
        caja_id: cajaAbierta.id,
        categoria: categoriaEgreso,
        descripcion: descripcionEgreso,
        monto: parseFloat(montoEgreso),
        observaciones: observacionesEgreso
      });

      alert('✅ Egreso registrado exitosamente');

      // Limpiar formulario
      setCategoriaEgreso('');
      setMontoEgreso('');
      setDescripcionEgreso('');
      setObservacionesEgreso('');

      // Recargar egresos
      cargarEgresosHoy();
    } catch (error) {
      alert('❌ Error al registrar egreso: ' + error.message);
    } finally {
      setRegistrandoEgreso(false);
    }
  };

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  // SIN CAJA ABIERTA: Formulario para abrir
  if (!cajaAbierta) {
    return (
      <div>
        <h2 className="text-4xl font-bold mb-8 text-gray-800">💰 Abrir Caja</h2>

        <div className="max-w-2xl">
          <Card>
            <form onSubmit={handleAbrirCaja} className="space-y-6">
              <div>
                <label className="block text-xl font-bold text-gray-700 mb-3">
                  Saldo Inicial *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                  placeholder="Ej: 50000"
                  className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-base text-gray-600 mt-2">Monto en efectivo con el que inicia la caja</p>
              </div>

              <div>
                <label className="block text-xl font-bold text-gray-700 mb-3">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales (opcional)"
                  rows="4"
                  className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={enviando}>
                {enviando ? '⏳ Abriendo...' : '✅ Abrir Caja'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // CON CAJA ABIERTA: Info + Registrar Pagos
  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">💰 Abrir Caja</h2>

      {/* Info de caja abierta */}
      <Card className="bg-yellow-50 border-l-4 border-yellow-600 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-6xl">⚠️</span>
            <div>
              <h3 className="text-3xl font-bold text-yellow-800">Ya hay una caja abierta</h3>
              <p className="text-xl text-yellow-700 mt-2">Puede registrar pagos o cerrar la caja</p>
            </div>
          </div>
          <Button variant="danger" onClick={() => window.location.hash = '#cerrar'}>
            Ir a Cerrar Caja
          </Button>
        </div>

        <div className="bg-white rounded-xl p-6 mt-6">
          <h4 className="text-2xl font-bold mb-4">Información de la caja abierta:</h4>
          <div className="space-y-3 text-lg">
            <p><strong>Fecha de apertura:</strong> {formatearFecha(cajaAbierta.fecha_apertura)}</p>
            <p><strong>Saldo inicial:</strong> {formatearMonto(cajaAbierta.saldo_inicial)}</p>
            <p><strong>Observaciones:</strong> {cajaAbierta.observaciones_apertura || '-'}</p>
          </div>
        </div>
      </Card>

      {/* Formulario Registrar Pago */}
      <Card className="mb-8">
        <h3 className="text-3xl font-bold mb-6">💵 Registrar Pago</h3>

        <form onSubmit={handleRegistrarPago} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative" ref={buscadorRef}>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Buscar Usuario (Nombre o RUT) *
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setMostrarResultados(true);
                  if (usuarioSeleccionado) setUsuarioSeleccionado('');
                }}
                onFocus={() => setMostrarResultados(true)}
                placeholder="Escriba para buscar..."
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                required
              />
              
              {/* Lista desplegable de resultados */}
              {mostrarResultados && busqueda.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {usuariosFiltrados.length > 0 ? (
                    usuariosFiltrados.map(u => (
                      <div
                        key={u.id}
                        onClick={() => handleSeleccionarUsuario(u)}
                        className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-0 transition-colors"
                      >
                        <p className="font-bold text-lg">{u.nombre}</p>
                        <p className="text-gray-600">RUT: {u.rut}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500 text-center">No se encontraron usuarios</div>
                  )}
                </div>
              )}
            </div>

            {usuarioSeleccionado && (
              <div className="bg-blue-50 p-4 rounded-xl flex items-center">
                <div>
                  <p className="text-lg font-semibold text-gray-700">Deuda Total del Usuario</p>
                  <p className="text-3xl font-bold text-blue-600">{formatearMonto(deudaUsuario)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Monto del Pago *
              </label>
              <input
                type="number"
                step="0.01"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Método de Pago *
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="abono">🧾 Abono (Servipag / Caja Vecina)</option>
              </select>
            </div>

            {/* N° Operación - aparece cuando NO es efectivo */}
            {metodoPago !== 'efectivo' && (
              <div>
                <label className="block text-xl font-bold text-gray-700 mb-3">
                  N° de Operación / Comprobante
                  {metodoPago === 'abono' && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="text"
                  value={numeroOperacion}
                  onChange={(e) => setNumeroOperacion(e.target.value)}
                  placeholder={
                    metodoPago === 'abono' ? 'Ej: 123456789 (Servipag)' :
                      metodoPago === 'transferencia' ? 'Ej: N° transferencia banco' :
                        'Ej: N° operación tarjeta'
                  }
                  className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required={metodoPago === 'abono'}
                />
                <p className="text-base text-gray-500 mt-1">
                  {metodoPago === 'abono' && 'Número del comprobante entregado por Servipag o Caja Vecina'}
                  {metodoPago === 'transferencia' && 'Número de comprobante de la transferencia (opcional)'}
                  {metodoPago === 'tarjeta' && 'Número de operación del voucher (opcional)'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-700 mb-3">
              Observaciones
            </label>
            <textarea
              value={observacionesPago}
              onChange={(e) => setObservacionesPago(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows="3"
              className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>

          <Button type="submit" variant="success" className="w-full" disabled={registrandoPago}>
            {registrandoPago ? '⏳ Registrando...' : '✅ Registrar Pago'}
          </Button>
        </form>
      </Card>

      {/* Tabla de Pagos de Hoy */}
      <Card title="📋 Pagos Registrados Hoy">
        {pagosHoy.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-2xl font-semibold text-gray-600">No hay pagos registrados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Fecha/Hora</th>
                  <th className="p-4 text-lg font-semibold">Usuario</th>
                  <th className="p-4 text-lg font-semibold">Monto</th>
                  <th className="p-4 text-lg font-semibold">Método</th>
                  <th className="p-4 text-lg font-semibold">N° Operación</th>
                  <th className="p-4 text-lg font-semibold">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {pagosHoy.map((pago) => (
                  <tr key={pago.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base">{formatearFecha(pago.fecha_pago)}</td>
                    <td className="p-4 text-base font-semibold">{getNombreUsuario(pago.usuario_id)}</td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(pago.monto)}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${pago.metodo_pago === 'efectivo' ? 'bg-green-100 text-green-800' :
                        pago.metodo_pago === 'tarjeta' ? 'bg-purple-100 text-purple-800' :
                          pago.metodo_pago === 'abono' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                        {pago.metodo_pago === 'efectivo' && '💵 Efectivo'}
                        {pago.metodo_pago === 'tarjeta' && '💳 Tarjeta'}
                        {pago.metodo_pago === 'transferencia' && '🏦 Transferencia'}
                        {pago.metodo_pago === 'abono' && '🧾 Abono'}
                      </span>
                    </td>
                    <td className="p-4 text-base font-mono"> 
                      {pago.numero_operacion || '-'} 
                    </td> 
                    <td className="p-4 text-base">{pago.observaciones || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resumen */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-6 rounded-xl text-center">
              <div>
                <p className="text-lg font-semibold text-gray-700">Total Pagos</p>
                <p className="text-2xl font-bold text-gray-900">{pagosHoy.length}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-green-700">💵 Efectivo</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatearMonto(pagosHoy.filter(p => p.metodo_pago === 'efectivo').reduce((sum, p) => sum + parseFloat(p.monto), 0))}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-700">🏦 Transferencias</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatearMonto(pagosHoy.filter(p => p.metodo_pago === 'transferencia').reduce((sum, p) => sum + parseFloat(p.monto), 0))}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-purple-700">💳 Tarjetas</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatearMonto(pagosHoy.filter(p => p.metodo_pago === 'tarjeta').reduce((sum, p) => sum + parseFloat(p.monto), 0))}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-orange-700">🧾 Abonos</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatearMonto(pagosHoy.filter(p => p.metodo_pago === 'abono').reduce((sum, p) => sum + parseFloat(p.monto), 0))}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
      {/* Sección de EGRESOS */}
      <Card className="mt-8 bg-red-50">
        <h3 className="text-3xl font-bold mb-6 text-red-800">💸 Registrar Egreso</h3>

        <form onSubmit={handleRegistrarEgreso} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Categoría *
              </label>
              <select
                value={categoriaEgreso}
                onChange={(e) => setCategoriaEgreso(e.target.value)}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                required
              >
                <option value="">-- Seleccione categoría --</option>
                <option value="personal">👷 Personal/Ayudantes</option>
                <option value="materiales">🔧 Materiales</option>
                <option value="transporte">🚗 Transporte</option>
                <option value="servicios">⚡ Servicios</option>
                <option value="otros">📦 Otros</option>
              </select>
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Monto *
              </label>
              <input
                type="number"
                step="0.01"
                value={montoEgreso}
                onChange={(e) => setMontoEgreso(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-700 mb-3">
              Descripción *
            </label>
            <input
              type="text"
              value={descripcionEgreso}
              onChange={(e) => setDescripcionEgreso(e.target.value)}
              placeholder="Ej: Pago ayudante instalación red"
              className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-xl font-bold text-gray-700 mb-3">
              Observaciones
            </label>
            <textarea
              value={observacionesEgreso}
              onChange={(e) => setObservacionesEgreso(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows="2"
              className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
            ></textarea>
          </div>

          <Button type="submit" variant="danger" className="w-full" disabled={registrandoEgreso}>
            {registrandoEgreso ? '⏳ Registrando...' : '💸 Registrar Egreso'}
          </Button>
        </form>
      </Card>

      {/* Tabla de Egresos del Día */}
      <Card title="📋 Egresos Registrados Hoy" className="mt-8">
        {egresosHoy.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-2xl font-semibold text-gray-600">No hay egresos registrados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Fecha/Hora</th>
                  <th className="p-4 text-lg font-semibold">Categoría</th>
                  <th className="p-4 text-lg font-semibold">Descripción</th>
                  <th className="p-4 text-lg font-semibold">Monto</th>
                  <th className="p-4 text-lg font-semibold">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {egresosHoy.map((egreso) => (
                  <tr key={egreso.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base">{formatearFecha(egreso.fecha_egreso)}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                        {egreso.categoria}
                      </span>
                    </td>
                    <td className="p-4 text-base">{egreso.descripcion}</td>
                    <td className="p-4 text-base font-bold text-red-600">
                      -{formatearMonto(egreso.monto)}
                    </td>
                    <td className="p-4 text-base">{egreso.observaciones || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resumen de Egresos */}
            <div className="mt-6 bg-red-50 p-6 rounded-xl">
              <div className="flex justify-between items-center">
                <p className="text-2xl font-bold text-red-800">Total Egresos del Día:</p>
                <p className="text-3xl font-bold text-red-600">
                  -{formatearMonto(egresosHoy.reduce((sum, e) => sum + parseFloat(e.monto), 0))}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default AbrirCajaPage;