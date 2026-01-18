import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';

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
    // Si es exitoso, el AuthContext redirigirá automáticamente
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Sistema APR</h1>
          <p className="text-xl text-gray-600">Agua Potable Rural</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              RUT
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12345678-9"
              className="w-full px-4 py-4 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              className="w-full px-4 py-4 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
              autoComplete="current-password"
            />
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            className="w-full text-xl py-4"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-lg font-semibold text-gray-700 mb-2">Usuarios de prueba:</p>
          <p className="text-base text-gray-600">Admin: 11111111-1 / demo123</p>
          <p className="text-base text-gray-600">Socio: 12345678-9 / demo123</p>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage;