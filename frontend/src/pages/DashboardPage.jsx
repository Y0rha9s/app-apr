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
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [pestanaPrincipal, setPestanaPrincipal] = useState('busqueda');
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
    setErrorBusqueda(null);
    if (!busquedaUsuario.trim()) {
      setUsuarioSeleccionado(null);
      setInfoUsuario(null);
      return;
    }

    setCargandoUsuario(true);
    try {
      const termino = busquedaUsuario.toLowerCase();
      // Buscar por número de cliente, RUT o nombre
      const usuario = usuarios.find(u => 
        u.numero_cliente?.toLowerCase().includes(termino) ||
        u.rut?.toLowerCase().includes(termino) ||
        u.nombre?.toLowerCase().includes(termino)
      );

      if (usuario) {
        setUsuarioSeleccionado(usuario);
        const info = await usuariosService.getInfoCompleta(usuario.id);
        setInfoUsuario(info.data);
      } else {
        setUsuarioSeleccionado(null);
        setInfoUsuario(null);
        setErrorBusqueda('No se encontró ningún usuario con ese criterio de búsqueda.');
      }
    } catch (error) {
      console.error('Error buscando usuario:', error);
      setUsuarioSeleccionado(null);
      setInfoUsuario(null);
      setErrorBusqueda('Ocurrió un error al buscar la información del usuario.');
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

  // Preparar datos para gráfico de morosidad por mes
  const prepararDatosMorosidad = () => {
    if (!infoUsuario || !infoUsuario.lecturas || !infoUsuario.pagos) {
      return [];
    }

    // Agrupar lecturas por mes/año y calcular morosidad
    const lecturasPorMes = {};
    
    infoUsuario.lecturas.historial.forEach(lectura => {
      const key = `${lectura.anio}-${String(lectura.mes).padStart(2, '0')}`;
      if (!lecturasPorMes[key]) {
        lecturasPorMes[key] = {
          mes: lectura.mes,
          anio: lectura.anio,
          monto: 0,
          pagado: 0,
          fecha: lectura.fecha
        };
      }
      lecturasPorMes[key].monto += parseFloat(lectura.monto || 0);
    });

    // Calcular pagos por mes
    infoUsuario.pagos.historial.forEach(pago => {
      const fechaPago = new Date(pago.fecha);
      const mesPago = fechaPago.getMonth() + 1;
      const anioPago = fechaPago.getFullYear();

      // Buscar lecturas que corresponden a este pago
      Object.keys(lecturasPorMes).forEach(key => {
        const lectura = lecturasPorMes[key];
        const fechaLectura = new Date(lectura.fecha);
        
        // Si el pago es posterior o igual a la lectura, se aplica
        if (fechaPago >= fechaLectura) {
          const montoRestante = lectura.monto - lectura.pagado;
          if (montoRestante > 0) {
            const montoAplicar = Math.min(pago.monto, montoRestante);
            lectura.pagado += montoAplicar;
          }
        }
      });
    });

    // Convertir a array y calcular morosidad
    const datos = Object.values(lecturasPorMes)
      .filter(item => item.monto > item.pagado)
      .map(item => ({
        mes: `${new Date(item.anio, item.mes - 1).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}`,
        monto: item.monto - item.pagado,
        montoTotal: item.monto,
        pagado: item.pagado
      }))
      .sort((a, b) => {
        // Ordenar por fecha
        const fechaA = new Date(a.mes);
        const fechaB = new Date(b.mes);
        return fechaA - fechaB;
      });

    return datos;
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
  const datosMorosidad = prepararDatosMorosidad();

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">📊 Dashboard General</h2>

      {/* Pestañas Principales */}
      <div className="mb-6">
        <div className="flex gap-2 border-b-2 border-gray-200">
          <button
            onClick={() => setPestanaPrincipal('busqueda')}
            className={`px-8 py-4 text-xl font-semibold transition-colors ${
              pestanaPrincipal === 'busqueda'
                ? 'border-b-4 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            🔍 Búsqueda de Usuarios
          </button>
          <button
            onClick={() => setPestanaPrincipal('resumen')}
            className={`px-8 py-4 text-xl font-semibold transition-colors ${
              pestanaPrincipal === 'resumen'
                ? 'border-b-4 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            📊 Resumen General
          </button>
        </div>
      </div>

      {/* Contenido de Pestaña: Búsqueda de Usuarios */}
      {pestanaPrincipal === 'busqueda' && (
        <div>
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
          </Card>

          {/* Información del Usuario Seleccionado */}
          {errorBusqueda && (
            <Card className="mb-6 bg-red-50 border-l-8 border-red-500">
              <div className="flex items-center">
                <div className="text-2xl mr-4">⚠️</div>
                <p className="text-red-700 font-semibold">{errorBusqueda}</p>
              </div>
            </Card>
          )}

          {infoUsuario && (
            <div className="space-y-6">
              {/* Información Básica */}
              <Card>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">👤 Información del Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nombre</p>
                    <p className="text-lg font-semibold">{infoUsuario.usuario.nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">RUT</p>
                    <p className="text-lg font-semibold">{infoUsuario.usuario.rut}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">N° Cliente</p>
                    <p className="text-lg font-bold text-blue-600">{infoUsuario.usuario.numero_cliente || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="text-lg font-semibold">{infoUsuario.usuario.telefono || 'N/A'}</p>
                  </div>
                </div>
              </Card>

              {/* Resumen de Morosidad */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-red-50 border-l-8 border-red-600">
                  <h4 className="text-xl font-bold mb-2 text-red-800">⚠️ Deuda Total</h4>
                  <p className="text-3xl font-bold text-red-700">{formatearMonto(infoUsuario.morosidad.deuda_total)}</p>
                </Card>
                <Card className="bg-orange-50 border-l-8 border-orange-600">
                  <h4 className="text-xl font-bold mb-2 text-orange-800">📅 Meses en Mora</h4>
                  <p className="text-3xl font-bold text-orange-700">{infoUsuario.morosidad.meses_en_mora}</p>
                </Card>
                <Card className="bg-yellow-50 border-l-8 border-yellow-600">
                  <h4 className="text-xl font-bold mb-2 text-yellow-800">💰 Saldo Anterior</h4>
                  <p className="text-3xl font-bold text-yellow-700">{formatearMonto(infoUsuario.saldo_anterior_pendiente)}</p>
                </Card>
              </div>

              {/* Convenio y Notificaciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className={infoUsuario.usuario.tiene_convenio ? 'bg-green-50 border-l-8 border-green-600' : 'bg-gray-50 border-l-8 border-gray-400'}>
                  <h4 className="text-xl font-bold mb-2">🤝 Convenio</h4>
                  {infoUsuario.usuario.tiene_convenio ? (
                    <div>
                      <p className="text-green-700 font-bold text-lg mb-2">✅ Tiene Convenio</p>
                      {infoUsuario.usuario.convenio_detalle && (
                        <p className="text-gray-700">{infoUsuario.usuario.convenio_detalle}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">❌ Sin Convenio</p>
                  )}
                </Card>
                <Card className={infoUsuario.usuario.tiene_notificacion ? 'bg-yellow-50 border-l-8 border-yellow-600' : 'bg-gray-50 border-l-8 border-gray-400'}>
                  <h4 className="text-xl font-bold mb-2">🔔 Notificaciones</h4>
                  {infoUsuario.usuario.tiene_notificacion ? (
                    <div>
                      <p className="text-yellow-700 font-bold text-lg mb-2">⚠️ Tiene Notificación</p>
                      {infoUsuario.usuario.notificacion_detalle && (
                        <p className="text-gray-700">{infoUsuario.usuario.notificacion_detalle}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600">✅ Sin Notificaciones</p>
                  )}
                </Card>
              </div>

              {/* Gráfico de Morosidad por Mes */}
              {datosMorosidad.length > 0 && (
                <Card>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">📊 Gráfico de Morosidad por Mes</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={datosMorosidad}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" style={{ fontSize: '14px' }} />
                      <YAxis style={{ fontSize: '14px' }} />
                      <Tooltip 
                        contentStyle={{ fontSize: '16px' }}
                        formatter={(value) => formatearMonto(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: '16px' }} />
                      <Bar dataKey="monto" fill="#ef4444" radius={[8, 8, 0, 0]} name="Monto en Mora" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-center text-gray-600">
                    <p>Total de meses en mora: <strong>{datosMorosidad.length}</strong></p>
                    <p>Monto total en mora: <strong className="text-red-600">{formatearMonto(datosMorosidad.reduce((sum, item) => sum + item.monto, 0))}</strong></p>
                  </div>
                </Card>
              )}

              {/* Información de Pagos */}
              {infoUsuario.pagos.ultimo_pago && (
                <Card>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">💰 Información de Pagos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Pagado</p>
                      <p className="text-2xl font-bold text-green-600">{formatearMonto(infoUsuario.pagos.total_pagado)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cantidad de Pagos</p>
                      <p className="text-2xl font-bold">{infoUsuario.pagos.cantidad_pagos}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Último Pago</p>
                      <p className="text-lg font-semibold">{formatearFecha(infoUsuario.pagos.ultimo_pago.fecha)}</p>
                      <p className="text-xl font-bold text-green-600">{formatearMonto(infoUsuario.pagos.ultimo_pago.monto)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Método de Pago</p>
                      <p className="text-lg font-semibold capitalize">{infoUsuario.pagos.ultimo_pago.metodo}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {!infoUsuario && usuarioSeleccionado === null && !errorBusqueda && (
            <Card className="text-center py-12">
              <p className="text-xl text-gray-500">🔍 Busca un usuario para ver su información y gráficos</p>
            </Card>
          )}
        </div>
      )}

      {/* Contenido de Pestaña: Resumen General */}
      {pestanaPrincipal === 'resumen' && (
        <div>
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
      )}
    </div>
  );
}

export default DashboardPage;
