import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';
import Card from './Card';
import { infoTipo, formatearFechaNotificacion } from '../utils/notificaciones';

// Bandeja del socio: muestra sus notificaciones al entrar a Mi Cuenta, con marca de leída.
function BandejaNotificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verLeidas, setVerLeidas] = useState(false);

  const cargar = async () => {
    try {
      const res = await api.get('/notificaciones/mis', { headers: authHeaders() });
      setNotificaciones(res.data.notificaciones);
    } catch (err) {
      // Sin bandeja disponible (ej. sin conexión): no se rompe Mi Cuenta
      console.error('Error cargando notificaciones:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const marcarLeida = async (id) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    try {
      await api.patch(`/notificaciones/${id}/leida`, {}, { headers: authHeaders() });
    } catch (err) {
      console.error('Error marcando como leída:', err);
      cargar();
    }
  };

  const marcarTodas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    try {
      await api.patch('/notificaciones/mis/leidas', {}, { headers: authHeaders() });
    } catch (err) {
      console.error('Error marcando todas como leídas:', err);
      cargar();
    }
  };

  if (cargando || notificaciones.length === 0) return null;

  const noLeidas = notificaciones.filter((n) => !n.leida);
  const visibles = verLeidas ? notificaciones : noLeidas;

  return (
    <Card className="mb-8 border-l-4 border-blue-500">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-2xl font-bold text-gray-800">
          🔔 Mis notificaciones{' '}
          {noLeidas.length > 0 && (
            <span className="ml-2 px-3 py-1 rounded-full text-sm font-bold bg-blue-600 text-white">
              {noLeidas.length} sin leer
            </span>
          )}
        </h3>
        <div className="flex gap-3">
          {noLeidas.length > 0 && (
            <button onClick={marcarTodas} className="text-blue-600 font-semibold hover:underline">
              Marcar todas como leídas
            </button>
          )}
          <button onClick={() => setVerLeidas(!verLeidas)} className="text-gray-600 font-semibold hover:underline">
            {verLeidas ? 'Ocultar leídas' : 'Ver también leídas'}
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-gray-500">No tienes notificaciones sin leer.</p>
      ) : (
        <div className="space-y-3">
          {visibles.map((n) => {
            const tipo = infoTipo(n.tipo);
            return (
              <div
                key={n.id}
                className={`p-4 rounded-xl border ${n.leida ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}
              >
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tipo.badge}`}>
                      {tipo.icon} {tipo.label}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">{formatearFechaNotificacion(n.fecha)}</span>
                  </div>
                  {!n.leida && (
                    <button onClick={() => marcarLeida(n.id)} className="text-sm text-blue-600 font-semibold hover:underline">
                      ✔️ Marcar como leída
                    </button>
                  )}
                </div>
                <p className="font-semibold mt-2">{n.titulo}</p>
                <p className="text-gray-700">{n.mensaje}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default BandejaNotificaciones;
