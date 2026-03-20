import { useState, useEffect } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function SociosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [actualizandoTipo, setActualizandoTipo] = useState({});

  // Formulario nuevo usuario
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    rol: 'socio'
  });

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

  const handleSuspender = async (id) => {
    if (!window.confirm('¿Está seguro de suspender este usuario?')) return;

    try {
      await api.put(`/usuarios/${id}/suspender`);
      alert('✅ Usuario suspendido correctamente');
      cargarUsuarios();
    } catch (error) {
      alert('❌ Error al suspender usuario: ' + error.message);
    }
  };

  const handleReponer = async (id) => {
    if (!window.confirm('¿Está seguro de reponer este usuario?')) return;

    try {
      await api.put(`/usuarios/${id}/reponer`);
      alert('✅ Usuario repuesto correctamente');
      cargarUsuarios();
    } catch (error) {
      alert('❌ Error al reponer usuario: ' + error.message);
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();

    try {
      await api.post('/usuarios', formData);
      alert('✅ Usuario creado exitosamente');
      setMostrarFormulario(false);
      setFormData({
        rut: '',
        nombre: '',
        email: '',
        telefono: '',
        direccion: '',
        rol: 'socio'
      });
      cargarUsuarios();
    } catch (error) {
      alert('❌ Error al crear usuario: ' + error.message);
    }
  };

  const handleToggleAfectoIva = async (u) => {
    setActualizandoTipo((prev) => ({ ...prev, [u.id]: true }));
    try {
      const tipoActual = u.tipo_usuario || 'normal';
      const nuevoTipo = tipoActual === 'exento_iva' ? 'normal' : 'exento_iva';
      await api.put(`/usuarios/${u.id}/tipo`, { tipo_usuario: nuevoTipo });
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, tipo_usuario: nuevoTipo } : x)));
    } catch (error) {
      alert('❌ Error al actualizar IVA: ' + (error.response?.data?.error || error.message));
    } finally {
      setActualizandoTipo((prev) => ({ ...prev, [u.id]: false }));
    }
  };

  const usuariosFiltrados = usuarios.filter(usuario =>
    usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    usuario.rut.toLowerCase().includes(busqueda.toLowerCase()) ||
    usuario.numero_cliente?.toLowerCase().includes(busqueda.toLowerCase()) ||
    usuario.medidor?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const clienteKey = (numeroCliente) => {
    if (!numeroCliente) return { prefix: 'ZZZ', num: Number.POSITIVE_INFINITY, raw: '' };
    const raw = numeroCliente.toString().trim();
    const match = raw.match(/^([A-Z]+)-0*(\d+)$/i);
    if (match) {
      return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10), raw };
    }
    const onlyNum = raw.match(/^0*(\d+)$/);
    if (onlyNum) {
      return { prefix: '', num: parseInt(onlyNum[1], 10), raw };
    }
    return { prefix: 'ZZZ', num: Number.POSITIVE_INFINITY, raw };
  };

  const usuariosOrdenados = usuariosFiltrados.slice().sort((a, b) => {
    const ak = clienteKey(a.numero_cliente);
    const bk = clienteKey(b.numero_cliente);
    if (ak.prefix !== bk.prefix) return ak.prefix.localeCompare(bk.prefix);
    if (ak.num !== bk.num) return ak.num - bk.num;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
  });

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
        <Button variant="primary" onClick={() => setMostrarFormulario(!mostrarFormulario)}>
          {mostrarFormulario ? '✖️ Cancelar' : '➕ Nuevo Usuario'}
        </Button>
      </div>

      {/* Formulario Nuevo Usuario */}
      {mostrarFormulario && (
        <Card className="mb-8 bg-blue-50">
          <h3 className="text-2xl font-bold mb-6">Crear Nuevo Usuario</h3>
          <form onSubmit={handleCrearUsuario} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">RUT *</label>
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                  placeholder="12345678-9"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Nombre Completo *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.cl"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+56912345678"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-lg font-semibold text-gray-700 mb-2">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Calle 123, Comuna"
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="socio">Usuario/Socio</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <Button type="submit" variant="success" className="w-full">
              ✅ Crear Usuario
            </Button>
            <p className="text-base text-gray-600 text-center">
              La contraseña predeterminada es: <strong>demo123</strong>
            </p>
          </form>
        </Card>
      )}

      {/* Búsqueda */}
      <Card className="mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, RUT o número de cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
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
            {usuarios.filter(s => s.estado === 'activo').length}
          </p>
        </Card>
        <Card className="bg-red-50 border-l-4 border-red-600">
          <h3 className="text-lg font-semibold text-gray-700">Morosos</h3>
          <p className="text-3xl font-bold text-red-700">
            {usuarios.filter(s => s.estado === 'moroso').length}
          </p>
        </Card>
        <Card className="bg-gray-50 border-l-4 border-gray-600">
          <h3 className="text-lg font-semibold text-gray-700">Suspendidos</h3>
          <p className="text-3xl font-bold text-gray-700">
            {usuarios.filter(s => s.estado === 'suspendido').length}
          </p>
        </Card>
      </div>

      {/* Tabla de usuarios */}
      <Card title="📋 Lista de Usuarios">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">Nº Cliente</th>
                <th className="p-4 text-lg font-semibold">Nº Medidor</th>
                <th className="p-4 text-lg font-semibold">RUT</th>
                <th className="p-4 text-lg font-semibold">Nombre</th>
                <th className="p-4 text-lg font-semibold">Teléfono</th>
                <th className="p-4 text-lg font-semibold">Dirección</th>
                <th className="p-4 text-lg font-semibold">Rol</th>
                <th className="p-4 text-lg font-semibold text-center">Afecto a IVA</th>
                <th className="p-4 text-lg font-semibold">Estado</th>
                <th className="p-4 text-lg font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosOrdenados.map((usuario) => (
                <tr key={usuario.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <a 
                      href={`https://apr-safip.onrender.com/api/boletas/pdf/${usuario.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-base font-bold text-blue-600 cursor-pointer hover:underline"
                    >
                      {usuario.numero_cliente || '-'}
                    </a>
                  </td>
                  <td className="p-4 text-base font-mono">
                    {usuario.medidor || usuario.numero_medidor || '-'}
                  </td>
                  <td className="p-4 text-base font-mono">{usuario.rut}</td>
                  <td className="p-4 text-base font-semibold">{usuario.nombre}</td>
                  <td className="p-4 text-base">{usuario.telefono || '-'}</td>
                  <td className="p-4 text-base">{usuario.direccion || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${usuario.rol === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                      {usuario.rol === 'admin' ? '👨‍💼 Admin' : '👤 Usuario'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      disabled={!!actualizandoTipo[usuario.id]}
                      onClick={() => handleToggleAfectoIva(usuario)}
                      className={`inline-flex items-center justify-center min-w-16 px-3 py-1 rounded-full text-sm font-bold border transition-colors ${
                        (usuario.tipo_usuario || 'normal') === 'exento_iva'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      } ${actualizandoTipo[usuario.id] ? 'opacity-60 cursor-wait' : ''}`}
                    >
                      {(usuario.tipo_usuario || 'normal') === 'exento_iva' ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${estadoBadge(usuario.estado)}`}>
                      {usuario.estado === 'activo' && '✅ Activo'}
                      {usuario.estado === 'moroso' && '⚠️ Moroso'}
                      {usuario.estado === 'suspendido' && '🚫 Suspendido'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                        👁️ Ver
                      </button>
                      {usuario.estado !== 'suspendido' && (
                        <button
                          onClick={() => handleSuspender(usuario.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          🚫 Suspender
                        </button>
                      )}
                      {usuario.estado === 'suspendido' && (
                        <button
                          onClick={() => handleReponer(usuario.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          ✅ Reponer
                        </button>
                      )}
                    </div>
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
