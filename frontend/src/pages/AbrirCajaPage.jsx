import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function AbrirCajaPage() {
  const { usuario } = useAuth();
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [saldoInicial, setSaldoInicial] = useState('');
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

  const handleAbrirCaja = async (e) => {
    e.preventDefault();
    setEnviando(true);

    try {
      await api.post('/cajas/abrir', {
        usuario_id: usuario.id,
        saldo_inicial: parseFloat(saldoInicial),
        observaciones_apertura: observaciones
      });

      alert('✅ Caja abierta exitosamente');
      verificarCajaAbierta();
      setSaldoInicial('');
      setObservaciones('');
    } catch (error) {
      alert('❌ Error al abrir caja: ' + error.message);
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

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando...</div>;
  }

  if (cajaAbierta) {
    return (
      <div>
        <h2 className="text-4xl font-bold mb-8 text-gray-800">💰 Abrir Caja</h2>
        
        <Card className="bg-yellow-50 border-l-4 border-yellow-600">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-6xl">⚠️</span>
            <div>
              <h3 className="text-3xl font-bold text-yellow-800">Ya hay una caja abierta</h3>
              <p className="text-xl text-yellow-700 mt-2">Debe cerrar la caja actual antes de abrir una nueva</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 mt-6">
            <h4 className="text-2xl font-bold mb-4">Información de la caja abierta:</h4>
            <div className="space-y-3 text-lg">
              <p><strong>Fecha de apertura:</strong> {new Date(cajaAbierta.fecha_apertura).toLocaleString('es-CL')}</p>
              <p><strong>Saldo inicial:</strong> {formatearMonto(cajaAbierta.saldo_inicial)}</p>
              <p><strong>Observaciones:</strong> {cajaAbierta.observaciones_apertura || '-'}</p>
            </div>
          </div>

          <div className="mt-6">
            <Button variant="danger" className="w-full" onClick={() => window.location.href = '#cerrar-caja'}>
              Ir a Cerrar Caja
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">💰 Abrir Caja</h2>

      <div className="max-w-2xl">
        <Card>
          <form onSubmit={handleAbrirCaja} className="space-y-6">
            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Saldo Inicial *
              </label>
              <input
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="Ej: 50000"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                required
              />
              <p className="text-base text-gray-600 mt-2">Monto en efectivo con el que inicia la caja</p>
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales (opcional)"
                rows="4"
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
              ></textarea>
            </div>

            <div className="flex gap-4">
              <Button type="submit" variant="primary" className="flex-1" disabled={enviando}>
                {enviando ? '⏳ Abriendo...' : '✅ Abrir Caja'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default AbrirCajaPage;