import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, ShieldCheck, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { simulatePaymentSuccess } from '../api';

const PaymentSimulation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const tenantId = searchParams.get('tenant_id') || 'N/A';
  const storeName = searchParams.get('store_name') || 'Tu Tienda';

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError('');
    try {
      await simulatePaymentSuccess();
      setSuccess(true);
      
      // Update the local user session to 'active' subscription
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        userObj.subscription_status = 'active';
        sessionStorage.setItem('user', JSON.stringify(userObj));
      }

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('Hubo un problema al procesar el pago simulado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white rounded-[2rem] border border-stone-200/60 shadow-lg p-8 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

        {!success ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-50 rounded-full text-emerald-600 animate-bounce">
                <CreditCard size={36} />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-brand-900 tracking-tight">Portal de Pagos SaaS (Pruebas)</h2>
              <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mt-1">Simulación de Pasarela de Pagos</p>
            </div>

            <div className="bg-stone-50 rounded-2xl p-5 text-left border border-stone-100 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase">Concepto:</span>
                <span className="text-stone-700 font-black">Suscripción Mensual Premium</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase">Comercio / Tienda:</span>
                <span className="text-stone-700 font-black uppercase">{storeName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase">ID Tienda:</span>
                <span className="text-stone-700 font-mono font-black">#{tenantId}</span>
              </div>
              <div className="border-t border-stone-200/60 pt-3 flex justify-between items-center">
                <span className="text-xs text-stone-400 font-bold uppercase">Total a pagar:</span>
                <span className="text-lg font-black text-emerald-700">$499.00 MXN</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-left">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <span className="text-xs font-semibold">{error}</span>
              </div>
            )}

            <button
              onClick={handleSimulatePayment}
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-6 rounded-xl hover:shadow-lg active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <span>Procesando Pago...</span>
              ) : (
                <>
                  <span>Simular Pago Exitoso</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            
            <p className="text-[10px] text-stone-400 font-medium leading-relaxed px-4">
              Nota: Este portal es una simulación local. Al hacer clic se registrará el pago mensual ficticio y se reactivará tu tienda inmediatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-6 text-center py-6 animate-fade-in">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-100 rounded-full text-emerald-600 animate-pulse">
                <CheckCircle size={48} className="animate-scale-up" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-brand-900 tracking-tight">¡Pago Aprobado con Éxito!</h2>
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Tu tienda ha sido reactivada</p>
            </div>

            <div className="text-xs font-medium text-stone-400 leading-relaxed max-w-xs mx-auto">
              Se ha renovado tu suscripción por 30 días adicionales. Serás redirigido automáticamente al panel de control en unos instantes.
            </div>

            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSimulation;
