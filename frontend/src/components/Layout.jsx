import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from './Logo';

function Layout({ children }) {
  const { usuario, logout, isAdmin, isOperador, isRecaudador } = useAuth();
  const [menuActivo, setMenuActivo] = useState(
    isAdmin ? 'dashboard' : isOperador ? 'toma-lecturas' : isRecaudador ? 'caja' : 'mi-cuenta'
  );
  const location = useLocation();
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

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
  }, [isAdmin, isOperador]);

  useEffect(() => {
    const el = scrollRef.current;
    const update = () => {
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      setShowLeft(el.scrollLeft > 0);
      setShowRight(el.scrollLeft < maxScroll - 1);
    };
    update();
    if (el) el.addEventListener('scroll', update);
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => {
      if (el) el.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const scrollByAmount = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = Math.floor(el.clientWidth * 0.7) * (dir === 'right' ? 1 : -1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 overflow-x-hidden">
      {/* Header Informativo */}
      <header className="shadow-xl sticky top-0 z-50" style={{ background: 'linear-gradient(to right, #065f66, #054b52, #065f66)' }}>
        <div className="container mx-auto px-4 md:px-6 py-4"> {/* px-6 -> px-4 md:px-6 */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3"> {/* gap-4 -> gap-3 */}
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl flex items-center justify-center"> {/* p-4 -> p-2, rounded-2xl -> rounded-xl */}
                <Logo size="md" className="drop-shadow-lg" /> {/* size="lg" -> size="md" */}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-lg"> {/* text-3xl/4xl -> text-2xl/3xl */}
                  Sistema APR
                </h1>
                <p className="text-base md:text-lg mt-0.5 text-white/90"> {/* text-lg/xl -> text-base/lg, mt-1 -> mt-0.5 */}
                  {isAdmin ? '👨‍💼 Panel Administrador'
                    : isOperador ? '📋 Panel Operador'
                      : isRecaudador ? '💵 Panel Recaudador'
                        : '👤 Portal del Usuario'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20"> {/* gap-6 -> gap-4, rounded-2xl -> rounded-xl, px-6 py-4 -> px-4 py-2, border-2 -> border */}
              <div className="text-right">
                <p className="text-base md:text-lg font-semibold text-white">{usuario.nombre}</p> {/* text-lg/xl -> text-base/lg */}
                <p className="text-sm md:text-base text-white/90">{usuario.rut}</p> {/* text-base/lg -> text-sm/base */}
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm md:text-base font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              /* px-6 py-3 -> px-4 py-2, rounded-xl -> rounded-lg, text-base/lg -> text-sm/base */
              >
                🚪 Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation mejorada */}
      <nav className="shadow-lg border-b-2 sticky top-[88px] z-40 w-full" style={{ background: 'linear-gradient(to right, #7dd3fc, #bae6fd, #7dd3fc)', borderColor: '#38bdf8' }}> {/* top-[120px] -> top-[88px] (aprox 30% menos) */}
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative">
            {showLeft && (
              <button
                onClick={() => scrollByAmount('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/80 text-sky-800 shadow hover:bg-white"
                aria-label="Desplazar a la izquierda"
              >
                ‹
              </button>
            )}
            {showRight && (
              <button
                onClick={() => scrollByAmount('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/80 text-sky-800 shadow hover:bg-white"
                aria-label="Desplazar a la derecha"
              >
                ›
              </button>
            )}
            <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-sky-200/80 to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-sky-200/80 to-transparent" />
            <div ref={scrollRef} className="flex overflow-x-auto scroll-smooth gap-2 py-3 scrollbar-hide">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMenuActivo(item.id)}
                  className={`flex items-center gap-3 px-8 py-4 text-lg md:text-xl font-semibold whitespace-nowrap rounded-xl transition-all duration-200 ${menuActivo === item.id
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
