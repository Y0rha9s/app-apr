import React, { useState } from 'react';
import './UploadExcel.css';

function UploadExcel() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const getBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return 'https://apr-safip.onrender.com';
  };
  
  const API_URL = getBaseUrl();
  
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      const extension = selectedFile.name.split('.').pop().toLowerCase();
      if (extension === 'xlsx' || extension === 'xls') {
        setFile(selectedFile);
        setError(null);
        setSheets([]);
        setSelectedSheet('');
        setResultado(null);
        
        // Obtener las hojas del archivo
        await obtenerHojas(selectedFile);
      } else {
        setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        setFile(null);
        setSheets([]);
      }
    }
  };

  const obtenerHojas = async (file) => {
    setLoadingSheets(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/get-sheets`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSheets(data.sheets);
        // Seleccionar la primera hoja por defecto
        if (data.sheets.length > 0) {
          setSelectedSheet(data.sheets[0]);
        }
      } else {
        setError('Error al leer las hojas del archivo');
      }
    } catch (err) {
      setError('Error al procesar el archivo');
      console.error(err);
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo primero');
      return;
    }

    if (!selectedSheet) {
      setError('Por favor selecciona una hoja/mes a procesar');
      return;
    }

    setLoading(true);
    setError(null);
    setResultado(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', selectedSheet);

    try {
      const response = await fetch(`${API_URL}/api/upload-excel`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResultado(data.resultados);
      } else {
        setError(data.error || 'Error al procesar el archivo');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-excel-container">
      <div className="upload-card">
        <h2>📊 Carga Masiva de Lecturas</h2>
        <p className="subtitle">Sube un archivo Excel con las lecturas mensuales</p>

        <div className="upload-section">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            id="file-input"
            className="file-input"
          />
          <label htmlFor="file-input" className="file-label">
            {file ? `📄 ${file.name}` : '📁 Seleccionar archivo Excel'}
          </label>

          {loadingSheets && (
            <div className="loading-sheets">
              ⏳ Leyendo hojas del archivo...
            </div>
          )}

          {sheets.length > 0 && (
            <div className="sheet-selector">
              <label htmlFor="sheet-select" className="sheet-label">
                📅 Selecciona el mes a procesar:
              </label>
              <select
                id="sheet-select"
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="sheet-select"
              >
                {sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !selectedSheet || loading}
            className="upload-button"
          >
            {loading ? '⏳ Procesando...' : `⬆️ Procesar ${selectedSheet || 'hoja seleccionada'}`}
          </button>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {resultado && (
          <div className="resultado-container">
            <div className="resultado-header">
              <h3>✅ Carga Completada</h3>
              <p>{resultado.exitosos} registros procesados exitosamente</p>
              <p className="periodo-info">📅 Periodo: {selectedSheet}</p>
            </div>

            {resultado.nuevosUsuarios.length > 0 && (
              <div className="nuevos-usuarios">
                <h4>👤 Usuarios Nuevos Creados ({resultado.nuevosUsuarios.length})</h4>
                <ul>
                  {resultado.nuevosUsuarios.map((nombre, idx) => (
                    <li key={idx}>{nombre}</li>
                  ))}
                </ul>
                <p className="info-password">
                  🔑 Contraseña generada: <code>apr[primeros4digitosRUT]</code>
                </p>
              </div>
            )}

            {resultado.errores.length > 0 && (
              <div className="errores-list">
                <h4>⚠️ Errores Encontrados ({resultado.errores.length})</h4>
                <ul>
                  {resultado.errores.map((err, idx) => (
                    <li key={idx}>
                      <strong>Fila {err.fila}:</strong> {err.nombre} - {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.detalles && resultado.detalles.length > 0 && (
              <div className="detalles-table">
                <h4>📋 Detalle de Registros</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Nombre</th>
                      <th>RUT</th>
                      <th>Consumo (m³)</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.detalles.slice(0, 10).map((detalle, idx) => (
                      <tr key={idx}>
                        <td>{detalle.fila}</td>
                        <td>{detalle.nombre}</td>
                        <td>{detalle.rut}</td>
                        <td>{detalle.consumo}</td>
                        <td>${detalle.total.toLocaleString()}</td>
                        <td>
                          <span className={`estado ${detalle.estado}`}>
                            {detalle.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resultado.detalles.length > 10 && (
                  <p className="more-results">
                    ... y {resultado.detalles.length - 10} registros más
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="instrucciones">
          <h4>📝 Formato del Excel:</h4>
          <ul>
            <li><strong>NOMBRE:</strong> Nombre completo del usuario</li>
            <li><strong>RUT:</strong> RUT del usuario</li>
            <li><strong>DOMICILIO:</strong> Dirección</li>
            <li><strong>L.ANTERIOR:</strong> Lectura anterior</li>
            <li><strong>L.ACTUAL:</strong> Lectura actual</li>
            <li><strong>ABONO:</strong> Monto abonado (opcional)</li>
            <li><strong>M. PAGO:</strong> Método de pago (opcional)</li>
          </ul>
          <p className="nota-importante">
            💡 <strong>Nota:</strong> El archivo puede contener múltiples hojas (meses). 
            Selecciona la hoja que deseas procesar antes de subir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default UploadExcel;
