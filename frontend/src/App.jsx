import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransaccionesPage from './pages/TransaccionesPage';
import SociosPage from './pages/SociosPage';
import Layout from './components/Layout';
import LecturasPage from './pages/LecturasPage';
import MorosidadPage from './pages/MorosidadPage';
import MiCuentaPage from './pages/MiCuentaPage';
import MiConsumoPage from './pages/MiConsumoPage';

function AppContent() {
  const { usuario, loading } = useAuth();

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

  return (
    <Layout>
      {({ menuActivo }) => {
        switch (menuActivo) {
          case 'dashboard':
            return <DashboardPage />;
          case 'transacciones':
            return <TransaccionesPage />;
          case 'socios':
            return <SociosPage />;
          case 'lecturas':
            return <LecturasPage />;
          case 'morosos':
            return <MorosidadPage />;
          case 'mi-cuenta':
            return <MiCuentaPage />;
          case 'mi-consumo':
            return <MiConsumoPage />;
          case 'pagos':
            return <div className="text-3xl">💳 Pagos (próximamente)</div>;
          case 'reclamos':
            return <div className="text-3xl">📝 Reclamos (próximamente)</div>;
          default:
            return <DashboardPage />;
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