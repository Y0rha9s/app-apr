import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Logo from '../components/Logo';

function LoginPage() {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Función para formatear RUT chileno
  const handleRutChange = (e) => {
    let valor = e.target.value.replace(/[^0-9kK]/g, ''); // Solo números y k
    if (valor.length > 1) {
      // Separar cuerpo y dígito verificador
      const cuerpo = valor.slice(0, -1);
      const dv = valor.slice(-1).toUpperCase();
      
      // Formatear cuerpo con puntos
      let cuerpoFormateado = '';
      for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
        cuerpoFormateado = cuerpo.charAt(i) + ((j > 0 && j % 3 === 0) ? '.' : '') + cuerpoFormateado;
      }
      
      setRut(`${cuerpoFormateado}-${dv}`);
    } else {
      setRut(valor);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Limpiar puntos del RUT antes de enviar (dejar solo números y guión)
    // Esto asegura compatibilidad si la BD guarda sin puntos
    const rutLimpio = rut.replace(/\./g, '');

    const result = await login(rutLimpio, password);

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
            <Logo size="2xl" className="drop-shadow-lg" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Sistema APR
          </h1>
          <p className="text-2xl text-blue-100">Agua Potable Rural</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10">
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
                onChange={handleRutChange}
                placeholder="Ej: 11.111.111-1"
                className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
                required
                autoComplete="username"
                maxLength="12"
              />
              <p className="text-sm text-gray-500 mt-1 ml-1">
                Formato automático (ej: 11-1)
              </p>
            </div>

            <div>
              <label className="block text-xl font-bold text-gray-700 mb-3">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="w-full px-6 py-5 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all pr-16"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl text-gray-500 hover:text-blue-600 transition-colors focus:outline-none p-2"
                  title={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {mostrarPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full text-xl py-5 mt-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? '⏳ Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          
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
