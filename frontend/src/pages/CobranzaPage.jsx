import { useState } from 'react';
import MorosidadNivelesPage from './MorosidadNivelesPage';
import CortesPage from './CortesPage';
import MultasPage from './MultasPage';

function CobranzaPage() {
  const [subMenu, setSubMenu] = useState('morosidad');

  const subMenuItems = [
    { id: 'morosidad', label: 'Morosidad', icon: '⚠️' },
    { id: 'cortes', label: 'Cortes', icon: '🚫' },
    { id: 'multas', label: 'Multas', icon: '🚨' },
  ];

  return (
    <div>
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

      {subMenu === 'morosidad' && <MorosidadNivelesPage />}
      {subMenu === 'cortes' && <CortesPage />}
      {subMenu === 'multas' && <MultasPage />}
    </div>
  );
}

export default CobranzaPage;
