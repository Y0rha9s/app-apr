import { useState, useEffect } from 'react';
import { transaccionesService, usuariosService } from '../services/api';
import Card from '../components/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

function DashboardPage() {
  const [balance, setBalance] = useState({ total_ingresos: 0, total_egresos: 0 });
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [infoUsuario, setInfoUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(false);
  const [tabActiva, setTabActiva] = useState('resumen');

  useEffect(() => {
    cargarDatos();
    cargarUsuarios();
  }, []);

  const cargarDatos = async () => {
    try {
      const balanceResponse = await transaccionesService.getBalance(1, 2026);
      setBalance(balanceResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const response = await usuariosService.getAll();
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const buscarUsuario = async () => {
    if (!busquedaUsuario.trim()) {
      setUsuarioSeleccionado(null);
      setInfoUsuario(null);
      return;
    }

    setCargandoUsuario(true);
    try {
      // Buscar por número de cliente, RUT o nombre
      const usuario = usuarios.find(u => 
        u.numero_cliente?.includes(busquedaUsuario) ||
        u.rut?.includes(busquedaUsuario) ||
        u.nombre?.toLowerCase().includes(busquedaUsuario.toLowerCase())
      );

      if (usuario) {
        setUsuarioSeleccionado(usuario);
        const info = await usuariosService.getInfoCompleta(usuario.id);
        setInfoUsuario(info.data);
      } else {
        setUsuarioSeleccionado(null);
        setInfoUsuario(null);
      }
    } catch (error) {
      console.error('Error buscando usuario:', error);
      setUsuarioSeleccionado(null);
      setInfoUsuario(null);
    } finally {
      setCargandoUsuario(false);
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
    return new Date(fecha).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const balanceTotal = parseFloat(balance.total_ingresos || 0) - parseFloat(balance.total_egresos || 0);

  const dataGrafico = [
    {
      name: 'Enero 2026',
      Ingresos: parseFloat(balance.total_ingresos || 0),
      Egresos: parseFloat(balance.total_egresos || 0),
    }
  ];

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'];

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">📊 Dashboard General</h2>

      {/* Búsqueda de Usuario */}
      <Card className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50">
        <h3 className="text-2xl font-bold mb-4 text-gray-800">🔍 Búsqueda de Usuario</h3>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Buscar por número de cliente, RUT o nombre..."
            value={busquedaUsuario}
            onChange={(e) => setBusquedaUsuario(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && buscarUsuario()}
            className="flex-1 px-6 py-4 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={buscarUsuario}
            disabled={cargandoUsuario}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {cargandoUsuario ? '⏳ Buscando...' : '🔍 Buscar'}
          </button>
        </div>

        {/* Información del Usuario Seleccionado */}
        {infoUsuario && (
          <div className="mt-6 p-6 bg-white rounded-lg border-2 border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Información Básica */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">👤 Información del Cliente</h4>
                <div className="space-y-2 text-base">
                  <p><strong>Nombre:</strong> {infoUsuario.usuario.nombre}</p>
                  <p><strong>RUT:</strong> {infoUsuario.usuario.rut}</p>
                  <p><strong>N° Cliente:</strong> <span className="font-bold text-blue-600">{infoUsuario.usuario.numero_cliente || 'N/A'}</span></p>
                  <p><strong>Teléfono:</strong> {infoUsuario.usuario.telefono || 'N/A'}</p>
                </div>
              </div>

              {/* Morosidad */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">⚠️ Morosidad</h4>
                <div className="space-y-2 text-base">
                  <p><strong>Deuda Total:</strong> <span className="text-red-600 font-bold">{formatearMonto(infoUsuario.morosidad.deuda_total)}</span></p>
                  <p><strong>Meses en Mora:</strong> <span className="text-red-600 font-bold">{infoUsuario.morosidad.meses_en_mora}</span></p>
                  <p><strong>Monto Morosidad:</strong> <span className="text-red-600 font-bold">{formatearMonto(infoUsuario.morosidad.monto_morosidad)}</span></p>
                </div>
              </div>

              {/* Pagos */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">💰 Pagos</h4>
                <div className="space-y-2 text-base">
                  <p><strong>Total Pagado:</strong> <span className="text-green-600 font-bold">{formatearMonto(infoUsuario.pagos.total_pagado)}</span></p>
                  <p><strong>Cantidad de Pagos:</strong> {infoUsuario.pagos.cantidad_pagos}</p>
                  {infoUsuario.pagos.ultimo_pago && (
                    <p><strong>Último Pago:</strong> {formatearFecha(infoUsuario.pagos.ultimo_pago.fecha)} - {formatearMonto(infoUsuario.pagos.ultimo_pago.monto)}</p>
                  )}
                </div>
              </div>

              {/* Saldo Anterior */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">📊 Saldo Anterior Pendiente</h4>
                <p className="text-2xl font-bold text-orange-600">{formatearMonto(infoUsuario.saldo_anterior_pendiente)}</p>
              </div>

              {/* Convenio */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">🤝 Convenio</h4>
                {infoUsuario.usuario.tiene_convenio ? (
                  <div className="space-y-2">
                    <p className="text-green-600 font-bold">✅ Tiene Convenio</p>
                    {infoUsuario.usuario.convenio_detalle && (
                      <p className="text-sm text-gray-600">{infoUsuario.usuario.convenio_detalle}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">❌ Sin Convenio</p>
                )}
              </div>

              {/* Notificaciones */}
              <div>
                <h4 className="text-xl font-bold mb-3 text-gray-800">🔔 Notificaciones</h4>
                {infoUsuario.usuario.tiene_notificacion ? (
                  <div className="space-y-2">
                    <p className="text-yellow-600 font-bold">⚠️ Tiene Notificación</p>
                    {infoUsuario.usuario.notificacion_detalle && (
                      <p className="text-sm text-gray-600">{infoUsuario.usuario.notificacion_detalle}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">✅ Sin Notificaciones</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-l-8 border-green-600 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">💵 Total Ingresos</h3>
              <p className="text-4xl font-bold text-green-700">
                {formatearMonto(balance.total_ingresos || 0)}
              </p>
            </div>
            <div className="text-6xl">📈</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-l-8 border-red-600 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">💸 Total Egresos</h3>
              <p className="text-4xl font-bold text-red-700">
                {formatearMonto(balance.total_egresos || 0)}
              </p>
            </div>
            <div className="text-6xl">📉</div>
          </div>
        </Card>

        <Card className={`bg-gradient-to-br ${balanceTotal >= 0 ? 'from-blue-50 to-blue-100 border-blue-600' : 'from-orange-50 to-orange-100 border-orange-600'} border-l-8 hover:shadow-xl transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">💰 Balance</h3>
              <p className={`text-4xl font-bold ${balanceTotal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatearMonto(balanceTotal)}
              </p>
            </div>
            <div className="text-6xl">{balanceTotal >= 0 ? '✅' : '⚠️'}</div>
          </div>
        </Card>
      </div>

      {/* Pestañas para Gráficos */}
      <Card>
        <div className="mb-6">
          <div className="flex gap-2 border-b-2 border-gray-200">
            <button
              onClick={() => setTabActiva('resumen')}
              className={`px-6 py-3 font-semibold transition-colors ${
                tabActiva === 'resumen'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              📊 Resumen
            </button>
            <button
              onClick={() => setTabActiva('ingresos-egresos')}
              className={`px-6 py-3 font-semibold transition-colors ${
                tabActiva === 'ingresos-egresos'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              💰 Ingresos vs Egresos
            </button>
            <button
              onClick={() => setTabActiva('tendencias')}
              className={`px-6 py-3 font-semibold transition-colors ${
                tabActiva === 'tendencias'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              📈 Tendencias
            </button>
            <button
              onClick={() => setTabActiva('distribucion')}
              className={`px-6 py-3 font-semibold transition-colors ${
                tabActiva === 'distribucion'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              🥧 Distribución
            </button>
          </div>
        </div>

        {/* Contenido de las pestañas */}
        <div className="mt-6">
          {tabActiva === 'resumen' && (
            <div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800">📊 Resumen General</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h4 className="text-xl font-bold mb-3 text-blue-800">ℹ️ Información del Sistema</h4>
                  <div className="space-y-3 text-lg">
                    <p><strong>Período:</strong> Enero 2026</p>
                    <p><strong>Estado:</strong> <span className="text-green-600 font-semibold">✅ Operativo</span></p>
                    <p><strong>Última actualización:</strong> {new Date().toLocaleDateString('es-CL')}</p>
                  </div>
                </div>
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h4 className="text-xl font-bold mb-3 text-yellow-800">⚡ Acciones Rápidas</h4>
                  <div className="space-y-3">
                    <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
                      ➕ Registrar Ingreso
                    </button>
                    <button className="w-full px-6 py-3 bg-red-600 text-white rounded-lg text-lg font-semibold hover:bg-red-700 transition-colors">
                      ➖ Registrar Egreso
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tabActiva === 'ingresos-egresos' && (
            <div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800">📊 Comparativa Ingresos vs Egresos</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dataGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" style={{ fontSize: '16px' }} />
                  <YAxis style={{ fontSize: '16px' }} />
                  <Tooltip 
                    contentStyle={{ fontSize: '18px' }}
                    formatter={(value) => formatearMonto(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '18px' }} />
                  <Bar dataKey="Ingresos" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Egresos" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {tabActiva === 'tendencias' && (
            <div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800">📈 Tendencias</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dataGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" style={{ fontSize: '16px' }} />
                  <YAxis style={{ fontSize: '16px' }} />
                  <Tooltip 
                    contentStyle={{ fontSize: '18px' }}
                    formatter={(value) => formatearMonto(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '18px' }} />
                  <Line type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} />
                  <Line type="monotone" dataKey="Egresos" stroke="#ef4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {tabActiva === 'distribucion' && (
            <div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800">🥧 Distribución</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Ingresos', value: parseFloat(balance.total_ingresos || 0) },
                      { name: 'Egresos', value: parseFloat(balance.total_egresos || 0) }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[COLORS[0], COLORS[1]].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatearMonto(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default DashboardPage;
