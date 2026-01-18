import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';

function LoginPage() {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(rut, password);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center p-6">
      {/* Decoración de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white/20 backdrop-blur-sm p-6 rounded-3xl mb-6">
            <span className="text-7xl">💧</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Sistema APR
          </h1>
          <p className="text-2xl text-blue-100">Agua Potable Rural</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Iniciar Sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 px-6 py-4 rounded-xl text-lg font-semibold animate-shake">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                RUT
              </label>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12345678-9"
                className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                required
                autoComplete="current-password"
              />
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              className="w-full text-xl py-5 mt-4"
              disabled={loading}
            >
              {loading ? '⏳ Ingresando...' : 'Iniciar Sesión'}
            </Button>
          </form>

          {/* Usuarios de prueba */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-100">
            <p className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">ℹ️</span>
              Usuarios de prueba:
            </p>
            <div className="space-y-3 text-base text-gray-700">
              <div className="bg-white px-4 py-3 rounded-lg">
                <p className="font-semibold">👨‍💼 Administrador:</p>
                <p className="font-mono">11111111-1 / demo123</p>
              </div>
              <div className="bg-white px-4 py-3 rounded-lg">
                <p className="font-semibold">👤 Socio:</p>
                <p className="font-mono">12345678-9 / demo123</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white text-lg mt-8 drop-shadow">
          © 2026 Sistema APR - Gestión de Agua Potable Rural
        </p>
      </div>
    </div>
  );
}

export default LoginPage;