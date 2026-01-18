const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');

const authController = {
  // Login
  login: async (req, res) => {
    try {
      const { rut, password } = req.body;

      // Validar campos
      if (!rut || !password) {
        return res.status(400).json({ error: 'RUT y contraseña son requeridos' });
      }

      // Buscar usuario por RUT
      const usuario = await usuarioModel.getByRut(rut);
      
      if (!usuario) {
        return res.status(401).json({ error: 'RUT o contraseña incorrectos' });
      }

      // Verificar contraseña (por ahora sin encriptar para demo)
      // En producción usar: const passwordValido = await bcrypt.compare(password, usuario.password);
      const passwordValido = password === 'demo123'; // Temporal para demo
      
      if (!passwordValido) {
        return res.status(401).json({ error: 'RUT o contraseña incorrectos' });
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          id: usuario.id, 
          rut: usuario.rut, 
          rol: usuario.rol 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Retornar datos del usuario (sin password)
      const { password: _, ...usuarioSinPassword } = usuario;

      res.json({
        token,
        usuario: usuarioSinPassword
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  },

  // Verificar token
  verificarToken: async (req, res) => {
    try {
      const usuario = await usuarioModel.getById(req.usuario.id);
      const { password: _, ...usuarioSinPassword } = usuario;
      res.json(usuarioSinPassword);
    } catch (error) {
      res.status(500).json({ error: 'Error verificando token' });
    }
  }
};

module.exports = authController;