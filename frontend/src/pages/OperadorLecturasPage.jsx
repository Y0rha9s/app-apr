import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DB_NAME = 'apr_offline';
const STORE_NAME = 'lecturas_pendientes';

// IndexedDB helpers
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarOffline(lectura) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ ...lectura, guardado_en: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function obtenerPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function eliminarPendiente(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function OperadorLecturasPage() {
  const { usuario } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [ultimaLectura, setUltimaLectura] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [ciclo, setCiclo] = useState(null);
  const fotoRef = useRef();

  const [formData, setFormData] = useState({
    usuario_id: '',
    usuario_nombre: '',
    lectura_actual: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear()
  });

  // Detectar conexión
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    cargarPendientes();
    if (online) {
      cargarUsuarios();
      cargarCiclo();
    }
  }, [online]);

  // Auto-sincronizar cuando vuelve la conexión
  useEffect(() => {
    if (online && pendientes.length > 0) {
      sincronizarPendientes();
    }
  }, [online]);

  const cargarCiclo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/configuracion/ciclo`);
      const data = await res.json();
      setCiclo(data);
    } catch (err) {
      console.error('Error cargando ciclo:', err);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await fetch(`${API_URL}/api/usuarios`);
      const data = await res.json();
      const soloUsuarios = data.filter(u => u.rol === 'usuario');
      setUsuarios(soloUsuarios);
      setUsuariosFiltrados(soloUsuarios);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  };

  const cargarPendientes = async () => {
    const items = await obtenerPendientes();
    setPendientes(items);
  };

  const handleBusqueda = (e) => {
    const valor = e.target.value;
    setBusqueda(valor);
    setMostrarLista(true);
    if (!valor.trim()) {
      setUsuariosFiltrados(usuarios);
      return;
    }
    const filtrados = usuarios.filter(u => {
      const q = valor.toLowerCase();
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.rut.includes(valor) ||
        (u.medidor && u.medidor.toLowerCase().includes(q)) ||
        (u.numero_cliente && u.numero_cliente.includes(valor))
      );
    });
    setUsuariosFiltrados(filtrados);
  };

  const seleccionarUsuario = async (u) => {
    setFormData(prev => ({ ...prev, usuario_id: u.id, usuario_nombre: u.nombre }));
    setBusqueda(u.nombre);
    setMostrarLista(false);
    if (online) {
      try {
        const res = await fetch(`${API_URL}/api/lecturas`);
        const lecturas = await res.json();
        const del_usuario = lecturas
          .filter(l => l.usuario_id === u.id)
          .sort((a, b) => b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes);
        setUltimaLectura(del_usuario[0] || null);
      } catch (err) {
        console.error('Error cargando última lectura:', err);
      }
    }
  };

  const limpiarSeleccion = () => {
    setFormData(prev => ({ ...prev, usuario_id: '', usuario_nombre: '' }));
    setBusqueda('');
    setUltimaLectura(null);
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const mostrarMensaje = (texto, tipo = 'success') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.usuario_id) {
      mostrarMensaje('Debes seleccionar un usuario', 'error');
      return;
    }
    if (!formData.lectura_actual) {
      mostrarMensaje('Debes ingresar la lectura actual', 'error');
      return;
    }
    if (!fotoFile) {
      mostrarMensaje('La foto del medidor es obligatoria', 'error');
      return;
    }

    setLoading(true);

    try {
      let foto_url = null;

      // Subir foto si hay conexión
      if (online) {
        const fd = new FormData();
        fd.append('foto', fotoFile);
        const fotoRes = await fetch(`${API_URL}/api/fotos/lectura`, {
          method: 'POST',
          body: fd
        });
        const fotoData = await fotoRes.json();
        if (!fotoData.success) throw new Error('Error al subir foto');
        foto_url = fotoData.foto_url;
      } else {
        // Offline: guardar foto como base64
        foto_url = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(fotoFile);
        });
      }

      const lecturaData = {
        usuario_id: parseInt(formData.usuario_id),
        usuario_nombre: formData.usuario_nombre,
        lectura_actual: parseInt(formData.lectura_actual),
        mes: parseInt(formData.mes),
        anio: parseInt(formData.anio),
        operador_id: usuario?.id,
        foto_url,
        offline: !online
      };

      if (online) {
        // Enviar directo al servidor
        const res = await fetch(`${API_URL}/api/lecturas/crear-con-boleta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lecturaData)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al guardar lectura');
        mostrarMensaje(`✅ Lectura guardada — Consumo: ${data.lectura.consumo_m3} m³`);
      } else {
        // Guardar en IndexedDB
        await guardarOffline(lecturaData);
        await cargarPendientes();
        mostrarMensaje('📦 Guardado sin conexión — se enviará al reconectar', 'warning');
      }

      // Limpiar formulario
      setFormData({
        usuario_id: '',
        usuario_nombre: '',
        lectura_actual: '',
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear()
      });
      setBusqueda('');
      setUltimaLectura(null);
      setFotoFile(null);
      setFotoPreview(null);
      if (fotoRef.current) fotoRef.current.value = '';

    } catch (err) {
      mostrarMensaje('❌ ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const sincronizarPendientes = async () => {
    if (!online || pendientes.length === 0) return;
    setSincronizando(true);
    let exitosos = 0;

    for (const item of pendientes) {
      try {
        // Si la foto es base64, subirla primero
        let foto_url = item.foto_url;
        if (foto_url && foto_url.startsWith('data:')) {
          const blob = await fetch(foto_url).then(r => r.blob());
          const fd = new FormData();
          fd.append('foto', blob, 'foto.jpg');
          const fotoRes = await fetch(`${API_URL}/api/fotos/lectura`, {
            method: 'POST',
            body: fd
          });
          const fotoData = await fotoRes.json();
          if (fotoData.success) foto_url = fotoData.foto_url;
        }

        const res = await fetch(`${API_URL}/api/lecturas/crear-con-boleta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, foto_url })
        });
        const data = await res.json();
        if (data.success) {
          await eliminarPendiente(item.id);
          exitosos++;
        }
      } catch (err) {
        console.error('Error sincronizando:', err);
      }
    }

    await cargarPendientes();
    setSincronizando(false);
    if (exitosos > 0) mostrarMensaje(`✅ ${exitosos} lectura(s) sincronizada(s)`);
  };

  const estaEnPeriodo = ciclo
    ? new Date().getDate() >= ciclo.inicioLecturas && new Date().getDate() <= ciclo.finLecturas
    : true;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">

      {/* Header estado conexión */}
      <div className={`flex items-center justify-between mb-6 px-4 py-3 rounded-xl ${online ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Toma de Lecturas</h1>
          <p className={`text-sm font-medium mt-1 ${online ? 'text-green-700' : 'text-orange-700'}`}>
            {online ? '🟢 En línea' : '🔴 Sin conexión — modo offline'}
          </p>
        </div>
        {pendientes.length > 0 && (
          <button
            onClick={sincronizarPendientes}
            disabled={!online || sincronizando}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-400"
          >
            {sincronizando ? '⏳' : `📤 Sync (${pendientes.length})`}
          </button>
        )}
      </div>

      {/* Aviso periodo */}
      {ciclo && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${estaEnPeriodo ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
          {estaEnPeriodo
            ? `📅 Período de lecturas activo: días ${ciclo.inicioLecturas} al ${ciclo.finLecturas}`
            : `⚠️ Fuera del período de lecturas (días ${ciclo.inicioLecturas}–${ciclo.finLecturas})`}
        </div>
      )}

      {/* Mensaje feedback */}
      {mensaje && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${mensaje.tipo === 'error' ? 'bg-red-100 text-red-800' :
            mensaje.tipo === 'warning' ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
          }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Buscador usuario */}
        <div className="relative">
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Usuario / Socio
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={handleBusqueda}
            onFocus={() => setMostrarLista(true)}
            placeholder="Buscar por nombre, RUT, medidor..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:border-blue-500"
          />
          {formData.usuario_id && (
            <button type="button" onClick={limpiarSeleccion}
              className="absolute right-3 top-11 text-gray-400 hover:text-gray-600 text-xl">✕</button>
          )}

          {mostrarLista && busqueda && usuariosFiltrados.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
              {usuariosFiltrados.map(u => (
                <div key={u.id} onClick={() => seleccionarUsuario(u)}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0">
                  <p className="font-semibold text-gray-800">{u.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {u.rut} {u.medidor && `· Medidor: ${u.medidor}`} {u.numero_cliente && `· N°${u.numero_cliente}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {formData.usuario_id && (
            <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
              <span className="text-sm text-green-800 font-medium">✓ {formData.usuario_nombre}</span>
              <button type="button" onClick={limpiarSeleccion}
                className="text-xs text-green-600 underline">Cambiar</button>
            </div>
          )}
        </div>

        {/* Lectura anterior — solo lectura */}
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Lectura anterior (m³)
          </label>
          <input
            type="text"
            value={ultimaLectura ? ultimaLectura.lectura_actual : '—'}
            readOnly
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-xl font-mono bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          {ultimaLectura && (
            <p className="text-xs text-gray-400 mt-1">
              Registrada en {new Date(ultimaLectura.anio, ultimaLectura.mes - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Última lectura */}
        {ultimaLectura && (
          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <p className="font-semibold text-blue-800 mb-1">Última lectura registrada</p>
            <div className="flex gap-6 text-blue-700">
              <span>Lectura: <strong>{ultimaLectura.lectura_actual}</strong></span>
              <span>Consumo: <strong>{ultimaLectura.consumo_m3} m³</strong></span>
            </div>
          </div>
        )}

        {/* Lectura actual */}
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Lectura actual (m³)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={formData.lectura_actual}
            onChange={(e) => setFormData(prev => ({ ...prev, lectura_actual: e.target.value }))}
            placeholder={ultimaLectura ? `Anterior: ${ultimaLectura.lectura_actual}` : 'Ej: 1600'}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-xl font-mono focus:outline-none focus:border-blue-500"
            min="0"
            required
          />
          {formData.lectura_actual && ultimaLectura && (
            <p className="text-sm text-gray-500 mt-1">
              Consumo estimado: <strong>{Math.max(0, parseInt(formData.lectura_actual) - ultimaLectura.lectura_actual)} m³</strong>
            </p>
          )}
        </div>

        {/* Foto obligatoria */}
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-2">
            Foto del medidor <span className="text-red-600">*obligatoria</span>
          </label>

          {!fotoPreview ? (
            <div
              onClick={() => fotoRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <span className="text-4xl mb-2">📷</span>
              <p className="text-gray-500 text-sm font-medium">Toca para tomar o subir foto</p>
              <p className="text-gray-400 text-xs mt-1">JPG, PNG hasta 10MB</p>
            </div>
          ) : (
            <div className="relative">
              <img src={fotoPreview} alt="Medidor" className="w-full h-48 object-cover rounded-xl border-2 border-green-300" />
              <button
                type="button"
                onClick={() => { setFotoPreview(null); setFotoFile(null); if (fotoRef.current) fotoRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
              >✕</button>
              <div className="absolute bottom-2 left-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                ✓ Foto cargada
              </div>
            </div>
          )}

          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            className="hidden"
          />
        </div>

        {/* Botón submit */}
        <button
          type="submit"
          disabled={loading || !formData.usuario_id || !fotoFile}
          className="w-full py-4 bg-blue-600 text-white rounded-xl text-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {loading ? '⏳ Guardando...' : online ? '✅ Registrar Lectura' : '📦 Guardar Offline'}
        </button>

      </form>

      {/* Pendientes offline */}
      {pendientes.length > 0 && (
        <div className="mt-6 px-4 py-4 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="font-semibold text-orange-800 mb-2">
            📦 {pendientes.length} lectura(s) pendiente(s) de sincronizar
          </p>
          <div className="space-y-1">
            {pendientes.map(p => (
              <div key={p.id} className="text-sm text-orange-700">
                · {p.usuario_nombre} — {p.lectura_actual} m³
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default OperadorLecturasPage;