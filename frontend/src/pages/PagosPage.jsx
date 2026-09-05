import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { usuariosService } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PagosPage = () => {
  const { usuario } = useAuth();
  const [deuda, setDeuda] = useState(0);
  const [loadingDeuda, setLoadingDeuda] = useState(true);
  const [boletas, setBoletas] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [form, setForm] = useState({
    boleta_id: '',
    monto_declarado: '',
    numero_operacion: '',
    comprobante: null
  });

  useEffect(() => {
    if (usuario) {
      cargarDeuda();
      cargarBoletas();
      cargarComprobantes();
    }
  }, [usuario]);

  const cargarDeuda = async () => {
    try {
      setLoadingDeuda(true);
      const response = await usuariosService.getDeuda(usuario.id);
      setDeuda(response.data.deuda || 0);
    } catch (error) {
      console.error('Error al cargar deuda:', error);
    } finally {
      setLoadingDeuda(false);
    }
  };

  const cargarBoletas = async () => {
    try {
      const res = await fetch(`${API_URL}/boletas/usuario/${usuario.id}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      setBoletas(data.filter(b => b.estado !== 'pagado'));
    } catch (err) {
      console.error('Error cargando boletas:', err);
    }
  };

  const cargarComprobantes = async () => {
    try {
      const res = await fetch(`${API_URL}/comprobantes/usuario/${usuario.id}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      setComprobantes(data);
    } catch (err) {
      console.error('Error cargando comprobantes:', err);
    }
  };

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit ejecutado', form);
    if (!form.monto_declarado) {
      mostrarMensaje('Ingresa el monto del pago', 'error');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('usuario_id', usuario.id);
      fd.append('monto_declarado', form.monto_declarado);
      if (form.boleta_id) fd.append('boleta_id', form.boleta_id);
      if (form.numero_operacion) fd.append('numero_operacion', form.numero_operacion);
      if (form.comprobante) fd.append('comprobante', form.comprobante);

      const res = await fetch(`${API_URL}/comprobantes`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (data.success) {
        mostrarMensaje('✅ Comprobante enviado — quedará en revisión hasta ser validado por el administrador');
        setForm({ boleta_id: '', monto_declarado: '', numero_operacion: '', comprobante: null });
        cargarComprobantes();
        cargarDeuda();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      mostrarMensaje('❌ ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const datosTransferencia = {
    banco: 'Banco Estado',
    tipoCuenta: 'Cuenta Vista / RUT',
    numero: '12.345.678-9',
    nombre: 'Comité de Agua Potable Rural',
    rut: '71.810.200-6',
    email: 'pagos@aprsafip.cl'
  };

  const estadoBadge = (estado) => {
    if (estado === 'pendiente') return 'bg-yellow-100 text-yellow-800';
    if (estado === 'validado') return 'bg-green-100 text-green-800';
    if (estado === 'rechazado') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const estadoLabel = (estado) => {
    if (estado === 'pendiente') return '⏳ En revisión';
    if (estado === 'validado') return '✅ Validado';
    if (estado === 'rechazado') return '❌ Rechazado';
    return estado;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-4xl font-bold mb-8 text-gray-800">💳 Gestión de Pagos</h2>

      {mensaje && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${mensaje.tipo === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Columna izquierda */}
        <div className="space-y-6">

          {/* Pago online - próximamente */}
          <Card title="🌐 Pago en Línea" className="border-l-4 border-blue-500">
            <div className="bg-blue-50 p-4 rounded-lg mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">Total a Pagar:</span>
              <span className="text-2xl font-bold text-blue-600">
                {loadingDeuda ? 'Cargando...' : `$ ${deuda.toLocaleString('es-CL')}`}
              </span>
            </div>
            <div className="space-y-4">
              <button className="w-full py-4 px-6 rounded-xl bg-gray-300 text-gray-500 cursor-not-allowed flex items-center justify-center gap-3" disabled>
                <img src="https://cdn.simpleicons.org/mercadopago/009EE3" alt="MP" className="w-8 h-8 bg-white rounded-full p-1.5 grayscale opacity-50" />
                <span className="text-xl font-bold">Mercado Pago (Próximamente)</span>
              </button>
              <button className="w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-xl flex items-center justify-center gap-3 cursor-not-allowed" disabled>
                <span className="text-2xl">💳</span>
                <span className="text-lg font-semibold">Transbank / WebPay (Próximamente)</span>
              </button>
            </div>
          </Card>

          {/* Reportar pago */}
          <Card title="📤 Reportar Transferencia o Depósito" className="border-l-4 border-green-500">
            <p className="text-gray-600 mb-4 text-sm">
              Si realizaste una transferencia o depósito, repórtalo aquí. El administrador lo validará y actualizará tu deuda.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Boleta asociada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Boleta a pagar (opcional)
                </label>
                <select
                  value={form.boleta_id}
                  onChange={(e) => setForm({ ...form, boleta_id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">— Pago general / abono —</option>
                  {boletas.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.periodo} — ${Number(b.saldo_pendiente).toLocaleString('es-CL')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto pagado ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.monto_declarado}
                  onChange={(e) => setForm({ ...form, monto_declarado: e.target.value })}
                  placeholder="Ej: 15000"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>

              {/* Nro operación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de operación / comprobante
                </label>
                <input
                  type="text"
                  value={form.numero_operacion}
                  onChange={(e) => setForm({ ...form, numero_operacion: e.target.value })}
                  placeholder="Ej: 12345678"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              {/* Foto comprobante */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foto del comprobante (opcional pero recomendado)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setForm({ ...form, comprobante: e.target.files[0] })}
                  className="w-full px-4 py-2 border border-dashed border-gray-400 rounded-lg bg-gray-50 cursor-pointer"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400">
                {loading ? '⏳ Enviando...' : '📤 Enviar Comprobante'}
              </button>
            </form>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">

          {/* Datos transferencia */}
          <Card title="🏦 Transferencia Bancaria" className="border-l-4 border-orange-500">
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 space-y-3">
              {Object.entries({
                'Banco': datosTransferencia.banco,
                'Tipo de Cuenta': datosTransferencia.tipoCuenta,
                'N° de Cuenta': datosTransferencia.numero,
                'Nombre': datosTransferencia.nombre,
                'RUT': datosTransferencia.rut,
                'Email': datosTransferencia.email
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-orange-200 pb-2 last:border-0">
                  <span className="text-gray-600">{k}:</span>
                  <span className="font-bold text-gray-800 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
              <span>⚠️</span>
              <p>Indica tu <strong>RUT</strong> o <strong>N° Cliente</strong> en el comentario de la transferencia.</p>
            </div>
          </Card>

          {/* Historial comprobantes */}
          {comprobantes.length > 0 && (
            <Card title="📋 Mis Comprobantes Enviados" className="border-l-4 border-purple-500">
              <div className="space-y-3">
                {comprobantes.map(c => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">
                          ${Number(c.monto_declarado).toLocaleString('es-CL')}
                        </p>
                        {c.numero_operacion && (
                          <p className="text-xs text-gray-500">Op: {c.numero_operacion}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${estadoBadge(c.estado)}`}>
                        {estadoLabel(c.estado)}
                      </span>
                    </div>
                    {c.observaciones && (
                      <p className="text-xs text-gray-600 mt-2 border-t pt-2">{c.observaciones}</p>
                    )}
                    {c.imagen_url && (
                      <a href={c.imagen_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline mt-1 block">
                        Ver comprobante
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="🏧 Depósito / Caja Vecina" className="border-l-4 border-purple-500">
            <p className="text-gray-600 mb-4">
              También puedes realizar depósitos presenciales usando los mismos datos de transferencia.
            </p>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl">🧾</div>
              <div>
                <p className="font-semibold text-gray-800">Guarda tu comprobante</p>
                <p className="text-sm text-gray-600">Sube la foto del voucher para validar tu pago.</p>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default PagosPage;
