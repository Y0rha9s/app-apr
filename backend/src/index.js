const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./config/database'); // Inicializar conexión BD

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
const transaccionRoutes = require('./routes/transaccionRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const lecturaRoutes = require('./routes/lecturaRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const egresoCajaRoutes = require('./routes/egresoCajaRoutes');
const boletaRoutes = require('./routes/boletaRoutes');
const uploadRoutes = require('./routes/upload');
const mercadoPagoRoutes = require('./routes/mercadoPagoRoutes');

app.use('/api/transacciones', transaccionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/lecturas', lecturaRoutes);
app.use('/api/cajas', cajaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/egresos-caja', egresoCajaRoutes);
app.use('/api/boletas', boletaRoutes);
app.use('/api', uploadRoutes);
app.use('/api/mercadopago', mercadoPagoRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API APR funcionando correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});