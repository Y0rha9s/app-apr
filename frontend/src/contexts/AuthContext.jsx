import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const API_URL = 'https://app-apr.onrender.com/api';

  // Verificar token al cargar
  useEffect(() => {
    if (token) {
      verificarToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const verificarToken = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuario(response.data);
    } catch (error) {
      console.error('Token inválido:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (rut, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { rut, password });
      const { token: newToken, usuario: userData } = response.data;
      
      localStorage.setItem('token', newToken);
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
    setToken(null);
    setUsuario(null);
  };

  const value = {
    usuario,
    loading,
    login,
    logout,
    isAuthenticated: !!usuario,
    isAdmin: usuario?.rol === 'admin'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};