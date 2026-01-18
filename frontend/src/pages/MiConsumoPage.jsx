import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card from '../components/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function MiConsumoPage() {
  const { usuario } = useAuth();
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarLecturas();
  }, []);

  const cargarLecturas = async () => {
    try {
      const response = await api.get(`/lecturas/usuario/${usuario.id}`);
      setLecturas(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando lecturas:', error);
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

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  // Preparar datos para el gráfico
  const dataGrafico = lecturas
    .slice(-6)
    .reverse()
    .map(l => ({
      periodo: `${new Date(l.anio, l.mes - 1).toLocaleString('es-CL', { month: 'short' })} ${l.anio}`,
      consumo: l.consumo_m3,
      monto: parseFloat(l.monto_calculado)
    }));

  const consumoTotal = lecturas.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);
  const consumoPromedio = lecturas.length > 0 ? Math.round(consumoTotal / lecturas.length) : 0;
  const ultimaLectura = lecturas[0];

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando consumo...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">💧 Mi Consumo de Agua</h2>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-cyan-50 border-l-4 border-cyan-600">
          <h3 className="text-lg font-semibold text-gray-700">Último Consumo</h3>
          <p className="text-4xl font-bold text-cyan-700">
            {ultimaLectura ? `${ultimaLectura.consumo_m3} m³` : '-'}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {ultimaLectura && new Date(ultimaLectura.anio, ultimaLectura.mes - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
          </p>
        </Card>

        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio Mensual</h3>
          <p className="text-4xl font-bold text-blue-700">{consumoPromedio} m³</p>
          <p className="text-sm text-gray-600 mt-2">Basado en {lecturas.length} lecturas</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Última Cuenta</h3>
          <p className="text-3xl font-bold text-green-700">
            {ultimaLectura ? formatearMonto(ultimaLectura.monto_calculado) : '-'}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {ultimaLectura && formatearFecha(ultimaLectura.fecha_lectura)}
          </p>
        </Card>
      </div>

      {/* Gráfico de consumo */}
      {lecturas.length > 0 && (
        <Card title="📊 Historial de Consumo (Últimos 6 meses)" className="mb-8">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" style={{ fontSize: '16px' }} />
              <YAxis style={{ fontSize: '16px' }} label={{ value: 'm³', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ fontSize: '18px' }}
                formatter={(value, name) => {
                  if (name === 'consumo') return `${value} m³`;
                  if (name === 'monto') return formatearMonto(value);
                  return value;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '18px' }} />
              <Line 
                type="monotone" 
                dataKey="consumo" 
                stroke="#0891b2" 
                strokeWidth={3}
                name="Consumo (m³)"
                dot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabla de lecturas */}
      <Card title="📋 Detalle de Lecturas">
        {lecturas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-2xl font-semibold text-gray-600">No hay lecturas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Período</th>
                  <th className="p-4 text-lg font-semibold">Fecha Lectura</th>
                  <th className="p-4 text-lg font-semibold">Lectura Anterior</th>
                  <th className="p-4 text-lg font-semibold">Lectura Actual</th>
                  <th className="p-4 text-lg font-semibold">Consumo</th>
                  <th className="p-4 text-lg font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {lecturas.map((lectura) => (
                  <tr key={lectura.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">
                      {new Date(lectura.anio, lectura.mes - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-base">{formatearFecha(lectura.fecha_lectura)}</td>
                    <td className="p-4 text-base text-center font-mono">{lectura.lectura_anterior}</td>
                    <td className="p-4 text-base text-center font-mono font-bold text-blue-600">
                      {lectura.lectura_actual}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full font-bold text-base">
                        {lectura.consumo_m3} m³
                      </span>
                    </td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(lectura.monto_calculado)}
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

export default MiConsumoPage;