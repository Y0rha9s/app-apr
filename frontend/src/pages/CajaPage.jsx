import { useState } from 'react';
import AbrirCajaPage from './AbrirCajaPage';
import CerrarCajaPage from './CerrarCajaPage';
import MisCajasPage from './MisCajasPage';

function CajaPage() {
  const [subMenu, setSubMenu] = useState('abrir');

  const subMenuItems = [
    { id: 'abrir', label: 'Abrir Caja', icon: '🔓' },
    { id: 'cerrar', label: 'Cerrar Caja', icon: '🔒' },
    { id: 'mis-cajas', label: 'Mis Cajas', icon: '📦' },
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
    </div>
  );
}

export default CajaPage;