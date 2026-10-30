import { useState, useEffect, Fragment } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

const METODOS = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'tarjeta', label: '💳 Tarjeta' },
  { id: 'abono', label: '📎 Abono' },
];

const CATEGORIAS = [
  { id: 'personal', label: '👷 Personal' },
  { id: 'materiales', label: '🧱 Materiales' },
  { id: 'transporte', label: '🚚 Transporte' },
  { id: 'servicios', label: '🔧 Servicios' },
  { id: 'otros', label: '📌 Otros' },
];

const VISTAS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Fecha de hoy en Chile (no la del navegador), formato YYYY-MM-DD
const hoyChile = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const formatearMonto = (monto) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(monto || 0);

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmyyyy = (iso) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

const etiquetaPeriodo = (vista, p) => {
  if (vista === 'semana') return `Semana ${ddmm(p.desde)} al ${ddmm(p.hasta)}`;
  if (vista === 'mes') return `${MESES[parseInt(p.clave.slice(5, 7), 10) - 1]} ${p.clave.slice(0, 4)}`;
  return ddmmyyyy(p.clave);
};

const etiquetaMetodo = (id) => METODOS.find((m) => m.id === id)?.label.replace(/^\S+\s/, '') || id;
const etiquetaCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.label.replace(/^\S+\s/, '') || id;

const escaparCsv = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function InformeCajaPage() {
  const hoy = hoyChile();
  const [vista, setVista] = useState('dia');
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abiertos, setAbiertos] = useState({});
  const [expandirTodo, setExpandirTodo] = useState(false);

  const cargarInforme = async (vistaAUsar = vista) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/informe-caja', {
        params: { vista: vistaAUsar, desde, hasta },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setInforme(response.data);
      setAbiertos({});
    } catch (err) {
      console.error('Error cargando informe de caja:', err);
      setInforme(null);
      setError(err.response?.data?.error || 'No se pudo cargar el informe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarInforme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarVista = (nueva) => {
    setVista(nueva);
    cargarInforme(nueva);
  };

  const toggleFila = (clave) => setAbiertos((prev) => ({ ...prev, [clave]: !prev[clave] }));

  const imprimir = () => {
    setExpandirTodo(true);
    setTimeout(() => {
      window.print();
      setExpandirTodo(false);
    }, 150);
  };

  const exportarCsv = () => {
    if (!informe) return;
    const filas = [];
    filas.push([`Informe de caja (${informe.vista})`, `Desde ${informe.desde}`, `Hasta ${informe.hasta}`]);
    filas.push([]);
    filas.push(['Resumen por período']);
    filas.push(['Período', 'Pagos', 'Ingresos', 'Egresos', 'Neto']);
    informe.periodos.forEach((p) =>
      filas.push([etiquetaPeriodo(informe.vista, p), p.cantidad_pagos, p.ingresos, p.egresos, p.neto])
    );
    filas.push(['TOTAL', informe.resumen.cantidad_pagos, informe.resumen.ingresos.total, informe.resumen.egresos.total, informe.resumen.neto]);
    filas.push([]);
    filas.push(['Ingresos por método']);
    METODOS.forEach((m) => filas.push([m.label.replace(/^\S+\s/, ''), informe.resumen.ingresos[m.id]]));
    if (informe.resumen.ingresos.otro > 0) filas.push(['Otro', informe.resumen.ingresos.otro]);
    filas.push([]);
    filas.push(['Egresos por categoría']);
    CATEGORIAS.forEach((c) => filas.push([c.label.replace(/^\S+\s/, ''), informe.resumen.egresos[c.id]]));
    filas.push([]);
    filas.push(['Pagos sin caja (migración histórica, no incluidos en los totales)', informe.sin_caja.cantidad, informe.sin_caja.total]);
    filas.push([]);
    filas.push(['Detalle de movimientos']);
    filas.push(['Período', 'Fecha', 'Tipo', 'Usuario', 'N° cliente', 'Método / Categoría', 'Monto', 'Observaciones', 'Caja']);
    informe.periodos.forEach((p) =>
      p.movimientos.forEach((m) =>
        filas.push([
          etiquetaPeriodo(informe.vista, p), m.fecha, m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
          m.usuario || '', m.numero_cliente || '',
          m.tipo === 'ingreso' ? etiquetaMetodo(m.concepto) : etiquetaCategoria(m.concepto),
          m.tipo === 'ingreso' ? m.monto : -m.monto, m.observaciones, m.caja_id,
        ])
      )
    );

    // BOM + separador ';' para que Excel en español lo abra con las columnas bien separadas
    const csv = '﻿' + filas.map((f) => f.map(escaparCsv).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-caja_${informe.vista}_${informe.desde}_${informe.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resumen = informe?.resumen;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #informe-imprimible, #informe-imprimible * { visibility: visible; }
          #informe-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <h2 className="text-4xl font-bold mb-8 text-gray-800 no-imprimir">📊 Informe de Caja</h2>

      {/* Filtros */}
      <Card className="mb-8 no-imprimir">
        <h3 className="text-2xl font-bold mb-6">🔍 Filtros</h3>

        <div className="flex gap-3 mb-6">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => cambiarVista(v.id)}
              className={`px-6 py-3 text-lg font-semibold rounded-xl transition-all ${
                vista === v.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>
          <Button onClick={() => cargarInforme()} variant="primary" size="md">
            🔎 Aplicar
          </Button>
          <div className="flex gap-3">
            <Button onClick={exportarCsv} variant="neutral" size="md" disabled={!informe}>
              📥 CSV
            </Button>
            <Button onClick={imprimir} variant="neutral" size="md" disabled={!informe}>
              🖨️ Imprimir
            </Button>
          </div>
        </div>
      </Card>

      {loading && <div className="text-center text-3xl py-12">⏳ Cargando informe...</div>}

      {!loading && error && (
        <Card className="mb-8">
          <p className="text-xl text-red-600 font-semibold">⚠️ {error}</p>
        </Card>
      )}

      {!loading && informe && (
        <div id="informe-imprimible">
          <div className="hidden print:block mb-6">
            <h2 className="text-3xl font-bold">Informe de Caja</h2>
            <p className="text-lg">
              Vista por {VISTAS.find((v) => v.id === informe.vista)?.label.toLowerCase()} · {ddmmyyyy(informe.desde)} al {ddmmyyyy(informe.hasta)} (hora de Chile)
            </p>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <h3 className="text-2xl font-bold mb-4 text-green-700">⬆️ Ingresos</h3>
              <div className="space-y-2 text-lg">
                {METODOS.map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span>{m.label}</span>
                    <span className="font-semibold">{formatearMonto(resumen.ingresos[m.id])}</span>
                  </div>
                ))}
                {resumen.ingresos.otro > 0 && (
                  <div className="flex justify-between">
                    <span>❔ Otro método</span>
                    <span className="font-semibold">{formatearMonto(resumen.ingresos.otro)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 pt-2 text-xl font-bold text-green-700">
                  <span>Total</span>
                  <span>{formatearMonto(resumen.ingresos.total)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-2xl font-bold mb-4 text-red-700">⬇️ Egresos</h3>
              <div className="space-y-2 text-lg">
                {CATEGORIAS.map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <span>{c.label}</span>
                    <span className="font-semibold">{formatearMonto(resumen.egresos[c.id])}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t-2 pt-2 text-xl font-bold text-red-700">
                  <span>Total</span>
                  <span>{formatearMonto(resumen.egresos.total)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-2xl font-bold mb-4">💰 Neto</h3>
              <p className={`text-4xl font-bold mb-4 ${resumen.neto < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                {formatearMonto(resumen.neto)}
              </p>
              <div className="space-y-2 text-lg text-gray-700">
                <div className="flex justify-between">
                  <span>Cantidad de pagos</span>
                  <span className="font-semibold">{resumen.cantidad_pagos}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cantidad de egresos</span>
                  <span className="font-semibold">{resumen.cantidad_egresos}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Pagos sin caja */}
          {informe.sin_caja.cantidad > 0 && (
            <div className="mb-8 px-6 py-4 rounded-xl bg-yellow-50 border-2 border-yellow-300 text-lg text-yellow-900">
              <strong>Sin caja (migración histórica):</strong> {informe.sin_caja.cantidad} pago(s) por{' '}
              {formatearMonto(informe.sin_caja.total)}
              {' — '}
              {METODOS.filter((m) => informe.sin_caja.por_metodo[m.id] > 0)
                .map((m) => `${etiquetaMetodo(m.id)} ${formatearMonto(informe.sin_caja.por_metodo[m.id])}`)
                .join(' · ')}
              . No están incluidos en los totales de arriba.
            </div>
          )}

          {/* Tabla por período */}
          <Card>
            <h3 className="text-2xl font-bold mb-6">
              📅 Detalle por {VISTAS.find((v) => v.id === informe.vista)?.label.toLowerCase()}
            </h3>

            {informe.periodos.length === 0 ? (
              <p className="text-xl text-gray-500 py-6 text-center">No hay movimientos en el rango seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-lg">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-left text-gray-600">
                      <th className="py-3 pr-4">Período</th>
                      <th className="py-3 pr-4 text-right">Pagos</th>
                      <th className="py-3 pr-4 text-right">Ingresos</th>
                      <th className="py-3 pr-4 text-right">Egresos</th>
                      <th className="py-3 text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.periodos.map((p) => {
                      const abierto = expandirTodo || abiertos[p.clave];
                      return (
                        <Fragment key={p.clave}>
                          <tr
                            onClick={() => toggleFila(p.clave)}
                            className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                          >
                            <td className="py-3 pr-4 font-semibold">
                              <span className="no-imprimir mr-2">{abierto ? '▼' : '▶'}</span>
                              {etiquetaPeriodo(informe.vista, p)}
                            </td>
                            <td className="py-3 pr-4 text-right">{p.cantidad_pagos}</td>
                            <td className="py-3 pr-4 text-right text-green-700 font-semibold">{formatearMonto(p.ingresos)}</td>
                            <td className="py-3 pr-4 text-right text-red-700 font-semibold">{formatearMonto(p.egresos)}</td>
                            <td className={`py-3 text-right font-bold ${p.neto < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                              {formatearMonto(p.neto)}
                            </td>
                          </tr>
                          {abierto && (
                            <tr className="bg-gray-50">
                              <td colSpan={5} className="px-6 py-4">
                                <table className="w-full text-base">
                                  <thead>
                                    <tr className="text-left text-gray-500 border-b border-gray-200">
                                      <th className="py-2 pr-3">Fecha</th>
                                      <th className="py-2 pr-3">Tipo</th>
                                      <th className="py-2 pr-3">Usuario</th>
                                      <th className="py-2 pr-3">Método / Categoría</th>
                                      <th className="py-2 pr-3 text-right">Monto</th>
                                      <th className="py-2">Observaciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.movimientos.map((m, i) => (
                                      <tr key={`${m.tipo}-${i}`} className="border-b border-gray-100">
                                        <td className="py-2 pr-3 whitespace-nowrap">{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)} {m.fecha.slice(11)}</td>
                                        <td className="py-2 pr-3">{m.tipo === 'ingreso' ? '⬆️ Ingreso' : '⬇️ Egreso'}</td>
                                        <td className="py-2 pr-3">{m.usuario || '-'}</td>
                                        <td className="py-2 pr-3">
                                          {m.tipo === 'ingreso' ? etiquetaMetodo(m.concepto) : etiquetaCategoria(m.concepto)}
                                        </td>
                                        <td className={`py-2 pr-3 text-right font-semibold ${m.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                                          {m.tipo === 'egreso' ? '-' : ''}{formatearMonto(m.monto)}
                                        </td>
                                        <td className="py-2">{m.observaciones || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="py-3 pr-4">TOTAL</td>
                      <td className="py-3 pr-4 text-right">{resumen.cantidad_pagos}</td>
                      <td className="py-3 pr-4 text-right text-green-700">{formatearMonto(resumen.ingresos.total)}</td>
                      <td className="py-3 pr-4 text-right text-red-700">{formatearMonto(resumen.egresos.total)}</td>
                      <td className="py-3 text-right text-blue-700">{formatearMonto(resumen.neto)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default InformeCajaPage;
