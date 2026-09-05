import { useState } from 'react';
import PrestamosPage from './PrestamosPage';
import ConveniosPage from './ConveniosPage';

function FinanciamientoPage() {
  const [subMenu, setSubMenu] = useState('prestamos');

  const subMenuItems = [
    { id: 'prestamos', label: 'Préstamos', icon: '🔧' },
    { id: 'convenios', label: 'Convenios', icon: '🤝' },
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
      {subMenu === 'prestamos' && <PrestamosPage />}
      {subMenu === 'convenios' && <ConveniosPage />}
    </div>
  );
}

export default FinanciamientoPage;
