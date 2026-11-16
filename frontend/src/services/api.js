import axios from 'axios';

// Detectar entorno automáticamente
const getBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  return 'https://apr-safip-xtxh.onrender.com/api';
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Agrega el token de sesion a todas las llamadas si existe y la llamada no trae uno propio.
// Las rutas publicas lo ignoran; las protegidas (ej. /pagos, /cajas) lo exigen.
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // sin acceso a localStorage: la llamada sigue sin token
  }
  return config;
});

// Servicios de transacciones
export const transaccionesService = {
  getAll: () => api.get('/transacciones'),
  getByTipo: (tipo) => api.get(`/transacciones/tipo/${tipo}`),
  getBalance: (mes, anio) => api.get(`/transacciones/balance?mes=${mes}&anio=${anio}`),
  create: (data) => api.post('/transacciones', data),
};

// Servicios de usuarios
export const usuariosService = {
  getAll: () => api.get('/usuarios'),
  getById: (id) => api.get(`/usuarios/${id}`),
  getDeuda: (id) => api.get(`/usuarios/${id}/deuda`),
  getInfoCompleta: (id) => api.get(`/usuarios/${id}/info-completa`),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
};

// Servicios de Mercado Pago
export const mercadoPagoService = {
  createPreference: (data) => api.post('/mercadopago/create-preference', data),
  checkPayment: (paymentId) => api.post('/mercadopago/check-payment', { paymentId }),
};

export default api;
// Cabecera con el token de sesion, para las rutas del backend que exigen autenticacion
// (el cliente `api` global no la agrega por si solo).
export const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
