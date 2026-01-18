import { useState, useEffect } from 'react';
import { transaccionesService } from '../services/api';
import Card from '../components/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function DashboardPage() {
  const [balance, setBalance] = useState({ total_ingresos: 0, total_egresos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
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

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  const balanceTotal = parseFloat(balance.total_ingresos || 0) - parseFloat(balance.total_egresos || 0);

  const dataGrafico = [
    {
      name: 'Enero 2026',
      Ingresos: parseFloat(balance.total_ingresos || 0),
      Egresos: parseFloat(balance.total_egresos || 0),
    }
  ];

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">📊 Dashboard General</h2>

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

      {/* Gráfico */}
      <Card title="📊 Comparativa Ingresos vs Egresos">
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
      </Card>

      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="bg-blue-50">
          <h3 className="text-2xl font-bold mb-4 text-blue-800">ℹ️ Información del Sistema</h3>
          <div className="space-y-3 text-lg">
            <p><strong>Período:</strong> Enero 2026</p>
            <p><strong>Estado:</strong> <span className="text-green-600 font-semibold">✅ Operativo</span></p>
            <p><strong>Última actualización:</strong> {new Date().toLocaleDateString('es-CL')}</p>
          </div>
        </Card>

        <Card className="bg-yellow-50">
          <h3 className="text-2xl font-bold mb-4 text-yellow-800">⚡ Acciones Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
              ➕ Registrar Ingreso
            </button>
            <button className="w-full px-6 py-3 bg-red-600 text-white rounded-lg text-lg font-semibold hover:bg-red-700 transition-colors">
              ➖ Registrar Egreso
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;