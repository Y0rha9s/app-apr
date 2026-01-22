import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function CerrarCajaPage() {
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [resumenPagos, setResumenPagos] = useState({
    monto_efectivo: 0,
    monto_tarjeta: 0,
    monto_transferencia: 0
  });
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    verificarCajaAbierta();
  }, []);

  const verificarCajaAbierta = async () => {
  try {
    const response = await api.get('/cajas/abierta');
    console.log('Caja abierta:', response.data); // AGREGAR
    setCajaAbierta(response.data);
    
    if (response.data) {
      // Cargar resumen de pagos de esta caja
      const resumenResponse = await api.get(`/pagos/resumen/${response.data.id}`);
      console.log('Resumen pagos:', resumenResponse.data); // AGREGAR
      setResumenPagos(resumenResponse.data);
    }
    
    setLoading(false);
  } catch (error) {
    console.error('Error verificando caja:', error); // YA EXISTE
    setLoading(false);
  }
};

  const calcularTotales = () => {
    const saldoInicial = parseFloat(cajaAbierta?.saldo_inicial || 0);
    const efectivo = parseFloat(resumenPagos.monto_efectivo || 0);
    const transferencia = parseFloat(resumenPagos.monto_transferencia || 0);
    const tarjeta = parseFloat(resumenPagos.monto_tarjeta || 0);
    const contado = parseFloat(efectivoContado || 0);

    const efectivoEsperado = saldoInicial + efectivo;
    const totalGeneral = saldoInicial + efectivo + transferencia + tarjeta;
    const diferencia = contado - efectivoEsperado;

    return { efectivoEsperado, totalGeneral, diferencia };
  };

  const handleCerrarCaja = async (e) => {
    e.preventDefault();
    
    if (!window.confirm('¿Está seguro de cerrar la caja? Esta acción no se puede deshacer.')) {
      return;
    }

    setEnviando(true);

    try {
      await api.put(`/cajas/cerrar/${cajaAbierta.id}`, {
        monto_efectivo: parseFloat(resumenPagos.monto_efectivo || 0),
        monto_transferencia: parseFloat(resumenPagos.monto_transferencia || 0),
        monto_tarjeta: parseFloat(resumenPagos.monto_tarjeta || 0),
        efectivo_contado: parseFloat(efectivoContado || 0),
        observaciones_cierre: observaciones
      });

      alert('✅ Caja cerrada exitosamente');
      verificarCajaAbierta();
      setEfectivoContado('');
      setObservaciones('');
    } catch (error) {
      alert('❌ Error al cerrar caja: ' + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  const { efectivoEsperado, totalGeneral, diferencia } = calcularTotales();

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  if (!cajaAbierta) {
    return (
      <div>
        <h2 className="text-4xl font-bold mb-8 text-gray-800">🔒 Cerrar Caja</h2>
        
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <div className="flex items-center gap-4">
            <span className="text-6xl">ℹ️</span>
            <div>
              <h3 className="text-3xl font-bold text-blue-800">No hay caja abierta</h3>
              <p className="text-xl text-blue-700 mt-2">Debe abrir una caja antes de poder cerrarla</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">🔒 Cerrar Caja</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Resumen del día */}
        <Card>
          <h3 className="text-2xl font-bold mb-6">📊 Resumen del Día</h3>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-lg font-semibold text-gray-700">Saldo Inicial</p>
              <p className="text-2xl font-bold text-gray-900">{formatearMonto(cajaAbierta.saldo_inicial)}</p>
              <p className="text-sm text-gray-600 mt-1">
                Apertura: {new Date(cajaAbierta.fecha_apertura).toLocaleString('es-CL')}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
              <p className="text-lg font-semibold text-green-800">💵 Monto Efectivo</p>
              <p className="text-2xl font-bold text-green-700">{formatearMonto(resumenPagos.monto_efectivo)}</p>
              <p className="text-sm text-green-600 mt-1">Pagos recibidos en efectivo</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <p className="text-lg font-semibold text-blue-800">💳 Monto Transferencia</p>
              <p className="text-2xl font-bold text-blue-700">{formatearMonto(resumenPagos.monto_transferencia)}</p>
              <p className="text-sm text-blue-600 mt-1">Pagos recibidos por transferencia</p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
              <p className="text-lg font-semibold text-purple-800">💳 Monto Tarjeta</p>
              <p className="text-2xl font-bold text-purple-700">{formatearMonto(resumenPagos.monto_tarjeta)}</p>
              <p className="text-sm text-purple-600 mt-1">Pagos recibidos con tarjeta</p>
            </div>
          </div>

          <form onSubmit={handleCerrarCaja} className="mt-8 space-y-6">
            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Efectivo Contado (físico en caja) *
              </label>
              <input
                type="number"
                step="0.01"
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                required
              />
              <p className="text-base text-gray-600 mt-2">Dinero físico realmente contado en caja</p>
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas sobre el cierre (opcional)"
                rows="3"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
              ></textarea>
            </div>

            <Button type="submit" variant="danger" className="w-full" disabled={enviando}>
              {enviando ? '⏳ Cerrando...' : '🔒 Cerrar Caja'}
            </Button>
          </form>
        </Card>

        {/* Totales calculados */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-cyan-50 to-blue-50">
            <h3 className="text-2xl font-bold mb-6">💰 Totales</h3>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-lg text-gray-600">Efectivo Esperado</p>
                <p className="text-3xl font-bold text-cyan-600">{formatearMonto(efectivoEsperado)}</p>
                <p className="text-sm text-gray-500 mt-1">Saldo Inicial + Efectivo del día</p>
              </div>

              <div className="bg-white p-4 rounded-lg">
                <p className="text-lg text-gray-600">Total General</p>
                <p className="text-3xl font-bold text-green-600">{formatearMonto(totalGeneral)}</p>
                <p className="text-sm text-gray-500 mt-1">Todos los ingresos del día</p>
              </div>

              <div className={`p-4 rounded-lg ${
                diferencia === 0 ? 'bg-green-100 border-2 border-green-400' : 
                diferencia > 0 ? 'bg-blue-100 border-2 border-blue-400' : 
                'bg-red-100 border-2 border-red-400'
              }`}>
                <p className="text-lg font-semibold">Diferencia</p>
                <p className={`text-4xl font-bold ${
                  diferencia === 0 ? 'text-green-600' : 
                  diferencia > 0 ? 'text-blue-600' : 
                  'text-red-600'
                }`}>
                  {formatearMonto(Math.abs(diferencia))}
                </p>
                <p className="text-lg font-semibold mt-2">
                  {diferencia > 0 && '📈 Sobrante'}
                  {diferencia < 0 && '📉 Faltante'}
                  {diferencia === 0 && '✅ Cuadrado'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CerrarCajaPage;