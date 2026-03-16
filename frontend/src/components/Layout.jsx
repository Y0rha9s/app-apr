import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from './Logo';

function Layout({ children }) {
  const { usuario, logout, isAdmin, isOperador, isRecaudador } = useAuth();
  const [menuActivo, setMenuActivo] = useState(
    isAdmin ? 'dashboard' : isOperador ? 'toma-lecturas' : isRecaudador ? 'caja' : 'mi-cuenta'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Actualizar el menú inicial cuando cambie el rol o la URL
  useEffect(() => {
    if (location.pathname === '/pagos') {
      setMenuActivo('pagos');
      return;
    }
    if (isAdmin && (menuActivo === 'mi-cuenta' || menuActivo === 'mi-consumo' || menuActivo === 'pagos' || menuActivo === 'reclamos')) {
      setMenuActivo('dashboard');
    } else if (isOperador) {
      setMenuActivo('toma-lecturas');
    } else if (isRecaudador) {
      setMenuActivo('caja');
    } else if (!isAdmin && !isOperador && !isRecaudador && (menuActivo === 'dashboard' || menuActivo === 'transacciones' || menuActivo === 'socios' || menuActivo === 'lecturas' || menuActivo === 'morosos' || menuActivo === 'carga-masiva')) {
      setMenuActivo('mi-cuenta');
    }
  }, [isAdmin, isOperador, isRecaudador]);

  const menuItems = isAdmin ? [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'transacciones', label: 'Ingresos/Egresos', icon: '💰' },
    { id: 'socios', label: 'Usuarios', icon: '👥' },
    { id: 'lecturas', label: 'Lecturas', icon: '💧' },
    { id: 'carga-masiva', label: 'Carga Masiva', icon: '📤' },
    { id: 'carga-simple', label: 'Carga Simple', icon: '📤' },
    { id: 'morosos', label: 'Morosidad', icon: '⚠️' },
    { id: 'cortes', label: 'Cortes', icon: '✂️' },
    { id: 'repactaciones', label: 'Repactaciones', icon: '💳' },
    { id: 'prestamos', label: 'Préstamos', icon: '🔧' },
    { id: 'avisos', label: 'Avisos Masivos', icon: '📄' },
    { id: 'caja', label: 'Caja', icon: '💵' },
  ] : isOperador ? [
    { id: 'toma-lecturas', label: 'Tomar Lectura', icon: '📋' },
  ] : isRecaudador ? [
    { id: 'caja', label: 'Caja', icon: '💵' },
  ] : [
    { id: 'mi-cuenta', label: 'Mi Cuenta', icon: '🏠' },
    { id: 'mi-consumo', label: 'Mi Consumo', icon: '💧' },
    { id: 'pagos', label: 'Pagos', icon: '💳' },
    { id: 'reclamos', label: 'Reclamos', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex overflow-hidden">
      {/* Overlay para móviles cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Barra Lateral (Sidebar) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 shadow-2xl transition-all duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } flex flex-col border-r border-sky-400`}
        style={{ background: 'linear-gradient(to bottom, #0ea5e9, #0284c7)' }}
      >
        {/* Cabecera Sidebar */}
        <div className="p-6 border-b border-white/20 flex items-center gap-3 bg-sky-900/10 backdrop-blur-sm">
          <div className="bg-white p-2 rounded-xl shadow-md">
            <Logo size="sm" />
          </div>
          <div className="overflow-hidden">
            <h2 className="text-xl font-black text-white tracking-tight truncate uppercase">Sistema APR</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
              <p className="text-[10px] text-sky-100 uppercase tracking-widest font-bold truncate">
                {isAdmin ? 'Administrador' : isOperador ? 'Operador' : isRecaudador ? 'Recaudador' : 'Socio'}
              </p>
            </div>
          </div>
        </div>

        {/* Menú de Navegación */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setMenuActivo(item.id);
                // Ocultar barra al seleccionar (tanto en móvil como en escritorio si se desea)
                if (window.innerWidth < 1024) {
                  setSidebarOpen(false);
                }
              }}
              className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 group relative ${menuActivo === item.id
                ? 'bg-white text-sky-700 shadow-xl scale-[1.02] z-10'
                : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
            >
              {menuActivo === item.id && (
                <div className="absolute left-0 w-1.5 h-8 bg-sky-400 rounded-r-full shadow-[2px_0_10px_rgba(56,189,248,0.5)]" />
              )}
              <span className={`text-2xl transition-transform duration-300 group-hover:scale-110 ${menuActivo === item.id ? '' : 'brightness-0 invert'}`}>
                {item.icon}
              </span>
              <span className={`font-bold text-base transition-colors duration-300 ${menuActivo === item.id ? 'text-sky-800' : 'text-white'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Info Usuario & Salir (Pie de Sidebar) */}
        <div className="p-4 border-t border-white/10 bg-sky-900/20 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4 p-3 bg-white/10 rounded-2xl border border-white/10">
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-sky-600 font-black shadow-lg ring-2 ring-white/20">
              {usuario.nombre.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-white truncate text-sm uppercase">{usuario.nombre}</p>
              <p className="text-[10px] text-sky-100 font-medium opacity-80">{usuario.rut}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white/10 text-white hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 font-bold text-sm uppercase tracking-widest border border-white/20 hover:border-red-500 shadow-lg group"
          >
            <span className="text-xl group-hover:rotate-12 transition-transform">🚪</span> Salir
          </button>
        </div>
      </aside>

      {/* Área de Contenido Principal */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Cabecera Superior con Hamburguesa */}
        <header className="bg-white/70 backdrop-blur-md border-b border-blue-50 shadow-sm px-4 lg:px-8 py-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white transition-all duration-300 lg:hidden shadow-sm"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`h-0.5 bg-current rounded-full transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`h-0.5 bg-current rounded-full transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 bg-current rounded-full transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
              </div>
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl lg:text-2xl font-black text-sky-900 tracking-tight leading-none mb-1">
                {menuItems.find(i => i.id === menuActivo)?.label || 'Panel de Control'}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                <span>Principal</span>
                <span>/</span>
                <span className="text-sky-500">{menuItems.find(i => i.id === menuActivo)?.label}</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4">
            <div className="px-3 py-1.5 bg-sky-100/50 rounded-lg border border-sky-200/50 flex items-center gap-2">
              <span className="text-sky-600 font-bold text-xs uppercase tracking-tighter">Versión</span>
              <span className="text-sky-800 font-black text-xs">1.0.0</span>
            </div>
          </div>
        </header>

        {/* Contenido de la Página */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-50/30">
          <div className="max-w-[1600px] mx-auto animate-fadeIn">
            {children({ menuActivo })}
          </div>

          {/* Footer Simple */}
          <footer className="mt-4 py-3 border-t border-gray-200/60 flex flex-col md:flex-row items-center justify-between gap-3 text-gray-400 font-medium text-xs">
            <p>© 2026 Sistema APR - Gestión de Agua Potable</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-sky-500 cursor-help transition-colors">Soporte Técnico</span>
              <span className="hover:text-sky-500 cursor-help transition-colors">Manual de Usuario</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Layout;
