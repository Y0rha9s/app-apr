import { useState, useEffect } from 'react';
import api, { authHeaders } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';
import NotificacionesLista from '../components/NotificacionesLista';
import { TIPOS_NOTIFICACION, CANALES_NOTIFICACION } from '../utils/notificaciones';

// Listado global de notificaciones con filtros por tipo, fecha (días en hora de Chile) y usuario.
function NotificacionesAdminPage() {
  const [filtros, setFiltros] = useState({ tipo: '', canal: '', usuario_id: '', desde: '', hasta: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async (f = filtros) => {
    setCargando(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const res = await api.get('/notificaciones', { params, headers: authHeaders() });
      setNotificaciones(res.data.notificaciones);
    } catch (err) {
      setNotificaciones([]);
      setError(err.response?.data?.error || 'No se pudieron cargar las notificaciones');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    api
      .get('/usuarios')
      .then((res) => setUsuarios(res.data.filter((u) => u.rol === 'usuario' || u.es_socio)))
      .catch((err) => console.error('Error cargando usuarios:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });

  const limpiar = () => {
    const vacios = { tipo: '', canal: '', usuario_id: '', desde: '', hasta: '' };
    setFiltros(vacios);
    cargar(vacios);
  };

  const inputClase =
    'w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white';

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-2">🔔 Notificaciones</h2>
      <p className="text-gray-600 mb-8">Historial global de avisos, cortes y reconexiones registrados en el sistema.</p>

      <Card className="mb-8">
        <h3 className="text-2xl font-bold mb-6">🔍 Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Tipo</label>
            <select value={filtros.tipo} onChange={cambiar('tipo')} className={inputClase}>
              <option value="">Todos</option>
              {TIPOS_NOTIFICACION.map((t) => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Canal</label>
            <select value={filtros.canal} onChange={cambiar('canal')} className={inputClase}>
              <option value="">Todos</option>
              {Object.entries(CANALES_NOTIFICACION).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario</label>
            <select value={filtros.usuario_id} onChange={cambiar('usuario_id')} className={inputClase}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.rut})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Desde</label>
            <input type="date" value={filtros.desde} onChange={cambiar('desde')} className={inputClase} />
          </div>
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Hasta</label>
            <input type="date" value={filtros.hasta} onChange={cambiar('hasta')} className={inputClase} />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={() => cargar()}>🔎 Aplicar</Button>
          <Button variant="neutral" onClick={limpiar}>Limpiar</Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-2xl font-bold mb-6">📋 Historial ({notificaciones.length})</h3>
        {cargando && <p className="text-center py-8 text-xl">⏳ Cargando...</p>}
        {!cargando && error && <p className="text-red-600 font-semibold">⚠️ {error}</p>}
        {!cargando && !error && <NotificacionesLista notificaciones={notificaciones} mostrarUsuario />}
        {!cargando && notificaciones.length >= 200 && (
          <p className="text-sm text-gray-500 mt-4">Se muestran las 200 más recientes; usa los filtros para acotar.</p>
        )}
      </Card>
    </div>
  );
}

export default NotificacionesAdminPage;
