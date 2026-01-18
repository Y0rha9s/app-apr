import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';

function MorosidadPage() {
  const [socios, setSocios] = useState([]);
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [sociosRes, lecturasRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/lecturas')
      ]);
      setSocios(sociosRes.data);
      setLecturas(lecturasRes.data);
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

  // Calcular deuda por socio
  const calcularDeuda = (socioId) => {
    const lecturasDelSocio = lecturas.filter(l => l.usuario_id === socioId);
    const totalDeuda = lecturasDelSocio.reduce((sum, l) => sum + parseFloat(l.monto_calculado || 0), 0);
    const mesesAdeudados = lecturasDelSocio.length;
    return { totalDeuda, mesesAdeudados };
  };

  const sociosMorosos = socios
    .filter(s => s.estado === 'moroso' && s.rol === 'socio')
    .map(socio => {
      const { totalDeuda, mesesAdeudados } = calcularDeuda(socio.id);
      return { ...socio, totalDeuda, mesesAdeudados };
    });

  const deudaTotal = sociosMorosos.reduce((sum, s) => sum + s.totalDeuda, 0);

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando datos...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">⚠️ Gestión de Morosidad</h2>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700">Total Morosos</h3>
          <p className="text-4xl font-bold text-red-700">{sociosMorosos.length}</p>
          <p className="text-sm text-gray-600 mt-2">Socios con pagos pendientes</p>
        </Card>

        <Card className="bg-orange-50 border-l-4 border-orange-600">
          <h3 className="text-lg font-semibold text-gray-700">Deuda Total</h3>
          <p className="text-3xl font-bold text-orange-700">{formatearMonto(deudaTotal)}</p>
          <p className="text-sm text-gray-600 mt-2">Monto total adeudado</p>
        </Card>

        <Card className="bg-yellow-50 border-l-4 border-yellow-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio Deuda</h3>
          <p className="text-3xl font-bold text-yellow-700">
            {sociosMorosos.length > 0 ? formatearMonto(deudaTotal / sociosMorosos.length) : '$0'}
          </p>
          <p className="text-sm text-gray-600 mt-2">Por socio moroso</p>
        </Card>
      </div>

      {/* Tabla de morosos */}
      <Card title="📋 Lista de Morosos">
        {sociosMorosos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-2xl font-semibold text-green-600">¡No hay morosos!</p>
            <p className="text-lg text-gray-600 mt-2">Todos los socios están al día con sus pagos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">RUT</th>
                  <th className="p-4 text-lg font-semibold">Nombre</th>
                  <th className="p-4 text-lg font-semibold">Teléfono</th>
                  <th className="p-4 text-lg font-semibold">Meses Adeudados</th>
                  <th className="p-4 text-lg font-semibold">Deuda Total</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sociosMorosos
                  .sort((a, b) => b.totalDeuda - a.totalDeuda)
                  .map((socio) => (
                    <tr key={socio.id} className="border-b hover:bg-red-50">
                      <td className="p-4 text-base font-mono">{socio.rut}</td>
                      <td className="p-4 text-base font-semibold">{socio.nombre}</td>
                      <td className="p-4 text-base">{socio.telefono || '-'}</td>
                      <td className="p-4 text-center">
                        <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-base font-bold">
                          {socio.mesesAdeudados} {socio.mesesAdeudados === 1 ? 'mes' : 'meses'}
                        </span>
                      </td>
                      <td className="p-4 text-base font-bold text-red-600 text-right">
                        {formatearMonto(socio.totalDeuda)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                            📧 Enviar Aviso
                          </button>
                          <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                            💰 Registrar Pago
                          </button>
                          <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                            🚫 Suspender
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Acciones masivas */}
      {sociosMorosos.length > 0 && (
        <Card className="mt-8 bg-yellow-50">
          <h3 className="text-2xl font-bold mb-4 text-gray-800">⚡ Acciones Masivas</h3>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
              📧 Enviar Avisos a Todos
            </button>
            <button className="px-6 py-3 bg-orange-600 text-white rounded-lg text-lg font-semibold hover:bg-orange-700">
              📊 Exportar Lista
            </button>
            <button className="px-6 py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700">
              📄 Generar Reporte
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default MorosidadPage;