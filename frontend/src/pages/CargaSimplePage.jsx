import { useState } from 'react';
import api from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

function CargaSimplePage() {
    const [archivo, setArchivo] = useState(null);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [anio, setAnio] = useState(new Date().getFullYear());
    const [procesando, setProcesando] = useState(false);
    const [resultados, setResultados] = useState(null);
    const [mostrarResultados, setMostrarResultados] = useState(false);
    const [conflictos, setConflictos] = useState([]);
    const [resolviendo, setResolviendo] = useState({});
    const [mensajeProceso, setMensajeProceso] = useState('');
    const [archivoContactos, setArchivoContactos] = useState(null);
    const [procesandoContactos, setProcesandoContactos] = useState(false);
    const [resultadosContactos, setResultadosContactos] = useState(null);

    const handleProcesarContactos = async () => {
        if (!archivoContactos) return;
        if (!window.confirm('¿Actualizar teléfonos y domicilios?')) return;

        setProcesandoContactos(true);
        setResultadosContactos(null);
        try {
            const formData = new FormData();
            formData.append('archivo', archivoContactos);

            const response = await api.post('/carga-simple/actualizar-contactos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResultadosContactos(response.data);
            setArchivoContactos(null);
            document.getElementById('fileContactos').value = '';
        } catch (error) {
            alert('❌ Error: ' + (error.response?.data?.error || error.message));
        } finally {
            setProcesandoContactos(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validar que sea Excel
            const extension = file.name.split('.').pop().toLowerCase();
            if (!['xlsx', 'xls'].includes(extension)) {
                alert('⚠️ Por favor selecciona un archivo Excel (.xlsx o .xls)');
                e.target.value = '';
                return;
            }
            setArchivo(file);
        }
    };

    const handleDescargarTemplate = async () => {
        try {
            const response = await api.get('/carga-simple/descargar-template', {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'template_lecturas.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();

            alert('✅ Template descargado correctamente');
        } catch (error) {
            alert('❌ Error descargando template: ' + error.message);
        }
    };

    const handleDescargarUsuarios = async () => {
        try {
            const response = await api.get(`/carga-simple/descargar-usuarios?mes=${mes}&anio=${anio}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `lecturas_${mes}_${anio}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            alert(`✅ Excel con usuarios descargado\n\nAhora solo debes llenar la columna "Lectura Actual" y subir el archivo.`);
        } catch (error) {
            alert('❌ Error descargando Excel: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleProcesar = async () => {
        if (!archivo) {
            alert('⚠️ Debes seleccionar un archivo Excel');
            return;
        }

        if (!mes || !anio) {
            alert('⚠️ Debes seleccionar mes y año');
            return;
        }

        if (!window.confirm(`¿Procesar lecturas para ${mes}/${anio}?`)) {
            return;
        }

        setProcesando(true);
        setResultados(null);
        setMostrarResultados(false);
        setConflictos([]);
        setMensajeProceso('');

        try {
            const formData = new FormData();
            formData.append('archivo', archivo);
            formData.append('mes', mes);
            formData.append('anio', anio);

            const response = await api.post('/carga-simple/procesar-lecturas', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setResultados(response.data.resultados);
            setMostrarResultados(true);
            setConflictos((response.data.resultados?.conflictos || []).map((c) => ({ ...c, decision: null })));
            setMensajeProceso(response.data.mensaje || '');

            // Limpiar archivo
            setArchivo(null);
            document.getElementById('fileInput').value = '';

        } catch (error) {
            alert('❌ Error procesando archivo: ' + (error.response?.data?.error || error.message));
        } finally {
            setProcesando(false);
        }
    };

    const handleConfirmarConflicto = async (c) => {
        setResolviendo((prev) => ({ ...prev, [c.lectura_id_existente]: true }));
        try {
            await api.put('/carga-simple/resolver-conflicto', {
                lectura_id: c.lectura_id_existente,
                lectura_actual: c.lectura_nueva
            });
            setConflictos((prev) =>
                prev.map((x) =>
                    x.lectura_id_existente === c.lectura_id_existente ? { ...x, decision: 'confirmado' } : x
                )
            );
        } catch (e) {
            alert('❌ Error aplicando lectura para ' + c.nombre + ': ' + (e.response?.data?.error || e.message));
        } finally {
            setResolviendo((prev) => ({ ...prev, [c.lectura_id_existente]: false }));
        }
    };

    const handleRechazarConflicto = (c) => {
        setConflictos((prev) =>
            prev.map((x) =>
                x.lectura_id_existente === c.lectura_id_existente ? { ...x, decision: 'rechazado' } : x
            )
        );
    };

    const formatearMonto = (monto) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(monto);
    };

    const meses = [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' }
    ];

    const anios = [2024, 2025, 2026, 2027];

    return (
        <div>
            <h2 className="text-4xl font-bold mb-8 text-gray-800">📤 Carga Masiva Simplificada</h2>

            {/* Instrucciones */}
            <Card className="mb-8 bg-blue-50 border-l-4 border-blue-600">
                <h3 className="text-2xl font-bold mb-4 text-blue-800">ℹ️ Instrucciones</h3>
                <div className="space-y-3 text-lg">
                    <p><strong>1.</strong> Descarga el template Excel haciendo clic en el botón de abajo</p>
                    <p><strong>2.</strong> Llena el Excel con los datos:</p>
                    <ul className="ml-8 list-disc space-y-2">
                        <li><strong>Nombre:</strong> Nombre del usuario (opcional)</li>
                        <li><strong>RUT:</strong> RUT del usuario (con guión)</li>
                        <li><strong>Nro Medidor:</strong> Número del medidor</li>
                        <li><strong>Lectura Actual:</strong> Lectura actual del medidor</li>
                    </ul>
                    <p><strong>3.</strong> El sistema buscará al usuario por RUT o Número de Medidor</p>
                    <p><strong>4.</strong> El consumo se calcula automáticamente (Lectura Actual - Lectura Anterior)</p>
                    <p><strong>5.</strong> Se generan las boletas automáticamente</p>
                </div>
                <div className="mt-6 flex gap-4 flex-wrap">
                    <button
                        onClick={handleDescargarTemplate}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg text-lg font-semibold hover:bg-gray-700 transition-colors"
                    >
                        📥 Descargar Template Vacío
                    </button>
                    <button
                        onClick={handleDescargarUsuarios}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        👥 Descargar Usuarios
                    </button>
                </div>
            </Card>

            {/* Formulario de Carga */}
            <Card className="mb-8">
                <h3 className="text-2xl font-bold mb-6 text-gray-800">📂 Cargar Archivo de Lecturas</h3>

                <div className="space-y-6">
                    {/* Selección de Período */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">Mes *</label>
                            <select
                                value={mes}
                                onChange={(e) => setMes(parseInt(e.target.value))}
                                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                                disabled={procesando}
                            >
                                {meses.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">Año *</label>
                            <select
                                value={anio}
                                onChange={(e) => setAnio(parseInt(e.target.value))}
                                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                                disabled={procesando}
                            >
                                {anios.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Selección de Archivo */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">Archivo Excel *</label>
                        <input
                            id="fileInput"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            disabled={procesando}
                            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                        />
                        {archivo && (
                            <p className="mt-2 text-green-600 font-semibold">
                                ✅ Archivo seleccionado: {archivo.name}
                            </p>
                        )}
                    </div>

                    {/* Botón Procesar */}
                    <Button
                        variant="primary"
                        onClick={handleProcesar}
                        disabled={!archivo || procesando}
                        className="w-full"
                    >
                        {procesando ? '⏳ Procesando...' : '🚀 Procesar Lecturas'}
                    </Button>
                </div>
            </Card>

            {/* Resultados */}
            {mostrarResultados && resultados && (
                <div className="space-y-6">
                    {mensajeProceso && (
                        <Card className="bg-green-50 border-l-4 border-green-600">
                            <p className="text-lg font-semibold text-green-800">{mensajeProceso}</p>
                        </Card>
                    )}

                    {conflictos.length > 0 && (
                        <Card title="⚠️ Conflictos de Lecturas" className="bg-yellow-50 border-l-4 border-yellow-500">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 border-b-2">
                                        <tr>
                                            <th className="p-3 text-base font-semibold">Fila</th>
                                            <th className="p-3 text-base font-semibold">Usuario</th>
                                            <th className="p-3 text-base font-semibold">RUT</th>
                                            <th className="p-3 text-base font-semibold">Periodo</th>
                                            <th className="p-3 text-base font-semibold text-center">Lectura Sistema</th>
                                            <th className="p-3 text-base font-semibold text-center">Lectura Excel</th>
                                            <th className="p-3 text-base font-semibold text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conflictos.map((c) => (
                                            <tr key={`${c.lectura_id_existente}-${c.fila}`} className="border-b hover:bg-white/50">
                                                <td className="p-3 text-center font-semibold">{c.fila}</td>
                                                <td className="p-3">{c.nombre}</td>
                                                <td className="p-3 font-mono text-sm">{c.rut}</td>
                                                <td className="p-3 font-mono text-sm">{String(c.mes).padStart(2, '0')}/{c.anio}</td>
                                                <td className="p-3 text-center font-bold">{c.lectura_existente}</td>
                                                <td className="p-3 text-center font-bold text-blue-700">{c.lectura_nueva}</td>
                                                <td className="p-3">
                                                    {c.decision ? (
                                                        <div className={`text-center font-bold ${c.decision === 'confirmado' ? 'text-green-700' : 'text-gray-600'}`}>
                                                            {c.decision === 'confirmado' ? '✅ Confirmado' : '🚫 Rechazado'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-3 justify-center">
                                                            <Button
                                                                variant="success"
                                                                size="sm"
                                                                disabled={!!resolviendo[c.lectura_id_existente]}
                                                                onClick={() => handleConfirmarConflicto(c)}
                                                            >
                                                                Confirmar
                                                            </Button>
                                                            <Button
                                                                variant="neutral"
                                                                size="sm"
                                                                disabled={!!resolviendo[c.lectura_id_existente]}
                                                                onClick={() => handleRechazarConflicto(c)}
                                                            >
                                                                Rechazar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-blue-50 border-l-4 border-blue-600">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">📊 Total Procesado</h3>
                            <p className="text-4xl font-bold text-blue-700">{resultados.total}</p>
                        </Card>

                        <Card className="bg-green-50 border-l-4 border-green-600">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">✅ Exitosos</h3>
                            <p className="text-4xl font-bold text-green-700">{resultados.exitosos.length}</p>
                        </Card>

                        <Card className="bg-red-50 border-l-4 border-red-600">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">❌ Errores</h3>
                            <p className="text-4xl font-bold text-red-700">{resultados.errores.length}</p>
                        </Card>
                    </div>

                    {/* Lecturas Exitosas */}
                    {resultados.exitosos.length > 0 && (
                        <Card title="✅ Lecturas Procesadas Exitosamente" className="bg-green-50">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 border-b-2">
                                        <tr>
                                            <th className="p-3 text-base font-semibold">Fila</th>
                                            <th className="p-3 text-base font-semibold">Nombre</th>
                                            <th className="p-3 text-base font-semibold">RUT</th>
                                            <th className="p-3 text-base font-semibold">Medidor</th>
                                            <th className="p-3 text-base font-semibold">Lect. Anterior</th>
                                            <th className="p-3 text-base font-semibold">Lect. Actual</th>
                                            <th className="p-3 text-base font-semibold">Consumo</th>
                                            <th className="p-3 text-base font-semibold">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultados.exitosos.map((item, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="p-3 text-center font-semibold">{item.fila}</td>
                                                <td className="p-3">{item.nombre}</td>
                                                <td className="p-3 font-mono text-sm">{item.rut}</td>
                                                <td className="p-3 font-mono text-sm">{item.medidor}</td>
                                                <td className="p-3 text-center">{item.lectura_anterior}</td>
                                                <td className="p-3 text-center font-bold">{item.lectura_actual}</td>
                                                <td className="p-3 text-center">
                                                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                                                        {item.consumo} m³
                                                    </span>
                                                </td>
                                                <td className="p-3 font-bold text-green-600">{formatearMonto(item.monto)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Errores */}
                    {resultados.errores.length > 0 && (
                        <Card title="❌ Errores Encontrados" className="bg-red-50">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 border-b-2">
                                        <tr>
                                            <th className="p-3 text-base font-semibold">Fila</th>
                                            <th className="p-3 text-base font-semibold">Nombre</th>
                                            <th className="p-3 text-base font-semibold">RUT</th>
                                            <th className="p-3 text-base font-semibold">Medidor</th>
                                            <th className="p-3 text-base font-semibold">Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultados.errores.map((item, index) => (
                                            <tr key={index} className="border-b hover:bg-gray-50">
                                                <td className="p-3 text-center font-semibold">{item.fila}</td>
                                                <td className="p-3">{item.nombre}</td>
                                                <td className="p-3 font-mono text-sm">{item.rut}</td>
                                                <td className="p-3 font-mono text-sm">{item.medidor}</td>
                                                <td className="p-3 text-red-600 font-semibold">{item.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}
            {/* Sección actualizar contactos */}
            <Card className="mt-8 border-l-4 border-purple-600">
                <h3 className="text-2xl font-bold mb-4 text-gray-800">📱 Actualizar Teléfonos y Domicilios</h3>
                <p className="text-gray-600 mb-4">
                    Sube un Excel con columnas <strong>NOMBRE, TELEFONO, RUT, DOMICILIO</strong>.
                    El sistema buscará por RUT primero, luego por nombre.
                    El teléfono siempre se reemplaza. El domicilio solo se agrega si el usuario no tiene uno.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">Archivo Excel</label>
                        <input
                            id="fileContactos"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                const ext = file?.name.split('.').pop().toLowerCase();
                                if (!['xlsx', 'xls'].includes(ext)) {
                                    alert('⚠️ Solo archivos Excel');
                                    e.target.value = '';
                                    return;
                                }
                                setArchivoContactos(file);
                            }}
                            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500"
                        />
                        {archivoContactos && (
                            <p className="mt-2 text-green-600 font-semibold">✅ {archivoContactos.name}</p>
                        )}
                    </div>

                    <button
                        onClick={handleProcesarContactos}
                        disabled={!archivoContactos || procesandoContactos}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl text-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {procesandoContactos ? '⏳ Procesando...' : '📱 Actualizar Contactos'}
                    </button>

                    {resultadosContactos && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                            <p className="font-semibold text-purple-800 mb-2">{resultadosContactos.mensaje}</p>
                            {resultadosContactos.resultados?.noEncontrados?.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-sm font-semibold text-red-700 mb-1">No encontrados:</p>
                                    {resultadosContactos.resultados.noEncontrados.map((u, i) => (
                                        <p key={i} className="text-sm text-red-600">· {u.nombre} {u.rut && `(${u.rut})`}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

export default CargaSimplePage;
