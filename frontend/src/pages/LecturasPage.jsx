import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Card from '../components/Card';

import Button from '../components/Button';
import FormularioNuevaLectura from '../components/FormularioNuevaLectura';

function LecturasPage() {

  const { usuario  } = useAuth();
  const [lecturas, setLecturas] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesActual] = useState(new Date().getMonth() + 1);
  const [anioActual] = useState(new Date().getFullYear());

  // Estados para edición
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);
  const [razonModificacion, setRazonModificacion] = useState('');


  const handleNuevaLectura = () => {
    setMostrarFormulario(true);
  };

  const handleCerrarFormulario = () => {
    setMostrarFormulario(false);
  };

  const handleLecturaCreada = (data) => {
    // Recargar lecturas
    cargarLecturas();

    // Mostrar mensaje de éxito
    alert(`✅ ${data.mensaje}\n\nConsumo: ${data.lectura.consumo_m3} m³\nTotal a pagar: $${data.boleta.total_a_pagar.toLocaleString()}`);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [lecturasRes, usuariosRes] = await Promise.all([
        api.get('/lecturas'),
        api.get('/usuarios')
      ]);
      setLecturas(lecturasRes.data);
      setUsuarios(usuariosRes.data.filter(u => u.rol === 'usuario'));
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getNombreUsuario = (usuarioId) => {
    const usuario = usuarios.find(u => u.id === usuarioId);
    return usuario ? usuario.nombre : 'Desconocido';
  };

  // Funciones de Edición
  const handleEditar = (lectura) => {
    setEditando(lectura.id);
    setFormEdit({
      lectura_anterior: lectura.lectura_anterior,
      lectura_actual: lectura.lectura_actual,
      monto_calculado: lectura.monto_calculado,
      observaciones: lectura.observaciones || '',
      fecha_lectura: lectura.fecha_lectura.split('T')[0]
    });
  };

  const handleCancelarEdicion = () => {
    setEditando(null);
    setFormEdit({});
    setMostrarModalEdicion(false);
    setRazonModificacion('');
  };

  const handleGuardarConRazon = async () => {
    if (!razonModificacion.trim()) {
      alert('⚠️ Debe ingresar una razón para modificar la lectura');
      return;
    }

    try {
      await api.put(`/lecturas/${editando}`, {
        lectura_anterior: parseInt(formEdit.lectura_anterior),
        lectura_actual: parseInt(formEdit.lectura_actual),
        monto_calculado: parseFloat(formEdit.monto_calculado),
        observaciones: formEdit.observaciones,
        razon_modificacion: razonModificacion,
        usuario_modificador_id: usuario.id
      });

      alert('✅ Lectura actualizada correctamente');
      setEditando(null);
      setMostrarModalEdicion(false);
      setRazonModificacion('');
      setFormEdit({});
      cargarDatos();
    } catch (error) {
      alert('❌ Error al actualizar lectura: ' + error.message);
    }
  };

  const handleSolicitarGuardar = () => {
    // Recalcular el consumo antes de abrir el modal
    const consumoNuevo = parseInt(formEdit.lectura_actual) - parseInt(formEdit.lectura_anterior);

    if (consumoNuevo < 0) {
      alert('⚠️ La lectura actual no puede ser menor que la anterior');
      return;
    }

    setMostrarModalEdicion(true);
  };

  const lecturasDelMes = lecturas.filter(l => l.mes === mesActual && l.anio === anioActual);
  const consumoTotal = lecturasDelMes.reduce((sum, l) => sum + (l.consumo_m3 || 0), 0);

  if (loading) {
    return <div className="text-center text-3xl py-12">⏳ Cargando lecturas...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold text-gray-800">💧 Gestión de Lecturas</h2>
        <button
          onClick={handleNuevaLectura}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700"
        >
          ➕ Nueva Lectura
        </button>
        {/* Modal del formulario */}
        {mostrarFormulario && (
          <FormularioNuevaLectura
            onClose={handleCerrarFormulario}
            onSuccess={handleLecturaCreada}
          />
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-gray-700">Lecturas del Mes</h3>
          <p className="text-3xl font-bold text-blue-700">{lecturasDelMes.length}</p>
          <p className="text-sm text-gray-600 mt-2">
            {new Date(anioActual, mesActual - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
          </p>
        </Card>

        <Card className="bg-cyan-50 border-l-4 border-cyan-600">
          <h3 className="text-lg font-semibold text-gray-700">Consumo Total</h3>
          <p className="text-3xl font-bold text-cyan-700">{consumoTotal} m³</p>
          <p className="text-sm text-gray-600 mt-2">Metros cúbicos del mes</p>
        </Card>

        <Card className="bg-green-50 border-l-4 border-green-600">
          <h3 className="text-lg font-semibold text-gray-700">Promedio por Usuario</h3>
          <p className="text-3xl font-bold text-green-700">
            {lecturasDelMes.length > 0 ? Math.round(consumoTotal / lecturasDelMes.length) : 0} m³
          </p>
          <p className="text-sm text-gray-600 mt-2">Consumo promedio</p>
        </Card>
      </div>

      {/* Tabla de lecturas */}
      <Card title="📋 Historial de Lecturas">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="p-4 text-lg font-semibold">Usuario</th>
                <th className="p-4 text-lg font-semibold">Fecha</th>
                <th className="p-4 text-lg font-semibold">Período</th>
                <th className="p-4 text-lg font-semibold">Lectura Anterior</th>
                <th className="p-4 text-lg font-semibold">Lectura Actual</th>
                <th className="p-4 text-lg font-semibold">Consumo (m³)</th>
                <th className="p-4 text-lg font-semibold">Monto</th>
                <th className="p-4 text-lg font-semibold">Operador</th>
                <th className="p-4 text-lg font-semibold">Foto</th>
                <th className="p-4 text-lg font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lecturas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-xl text-gray-500">
                    No hay lecturas registradas
                  </td>
                </tr>
              ) : (
                lecturas.slice().reverse().map((lectura) => (
                  <tr key={lectura.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-base font-semibold">{lectura.usuario_nombre || 'Desconocido'}</td>
                    <td className="p-4 text-base">{formatearFecha(lectura.fecha_lectura)}</td>
                    <td className="p-4 text-base">
                      {new Date(lectura.anio, lectura.mes - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-base text-center font-mono">{lectura.lectura_anterior}</td>
                    <td className="p-4 text-base text-center font-mono font-bold text-blue-600">
                      {editando === lectura.id ? (
                        <input
                          type="number"
                          value={formEdit.lectura_actual}
                          onChange={(e) => setFormEdit({ ...formEdit, lectura_actual: e.target.value })}
                          className="w-24 px-2 py-1 border rounded"
                        />
                      ) : (
                        lectura.lectura_actual
                      )}
                    </td>
                    <td className="p-4 text-base text-center">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full font-bold">
                        {lectura.consumo_m3} m³
                      </span>
                    </td>
                    <td className="p-4 text-base font-bold text-green-600">
                      {formatearMonto(lectura.monto_calculado)}
                    </td>
                    <td className="p-4 text-base text-gray-500"> 
                      {lectura.operador_nombre || '—'} 
                    </td> 
                    <td className="p-4"> 
                      {lectura.foto_url ? ( 
                        <a href={lectura.foto_url} target="_blank" rel="noopener noreferrer"> 
                          <img 
                            src={lectura.foto_url} 
                            alt="Medidor" 
                            className="w-14 h-14 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-400 transition cursor-pointer" 
                          /> 
                        </a> 
                      ) : ( 
                        <span className="text-gray-400 text-sm">Sin foto</span> 
                      )} 
                    </td>
                    <td className="p-4">
                      {editando === lectura.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSolicitarGuardar(lectura.id)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                          >
                            ✅ Guardar
                          </button>
                          <button
                            onClick={handleCancelarEdicion}
                            className="text-red-600 hover:text-red-800 font-bold"
                          >
                            ❌
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditar(lectura)}
                          className="text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de confirmación de edición */}
      {mostrarModalEdicion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">⚠️ Confirmar Modificación</h3>
            <p className="text-lg mb-4">
              Está a punto de modificar una lectura. Por razones de auditoría, debe indicar el motivo:
            </p>

            <textarea
              value={razonModificacion}
              onChange={(e) => setRazonModificacion(e.target.value)}
              placeholder="Ej: Lectura tomada incorrectamente, el medidor marcaba 12345 en lugar de 12356"
              rows="4"
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 mb-4"
              required
            />

            <div className="flex gap-4">
              <Button
                variant="success"
                onClick={() => handleGuardarConRazon(editando)}
                className="flex-1"
              >
                ✅ Confirmar Cambios
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setMostrarModalEdicion(false);
                  setRazonModificacion('');
                }}
                className="flex-1"
              >
                ❌ Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default LecturasPage;