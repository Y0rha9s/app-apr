const usuarioModel = require('../models/usuarioModel');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const usuarioController = {

  getAll: async (req, res) => {
    try {
      const usuarios = await usuarioModel.getAll();
      const usuariosSinPassword = usuarios.map(({ password, ...u }) => u);
      res.json(usuariosSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = await usuarioModel.getById(id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      const { password, ...usuarioSinPassword } = usuario;
      res.json(usuarioSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getDeuda: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT COALESCE(SUM(saldo_pendiente), 0) as deuda
       FROM boletas
       WHERE usuario_id = $1 AND estado IN ('pendiente', 'abonada')`,
        [id]
      );
      res.json({ deuda: parseFloat(result.rows[0].deuda) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  suspender: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE usuarios SET estado = 'suspendido', fecha_suspension = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      const { password, ...usuario } = result.rows[0];
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  reponer: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE usuarios SET estado = 'activo', fecha_reposicion = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      const { password, ...usuario } = result.rows[0];
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const { rut, nombre, email, telefono, direccion, rol, medidor } = req.body;

      // Verificar RUT duplicado
      const existe = await pool.query('SELECT id FROM usuarios WHERE rut = $1', [rut]);
      if (existe.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un usuario con ese RUT' });
      }

      // Generar número SAFIP correlativo
      const maxResult = await pool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_cliente FROM 7) AS INTEGER)), 0) as max
         FROM usuarios 
         WHERE numero_cliente LIKE 'SAFIP-%' 
         AND numero_cliente ~ '^SAFIP-[0-9]+$'`
      );
      const siguiente = parseInt(maxResult.rows[0].max) + 1;
      const numeroCliente = 'SAFIP-' + siguiente.toString().padStart(4, '0');

      // Hashear contraseña: apr + primeros 4 dígitos del RUT
      const digitos = rut.replace(/[^0-9]/g, '').substring(0, 4);
      const passwordStr = `apr${digitos}`;
      const hashedPassword = await bcrypt.hash(passwordStr, 10);

      const esSocio = !['admin', 'operador'].includes(rol);

      const result = await pool.query(
        `INSERT INTO usuarios 
         (numero_cliente, rut, nombre, email, telefono, direccion, password, rol, estado, medidor, es_socio) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo', $9, $10) 
         RETURNING *`,
        [numeroCliente, rut, nombre, email || `${rut.replace(/[^0-9]/g, '')}@temp.com`,
          telefono || null, direccion || null, hashedPassword,
          rol || 'usuario', medidor || null, esSocio]
      );

      const { password, ...usuario } = result.rows[0];
      res.status(201).json({ ...usuario, password_inicial: passwordStr });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, rut, email, telefono, direccion } = req.body;
      const usuarioExistente = await usuarioModel.getById(id);
      if (!usuarioExistente) return res.status(404).json({ error: 'Usuario no encontrado' });
      const usuarioActualizado = await usuarioModel.update(id, { nombre, rut, email, telefono, direccion });
      const { password, ...usuario } = usuarioActualizado;
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getInfoCompleta: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = await usuarioModel.getById(id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      const lecturasResult = await pool.query(
        'SELECT * FROM lecturas WHERE usuario_id = $1 ORDER BY fecha_lectura DESC', [id]
      );
      const pagosResult = await pool.query(
        'SELECT * FROM pagos WHERE usuario_id = $1 ORDER BY fecha_pago DESC', [id]
      );

      const totalLecturas = lecturasResult.rows.reduce((sum, l) => sum + parseFloat(l.monto_calculado || 0), 0);
      const totalPagos = pagosResult.rows.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
      const deuda = totalLecturas - totalPagos;

      res.json({
        usuario: {
          id: usuario.id, nombre: usuario.nombre, rut: usuario.rut,
          numero_cliente: usuario.numero_cliente, email: usuario.email,
          telefono: usuario.telefono, direccion: usuario.direccion,
          rol: usuario.rol, estado: usuario.estado
        },
        morosidad: {
          deuda_total: deuda >= 0 ? deuda : 0,
          monto_morosidad: deuda >= 0 ? deuda : 0
        },
        pagos: {
          total_pagado: totalPagos,
          cantidad_pagos: pagosResult.rows.length,
          ultimo_pago: pagosResult.rows[0] || null,
          historial: pagosResult.rows
        },
        lecturas: {
          total: totalLecturas,
          cantidad: lecturasResult.rows.length,
          historial: lecturasResult.rows
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = usuarioController;