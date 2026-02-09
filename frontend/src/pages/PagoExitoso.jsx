import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mercadoPagoService } from '../services/api';

function PagoExitoso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verificando, setVerificando] = useState(true);
  const [mensaje, setMensaje] = useState('Verificando estado del pago...');

  useEffect(() => {
    const verificarPago = async () => {
      const paymentId = searchParams.get('payment_id'); // MP devuelve payment_id en la URL
      const status = searchParams.get('status');

      if (paymentId && status === 'approved') {
        try {
          // Intentar registrar/verificar el pago en backend
          await mercadoPagoService.checkPayment(paymentId);
          setMensaje('Pago verificado y registrado correctamente.');
        } catch (error) {
          console.error('Error verificando pago:', error);
          setMensaje('Pago procesado en Mercado Pago. Actualizando registros...');
        }
      } else {
        setMensaje('Pago procesado correctamente.');
      }
      setVerificando(false);

      // Redirigir después de verificar
      setTimeout(() => {
        navigate('/pagos');
      }, 4000);
    };

    verificarPago();
  }, [navigate, searchParams]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '80vh', 
      padding: '20px',
      background: '#f0f9ff'
    }}> 
      <div style={{ 
        background: 'white', 
        padding: '40px', 
        borderRadius: '16px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
        textAlign: 'center', 
        maxWidth: '500px',
        width: '100%'
      }}> 
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>✅</div> 
        <h1 style={{ color: '#2ecc71', marginBottom: '20px', fontSize: '2rem', fontWeight: 'bold' }}> 
          ¡Pago Exitoso! 
        </h1> 
        <p style={{ fontSize: '18px', color: '#555', marginBottom: '30px', lineHeight: '1.5' }}> 
          {verificando ? 'Verificando con el banco...' : mensaje} <br/>
          {verificando && <span style={{fontSize: '14px', color: '#999'}}>(Esto asegura que tu deuda se actualice al instante)</span>}
        </p> 
        <button 
          onClick={() => navigate('/pagos')} 
          disabled={verificando}
          style={{ 
            backgroundColor: verificando ? '#ccc' : '#2ecc71', 
            color: 'white', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '16px', 
            fontWeight: 'bold',
            cursor: verificando ? 'wait' : 'pointer',
            transition: 'background-color 0.3s'
          }}
        > 
          {verificando ? 'Procesando...' : 'Ver mis pagos'}
        </button> 
        {!verificando && (
          <p style={{ marginTop: '20px', fontSize: '14px', color: '#999' }}>
            Redirigiendo automáticamente en unos segundos...
          </p>
        )}
      </div> 
    </div> 
  ); 
} 

export default PagoExitoso;