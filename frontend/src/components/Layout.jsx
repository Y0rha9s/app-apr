import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

function Layout({ children }) {
  const { usuario, logout, isAdmin } = useAuth();
  const [menuActivo, setMenuActivo] = useState(isAdmin ? 'dashboard' : 'mi-cuenta');

  // Actualizar el menú inicial cuando cambie el rol
  useEffect(() => {
    // Si es admin y está en una página de socio, cambiar a dashboard
    if (isAdmin && (menuActivo === 'mi-cuenta' || menuActivo === 'mi-consumo' || menuActivo === 'pagos' || menuActivo === 'reclamos')) {
      setMenuActivo('dashboard');
    }
    // Si es socio y está en una página de admin, cambiar a mi-cuenta
    else if (!isAdmin && (menuActivo === 'dashboard' || menuActivo === 'transacciones' || menuActivo === 'socios' || menuActivo === 'lecturas' || menuActivo === 'morosos')) {
      setMenuActivo('mi-cuenta');
    }
  }, [isAdmin]);

  const menuItems = isAdmin ? [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'transacciones', label: 'Ingresos/Egresos', icon: '💰' },
    { id: 'socios', label: 'Socios', icon: '👥' },
    { id: 'lecturas', label: 'Lecturas', icon: '💧' },
    { id: 'morosos', label: 'Morosidad', icon: '⚠️' },
    { id: 'caja', label: 'Caja', icon: '💵' },
  ] : [
    { id: 'mi-cuenta', label: 'Mi Cuenta', icon: '🏠' },
    { id: 'mi-consumo', label: 'Mi Consumo', icon: '💧' },
    { id: 'pagos', label: 'Pagos', icon: '💳' },
    { id: 'reclamos', label: 'Reclamos', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header mejorado */}
      <header className="shadow-xl sticky top-0 z-50" style={{ background: 'linear-gradient(to right, #065f66, #054b52, #065f66)' }}>
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
                <span className="text-5xl">💧</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                  Sistema APR
                </h1>
                <p className="text-lg md:text-xl mt-1 text-white/90">
                  {isAdmin ? '👨‍💼 Panel Administrador' : '👤 Portal del Socio'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-white/20">
              <div className="text-right">
                <p className="text-lg md:text-xl font-semibold text-white">{usuario.nombre}</p>
                <p className="text-base md:text-lg text-white/90">{usuario.rut}</p>
              </div>
              <button
                onClick={logout}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-base md:text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation mejorada */}
      <nav className="shadow-lg border-b-2 sticky top-[120px] z-40" style={{ background: 'linear-gradient(to right, #7dd3fc, #bae6fd, #7dd3fc)', borderColor: '#38bdf8' }}>
        <div className="container mx-auto px-6">
          <div className="flex overflow-x-auto gap-2 py-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMenuActivo(item.id)}
                className={`flex items-center gap-3 px-8 py-4 text-lg md:text-xl font-semibold whitespace-nowrap rounded-xl transition-all duration-200 ${
                  menuActivo === item.id
                    ? 'text-white shadow-lg scale-105'
                    : 'hover:scale-105'
                }`}
                style={menuActivo === item.id 
                  ? { background: 'linear-gradient(to right, #0ea5e9, #0284c7)', color: 'white' }
                  : { color: '#075985' }
                }
                onMouseEnter={(e) => {
                  if (menuActivo !== item.id) {
                    e.currentTarget.style.backgroundColor = '#7dd3fc';
                    e.currentTarget.style.color = '#0c4a6e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (menuActivo !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#075985';
                  }
                }}
              >
                <span className="text-2xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content con mejor espaciado */}
      <main className="container mx-auto px-6 py-10">
        <div className="animate-fadeIn">
          {children({ menuActivo })}
        </div>
      </main>

      {/* Footer mejorado */}
      <footer className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 text-white mt-16">
        <div className="container mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
                <span className="text-4xl">💧</span>
                <h3 className="text-2xl font-bold">Sistema APR</h3>
              </div>
              <p className="text-lg text-gray-300">
                Gestión eficiente de agua potable para comunidades rurales
              </p>
            </div>
            
            <div>
              <h4 className="text-xl font-bold mb-4">Contacto</h4>
              <p className="text-lg text-gray-300 mb-2">📞 +56 9 1234 5678</p>
              <p className="text-lg text-gray-300">✉️ contacto@apr.cl</p>
            </div>
            
            <div>
              <h4 className="text-xl font-bold mb-4">Horario de Atención</h4>
              <p className="text-lg text-gray-300 mb-2">Lunes a Viernes</p>
              <p className="text-lg text-gray-300">9:00 - 18:00 hrs</p>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-lg text-gray-400">
              © 2026 Sistema APR - Todos los derechos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;