import axios from 'axios';

// URL de la API
const API_URL = 'https://app-apr.onrender.com/api'; 
// const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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