const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('../config/database');

// Configurar cliente de Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
    options: { timeout: 5000 }
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

// Crear preferencia de pago
router.post('/create-preference', async (req, res) => {
    const { boletaId, monto, descripcion, usuarioEmail, usuarioId } = req.body;

    try {
        let externalReference = String(boletaId);
        // Si es pago de deuda total, usar referencia de usuario
        if (boletaId === 'DEUDA-TOTAL' && usuarioId) {
            externalReference = `USER-${usuarioId}`;
        }

        const preferenceData = {
            items: [
                {
                    title: descripcion || `Pago de agua - Boleta #${boletaId}`,
                    unit_price: parseFloat(monto),
                    quantity: 1,
                    currency_id: 'CLP'
                }
            ],
            back_urls: {
                success: `${process.env.FRONTEND_URL}/pago-exitoso`,
                failure: `${process.env.FRONTEND_URL}/pago-fallido`,
                pending: `${process.env.FRONTEND_URL}/pago-pendiente`
            },
            auto_return: 'approved',
            external_reference: externalReference,
            payer: {
                email: usuarioEmail || 'test@test.com'
            },
            notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
            statement_descriptor: 'APR AGUA',
            metadata: {
                boleta_id: boletaId,
                usuario_id: usuarioId
            }
        };

        console.log('📋 Creando preferencia...');

        const preference = await preferenceClient.create({ body: preferenceData });

        console.log('✅ Preferencia creada:', preference.id);
        console.log('🔗 Sandbox URL:', preference.sandbox_init_point);

        res.json({
            success: true,
            id: preference.id,
            init_point: preference.init_point,
            sandbox_init_point: preference.sandbox_init_point
        });

    } catch (error) {
        console.error('❌ Error al crear preferencia:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Función auxiliar para registrar pago en BD
async function registrarPagoEnBD(payment) {
  const status = payment.status;
  const externalReference = payment.external_reference;
  const monto = payment.transaction_amount;
  const paymentId = payment.id;

  console.log(`💰 Procesando pago ${paymentId}: ${status} - Ref ${externalReference} - Monto ${monto}`);

  if (status === 'approved') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar si el pago ya existe para evitar duplicados
      // MercadoPago puede enviar múltiples webhooks, o el usuario puede reintentar la verificación manual
      // Aunque MP ID es numérico, lo guardamos como referencia en algún lado si fuera necesario.
      // Aquí asumimos que si hay un pago con el mismo monto y fecha muy reciente para el mismo usuario, podría ser duplicado,
      // pero lo ideal es guardar el ID de transacción externa.
      // Por ahora, para simplificar y dado el esquema actual, procederemos.
      // TODO: Agregar columna `external_id` a tabla pagos para evitar duplicados reales.

      let usuarioId;
      let boletaId = null;

      if (externalReference.startsWith('USER-')) {
        usuarioId = externalReference.split('-')[1];
      } else {
        boletaId = externalReference;
        const boletaResult = await client.query(
          'SELECT usuario_id FROM boletas WHERE id = $1',
          [boletaId]
        );

        if (boletaResult.rows.length > 0) {
          usuarioId = boletaResult.rows[0].usuario_id;
        } else {
          console.warn(`Boleta ${boletaId} no encontrada.`);
          throw new Error('Boleta no encontrada');
        }
      }

      // Registrar el pago
      await client.query(
        `INSERT INTO pagos (usuario_id, boleta_id, monto, metodo_pago, fecha_pago)
         VALUES ($1, $2, $3, $4, NOW())`,
        [usuarioId, boletaId, monto, 'mercadopago']
      );

      // Actualizar deuda
      if (boletaId) {
        await client.query(
          `UPDATE boletas 
           SET saldo_pendiente = saldo_pendiente - $1,
               estado = CASE 
                 WHEN saldo_pendiente - $1 <= 0 THEN 'pagado'
                 ELSE 'parcial'
               END
           WHERE id = $2`,
          [monto, boletaId]
        );
      }

      await client.query('COMMIT');
      console.log('✅ Pago registrado exitosamente en BD');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error al procesar pago en BD:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  return false;
}

// Webhook para recibir notificaciones de pago
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  console.log('📩 Webhook recibido:', { type, data });

  try {
    if (type === 'payment') {
      const payment = await paymentClient.get({ id: data.id });
      await registrarPagoEnBD(payment);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.sendStatus(500);
  }
});

// Endpoint de verificación manual (para desarrollo o fallback)
router.post('/check-payment', async (req, res) => {
  const { paymentId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ success: false, error: 'paymentId requerido' });
  }

  try {
    const payment = await paymentClient.get({ id: paymentId });
    
    // Intentar registrar (si ya existe o falla, la función manejará errores o duplicados en el futuro)
    // Nota: registrarPagoEnBD actual no chequea duplicados por ID externo, así que cuidado al llamar múltiples veces.
    // Para desarrollo es aceptable.
    const registrado = await registrarPagoEnBD(payment);

    res.json({
      success: true,
      status: payment.status,
      registrado: registrado
    });

  } catch (error) {
    console.error('❌ Error al verificar pago manualmente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verificar estado de pago (solo lectura)

// Verificar estado de pago
router.get('/payment/:paymentId', async (req, res) => {
    try {
        const payment = await paymentClient.get({ id: req.params.paymentId });

        res.json({
            success: true,
            payment: payment
        });
    } catch (error) {
        console.error('❌ Error al obtener pago:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;