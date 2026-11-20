import api, { authHeaders } from '../services/api';

// Sube una foto de medidor desde administracion (ej. la que el socio envio a Pedro).
// El servidor la redimensiona y le pone la marca de agua "SUBIDA POR ADMINISTRACION".
// Devuelve la URL para guardar en la lectura.
export async function subirFotoLecturaAdmin(archivo) {
  const fd = new FormData();
  fd.append('foto', archivo);
  fd.append('origen', 'administracion');
  const res = await fetch(`${api.defaults.baseURL}/fotos/lectura`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo subir la foto');
  return data.foto_url;
}

export const EXTENSIONES_FOTO = '.jpg,.jpeg,.png,.webp';
