import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';
import NotificacionesLista from './NotificacionesLista';

const TABS = [
  { id: 'datos', label: '👤 Datos' },
  { id: 'notificaciones', label: '🔔 Notificaciones' },
];

const CAMPOS_EDITABLES = [
  { id: 'nombre', label: 'Nombre', type: 'text' },
  { id: 'rut', label: 'RUT', type: 'text' },
  { id: 'telefono', label: 'Teléfono', type: 'text' },
  { id: 'email', label: 'Correo', type: 'email' },
  { id: 'direccion', label: 'Dirección', type: 'text' },
];

const aFormulario = (u) => ({
  nombre: (u.nombre || '').trim(),
  rut: u.rut || '',
  telefono: u.telefono || '',
  email: u.email || '',
  direccion: u.direccion || '',
});

// Ficha del usuario con pestañas: Datos (con modo edición para el admin) y Notificaciones (historial).
// `onActualizado` se llama con el usuario ya guardado para que la tabla de atrás se refresque.
function FichaSocioModal({ usuario: usuarioInicial, onClose, onActualizado }) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [tab, setTab] = useState('datos');
  const [notificaciones, setNotificaciones] = useState(null);
  const [errorNotif, setErrorNotif] = useState('');
  const [editando, setEditando] = useState(false);
  const [formulario, setFormulario] = useState(aFormulario(usuarioInicial));
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    if (tab !== 'notificaciones' || notificaciones !== null) return;
    api
      .get(`/notificaciones/usuario/${usuario.id}`, { headers: authHeaders() })
      .then((res) => setNotificaciones(res.data.notificaciones))
      .catch((err) => setErrorNotif(err.response?.data?.error || 'No se pudo cargar el historial'));
  }, [tab, notificaciones, usuario.id]);

  const empezarEdicion = () => {
    setFormulario(aFormulario(usuario));
    setErrorGuardar('');
    setGuardadoOk(false);
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setErrorGuardar('');
  };

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar('');
    try {
      const res = await api.put(`/usuarios/${usuario.id}`, formulario, { headers: authHeaders() });
      const actualizado = { ...usuario, ...res.data };
      setUsuario(actualizado);
      setEditando(false);
      setGuardadoOk(true);
      if (onActualizado) onActualizado(actualizado);
    } catch (err) {
      setErrorGuardar(err.response?.data?.error || 'No se pudo guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  const dato = (etiqueta, valor) => (
    <div>
      <p className="text-sm font-semibold text-gray-500">{etiqueta}</p>
      <p className="text-lg text-gray-900">{valor || '-'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{usuario.nombre}</h3>
            <p className="text-gray-600 font-mono">{usuario.rut} · {usuario.numero_cliente || 'sin N° cliente'}</p>
          </div>
          <button onClick={onClose} className="text-3xl text-gray-500 hover:text-gray-800" aria-label="Cerrar">✖</button>
        </div>

        <div className="flex gap-3 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 text-lg font-semibold rounded-xl transition-all ${
                tab === t.id ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'datos' && (
          <>
            {guardadoOk && (
              <div className="mb-6 p-4 rounded-lg bg-green-100 text-green-700 font-semibold">
                ✅ Datos guardados correctamente
              </div>
            )}

            {editando ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CAMPOS_EDITABLES.map((c) => (
                  <div key={c.id}>
                    <label className="block text-sm font-semibold text-gray-500 mb-1">{c.label}</label>
                    <input
                      type={c.type}
                      value={formulario[c.id]}
                      onChange={(e) => setFormulario({ ...formulario, [c.id]: e.target.value })}
                      className="w-full px-4 py-2 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
                {dato('N° Cliente (no editable)', usuario.numero_cliente)}
                {dato('N° Medidor (no editable)', usuario.medidor || usuario.numero_medidor)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dato('Nombre', usuario.nombre)}
                {dato('RUT', usuario.rut)}
                {dato('Teléfono', usuario.telefono)}
                {dato('Correo', usuario.email || usuario.correo_electronico)}
                {dato('Dirección', usuario.direccion)}
                {dato('N° Medidor', usuario.medidor || usuario.numero_medidor)}
                {dato('Estado', usuario.estado)}
                {dato('Servicio', usuario.estado_servicio)}
              </div>
            )}

            {errorGuardar && (
              <div className="mt-6 p-4 rounded-lg bg-red-100 text-red-700 font-semibold">⚠️ {errorGuardar}</div>
            )}

            <div className="mt-8 pt-6 border-t flex gap-3 justify-end">
              {editando ? (
                <>
                  <button
                    onClick={cancelarEdicion}
                    disabled={guardando}
                    className="px-6 py-3 text-lg font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardar}
                    disabled={guardando}
                    className="px-6 py-3 text-lg font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {guardando ? '⏳ Guardando...' : '💾 Guardar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={empezarEdicion}
                  className="px-6 py-3 text-lg font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  ✏️ Editar
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'notificaciones' && (
          <>
            {errorNotif && <p className="text-red-600 font-semibold">⚠️ {errorNotif}</p>}
            {!errorNotif && notificaciones === null && <p className="text-center py-8">⏳ Cargando...</p>}
            {notificaciones !== null && <NotificacionesLista notificaciones={notificaciones} />}
          </>
        )}
      </div>
    </div>
  );
}

export default FichaSocioModal;
