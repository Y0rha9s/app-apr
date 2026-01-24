const usuarioModel = require('../models/usuarioModel');
const pool = require('../config/database');

const usuarioController = {
  // Obtener todos los usuarios
  getAll: async (req, res) => {
    try {
      const usuarios = await usuarioModel.getAll();
      // Eliminar passwords de la respuesta
      const usuariosSinPassword = usuarios.map(({ password, ...usuario }) => usuario);
      res.json(usuariosSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener usuario por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = await usuarioModel.getById(id);

      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const { password, ...usuarioSinPassword } = usuario;
      res.json(usuarioSinPassword);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener deuda de un usuario
  getDeuda: async (req, res) => {
    try {
      const { id } = req.params;

      // Suma de lecturas
      const lecturasResult = await pool.query(
        'SELECT SUM(monto_calculado) as total_lecturas FROM lecturas WHERE usuario_id = $1',
        [id]
      );

      // Suma de pagos
      const pagosResult = await pool.query(
        'SELECT SUM(monto) as total_pagos FROM pagos WHERE usuario_id = $1',
        [id]
      );

      const totalLecturas = parseFloat(lecturasResult.rows[0].total_lecturas || 0);
      const totalPagos = parseFloat(pagosResult.rows[0].total_pagos || 0);
      const deuda = totalLecturas - totalPagos;

      res.json({ deuda: deuda >= 0 ? deuda : 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  suspender: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE usuarios 
       SET estado = 'suspendido', fecha_suspension = NOW() 
       WHERE id = $1 
       RETURNING *`,
        [id]
      );

      const { password, ...usuario } = result.rows[0];
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Reponer usuario
  reponer: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE usuarios 
       SET estado = 'activo', fecha_reposicion = NOW() 
       WHERE id = $1 
       RETURNING *`,
        [id]
      );

      const { password, ...usuario } = result.rows[0];
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Reponer usuario
  reponer: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE usuarios 
       SET estado = 'activo', fecha_reposicion = NOW() 
       WHERE id = $1 
       RETURNING *`,
        [id]
      );

      const { password, ...usuario } = result.rows[0];
      res.json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Crear usuario
  create: async (req, res) => {
    try {
      const { rut, nombre, email, telefono, direccion, rol } = req.body;

      // Generar número de cliente automático
      const countResult = await pool.query('SELECT COUNT(*) FROM usuarios');
      const count = parseInt(countResult.rows[0].count) + 1;
      const numeroCliente = 'CLI-' + count.toString().padStart(4, '0');

      const result = await pool.query(
        `INSERT INTO usuarios (numero_cliente, rut, nombre, email, telefono, direccion, password, rol, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo') 
       RETURNING *`,
        [numeroCliente, rut, nombre, email, telefono, direccion, 'demo123', rol || 'socio']
      );

      const { password, ...usuario } = result.rows[0];
      res.status(201).json(usuario);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener información completa del usuario (pagos, morosidad, convenio, notificaciones)
  getInfoCompleta: async (req, res) => {
    try {
      const { id } = req.params;

      // Información del usuario
      const usuario = await usuarioModel.getById(id);
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Obtener todas las lecturas del usuario
      const lecturasResult = await pool.query(
        'SELECT * FROM lecturas WHERE usuario_id = $1 ORDER BY fecha_lectura DESC',
        [id]
      );

      // Obtener todos los pagos del usuario
      const pagosResult = await pool.query(
        'SELECT * FROM pagos WHERE usuario_id = $1 ORDER BY fecha_pago DESC',
        [id]
      );

      // Calcular deuda total
      const totalLecturas = lecturasResult.rows.reduce((sum, l) => sum + parseFloat(l.monto_calculado || 0), 0);
      const totalPagos = pagosResult.rows.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
      const deuda = totalLecturas - totalPagos;

      // Calcular meses en mora (lecturas sin pagar)
      const lecturasConMora = lecturasResult.rows.filter(l => {
        const montoLectura = parseFloat(l.monto_calculado || 0);
        const pagosEnLectura = pagosResult.rows.filter(p => {
          const fechaPago = new Date(p.fecha_pago);
          const fechaLectura = new Date(l.fecha_lectura);
          return fechaPago >= fechaLectura;
        });
        const pagosEnLecturaTotal = pagosEnLectura.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
        return montoLectura > pagosEnLecturaTotal;
      });
      const mesesEnMora = lecturasConMora.length;

      // Último pago
      const ultimoPago = pagosResult.rows[0] || null;

      // Saldo anterior pendiente (deuda antes del último pago)
      const saldoAnterior = ultimoPago
        ? deuda + parseFloat(ultimoPago.monto || 0)
        : deuda;

      // Información completa
      const infoCompleta = {
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          rut: usuario.rut,
          numero_cliente: usuario.numero_cliente,
          email: usuario.email,
          telefono: usuario.telefono,
          direccion: usuario.direccion,
          rol: usuario.rol,
          estado: usuario.estado,
          tiene_convenio: usuario.tiene_convenio || false,
          tiene_notificacion: usuario.tiene_notificacion || false,
          convenio_detalle: usuario.convenio_detalle || null,
          notificacion_detalle: usuario.notificacion_detalle || null
        },
        morosidad: {
          deuda_total: deuda >= 0 ? deuda : 0,
          meses_en_mora: mesesEnMora,
          monto_morosidad: deuda >= 0 ? deuda : 0
        },
        pagos: {
          total_pagado: totalPagos,
          cantidad_pagos: pagosResult.rows.length,
          ultimo_pago: ultimoPago ? {
            fecha: ultimoPago.fecha_pago,
            monto: ultimoPago.monto,
            metodo: ultimoPago.metodo_pago,
            observaciones: ultimoPago.observaciones
          } : null,
          historial: pagosResult.rows.map(p => ({
            id: p.id,
            fecha: p.fecha_pago,
            monto: p.monto,
            metodo: p.metodo_pago,
            observaciones: p.observaciones
          }))
        },
        saldo_anterior_pendiente: saldoAnterior >= 0 ? saldoAnterior : 0,
        lecturas: {
          total: totalLecturas,
          cantidad: lecturasResult.rows.length,
          historial: lecturasResult.rows.map(l => ({
            id: l.id,
            fecha: l.fecha_lectura,
            mes: l.mes,
            anio: l.anio,
            lectura_anterior: l.lectura_anterior,
            lectura_actual: l.lectura_actual,
            monto: l.monto_calculado,
            observaciones: l.observaciones
          }))
        }
      };

      res.json(infoCompleta);
    } catch (error) {
      console.error('Error obteniendo información completa:', error);
      res.status(500).json({ error: error.message });
    }
  }
};


module.exports = usuarioController;