const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const sharp = require('sharp');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
  }
});

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

// POST /api/fotos/lectura
router.post('/lectura', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna foto' });
    }

    const supabase = getSupabase();
    const timestamp = Date.now();
    const fileName = `lectura_${timestamp}.jpg`;
    const filePath = `fotos/${fileName}`;

    // Redimensionar y comprimir: una foto de medidor no necesita mas de 1280px
    // de ancho ni calidad maxima para ser legible, y esto evita llenar el storage.
    const bufferComprimido = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from('lecturas-fotos')
      .upload(filePath, bufferComprimido, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('lecturas-fotos')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      foto_url: urlData.publicUrl,
      fileName
    });

  } catch (error) {
    console.error('Error subiendo foto:', error.message);
    res.status(500).json({ error: 'Error al subir la foto: ' + error.message });
  }
});

// POST /api/fotos/evidencia — foto o video de evidencia (usado hoy por Cortes).
// Las fotos se comprimen igual que /lectura; los videos se suben tal cual (sharp
// no procesa video), con un limite de tamaño mas alto.
const uploadEvidencia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (video)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const permitidos = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm'];
    if (permitidos.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP) o video (MP4, MOV, WEBM)'));
    }
  }
});

router.post('/evidencia', uploadEvidencia.single('evidencia'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const supabase = getSupabase();
    const timestamp = Date.now();
    const esImagen = req.file.mimetype.startsWith('image/');

    let bufferSubida = req.file.buffer;
    let contentType = req.file.mimetype;
    let ext = path.extname(req.file.originalname).toLowerCase() || (esImagen ? '.jpg' : '.mp4');

    if (esImagen) {
      bufferSubida = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1280, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      contentType = 'image/jpeg';
      ext = '.jpg';
    }

    const fileName = `evidencia_${timestamp}${ext}`;
    const filePath = `evidencias/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('lecturas-fotos')
      .upload(filePath, bufferSubida, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('lecturas-fotos')
      .getPublicUrl(filePath);

    res.json({ success: true, url: urlData.publicUrl, tipo: esImagen ? 'foto' : 'video', fileName });

  } catch (error) {
    console.error('Error subiendo evidencia:', error.message);
    res.status(500).json({ error: 'Error al subir la evidencia: ' + error.message });
  }
});

module.exports = router;