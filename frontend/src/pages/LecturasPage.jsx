import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';

function LecturasPage() {
  const [lecturas, setLecturas] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesActual] = useState(new Date().getMonth() + 1);
  const [anioActual] = useState(new Date().getFullYear());

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [lecturasRes, sociosRes] = await Promise.all([
        api.get('/lecturas'),
        api.get('/usuarios')
      ]);
      setLecturas(lecturasRes.data);
      setSocios(sociosRes.data.filter(s => s.rol === 'socio'));
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

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getNombreSocio = (usuarioId) => {
    const socio = socios.find(s => s.id === usuarioId);
    return socio ? socio.nombre : 'Desconocido';
  };

  const lecturasDelMes = lecturas.filter(l => l.mes === mesActual && l.anio === anioActual);
  const consumoTotal = lecturasDelMes.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando lecturas...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-gray-800">💧 Gestión de Lecturas</h2>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
          ➕ Nueva Lectura
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Lecturas del Mes</h3>
          <p className="text-3xl font-bold text-blue-700">{lecturasDelMes.length}</p>
          <p className="text-sm text-gray-600 mt-2">
            {new Date(anioActual, mesActual - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
          </p>
        </Card>

        <Card className="bg-cyan-50 border-l-4 border-cyan-600">
          <h3 className="text-lg font-semibold text-gray-700">Consumo Total</h3>
          <p className="text-3xl font-bold text-cyan-700">{consumoTotal} m³</p>
          <p className="text-sm text-gray-600 mt-2">Metros cúbicos del mes</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio por Socio</h3>
          <p className="text-3xl font-bold text-green-700">
            {lecturasDelMes.length > 0 ? Math.round(consumoTotal / lecturasDelMes.length) : 0} m³
          </p>
          <p className="text-sm text-gray-600 mt-2">Consumo promedio</p>
        </Card>
      </div>

      {/* Tabla de lecturas */}
      <Card title="📋 Historial de Lecturas">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">Socio</th>
                <th className="p-4 text-lg font-semibold">Fecha</th>
                <th className="p-4 text-lg font-semibold">Período</th>
                <th className="p-4 text-lg font-semibold">Lectura Anterior</th>
                <th className="p-4 text-lg font-semibold">Lectura Actual</th>
                <th className="p-4 text-lg font-semibold">Consumo (m³)</th>
                <th className="p-4 text-lg font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {lecturas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-xl text-gray-500">
                    No hay lecturas registradas
                  </td>
                </tr>
              ) : (
                lecturas.slice().reverse().map((lectura) => (
                  <tr key={lectura.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">{getNombreSocio(lectura.usuario_id)}</td>
                    <td className="p-4 text-base">{formatearFecha(lectura.fecha_lectura)}</td>
                    <td className="p-4 text-base">
                      {new Date(lectura.anio, lectura.mes - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-base text-center font-mono">{lectura.lectura_anterior}</td>
                    <td className="p-4 text-base text-center font-mono font-bold text-blue-600">
                      {lectura.lectura_actual}
                    </td>
                    <td className="p-4 text-base text-center">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {lectura.consumo_m3} m³
                      </span>
                    </td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(lectura.monto_calculado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default LecturasPage;