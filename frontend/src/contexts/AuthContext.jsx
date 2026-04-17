import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(() => {
    // Cargar usuario desde localStorage al iniciar
    const cached = localStorage.getItem('usuario');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://apr-safip-xtxh.onrender.com/api';

  useEffect(() => {
    if (token) {
      verificarToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const verificarToken = async () => {
    // Si hay usuario cacheado y no hay internet, usar el cache
    if (!navigator.onLine) {
      const cached = localStorage.getItem('usuario');
      if (cached) {
        setUsuario(JSON.parse(cached));
        setLoading(false);
        return;
      }
    }

    try {
      const response = await axios.get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000 // 5 segundos máximo
      });
      setUsuario(response.data);
      // Guardar en localStorage para uso offline
      localStorage.setItem('usuario', JSON.stringify(response.data));
    } catch (error) {
      // Si falla por red (offline), usar cache
      const cached = localStorage.getItem('usuario');
      if (cached) {
        setUsuario(JSON.parse(cached));
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (rut, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { rut, password });
      const { token: newToken, usuario: userData } = response.data;

      localStorage.setItem('token', newToken);
      localStorage.setItem('usuario', JSON.stringify(userData));
      setToken(newToken);
      setUsuario(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesión'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken(null);
    setUsuario(null);
  };

  const value = {
    usuario,
    loading,
    login,
    logout,
    refreshUser: verificarToken,
    isAuthenticated: !!usuario,
    isAdmin: usuario?.rol === 'admin',
    isOperador: usuario?.rol === 'operador',
    isRecaudador: usuario?.rol === 'recaudador',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};