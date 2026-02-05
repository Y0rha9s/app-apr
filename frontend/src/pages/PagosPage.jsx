import React, { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';

const PagosPage = () => {
  const [metodoSeleccionado, setMetodoSeleccionado] = useState(null);

  const datosTransferencia = {
    banco: 'Banco Estado',
    tipoCuenta: 'Cuenta Vista / RUT',
    numero: '12.345.678-9',
    nombre: 'Comité de Agua Potable Rural',
    rut: '65.432.109-8',
    email: 'pagos@apr-ejemplo.cl'
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-4xl font-bold mb-8 text-gray-800">💳 Gestión de Pagos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Columna Izquierda: Pago Online */}
        <div className="space-y-6">
          <Card title="🌐 Pago en Línea" className="border-l-4 border-blue-500">
            <p className="text-gray-600 mb-6">
              La forma más rápida y segura de pagar su cuenta. El pago se registra automáticamente.
            </p>
            
            <div className="space-y-4">
              {/* Mercado Pago - Destacado */}
              <button 
                className="w-full bg-[#009EE3] hover:bg-[#008ED0] text-white py-4 px-6 rounded-xl shadow-md transition-transform transform hover:scale-[1.02] flex items-center justify-center gap-3"
                onClick={() => alert('Integración con Mercado Pago próximamente')}
              >
                <img 
                  src="https://img.icons8.com/color/48/mercadopago.png" 
                  alt="Mercado Pago" 
                  className="w-8 h-8 bg-white rounded-full p-1"
                />
                <span className="text-xl font-bold">Pagar con Mercado Pago</span>
              </button>

              {/* WebPay - Secundario */}
              <button 
                className="w-full bg-[#D01835] hover:bg-[#B0142D] text-white py-3 px-6 rounded-xl shadow-sm transition-transform transform hover:scale-[1.02] flex items-center justify-center gap-3"
                onClick={() => alert('Integración con WebPay próximamente')}
              >
                <span className="text-2xl">💳</span>
                <span className="text-lg font-semibold">Pagar con WebPay / Tarjetas</span>
              </button>
            </div>
            
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>🔒 Pagos procesados de forma segura</p>
            </div>
          </Card>

          {/* Subir Comprobante */}
          <Card title="📤 Reportar Pago (Boleta/Transferencia)" className="border-l-4 border-green-500">
            <p className="text-gray-600 mb-4">
              Si realizó una transferencia o depósito, suba su comprobante aquí para validarlo.
            </p>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Funcionalidad de subida próximamente'); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Boleta / Operación</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Ej: 12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjuntar Comprobante (Imagen o PDF)</label>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  className="w-full px-4 py-2 border border-dashed border-gray-400 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer"
                />
              </div>
              <Button variant="success" className="w-full">
                📤 Enviar Comprobante
              </Button>
            </form>
          </Card>
        </div>

        {/* Columna Derecha: Datos Transferencia y Depósito */}
        <div className="space-y-6">
          <Card title="🏦 Transferencia Bancaria" className="border-l-4 border-orange-500">
            <p className="text-gray-600 mb-4">
              Puede realizar una transferencia directa a nuestra cuenta. Recuerde enviar el comprobante.
            </p>
            
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 space-y-3">
              <div className="flex justify-between border-b border-orange-200 pb-2">
                <span className="text-gray-600">Banco:</span>
                <span className="font-bold text-gray-800">{datosTransferencia.banco}</span>
              </div>
              <div className="flex justify-between border-b border-orange-200 pb-2">
                <span className="text-gray-600">Tipo de Cuenta:</span>
                <span className="font-bold text-gray-800">{datosTransferencia.tipoCuenta}</span>
              </div>
              <div className="flex justify-between border-b border-orange-200 pb-2">
                <span className="text-gray-600">N° de Cuenta:</span>
                <span className="font-mono font-bold text-xl text-blue-600">{datosTransferencia.numero}</span>
              </div>
              <div className="flex justify-between border-b border-orange-200 pb-2">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-bold text-gray-800 text-right">{datosTransferencia.nombre}</span>
              </div>
              <div className="flex justify-between border-b border-orange-200 pb-2">
                <span className="text-gray-600">RUT:</span>
                <span className="font-bold text-gray-800">{datosTransferencia.rut}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-600">Email:</span>
                <span className="font-bold text-gray-800">{datosTransferencia.email}</span>
              </div>
            </div>
            
            <div className="mt-4 bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
              <span>⚠️</span>
              <p>Importante: Indique su <strong>RUT</strong> o <strong>Número de Cliente</strong> en el comentario de la transferencia.</p>
            </div>
          </Card>

          <Card title="🏧 Depósito / Caja Vecina" className="border-l-4 border-purple-500">
             <p className="text-gray-600 mb-4">
              También puede realizar depósitos presenciales en Caja Vecina o sucursales bancarias usando los mismos datos de transferencia.
            </p>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl">🧾</div>
              <div>
                <p className="font-semibold text-gray-800">Guarde su comprobante</p>
                <p className="text-sm text-gray-600">Es indispensable subir la foto del voucher para validar su pago.</p>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default PagosPage;
