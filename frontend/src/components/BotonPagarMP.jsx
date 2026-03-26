import React, { useState } from 'react';
import { mercadoPagoService } from '../services/api';

function BotonPagarMP({ boleta, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePagar = async () => {
    setLoading(true);
    setError(null);

    try {
      const preferenceData = {
        boletaId: boleta.id,
        monto: boleta.monto || boleta.saldo_pendiente || boleta.total_a_pagar,
        descripcion: boleta.descripcion || `Pago de agua - Boleta #${boleta.id || 'General'}`,
        usuarioEmail: boleta.usuario_email,
        usuarioId: boleta.usuario_id
      };

      const response = await mercadoPagoService.createPreference(preferenceData);
      const data = response.data;

      if (data.init_point) {
        if (typeof onSuccess === 'function') onSuccess(data);
        // Redirigir a Mercado Pago
        window.location.href = data.init_point; 
      } else {
        setError(data.error || 'Error al crear el pago');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button 
        onClick={handlePagar} 
        disabled={loading} 
        className={`w-full py-4 px-6 rounded-xl shadow-md transition-transform transform flex items-center justify-center gap-3 ${
          loading 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-[#009EE3] hover:bg-[#008ED0] hover:scale-[1.02] text-white cursor-pointer'
        }`}
      >
        {loading ? ( 
          <>
             <span className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mr-2"></span>
             Procesando...
          </> 
        ) : ( 
          <> 
            <img 
              src="https://cdn.simpleicons.org/mercadopago/009EE3" 
              alt="Mercado Pago" 
              className="w-8 h-8 bg-white rounded-full p-1.5"
            /> 
            <span className="text-xl font-bold">
              Pagar ${((boleta.monto || boleta.saldo_pendiente || boleta.total_a_pagar) || 0).toLocaleString('es-CL')}
            </span>
          </> 
        )} 
      </button> 

      {error && ( 
        <p className="text-red-500 mt-2 text-center text-sm font-medium"> 
          ❌ {error} 
        </p> 
      )} 
    </div> 
  ); 
} 

export default BotonPagarMP;
