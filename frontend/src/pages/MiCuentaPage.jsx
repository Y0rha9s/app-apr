import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import { usuariosService } from '../services/api';

function MiCuentaPage() {
  const { usuario, refreshUser } = useAuth();
  
  // Estados para edición
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estados para historial
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const handleEditClick = () => {
    setFormData({
      nombre: usuario.nombre || '',
      rut: usuario.rut || '',
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      direccion: usuario.direccion || ''
    });
    setIsEditing(true);
    setMessage({ type: '', text: '' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await usuariosService.update(usuario.id, formData);
      await refreshUser();
      setMessage({ type: 'success', text: 'Información actualizada correctamente' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar:', error);
      setMessage({ type: 'error', text: 'Error al actualizar la información' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerHistorial = async () => {
    setShowHistorial(true);
    setLoadingHistorial(true);
    try {
      // Usamos getInfoCompleta que devuelve pagos y lecturas
      // O podemos crear un endpoint específico si getInfoCompleta trae demasiada data
      // Pero api.js dice getInfoCompleta devuelve pagosResult
      const response = await usuariosService.getInfoCompleta(usuario.id);
      // Asumiendo que la respuesta tiene una propiedad 'pagos' o similar.
      // Revisando el backend controller: devuelve { usuario, lecturas: [...], pagos: [...], ... }
      // Pero espera, getInfoCompleta devuelve { usuario: {...}, lecturas: [...], pagos: [...] }
      // NO, mirando el controller: res.json(infoCompleta);
      // infoCompleta tiene: usuario, lecturas, pagos, deuda, etc.
      if (response.data && response.data.pagos) {
        setHistorial(response.data.pagos);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoadingHistorial(false);
    }
  };

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8 text-gray-800">🏠 Mi Cuenta</h2>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Información Personal */}
        <Card title="👤 Información Personal">
          <div className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Nombre Completo</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="nombre" 
                  value={formData.nombre} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-xl text-gray-900">{usuario.nombre}</p>
              )}
            </div>
            
            {usuario.rol === 'socio' && usuario.numero_cliente && (
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-1">Número de Cliente</label>
                <p className="text-xl text-gray-900 font-mono font-bold text-blue-600">
                  {usuario.numero_cliente} 
                  {isEditing && <span className="text-xs text-gray-500 font-normal ml-2">(No editable)</span>}
                </p>
              </div>
            )}

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">RUT</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="rut" 
                  value={formData.rut} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-xl text-gray-900 font-mono">{usuario.rut}</p>
              )}
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Email</label>
              {isEditing ? (
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-xl text-gray-900">{usuario.email || 'No registrado'}</p>
              )}
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Teléfono</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="telefono" 
                  value={formData.telefono} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-xl text-gray-900">{usuario.telefono || 'No registrado'}</p>
              )}
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-1">Dirección</label>
              {isEditing ? (
                <input 
                  type="text" 
                  name="direccion" 
                  value={formData.direccion} 
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-xl text-gray-900">{usuario.direccion || 'No registrada'}</p>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex gap-4 mt-6">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
              <button 
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg text-lg font-semibold hover:bg-gray-600 disabled:opacity-50"
              >
                ❌ Cancelar
              </button>
            </div>
          ) : (
            <button 
              onClick={handleEditClick}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700"
            >
              ✏️ Editar Información
            </button>
          )}
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
              <button 
                onClick={handleVerHistorial}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700"
              >
                💳 Ver Historial de Pagos
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal Historial de Pagos */}
      {showHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">💳 Historial de Pagos</h3>
              <button 
                onClick={() => setShowHistorial(false)} 
                className="text-gray-500 hover:text-red-500 transition-colors text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            
            {loadingHistorial ? (
               <div className="flex justify-center py-8">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
               </div>
            ) : historial.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="text-left py-3 px-4 text-gray-600 font-semibold uppercase text-sm">Fecha</th>
                       <th className="text-left py-3 px-4 text-gray-600 font-semibold uppercase text-sm">Monto</th>
                       <th className="text-left py-3 px-4 text-gray-600 font-semibold uppercase text-sm">Método</th>
                       <th className="text-left py-3 px-4 text-gray-600 font-semibold uppercase text-sm">Estado</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                     {historial.map((pago, index) => (
                       <tr key={pago.id || index} className="hover:bg-gray-50 transition-colors">
                         <td className="py-3 px-4 font-mono">
                           {new Date(pago.fecha_pago).toLocaleDateString('es-CL')}
                         </td>
                         <td className="py-3 px-4 font-bold text-green-600">
                           ${parseInt(pago.monto).toLocaleString('es-CL')}
                         </td>
                         <td className="py-3 px-4 capitalize">
                           {pago.metodo_pago || 'Transferencia'}
                         </td>
                         <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                              Completado
                            </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg">No hay pagos registrados en el historial.</p>
              </div>
            )}
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setShowHistorial(false)} 
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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