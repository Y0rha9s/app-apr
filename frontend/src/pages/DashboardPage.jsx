import { useState, useEffect } from 'react';
import { transaccionesService, usuariosService } from '../services/api';
import api from '../services/api';
import Card from '../components/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

function DashboardPage() {
  const [balance, setBalance] = useState({ total_ingresos: 0, total_egresos: 0 });
  const [kpis, setKpis] = useState(null);
  const [topConsumidores, setTopConsumidores] = useState([]);
  const [topDeudores, setTopDeudores] = useState([]);
  const [evolucionConsumo, setEvolucionConsumo] = useState([]);
  const [alertas, setAlertas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [infoUsuario, setInfoUsuario] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [pestanaPrincipal, setPestanaPrincipal] = useState('kpis');
  const [rango, setRango] = useState('3m');

  useEffect(() => {
    cargarDatos(rango);
  }, [rango]);

  const cargarDatos = async (rangoActual = '3m') => {
    try {
      const [
        balanceRes,
        kpisRes,
        consumidoresRes,
        deudoresRes,
        evolucionRes,
        alertasRes,
        usuariosRes
      ] = await Promise.all([
        transaccionesService.getBalance(new Date().getMonth() + 1, new Date().getFullYear()),
        api.get(`/dashboard/kpis?rango=${rangoActual}`),
        api.get(`/dashboard/top-consumidores?rango=${rangoActual}`),
        api.get(`/dashboard/top-deudores?rango=${rangoActual}`),
        api.get(`/dashboard/evolucion-consumo?rango=${rangoActual}`),
        api.get(`/dashboard/alertas?rango=${rangoActual}`),
        usuariosService.getAll()
      ]);

      setBalance(balanceRes.data);
      setKpis(kpisRes.data.kpis);
      setTopConsumidores(consumidoresRes.data.consumidores || []);
      setTopDeudores(deudoresRes.data.deudores || []);
      setEvolucionConsumo(evolucionRes.data.evolucion || []);
      setAlertas(alertasRes.data.alertas);
      setUsuarios(usuariosRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
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
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando dashboard...</div>;
  }

  const RANGOS = [
    { valor: '7d', label: '7 días' },
    { valor: '15d', label: '15 días' },
    { valor: '30d', label: '30 días' },
    { valor: '3m', label: '3 meses' },
    { valor: '6m', label: '6 meses' },
    { valor: '1y', label: '1 año' },
  ];

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">📊 Dashboard Administrativo</h2>

      {/* Selector de rango */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {RANGOS.map(r => (
          <button
            key={r.valor}
            onClick={() => setRango(r.valor)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${rango === r.valor
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Pestañas Principales */}
      <div className="mb-6">
        <div className="flex gap-2 border-b-2 border-gray-200 overflow-x-auto">
          <button
            onClick={() => setPestanaPrincipal('kpis')}
            className={`px-8 py-4 text-xl font-semibold transition-colors whitespace-nowrap ${pestanaPrincipal === 'kpis'
              ? 'border-b-4 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            📊 KPIs y Métricas
          </button>
          <button
            onClick={() => setPestanaPrincipal('analisis')}
            className={`px-8 py-4 text-xl font-semibold transition-colors whitespace-nowrap ${pestanaPrincipal === 'analisis'
              ? 'border-b-4 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            📈 Análisis y Rankings
          </button>
          <button
            onClick={() => setPestanaPrincipal('alertas')}
            className={`px-8 py-4 text-xl font-semibold transition-colors whitespace-nowrap ${pestanaPrincipal === 'alertas'
              ? 'border-b-4 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            🔔 Alertas Tempranas
          </button>
          <button
            onClick={() => setPestanaPrincipal('busqueda')}
            className={`px-8 py-4 text-xl font-semibold transition-colors whitespace-nowrap ${pestanaPrincipal === 'busqueda'
              ? 'border-b-4 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            🔍 Búsqueda de Usuario
          </button>
        </div>
      </div>

      {/* KPIs Y MÉTRICAS */}
      {pestanaPrincipal === 'kpis' && kpis && (
        <div className="space-y-6">
          {/* KPIs Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">👥 Total Usuarios</h3>
              <p className="text-4xl font-bold text-blue-700">{kpis.total_usuarios}</p>
              <p className="text-sm text-gray-600 mt-2">{kpis.usuarios_activos} activos</p>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">⚠️ Tasa Morosidad</h3>
              <p className="text-4xl font-bold text-red-700">{kpis.tasa_morosidad}%</p>
              <p className="text-sm text-gray-600 mt-2">{kpis.usuarios_morosos} usuarios</p>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">💰 Deuda Total</h3>
              <p className="text-3xl font-bold text-orange-700">{formatearMonto(kpis.deuda_total)}</p>
              <p className="text-sm text-gray-600 mt-2">Pendiente de pago</p>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-l-4 border-cyan-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">💧 Consumo Promedio</h3>
              <p className="text-4xl font-bold text-cyan-700">{kpis.consumo_promedio}</p>
              <p className="text-sm text-gray-600 mt-2">m³ por usuario</p>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">💵 Ingresos Mes</h3>
              <p className="text-3xl font-bold text-green-700">{formatearMonto(kpis.ingresos_mes_actual)}</p>
              <p className="text-sm text-gray-600 mt-2">Mes actual</p>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-600">
              <h3 className="text-base font-semibold text-gray-700 mb-2">📊 Balance</h3>
              <p className="text-3xl font-bold text-purple-700">
                {formatearMonto(parseFloat(balance.total_ingresos || 0) - parseFloat(balance.total_egresos || 0))}
              </p>
              <p className="text-sm text-gray-600 mt-2">Ingresos - Egresos</p>
            </Card>
          </div>

          {/* Gráfico de Evolución de Consumo */}
          <Card title="📈 Evolución de Consumo (Últimos 6 Meses)">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={evolucionConsumo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => `${parseFloat(value).toFixed(1)} m³`} />
                <Legend />
                <Line type="monotone" dataKey="consumo_promedio" stroke="#0ea5e9" strokeWidth={3} name="Consumo Promedio" />
                <Line type="monotone" dataKey="consumo_total" stroke="#8b5cf6" strokeWidth={3} name="Consumo Total" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ANÁLISIS Y RANKINGS */}
      {pestanaPrincipal === 'analisis' && (
        <div className="space-y-6">
          {/* Top Consumidores */}
          <Card title="🏆 Top 10 Mayores Consumidores">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 border-b-2">
                  <tr>
                    <th className="p-3 text-base font-semibold">#</th>
                    <th className="p-3 text-base font-semibold">Usuario</th>
                    <th className="p-3 text-base font-semibold">N° Cliente</th>
                    <th className="p-3 text-base font-semibold">Consumo Total (3 meses)</th>
                    <th className="p-3 text-base font-semibold">Promedio Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {topConsumidores.map((consumidor, index) => (
                    <tr key={consumidor.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-lg">{index + 1}</td>
                      <td className="p-3 font-semibold">{consumidor.nombre}</td>
                      <td className="p-3 font-mono">{consumidor.numero_cliente}</td>
                      <td className="p-3 font-bold text-cyan-600">{parseFloat(consumidor.consumo_total).toFixed(1)} m³</td>
                      <td className="p-3">{parseFloat(consumidor.consumo_promedio).toFixed(1)} m³</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Top Deudores */}
          <Card title="⚠️ Top 10 Mayores Deudores">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 border-b-2">
                  <tr>
                    <th className="p-3 text-base font-semibold">#</th>
                    <th className="p-3 text-base font-semibold">Usuario</th>
                    <th className="p-3 text-base font-semibold">RUT</th>
                    <th className="p-3 text-base font-semibold">Deuda Total</th>
                    <th className="p-3 text-base font-semibold">Boletas Pendientes</th>
                    <th className="p-3 text-base font-semibold">Días Mora</th>
                  </tr>
                </thead>
                <tbody>
                  {topDeudores.map((deudor, index) => (
                    <tr key={deudor.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-lg">{index + 1}</td>
                      <td className="p-3 font-semibold">{deudor.nombre}</td>
                      <td className="p-3 font-mono text-sm">{deudor.rut}</td>
                      <td className="p-3 font-bold text-red-600">{formatearMonto(deudor.deuda_total)}</td>
                      <td className="p-3 text-center">{deudor.boletas_pendientes}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${deudor.dias_morosidad > 90 ? 'bg-red-100 text-red-800' :
                          deudor.dias_morosidad > 60 ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {deudor.dias_morosidad} días
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Gráfico de Top Consumidores */}
          <Card title="📊 Comparativa de Consumo">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topConsumidores.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" angle={-15} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => `${parseFloat(value).toFixed(1)} m³`} />
                <Legend />
                <Bar dataKey="consumo_total" fill="#0ea5e9" name="Consumo Total (3 meses)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ALERTAS TEMPRANAS */}
      {pestanaPrincipal === 'alertas' && alertas && (
        <div className="space-y-6">
          {/* Nuevos Morosos */}
          <Card title="🆕 Nuevos Morosos (Últimos 7 días)" className="bg-red-50">
            {alertas.nuevos_morosos.length === 0 ? (
              <p className="text-center py-6 text-gray-600">✅ No hay nuevos morosos en los últimos 7 días</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-base font-semibold">Usuario</th>
                      <th className="p-3 text-base font-semibold">Período</th>
                      <th className="p-3 text-base font-semibold">Deuda</th>
                      <th className="p-3 text-base font-semibold">Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.nuevos_morosos.map((moroso, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-semibold">{moroso.nombre}</td>
                        <td className="p-3">{moroso.periodo}</td>
                        <td className="p-3 font-bold text-red-600">{formatearMonto(moroso.saldo_pendiente)}</td>
                        <td className="p-3">{formatearFecha(moroso.fecha_vencimiento)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Consumo Anormal */}
          <Card title="⚡ Consumo Anormal Detectado" className="bg-yellow-50">
            {alertas.consumo_anormal.length === 0 ? (
              <p className="text-center py-6 text-gray-600">✅ No se detectó consumo anormal</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-base font-semibold">Usuario</th>
                      <th className="p-3 text-base font-semibold">Consumo Actual</th>
                      <th className="p-3 text-base font-semibold">Promedio</th>
                      <th className="p-3 text-base font-semibold">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.consumo_anormal.map((alerta, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-semibold">{alerta.nombre}</td>
                        <td className="p-3">{parseFloat(alerta.consumo_actual).toFixed(1)} m³</td>
                        <td className="p-3">{parseFloat(alerta.consumo_promedio).toFixed(1)} m³</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${parseFloat(alerta.variacion_porcentaje) > 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {parseFloat(alerta.variacion_porcentaje) > 0 ? '↑' : '↓'}
                            {Math.abs(parseFloat(alerta.variacion_porcentaje)).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Cortes Próximos */}
          <Card title="✂️ Cortes Programados (Próximos 7 días)" className="bg-orange-50">
            {alertas.cortes_proximos.length === 0 ? (
              <p className="text-center py-6 text-gray-600">✅ No hay cortes programados próximamente</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-base font-semibold">Usuario</th>
                      <th className="p-3 text-base font-semibold">Fecha Corte</th>
                      <th className="p-3 text-base font-semibold">Motivo</th>
                      <th className="p-3 text-base font-semibold">Monto Corte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.cortes_proximos.map((corte, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-semibold">{corte.nombre}</td>
                        <td className="p-3">{formatearFecha(corte.fecha_corte)}</td>
                        <td className="p-3">{corte.motivo}</td>
                        <td className="p-3 font-bold text-orange-600">{formatearMonto(corte.monto_corte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* BÚSQUEDA DE USUARIO (mantener funcionalidad existente) */}
      {pestanaPrincipal === 'busqueda' && (
        <div>
          <Card className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50">
            <h3 className="text-2xl font-bold mb-4 text-gray-800">🔍 Búsqueda de Usuario</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Buscar por número de cliente..."
                value={busquedaUsuario}
                onChange={(e) => setBusquedaUsuario(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarUsuario()}
                className="flex-1 px-4 py-3 text-lg border-2 rounded-xl w-full"
              />
              <button
                onClick={buscarUsuario}
                disabled={cargandoUsuario}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl w-full md:w-auto hover:bg-blue-700 disabled:opacity-50"
              >
                {cargandoUsuario ? '⏳ Buscando...' : 'Buscar'}
              </button>
            </div>
          </Card>

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
            </div>
          )}

          {!infoUsuario && usuarioSeleccionado === null && !errorBusqueda && (
            <Card className="text-center py-12">
              <p className="text-xl text-gray-500">🔍 Busca un usuario para ver su información detallada</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardPage;