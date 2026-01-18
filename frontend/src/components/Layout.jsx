import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

function Layout({ children }) {
  const { usuario, logout, isAdmin } = useAuth();
  const [menuActivo, setMenuActivo] = useState('dashboard');

  const menuItems = isAdmin ? [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'transacciones', label: '💰 Ingresos/Egresos', icon: '💰' },
    { id: 'socios', label: '👥 Socios', icon: '👥' },
    { id: 'lecturas', label: '💧 Lecturas', icon: '💧' },
    { id: 'morosos', label: '⚠️ Morosidad', icon: '⚠️' },
  ] : [
    { id: 'mi-cuenta', label: '🏠 Mi Cuenta', icon: '🏠' },
    { id: 'mi-consumo', label: '💧 Mi Consumo', icon: '💧' },
    { id: 'pagos', label: '💳 Pagos', icon: '💳' },
    { id: 'reclamos', label: '📝 Reclamos', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">💧 Sistema APR</h1>
              <p className="text-lg md:text-xl mt-1">
                {isAdmin ? '👨‍💼 Panel Administrador' : '👤 Panel Socio'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg md:text-xl font-semibold">{usuario.nombre}</p>
              <p className="text-base md:text-lg opacity-90">{usuario.rut}</p>
              <button
                onClick={logout}
                className="mt-3 px-6 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-base md:text-lg font-semibold transition-colors"
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-md border-b-2 border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMenuActivo(item.id)}
                className={`px-6 py-4 text-lg md:text-xl font-semibold whitespace-nowrap transition-all ${
                  menuActivo === item.id
                    ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children({ menuActivo })}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-lg">Sistema APR - Agua Potable Rural © 2026</p>
          <p className="text-base opacity-75 mt-2">Gestión eficiente para comunidades rurales</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;