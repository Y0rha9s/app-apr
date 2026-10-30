import { Fragment, useState } from 'react';
import { infoTipo, CANALES_NOTIFICACION, formatearFechaNotificacion } from '../utils/notificaciones';

// Tabla de historial de notificaciones (fecha, tipo, canal, quien la genero). Al hacer clic en una
// fila se ve el mensaje completo. `mostrarUsuario` agrega la columna del socio (vista global).
function NotificacionesLista({ notificaciones, mostrarUsuario = false }) {
  const [abierta, setAbierta] = useState(null);

  if (notificaciones.length === 0) {
    return <p className="text-center py-8 text-gray-500">Sin notificaciones</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-100 border-b-2 border-gray-300">
          <tr>
            <th className="p-3 text-base font-semibold">Fecha</th>
            {mostrarUsuario && <th className="p-3 text-base font-semibold">Socio</th>}
            <th className="p-3 text-base font-semibold">Tipo</th>
            <th className="p-3 text-base font-semibold">Canal</th>
            <th className="p-3 text-base font-semibold">Generada por</th>
            <th className="p-3 text-base font-semibold">Lectura</th>
          </tr>
        </thead>
        <tbody>
          {notificaciones.map((n) => {
            const tipo = infoTipo(n.tipo);
            return (
              <Fragment key={n.id}>
                <tr
                  onClick={() => setAbierta(abierta === n.id ? null : n.id)}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                >
                  <td className="p-3 whitespace-nowrap">{formatearFechaNotificacion(n.fecha)}</td>
                  {mostrarUsuario && (
                    <td className="p-3">
                      <div className="font-semibold">{n.usuario_nombre}</div>
                      <div className="text-xs text-gray-500 font-mono">{n.usuario_rut}</div>
                    </td>
                  )}
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tipo.badge}`}>
                      {tipo.icon} {tipo.label}
                    </span>
                  </td>
                  <td className="p-3">{CANALES_NOTIFICACION[n.canal] || n.canal}</td>
                  <td className="p-3">{n.generada_por_nombre || 'Sistema'}</td>
                  <td className="p-3">{n.leida ? '✔️ Leída' : '🔵 No leída'}</td>
                </tr>
                {abierta === n.id && (
                  <tr className="bg-gray-50 border-b">
                    <td colSpan={mostrarUsuario ? 6 : 5} className="p-4">
                      <p className="font-semibold mb-1">{n.titulo}</p>
                      <p className="text-gray-700">{n.mensaje}</p>
                      {n.boleta_id && <p className="text-xs text-gray-500 mt-2">Boleta de referencia: #{n.boleta_id}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default NotificacionesLista;
