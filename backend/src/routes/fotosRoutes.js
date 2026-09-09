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

module.exports = router;