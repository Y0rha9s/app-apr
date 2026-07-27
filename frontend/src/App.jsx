import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransaccionesPage from './pages/TransaccionesPage';
import SociosPage from './pages/SociosPage';
import Layout from './components/Layout';
import LecturasPage from './pages/LecturasPage';
import MorosidadPage from './pages/MorosidadPage';
import MiCuentaPage from './pages/MiCuentaPage';
import MiConsumoPage from './pages/MiConsumoPage';
import CajaPage from './pages/CajaPage';
import PagosPage from './pages/PagosPage';
import UploadExcel from './components/UploadExcel';
import PagoExitoso from './pages/PagoExitoso';
import CortesPage from './pages/CortesPage';
import RepactacionesPage from './pages/RepactacionesPage';
import PrestamosPage from './pages/PrestamosPage';
import AvisosPage from './pages/AvisosPage';
import CargaSimplePage from './pages/CargaSimplePage';
import OperadorLecturasPage from './pages/OperadorLecturasPage';
import BoletasPage from './pages/BoletasPage';

function AppContent() {
  const { usuario, loading, isAdmin, isOperador, isRecaudador } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <div className="text-3xl font-bold text-gray-600">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <LoginPage />;
  }

  // Rutas especiales que no usan el Layout principal o necesitan renderizado completo
  if (location.pathname === '/pago-exitoso') {
    return <PagoExitoso />;
  }
  if (location.pathname === '/pago-fallido') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md w-full">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Pago Fallido</h1>
          <p className="text-gray-600 mb-6">Lo sentimos, no pudimos procesar tu pago. Por favor intenta nuevamente.</p>
          <a href="/pagos" className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition-colors">
            Volver a intentar
          </a>
        </div>
      </div>
    );
  }
  if (location.pathname === '/pago-pendiente') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md w-full">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-yellow-600 mb-2">Pago Pendiente</h1>
          <p className="text-gray-600 mb-6">Tu pago está siendo procesado. Te notificaremos cuando se complete.</p>
          <a href="/pagos" className="bg-yellow-600 text-white px-6 py-2 rounded-full hover:bg-yellow-700 transition-colors">
            Volver a Pagos
          </a>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {({ menuActivo }) => {
        switch (menuActivo) {
          case 'dashboard':
            // Solo administradores pueden ver el dashboard
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <DashboardPage />;
          case 'transacciones':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <TransaccionesPage />;
          case 'socios':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <SociosPage />;
          case 'lecturas':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <LecturasPage />;
          case 'morosos':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <MorosidadPage />;
          case 'carga-masiva': // ← NUEVO CASO
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <UploadExcel />;
          case 'caja':
            if (!isAdmin && !isRecaudador) {
              return <MiCuentaPage />;
            }
            return <CajaPage />;
          case 'mi-cuenta':
            return <MiCuentaPage />;
          case 'mi-consumo':
            return <MiConsumoPage />;
          case 'pagos':
            return <PagosPage />;
          case 'reclamos':
            return <div className="text-3xl">📝 Reclamos (próximamente)</div>;
          case 'cortes':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <CortesPage />;
          case 'repactaciones':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <RepactacionesPage />;
          case 'prestamos':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <PrestamosPage />;
          case 'avisos':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <AvisosPage />;
          case 'boletas':
            if (!isAdmin) return <MiCuentaPage />;
            return <BoletasPage />;
          case 'carga-simple':
            if (!isAdmin) {
              return <MiCuentaPage />;
            }
            return <CargaSimplePage />;
          case 'toma-lecturas':
            if (!isOperador && !isAdmin) {
              return <MiCuentaPage />;
            }
            return <OperadorLecturasPage />;
          default:

            // Por defecto, mostrar la página según el rol
            return isAdmin ? <DashboardPage /> : <MiCuentaPage />;
        }
      }}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;