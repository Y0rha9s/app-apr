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

// Middleware para verificar que el rol del usuario este entre los permitidos
const soloRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para esta accion' });
  }
  next();
};

// Lee el token si viene y es valido (deja req.usuario), pero NO rechaza si falta: para rutas
// que hoy son publicas y solo quieren saber quien las ejecuto.
const authOpcional = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) req.usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // token invalido: se ignora
  }
  next();
};

module.exports = { authMiddleware, esAdmin, soloRoles, authOpcional };