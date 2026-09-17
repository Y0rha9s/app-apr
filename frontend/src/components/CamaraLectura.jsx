import { useEffect, useRef, useState } from 'react';

// Cámara embebida para tomar la foto del medidor sin salir a la app nativa de
// Cámara del celular. Si el navegador no soporta getUserMedia o el operador
// rechaza el permiso, avisa al padre (onFallback) para que use el <input
// type=file capture> de siempre en vez de quedar trabado.
function formatearFechaHora(fecha) {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function CamaraLectura({ onCapturar, onCancelar, onFallback }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoBlob, setFotoBlob] = useState(null);

  useEffect(() => {
    iniciarCamara();
    return () => detenerCamara();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const iniciarCamara = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onFallback('Este navegador no soporta cámara integrada');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const motivo = err.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado'
        : err.name === 'NotFoundError'
          ? 'No se encontró una cámara disponible'
          : 'No se pudo abrir la cámara';
      onFallback(motivo);
    }
  };

  const capturar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Quemar fecha y hora del dispositivo en el momento de la captura, en una caja
    // semi-transparente abajo a la derecha para que se lea sobre cualquier fondo
    const texto = formatearFechaHora(new Date());
    const fontSize = Math.max(16, Math.round(canvas.width * 0.035));
    const padding = Math.round(fontSize * 0.5);
    const margen = 14;
    ctx.font = `bold ${fontSize}px monospace`;
    const boxW = ctx.measureText(texto).width + padding * 2;
    const boxH = fontSize + padding * 1.5;
    const boxX = canvas.width - boxW - margen;
    const boxY = canvas.height - boxH - margen;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, boxX + padding, boxY + boxH / 2);

    canvas.toBlob((blob) => {
      if (!blob) return;
      setFotoBlob(blob);
      setFotoPreview(URL.createObjectURL(blob));
      detenerCamara();
    }, 'image/jpeg', 0.92);
  };

  const repetir = () => {
    setFotoPreview(null);
    setFotoBlob(null);
    iniciarCamara();
  };

  const usarFoto = () => {
    if (!fotoBlob) return;
    const file = new File([fotoBlob], `medidor_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapturar(file);
  };

  const cancelar = () => {
    detenerCamara();
    onCancelar();
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
          <p className="text-4xl mb-3">🚫</p>
          <p className="font-semibold text-gray-800 mb-4">{error}</p>
          <button onClick={cancelar} className="w-full py-3 bg-gray-200 rounded-xl font-semibold">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      <div className="flex-1 relative overflow-hidden">
        {!fotoPreview ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={fotoPreview} alt="Foto capturada" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="bg-black/90 px-4 py-5 flex items-center justify-center gap-4">
        {!fotoPreview ? (
          <>
            <button type="button" onClick={cancelar}
              className="px-5 py-3 text-white font-semibold">Cancelar</button>
            <button type="button" onClick={capturar}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 active:scale-95 transition" />
          </>
        ) : (
          <>
            <button type="button" onClick={repetir}
              className="px-5 py-3 bg-gray-700 text-white rounded-xl font-semibold">🔄 Repetir</button>
            <button type="button" onClick={usarFoto}
              className="px-5 py-3 bg-green-600 text-white rounded-xl font-semibold">✅ Usar esta foto</button>
          </>
        )}
      </div>
    </div>
  );
}

export default CamaraLectura;
