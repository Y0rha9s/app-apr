import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PRIMER_ANIO = 2026; // año en que empezó a usarse el sistema

const FORMAS = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'tarjeta', label: '💳 Tarjeta' },
  { id: 'abono', label: '📎 Abono' },
  { id: 'otro', label: '❔ Otro' },
];

// Fecha de hoy en Chile (no la del navegador): { anio, mes }
const hoyChile = () => {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number);
  return { anio, mes };
};

const formatearMonto = (monto) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(monto || 0);

// Historial de todos los pagos del mes o del año, descargable a Excel. Solo admin.
function HistorialPagosPage() {
  const hoy = hoyChile();
  const [anio, setAnio] = useState(hoy.anio);
  const [mes, setMes] = useState(String(hoy.mes)); // '' = todo el año
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const anios = [];
  for (let a = hoy.anio; a >= PRIMER_ANIO; a--) anios.push(a);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await api.get('/informe-caja/pagos', { params: { anio, mes }, headers: authHeaders() });
      setDatos(res.data);
    } catch (err) {
      setDatos(null);
      setError(err.response?.data?.error || 'No se pudo cargar el historial de pagos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const descargarExcel = async () => {
    setDescargando(true);
    try {
      const res = await api.get('/informe-caja/pagos/excel', {
        params: { anio, mes },
        headers: authHeaders(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagos_${anio}${mes ? '-' + String(mes).padStart(2, '0') : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error descargando Excel:', err);
      alert('❌ No se pudo descargar el Excel');
    } finally {
      setDescargando(false);
    }
  };

  const resumen = datos?.resumen;
  const periodo = mes ? `${MESES[parseInt(mes, 10) - 1]} ${anio}` : `Año ${anio}`;
  const inputClase = 'w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white';

  return (
    <div>
      <h2 className="text-4xl font-bold mb-2 text-gray-800">🗂️ Historial de Pagos</h2>
      <p className="text-gray-600 mb-8">
        Todos los pagos del mes o del año, con RUT, nombre, forma de pago, monto y comentario. Descargable a Excel.
      </p>

      <Card className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Año</label>
            <select value={anio} onChange={(e) => setAnio(parseInt(e.target.value, 10))} className={inputClase}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Mes</label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} className={inputClase}>
              <option value="">Todo el año</option>
              {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
            </select>
          </div>
          <Button onClick={cargar} variant="primary" size="md">🔎 Ver</Button>
          <Button onClick={descargarExcel} variant="success" size="md" disabled={descargando || !datos}>
            {descargando ? '⏳ Generando...' : '📥 Descargar Excel'}
          </Button>
        </div>
      </Card>

      {cargando && <div className="text-center text-3xl py-12">⏳ Cargando pagos...</div>}
      {!cargando && error && (
        <Card><p className="text-xl text-red-600 font-semibold">⚠️ {error}</p></Card>
      )}

      {!cargando && datos && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <h3 className="text-lg font-semibold text-gray-600">{periodo}</h3>
              <p className="text-4xl font-bold text-blue-700">{formatearMonto(resumen.total)}</p>
              <p className="text-gray-600 mt-1">{resumen.cantidad} pagos</p>
            </Card>
            <Card className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Por forma de pago</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {FORMAS.filter((f) => resumen.por_forma[f.id]).map((f) => (
                  <div key={f.id}>
                    <span className="font-semibold">{f.label}:</span>{' '}
                    {formatearMonto(resumen.por_forma[f.id].total)}{' '}
                    <span className="text-gray-500">({resumen.por_forma[f.id].cantidad})</span>
                  </div>
                ))}
              </div>
              {resumen.sin_caja > 0 && (
                <p className="text-sm text-yellow-800 mt-3">
                  {resumen.sin_caja} pago(s) sin caja (migración histórica), incluidos en el total.
                </p>
              )}
            </Card>
          </div>

          <Card>
            {datos.pagos.length === 0 ? (
              <p className="text-xl text-gray-500 py-8 text-center">No hay pagos en el período seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="p-3 text-base font-semibold">N°</th>
                      <th className="p-3 text-base font-semibold">Fecha</th>
                      <th className="p-3 text-base font-semibold">RUT</th>
                      <th className="p-3 text-base font-semibold">Nombre</th>
                      <th className="p-3 text-base font-semibold">Forma de pago</th>
                      <th className="p-3 text-base font-semibold text-right">Monto</th>
                      <th className="p-3 text-base font-semibold">Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.pagos.map((p) => (
                      <tr key={p.numero} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">{p.numero}</td>
                        <td className="p-3 whitespace-nowrap text-sm">{p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)}/{p.fecha.slice(0, 4)} {p.fecha.slice(11)}</td>
                        <td className="p-3 font-mono text-sm">{p.rut}</td>
                        <td className="p-3 font-semibold">{p.nombre}</td>
                        <td className="p-3">{p.forma_pago_etiqueta}</td>
                        <td className="p-3 text-right font-bold text-green-700">{formatearMonto(p.monto)}</td>
                        <td className="p-3 text-sm">{p.comentario || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default HistorialPagosPage;
