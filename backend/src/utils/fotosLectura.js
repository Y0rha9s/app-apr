// Validacion de la foto que respalda una lectura. La foto debe haber sido subida por
// POST /api/fotos/lectura (que le pone la marca de agua del servidor), no ser un link cualquiera.

const VENTANA_MINUTOS = 15; // la foto debe haberse subido hasta 15 min antes de guardar la lectura

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patronFotoLectura() {
  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  return new RegExp(`^${escapar(base)}/storage/v1/object/public/lecturas-fotos/fotos/lectura_(\\d{13})\\.jpg$`);
}

// Devuelve { ok: true, subidaEn: Date } o { ok: false, error }
function validarFotoLectura(fotoUrl, ahora = Date.now()) {
  if (!fotoUrl || typeof fotoUrl !== 'string') {
    return { ok: false, error: 'La foto del medidor es obligatoria: sin foto no se puede guardar la lectura' };
  }
  const m = patronFotoLectura().exec(fotoUrl);
  if (!m) {
    return { ok: false, error: 'La foto no es válida: debe tomarse y subirse desde la aplicación' };
  }
  const subidaEn = new Date(parseInt(m[1], 10));
  const minutos = (ahora - subidaEn.getTime()) / 60000;
  if (minutos > VENTANA_MINUTOS || minutos < -2) {
    return { ok: false, error: 'La foto es antigua: debe tomarse en el momento de registrar la lectura' };
  }
  return { ok: true, subidaEn };
}

module.exports = { VENTANA_MINUTOS, validarFotoLectura };
