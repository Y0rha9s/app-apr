const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Agregar datos del usuario al request
    req.usuario = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware para verificar rol admin
const esAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Requiere rol de administrador' });
  }
  next();
};

module.exports = { authMiddleware, esAdmin };