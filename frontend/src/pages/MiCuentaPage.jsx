import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';

function MiCuentaPage() {
  const { usuario } = useAuth();

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">🏠 Mi Cuenta</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Información Personal */}
        <Card title="👤 Información Personal">
          <div className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Nombre Completo</label>
              <p className="text-xl text-gray-900">{usuario.nombre}</p>
            </div>
            {usuario.rol === 'socio' && usuario.numero_cliente && (
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-1">Número de Cliente</label>
                <p className="text-xl text-gray-900 font-mono font-bold text-blue-600">{usuario.numero_cliente}</p>
              </div>
            )}
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">RUT</label>
              <p className="text-xl text-gray-900 font-mono">{usuario.rut}</p>
            </div>
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Email</label>
              <p className="text-xl text-gray-900">{usuario.email || 'No registrado'}</p>
            </div>
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Teléfono</label>
              <p className="text-xl text-gray-900">{usuario.telefono || 'No registrado'}</p>
            </div>
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Dirección</label>
              <p className="text-xl text-gray-900">{usuario.direccion || 'No registrada'}</p>
            </div>
          </div>
          <button className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
            ✏️ Editar Información
          </button>
        </Card>

        {/* Estado de Cuenta */}
        <Card title="💰 Estado de Cuenta">
          <div className="space-y-6">
            <div className={`p-6 rounded-lg ${
              usuario.estado === 'activo' 
                ? 'bg-green-50 border-2 border-green-500' 
                : 'bg-red-50 border-2 border-red-500'
            }`}>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Estado Actual</h3>
              <p className={`text-3xl font-bold ${
                usuario.estado === 'activo' ? 'text-green-700' : 'text-red-700'
              }`}>
                {usuario.estado === 'activo' && '✅ AL DÍA'}
                {usuario.estado === 'moroso' && '⚠️ MOROSO'}
                {usuario.estado === 'suspendido' && '🚫 SUSPENDIDO'}
              </p>
            </div>

            {usuario.estado === 'moroso' && (
              <div className="bg-red-100 border-l-4 border-red-600 p-4">
                <p className="text-lg font-semibold text-red-800">
                  ⚠️ Tiene pagos pendientes
                </p>
                <p className="text-base text-red-700 mt-2">
                  Por favor, regularice su situación para evitar la suspensión del servicio.
                </p>
              </div>
            )}

            <div className="pt-4 border-t-2">
              <p className="text-lg text-gray-700 mb-3">
                <strong>Fecha de registro:</strong>{' '}
                {new Date(usuario.fecha_registro).toLocaleDateString('es-CL')}
              </p>
              <button className="w-full px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700">
                💳 Ver Historial de Pagos
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card className="mt-8 bg-blue-50">
        <h3 className="text-2xl font-bold mb-6 text-gray-800">⚡ Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="px-6 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
            💧 Ver Mi Consumo
          </button>
          <button className="px-6 py-4 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700">
            💰 Pagar Cuenta
          </button>
          <button className="px-6 py-4 bg-orange-600 text-white rounded-lg text-lg font-semibold hover:bg-orange-700">
            📝 Hacer Reclamo
          </button>
        </div>
      </Card>
    </div>
  );
}

export default MiCuentaPage;