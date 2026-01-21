import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function MisCajasPage() {
  const [cajas, setCajas] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarCajas();
  }, []);

  const cargarCajas = async () => {
    try {
      const response = await api.get('/cajas');
      setCajas(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando cajas:', error);
      setLoading(false);
    }
  };

  const aplicarFiltro = async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione ambas fechas');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/cajas/filtrar?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
      setCajas(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error filtrando cajas:', error);
      setLoading(false);
    }
  };

  const limpiarFiltro = () => {
    setFechaInicio('');
    setFechaFin('');
    cargarCajas();
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

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando cajas...</div>;
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">📦 Mis Cajas</h2>

      {/* Filtros */}
      <Card className="mb-8">
        <h3 className="text-2xl font-bold mb-6">🔍 Filtrar por Fecha</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-end gap-3">
            <Button variant="primary" onClick={aplicarFiltro} className="flex-1">
              Aplicar Filtro
            </Button>
            <Button variant="outline" onClick={limpiarFiltro}>
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Total Cajas</h3>
          <p className="text-3xl font-bold text-blue-700">{cajas.length}</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Cajas Cerradas</h3>
          <p className="text-3xl font-bold text-green-700">
            {cajas.filter(c => c.estado === 'cerrada').length}
          </p>
        </Card>

        <Card className="bg-yellow-50 border-l-4 border-yellow-600">
          <h3 className="text-lg font-semibold text-gray-700">Cajas Abiertas</h3>
          <p className="text-3xl font-bold text-yellow-700">
            {cajas.filter(c => c.estado === 'abierta').length}
          </p>
        </Card>
      </div>

      {/* Lista de cajas */}
      <Card title="📋 Historial de Cajas">
        {cajas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-2xl font-semibold text-gray-600">No se encontraron cajas</p>
            <p className="text-lg text-gray-500 mt-2">Intente con otro rango de fechas o abra una nueva caja</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="p-4 text-lg font-semibold">Estado</th>
                  <th className="p-4 text-lg font-semibold">Apertura</th>
                  <th className="p-4 text-lg font-semibold">Cierre</th>
                  <th className="p-4 text-lg font-semibold">Saldo Inicial</th>
                  <th className="p-4 text-lg font-semibold">Total General</th>
                  <th className="p-4 text-lg font-semibold">Diferencia</th>
                  <th className="p-4 text-lg font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cajas.map((caja) => {
                  const totalGeneral = parseFloat(caja.monto_efectivo || 0) + 
                                     parseFloat(caja.monto_transferencia || 0) + 
                                     parseFloat(caja.monto_tarjeta || 0) +
                                     parseFloat(caja.saldo_inicial || 0);
                  
                  return (
                    <tr key={caja.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          caja.estado === 'abierta' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {caja.estado === 'abierta' ? '🟡 Abierta' : '✅ Cerrada'}
                        </span>
                      </td>
                      <td className="p-4 text-base">{formatearFecha(caja.fecha_apertura)}</td>
                      <td className="p-4 text-base">
                        {caja.fecha_cierre ? formatearFecha(caja.fecha_cierre) : '-'}
                      </td>
                      <td className="p-4 text-base font-semibold">
                        {formatearMonto(caja.saldo_inicial)}
                      </td>
                      <td className="p-4 text-base font-bold text-green-600">
                        {caja.estado === 'cerrada' ? formatearMonto(totalGeneral) : '-'}
                      </td>
                      <td className="p-4 text-base">
                        {caja.diferencia !== null && caja.diferencia !== undefined ? (
                          <span className={`font-bold ${
                            caja.diferencia === 0 ? 'text-green-600' : 
                            caja.diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {formatearMonto(Math.abs(caja.diferencia))}
                            {caja.diferencia > 0 && ' ↑'}
                            {caja.diferencia < 0 && ' ↓'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4">
                        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                          👁️ Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default MisCajasPage;