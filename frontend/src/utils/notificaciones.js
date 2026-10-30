// Etiquetas y estilos compartidos de las notificaciones (admin, ficha del socio y bandeja).
export const TIPOS_NOTIFICACION = [
  { id: 'aviso_mora', label: 'Aviso de mora', icon: '🟡', badge: 'bg-yellow-100 text-yellow-800' },
  { id: 'aviso_corte', label: 'Aviso de corte', icon: '🟠', badge: 'bg-orange-100 text-orange-800' },
  { id: 'corte', label: 'Corte', icon: '🚫', badge: 'bg-red-100 text-red-800' },
  { id: 'reconexion', label: 'Reconexión', icon: '✅', badge: 'bg-green-100 text-green-800' },
  { id: 'prestamo', label: 'Préstamo', icon: '🤝', badge: 'bg-blue-100 text-blue-800' },
  { id: 'otro', label: 'Otro', icon: '📌', badge: 'bg-gray-100 text-gray-800' },
];

export const CANALES_NOTIFICACION = {
  app: '📱 App',
  whatsapp: '💬 WhatsApp',
};

export const infoTipo = (id) =>
  TIPOS_NOTIFICACION.find((t) => t.id === id) || { id, label: id, icon: '📌', badge: 'bg-gray-100 text-gray-800' };

// 'YYYY-MM-DD HH24:MI' (hora de Chile, ya convertida por el backend) -> 'dd/mm/yyyy HH:MM'
export const formatearFechaNotificacion = (f) =>
  f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)} ${f.slice(11)}` : '-';
