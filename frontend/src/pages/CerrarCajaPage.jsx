import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function CerrarCajaPage() {
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');
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
      setCajaAbierta(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error verificando caja:', error);
      setLoading(false);
    }
  };

  const calcularTotales = () => {
    const saldoInicial = parseFloat(cajaAbierta?.saldo_inicial || 0);
    const efectivo = parseFloat(montoEfectivo || 0);
    const transferencia = parseFloat(montoTransferencia || 0);
    const tarjeta = parseFloat(montoTarjeta || 0);
    const contado = parseFloat(efectivoContado || 0);

    const efectivoEsperado = saldoInicial + efectivo;
    const totalGeneral = efectivoEsperado + transferencia + tarjeta;
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
        monto_efectivo: parseFloat(montoEfectivo || 0),
        monto_transferencia: parseFloat(montoTransferencia || 0),
        monto_tarjeta: parseFloat(montoTarjeta || 0),
        efectivo_contado: parseFloat(efectivoContado || 0),
        observaciones_cierre: observaciones
      });

      alert('✅ Caja cerrada exitosamente');
      verificarCajaAbierta();
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
        {/* Formulario */}
        <Card>
          <h3 className="text-2xl font-bold mb-6">Arqueo de Caja</h3>
          
          <form onSubmit={handleCerrarCaja} className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-lg"><strong>Saldo Inicial:</strong> {formatearMonto(cajaAbierta.saldo_inicial)}</p>
              <p className="text-base text-gray-600">Fecha apertura: {new Date(cajaAbierta.fecha_apertura).toLocaleString('es-CL')}</p>
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Monto Efectivo (ventas) *
              </label>
              <input
                type="number"
                step="0.01"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Monto Transferencia
              </label>
              <input
                type="number"
                step="0.01"
                value={montoTransferencia}
                onChange={(e) => setMontoTransferencia(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Monto Tarjeta
              </label>
              <input
                type="number"
                step="0.01"
                value={montoTarjeta}
                onChange={(e) => setMontoTarjeta(e.target.value)}
                placeholder="0"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Efectivo Contado (físico) *
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

            <div className="flex gap-4">
              <Button type="submit" variant="danger" className="flex-1" disabled={enviando}>
                {enviando ? '⏳ Cerrando...' : '🔒 Cerrar Caja'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Resumen */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
            <h3 className="text-2xl font-bold mb-6">📊 Resumen</h3>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-lg text-gray-600">Efectivo Esperado</p>
                <p className="text-3xl font-bold text-blue-600">{formatearMonto(efectivoEsperado)}</p>
              </div>

              <div className="bg-white p-4 rounded-lg">
                <p className="text-lg text-gray-600">Total General</p>
                <p className="text-3xl font-bold text-green-600">{formatearMonto(totalGeneral)}</p>
                <p className="text-base text-gray-500 mt-1">Efectivo + Transferencia + Tarjeta</p>
              </div>

              <div className={`p-4 rounded-lg ${
                diferencia === 0 ? 'bg-green-100' : diferencia > 0 ? 'bg-blue-100' : 'bg-red-100'
              }`}>
                <p className="text-lg font-semibold">Diferencia</p>
                <p className={`text-3xl font-bold ${
                  diferencia === 0 ? 'text-green-600' : diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {formatearMonto(Math.abs(diferencia))}
                  {diferencia > 0 && ' (Sobrante)'}
                  {diferencia < 0 && ' (Faltante)'}
                  {diferencia === 0 && ' (Cuadrado)'}
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