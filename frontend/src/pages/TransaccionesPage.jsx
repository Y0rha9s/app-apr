import { useState, useEffect } from 'react';
import { transaccionesService } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function TransaccionesPage() {
  const [transacciones, setTransacciones] = useState([]);
  const [balance, setBalance] = useState({ total_ingresos: 0, total_egresos: 0 });
  const [filtro, setFiltro] = useState('todas'); // 'todas', 'ingreso', 'egreso'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [filtro]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Cargar transacciones según filtro
      let response;
      if (filtro === 'todas') {
        response = await transaccionesService.getAll();
      } else {
        response = await transaccionesService.getByTipo(filtro);
      }
      setTransacciones(response.data);

      // Cargar balance
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
      currency: 'CLP'
    }).format(monto);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const balanceTotal = parseFloat(balance.total_ingresos || 0) - parseFloat(balance.total_egresos || 0);

  if (loading) {
    return <div className="p-8 text-center text-2xl">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold mb-8">Panel Admin - Ingresos y Egresos</h1>

      {/* Resumen Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Ingresos</h3>
          <p className="text-3xl font-bold text-green-600">
            {formatearMonto(balance.total_ingresos || 0)}
          </p>
        </Card>

        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Egresos</h3>
          <p className="text-3xl font-bold text-red-600">
            {formatearMonto(balance.total_egresos || 0)}
          </p>
        </Card>

        <Card className={`${balanceTotal >= 0 ? 'bg-blue-50 border-blue-600' : 'bg-orange-50 border-orange-600'} border-l-4`}>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Balance</h3>
          <p className={`text-3xl font-bold ${balanceTotal >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatearMonto(balanceTotal)}
          </p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <Button 
            variant={filtro === 'todas' ? 'primary' : 'neutral'}
            onClick={() => setFiltro('todas')}
          >
            Todas
          </Button>
          <Button 
            variant={filtro === 'ingreso' ? 'success' : 'neutral'}
            onClick={() => setFiltro('ingreso')}
          >
            Ingresos
          </Button>
          <Button 
            variant={filtro === 'egreso' ? 'danger' : 'neutral'}
            onClick={() => setFiltro('egreso')}
          >
            Egresos
          </Button>
        </div>
      </Card>

      {/* Tabla de transacciones */}
      <Card title="Listado de Transacciones">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">Fecha</th>
                <th className="p-4 text-lg font-semibold">Tipo</th>
                <th className="p-4 text-lg font-semibold">Categoría</th>
                <th className="p-4 text-lg font-semibold">Descripción</th>
                <th className="p-4 text-lg font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {transacciones.map((transaccion) => (
                <tr key={transaccion.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-base">{formatearFecha(transaccion.fecha)}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      transaccion.tipo === 'ingreso' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaccion.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="p-4 text-base">{transaccion.categoria}</td>
                  <td className="p-4 text-base">{transaccion.descripcion}</td>
                  <td className={`p-4 text-base font-bold text-right ${
                    transaccion.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatearMonto(transaccion.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default TransaccionesPage;