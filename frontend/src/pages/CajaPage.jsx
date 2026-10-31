import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AbrirCajaPage from './AbrirCajaPage';
import CerrarCajaPage from './CerrarCajaPage';
import MisCajasPage from './MisCajasPage';
import InformeCajaPage from './InformeCajaPage';
import HistorialPagosPage from './HistorialPagosPage';

function CajaPage() {
  const { isAdmin } = useAuth();
  const [subMenu, setSubMenu] = useState('abrir');

  const subMenuItems = [
    { id: 'abrir', label: 'Abrir Caja', icon: '🔓' },
    { id: 'cerrar', label: 'Cerrar Caja', icon: '🔒' },
    { id: 'mis-cajas', label: 'Mis Cajas', icon: '📦' },
    { id: 'informe', label: 'Informe', icon: '📊' },
    // Historial de todos los pagos (con RUT y nombre) descargable a Excel: solo el administrador
    ...(isAdmin ? [{ id: 'historial-pagos', label: 'Historial de Pagos', icon: '🗂️' }] : []),
  ];

  return (
    <div>
      {/* Sub-navegación */}
      <div className="flex gap-4 mb-8">
        {subMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSubMenu(item.id)}
            className={`flex items-center gap-3 px-6 py-3 text-lg font-semibold rounded-xl transition-all ${
              subMenu === item.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido según sub-menú */}
      {subMenu === 'abrir' && <AbrirCajaPage />}
      {subMenu === 'cerrar' && <CerrarCajaPage />}
      {subMenu === 'mis-cajas' && <MisCajasPage />}
      {subMenu === 'informe' && <InformeCajaPage />}
      {subMenu === 'historial-pagos' && isAdmin && <HistorialPagosPage />}
    </div>
  );
}

export default CajaPage;