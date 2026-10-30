const usuarioModel = require('../models/usuarioModel');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { limpiarRut, validarYFormatearRut } = require('../utils/rut');

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

  // Edicion de datos basicos desde la ficha del usuario (solo admin, ver usuarioRoutes).
  // Solo cambia los campos que vienen en el body; el RUT solo se valida si realmente cambia
  // (hay datos historicos con RUT que no pasarian la validacion y no deben bloquear otras ediciones).
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const usuarioExistente = await usuarioModel.getById(id);
      if (!usuarioExistente) return res.status(404).json({ error: 'Usuario no encontrado' });

      const campos = {};

      if (req.body.nombre !== undefined) {
        const nombre = String(req.body.nombre).trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        campos.nombre = nombre;
      }

      if (req.body.rut !== undefined && limpiarRut(req.body.rut) !== limpiarRut(usuarioExistente.rut)) {
        const rutFormateado = validarYFormatearRut(req.body.rut);
        if (!rutFormateado) return res.status(400).json({ error: 'El RUT no es válido' });
        const duplicado = await pool.query(
          "SELECT id, nombre FROM usuarios WHERE replace(replace(upper(rut),'.',''),'-','') = $1 AND id <> $2",
          [limpiarRut(rutFormateado), id]
        );
        if (duplicado.rows.length > 0) {
          return res.status(400).json({ error: `El RUT ya está registrado para ${duplicado.rows[0].nombre.trim()}` });
        }
        campos.rut = rutFormateado;
      }

      if (req.body.email !== undefined) {
        const email = String(req.body.email || '').trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'El correo no es válido' });
        }
        campos.email = email || null;
      }
      if (req.body.telefono !== undefined) campos.telefono = String(req.body.telefono || '').trim() || null;
      if (req.body.direccion !== undefined) campos.direccion = String(req.body.direccion || '').trim() || null;

      const columnas = Object.keys(campos);
      if (columnas.length === 0) return res.status(400).json({ error: 'No hay cambios para guardar' });

      const sets = columnas.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const { rows } = await pool.query(
        `UPDATE usuarios SET ${sets}, updated_at = NOW() WHERE id = $${columnas.length + 1} RETURNING *`,
        [...columnas.map((c) => campos[c]), id]
      );
      const { password, ...usuario } = rows[0];
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
      const deudaResult = await pool.query(
        `SELECT COALESCE(SUM(saldo_pendiente), 0) as deuda
       FROM boletas WHERE usuario_id = $1 AND estado IN ('pendiente', 'abonada')`,
        [id]
      );

      const deuda = parseFloat(deudaResult.rows[0].deuda);
      const totalPagos = pagosResult.rows.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

      res.json({
        usuario: {
          id: usuario.id, nombre: usuario.nombre, rut: usuario.rut,
          numero_cliente: usuario.numero_cliente, email: usuario.email,
          telefono: usuario.telefono, direccion: usuario.direccion,
          rol: usuario.rol, estado: usuario.estado
        },
        morosidad: {
          deuda_total: deuda,
          monto_morosidad: deuda
        },
        pagos: {
          total_pagado: totalPagos,
          cantidad_pagos: pagosResult.rows.length,
          ultimo_pago: pagosResult.rows[0] || null,
          historial: pagosResult.rows
        },
        lecturas: {
          total: lecturasResult.rows.reduce((sum, l) => sum + parseFloat(l.monto_calculado || 0), 0),
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