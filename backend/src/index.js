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
const tipoUsuarioRoutes = require('./routes/tipoUsuarioRoutes');
const morosidadRoutes = require('./routes/morosidadRoutes');
const repactacionRoutes = require('./routes/repactacionRoutes');
const corteRoutes = require('./routes/corteRoutes');
const prestamoRoutes = require('./routes/prestamoRoutes');
const avisoRoutes = require('./routes/avisoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const cargaSimpleRoutes = require('./routes/cargaSimpleRoutes');
const configuracionRoutes = require('./routes/configuracion.routes');
const fotosRoutes = require('./routes/fotosRoutes');
const reporteRoutes = require('./routes/reporteRoutes');
const comprobanteRoutes = require('./routes/comprobanteRoutes');
const dteRoutes = require('./routes/dteRoutes');

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
app.use('/api/usuarios', tipoUsuarioRoutes);
app.use('/api/morosidad', morosidadRoutes);
app.use('/api/repactaciones', repactacionRoutes);
app.use('/api/cortes', corteRoutes);
app.use('/api/prestamos', prestamoRoutes);
app.use('/api/avisos', avisoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/carga-simple', cargaSimpleRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/fotos', fotosRoutes);
app.use('/api/reporte', reporteRoutes);
app.use('/api/comprobantes', comprobanteRoutes);
app.use('/api/dte', dteRoutes);


// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API APR funcionando correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});