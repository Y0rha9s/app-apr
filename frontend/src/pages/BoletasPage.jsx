import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const estadoBadge = (estado) => {
    const map = {
        pendiente: 'bg-yellow-100 text-yellow-800',
        pagada: 'bg-green-100 text-green-800',
        anulada: 'bg-red-100 text-red-800',
        abonada: 'bg-orange-100 text-orange-800',
    };
    return map[estado] || 'bg-gray-100 text-gray-700';
};

export default function BoletasPage() {
    const hoy = new Date();
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [estado, setEstado] = useState('');
    const [boletas, setBoletas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [busqueda, setBusqueda] = useState('');

    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    const fetchBoletas = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ periodo });
            if (estado) params.append('estado', estado);
            const { data } = await api.get(`/boletas?${params}`);
            setBoletas(data);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al cargar boletas' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBoletas(); }, [mes, anio, estado]);

    const generarMasivo = async () => {
        if (!confirm(`¿Generar boletas para TODOS los socios activos del período ${periodo}?`)) return;
        setGenerando(true);
        setMensaje(null);
        try {
            const { data } = await api.post('/boletas/generar-masivo', { periodo });
            setMensaje({ tipo: 'ok', texto: data.message });
            fetchBoletas();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'Error al generar boletas' });
        } finally {
            setGenerando(false);
        }
    };

    const cambiarEstado = async (id, nuevoEstado) => {
        try {
            await api.patch(`/boletas/${id}/estado`, { estado: nuevoEstado });
            fetchBoletas();
        } catch {
            setMensaje({ tipo: 'error', texto: 'Error al actualizar estado' });
        }
    };

    const abrirPDF = (id) => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        window.open(`${baseUrl}/boletas/pdf/${id}`, '_blank');
    };

    const enviarWhatsapp = async (boleta) => {
        // Placeholder — se conecta a Wassenger en el siguiente paso
        alert(`📱 Wassenger: enviando boleta a ${boleta.nombre} (${boleta.telefono || 'sin teléfono'})`);
        try {
            await api.patch(`/boletas/${boleta.id}/enviada`, { canal: 'whatsapp' });
            fetchBoletas();
        } catch { }
    };

    const boletasFiltradas = boletas.filter(b =>
        b.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        b.rut?.includes(busqueda) ||
        String(b.numero_cliente).includes(busqueda)
    );

    const totalPendiente = boletas
        .filter(b => b.estado === 'pendiente' || b.estado === 'abonada')
        .reduce((sum, b) => sum + parseFloat(b.saldo_pendiente || 0), 0);

    const totalPagado = boletas
        .reduce((sum, b) => {
            const totalBoleta = parseFloat(b.total_a_pagar || 0);
            const saldo = parseFloat(b.saldo_pendiente || 0);
            return sum + (b.estado === 'anulada' ? 0 : totalBoleta - saldo);
        }, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🧾 Boletas</h1>
                    <p className="text-gray-500 text-sm mt-1">Generación y gestión de liquidaciones de cobro</p>
                </div>
                <button
                    onClick={generarMasivo}
                    disabled={generando}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition"
                >
                    {generando ? '⏳ Generando...' : '⚡ Generar boletas del período'}
                </button>
                <button
                    onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/boletas/zip/${periodo}`, '_blank')}
                    disabled={boletas.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition"
                >
                    📦 Descargar ZIP
                </button>
            </div>

            {/* Mensaje feedback */}
            {mensaje && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium ${mensaje.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {mensaje.tipo === 'ok' ? '✅' : '❌'} {mensaje.texto}
                </div>
            )}

            {/* Filtros */}
            <Card>
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">MES</label>
                        <select
                            value={mes}
                            onChange={e => setMes(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            {MESES.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">AÑO</label>
                        <select
                            value={anio}
                            onChange={e => setAnio(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            {[2024, 2025, 2026].map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">ESTADO</label>
                        <select
                            value={estado}
                            onChange={e => setEstado(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">Todos</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="abonada">Abonada</option>
                            <option value="pagada">Pagada</option>
                            <option value="anulada">Anulada</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">BUSCAR</label>
                        <input
                            type="text"
                            placeholder="Nombre, RUT o N° cliente..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total boletas', valor: boletas.length, icon: '🧾', color: 'blue' },
                    { label: 'Pendientes', valor: boletas.filter(b => b.estado === 'pendiente').length, icon: '⏳', color: 'yellow' },
                    { label: 'Abonadas', valor: boletas.filter(b => b.estado === 'abonada').length, icon: '🟠', color: 'orange' },
                    { label: 'Pagadas', valor: boletas.filter(b => b.estado === 'pagada').length, icon: '✅', color: 'green' },
                    { label: 'Monto pendiente', valor: `$${totalPendiente.toLocaleString('es-CL')}`, icon: '💰', color: 'red' },
                ].map((s, i) => (
                    <div key={i} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-4`}>
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <div className="text-xl font-bold text-gray-800">{s.valor}</div>
                        <div className="text-xs text-gray-500">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="text-center py-12 text-gray-400">⏳ Cargando boletas...</div>
                ) : boletasFiltradas.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="text-4xl mb-2">🧾</div>
                        <p>No hay boletas para este período.</p>
                        <p className="text-sm mt-1">Usa el botón <strong>"Generar boletas del período"</strong> para crearlas.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <th className="px-3 py-3 text-left">N° Cliente</th>
                                    <th className="px-3 py-3 text-left">Nombre</th>
                                    <th className="px-3 py-3 text-right">Consumo</th>
                                    <th className="px-3 py-3 text-right">Total</th>
                                    <th className="px-3 py-3 text-right">Vencimiento</th>
                                    <th className="px-3 py-3 text-center">Estado</th>
                                    <th className="px-3 py-3 text-center">Enviada</th>
                                    <th className="px-3 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {boletasFiltradas.map(b => (
                                    <tr key={b.id} className="hover:bg-gray-50 transition">
                                        <td className="px-3 py-3 font-mono font-semibold text-blue-600">
                                            {b.numero_cliente}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="font-medium text-gray-800">{b.nombre}</div>
                                            <div className="text-xs text-gray-400">{b.rut}</div>
                                        </td>
                                        <td className="px-3 py-3 text-right text-gray-600">{b.consumo_m3} m³</td>
                                        <td className="px-3 py-3 text-right font-semibold text-gray-800">
                                            ${Number(b.total_a_pagar || 0).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-3 py-3 text-right text-gray-500 text-xs">
                                            {b.fecha_vencimiento
                                                ? new Date(b.fecha_vencimiento).toLocaleDateString('es-CL')
                                                : '-'}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <select
                                                value={b.estado}
                                                onChange={e => cambiarEstado(b.id, e.target.value)}
                                                className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${estadoBadge(b.estado)}`}
                                            >
                                                <option value="pendiente">Pendiente</option>
                                                <option value="abonada">Abonada</option>
                                                <option value="pagada">Pagada</option>
                                                <option value="anulada">Anulada</option>
                                            </select>
                                        </td>
                                        <td className="px-3 py-3 text-center text-lg">
                                            {b.enviada_whatsapp ? '📱' : ''}
                                            {b.enviada_email ? '📧' : ''}
                                            {!b.enviada_whatsapp && !b.enviada_email ? (
                                                <span className="text-gray-300 text-xs">—</span>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex gap-1 justify-center">
                                                <button
                                                    onClick={() => abrirPDF(b.id)}
                                                    title="Ver PDF"
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs transition"
                                                >
                                                    📄 PDF
                                                </button>
                                                <button
                                                    onClick={() => enviarWhatsapp(b)}
                                                    title="Enviar por WhatsApp"
                                                    className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs transition"
                                                >
                                                    📱
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-3 text-xs text-gray-400 text-right px-3">
                            {boletasFiltradas.length} boleta(s) — Total pagado: ${totalPagado.toLocaleString('es-CL')}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}