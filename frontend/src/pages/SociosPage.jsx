import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';

function SociosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setLoading(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(usuario => 
    usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    usuario.rut.includes(busqueda) ||
    (usuario.numero_cliente && usuario.numero_cliente.includes(busqueda))
  );

  const estadoBadge = (estado) => {
    const colores = {
      activo: 'bg-green-100 text-green-800',
      moroso: 'bg-red-100 text-red-800',
      suspendido: 'bg-gray-100 text-gray-800'
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando usuarios...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-gray-800">👥 Gestión de Usuarios</h2>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700">
          ➕ Nuevo Usuario
        </button>
      </div>

      {/* Búsqueda */}
      <Card className="mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, RUT o número de cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
        />
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Total Usuarios</h3>
          <p className="text-3xl font-bold text-blue-700">{usuarios.length}</p>
        </Card>
        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Activos</h3>
          <p className="text-3xl font-bold text-green-700">
            {usuarios.filter(u => u.estado === 'activo').length}
          </p>
        </Card>
        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700">Morosos</h3>
          <p className="text-3xl font-bold text-red-700">
            {usuarios.filter(u => u.estado === 'moroso').length}
          </p>
        </Card>
        <Card className="bg-gray-50 border-l-4 border-gray-600">
          <h3 className="text-lg font-semibold text-gray-700">Administradores</h3>
          <p className="text-3xl font-bold text-gray-700">
            {usuarios.filter(u => u.rol === 'admin').length}
          </p>
        </Card>
      </div>

      {/* Tabla de usuarios */}
      <Card title="📋 Lista de Usuarios">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">N° Cliente</th>
                <th className="p-4 text-lg font-semibold">RUT</th>
                <th className="p-4 text-lg font-semibold">Nombre</th>
                <th className="p-4 text-lg font-semibold">Teléfono</th>
                <th className="p-4 text-lg font-semibold">Dirección</th>
                <th className="p-4 text-lg font-semibold">Rol</th>
                <th className="p-4 text-lg font-semibold">Estado</th>
                <th className="p-4 text-lg font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-base font-mono font-bold text-blue-600">
                    {usuario.numero_cliente || '-'}
                  </td>
                  <td className="p-4 text-base font-mono">{usuario.rut}</td>
                  <td className="p-4 text-base font-semibold">{usuario.nombre}</td>
                  <td className="p-4 text-base">{usuario.telefono || '-'}</td>
                  <td className="p-4 text-base">{usuario.direccion || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      usuario.rol === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {usuario.rol === 'admin' ? '👨‍💼 Admin' : '👤 Usuario'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${estadoBadge(usuario.estado)}`}>
                      {usuario.estado === 'activo' && '✅ Activo'}
                      {usuario.estado === 'moroso' && '⚠️ Moroso'}
                      {usuario.estado === 'suspendido' && '🚫 Suspendido'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm mr-2">
                      👁️ Ver
                    </button>
                    <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default SociosPage;