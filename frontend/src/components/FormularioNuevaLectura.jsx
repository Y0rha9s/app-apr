import React, { useState, useEffect } from 'react';
import api from '../services/api';

function FormularioNuevaLectura({ onClose, onSuccess }) {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ultimaLectura, setUltimaLectura] = useState(null);
  
  const [formData, setFormData] = useState({
    usuario_id: '',
    usuario_nombre: '',
    lectura_actual: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear()
  });

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Cargar usuarios al montar
  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Obtener última lectura cuando se selecciona usuario
  useEffect(() => {
    if (formData.usuario_id) {
      obtenerUltimaLectura(formData.usuario_id);
    }
  }, [formData.usuario_id]);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      const usuariosFiltrados = response.data.filter(u => u.rol === 'usuario');
      setUsuarios(usuariosFiltrados);
      setUsuariosFiltrados(usuariosFiltrados);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError('Error al cargar usuarios');
    }
  };

  const handleBusqueda = (e) => {
    const valor = e.target.value;
    setBusqueda(valor);
    setMostrarLista(true);

    if (valor.trim() === '') {
      setUsuariosFiltrados(usuarios);
      return;
    }

    const filtrados = usuarios.filter(u => {
      const busquedaLower = valor.toLowerCase();
      return (
        u.nombre.toLowerCase().includes(busquedaLower) ||
        u.rut.includes(valor) ||
        (u.medidor && u.medidor.toLowerCase().includes(busquedaLower)) ||
        (u.numero_cliente && u.numero_cliente.includes(valor))
      );
    });

    setUsuariosFiltrados(filtrados);
  };

  const seleccionarUsuario = (usuario) => {
    setFormData(prev => ({
      ...prev,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre
    }));
    setBusqueda(usuario.nombre);
    setMostrarLista(false);
  };

  const limpiarSeleccion = () => {
    setFormData(prev => ({
      ...prev,
      usuario_id: '',
      usuario_nombre: ''
    }));
    setBusqueda('');
    setUsuariosFiltrados(usuarios);
    setUltimaLectura(null);
  };

  const obtenerUltimaLectura = async (usuarioId) => {
    try {
      const response = await api.get('/lecturas');
      const lecturas = response.data;

      const lecturasUsuario = lecturas.filter(l => l.usuario_id === parseInt(usuarioId));
      if (lecturasUsuario.length > 0) {
        const ultima = lecturasUsuario.sort((a, b) => {
          if (b.anio !== a.anio) return b.anio - a.anio;
          return b.mes - a.mes;
        })[0];
        setUltimaLectura(ultima);
      } else {
        setUltimaLectura(null);
      }
    } catch (err) {
      console.error('Error obteniendo última lectura:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.usuario_id || !formData.lectura_actual) {
      setError('Por favor completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/lecturas/crear-con-boleta', {
        usuario_id: parseInt(formData.usuario_id),
        lectura_actual: parseInt(formData.lectura_actual),
        mes: parseInt(formData.mes),
        anio: parseInt(formData.anio)
      });

      const data = response.data;

      if (data.success) {
        onSuccess(data);
        onClose();
      } else {
        setError(data.error || 'Error al crear la lectura');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-gray-900/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">➕ Nueva Lectura</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Buscador de Usuario */}
          <div className="relative">
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Buscar Usuario
            </label>
            
            <div className="relative">
              <input
                type="text"
                value={busqueda}
                onChange={handleBusqueda}
                onFocus={() => setMostrarLista(true)}
                placeholder="Buscar por nombre, RUT, medidor o n° cliente..."
                className="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
              />
              
              {formData.usuario_id && (
                <button
                  type="button"
                  onClick={limpiarSeleccion}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Lista de resultados */}
            {mostrarLista && busqueda && usuariosFiltrados.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {usuariosFiltrados.map(usuario => (
                  <div
                    key={usuario.id}
                    onClick={() => seleccionarUsuario(usuario)}
                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                  >
                    <div className="font-semibold text-gray-800">{usuario.nombre}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="mr-4">📋 RUT: {usuario.rut}</span>
                      {usuario.medidor && <span className="mr-4">🔢 Medidor: {usuario.medidor}</span>}
                      {usuario.numero_cliente && <span>👤 N°: {usuario.numero_cliente}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sin resultados */}
            {mostrarLista && busqueda && usuariosFiltrados.length === 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 text-center text-gray-500">
                No se encontraron usuarios
              </div>
            )}

            {/* Usuario seleccionado */}
            {formData.usuario_id && !mostrarLista && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-green-700">✓ Usuario seleccionado:</span>
                    <p className="font-semibold text-green-900">{formData.usuario_nombre}</p>
                  </div>
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mostrar última lectura */}
          {ultimaLectura && formData.usuario_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                📊 Última lectura registrada:
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Periodo:</span>
                  <p className="font-bold">{meses[ultimaLectura.mes - 1]} {ultimaLectura.anio}</p>
                </div>
                <div>
                  <span className="text-gray-600">Lectura:</span>
                  <p className="font-bold">{ultimaLectura.lectura_actual} m³</p>
                </div>
                <div>
                  <span className="text-gray-600">Consumo:</span>
                  <p className="font-bold">{ultimaLectura.consumo_m3} m³</p>
                </div>
              </div>
            </div>
          )}

          {/* Periodo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                Mes
              </label>
              <select
                name="mes"
                value={formData.mes}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
                required
              >
                {meses.map((mes, index) => (
                  <option key={index} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                Año
              </label>
              <input
                type="number"
                name="anio"
                value={formData.anio}
                onChange={handleChange}
                min="2020"
                max="2030"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Lectura Actual */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              Lectura Actual (m³)
            </label>
            <input
              type="number"
              name="lectura_actual"
              value={formData.lectura_actual}
              onChange={handleChange}
              min="0"
              placeholder={ultimaLectura ? `Anterior: ${ultimaLectura.lectura_actual}` : 'Ej: 1600'}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
              required
            />
            {formData.lectura_actual && ultimaLectura && (
              <p className="text-sm text-gray-600 mt-2">
                Consumo estimado: <strong>{Math.max(0, parseInt(formData.lectura_actual) - ultimaLectura.lectura_actual)} m³</strong>
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg text-lg font-semibold hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.usuario_id}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Creando...' : 'Crear Lectura y Boleta'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>💡 Nota:</strong> Al crear la lectura se generará automáticamente:
          </p>
          <ul className="text-sm text-yellow-700 mt-2 ml-4 list-disc">
            <li>Cálculo de consumo (lectura_actual - lectura_anterior)</li>
            <li>Aplicación de tarifas por tramos y descuentos</li>
            <li>Boleta con saldo anterior incluido</li>
            <li>Fecha de vencimiento (15 días)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default FormularioNuevaLectura;