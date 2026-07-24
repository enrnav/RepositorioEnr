import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, ShieldCheck, ArrowRight, ShieldAlert, CheckCircle, Landmark, Copy, Check, Barcode } from 'lucide-react';
import { simulatePaymentSuccess } from '../api';

const PaymentSimulation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Payment method selection tab: 'card', 'spei', 'oxxo'
  const [activeTab, setActiveTab] = useState('card');

  // Credit Card Form States
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [copiedText, setCopiedText] = useState('');

  const tenantId = searchParams.get('inquilino_id') || 'N/A';
  const storeName = searchParams.get('nombre_tienda') || 'Tu Tienda';

  // Format Card Number (adds spaces every 4 digits)
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // keep only numbers
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.match(/.{1,4}/g)?.join(' ') || '';
    setCardNumber(formatted);
  };

  // Format Expiry Date (MM/YY)
  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  // Format CVC
  const handleCvcChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3);
    setCardCvc(value);
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    
    if (activeTab === 'card') {
      if (!cardholderName.trim()) {
        setError('Por favor, ingresa el nombre del tarjetahabiente.');
        return;
      }
      if (cardNumber.replace(/\s/g, '').length !== 16) {
        setError('El número de tarjeta debe tener 16 dígitos.');
        return;
      }
      if (cardExpiry.length !== 5) {
        setError('Ingresa una fecha de vencimiento válida (MM/YY).');
        return;
      }
      if (cardCvc.length !== 3) {
        setError('El CVC debe tener 3 dígitos.');
        return;
      }
    }

    setLoading(true);
    setError('');
    
    // Determine card brand if card method selected
    let brand = 'Visa';
    const numClean = cardNumber.replace(/\s/g, '');
    if (numClean.startsWith('4')) brand = 'Visa';
    else if (numClean.startsWith('5')) brand = 'Mastercard';
    else if (numClean.startsWith('3')) brand = 'Amex';

    const paymentData = {
      metodo_pago: activeTab,
      tarjeta_marca: activeTab === 'card' ? brand : null,
      tarjeta_ultimos4: activeTab === 'card' ? numClean.slice(-4) : null,
      tarjeta_titular: activeTab === 'card' ? cardholderName : null,
      tarjeta_vencimiento: activeTab === 'card' ? cardExpiry : null
    };

    try {
      await simulatePaymentSuccess(paymentData);
      setSuccess(true);
      
      // Update the local user session to 'active' subscription
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        userObj.estado_suscripcion = 'active';
        sessionStorage.setItem('user', JSON.stringify(userObj));
      }

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('Hubo un problema al procesar el pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-stone-200/60 shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row animate-scale-up">
        
        {/* Left Side: Premium Slogan & Summary */}
        <div className="flex-1 bg-gradient-to-br from-indigo-950 to-stone-900 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.1),transparent)] pointer-events-none"></div>
          
          <div className="space-y-8 relative z-10">
            <div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/30">
                Plan Premium
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight mt-4 leading-tight uppercase">
                Lleva tu negocio al siguiente nivel
              </h2>
              <p className="text-sm text-stone-300 font-medium leading-relaxed mt-3">
                Desbloquea el plan ilimitado y opera con la máxima capacidad de la plataforma:
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-1.5 bg-white/5 rounded-lg text-emerald-450 border border-white/10 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Productos Ilimitados</h4>
                  <p className="text-[11px] text-stone-300 mt-0.5">Sube todo tu catálogo sin límites (el plan gratis restringe a 50).</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="p-1.5 bg-white/5 rounded-lg text-emerald-455 border border-white/10 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Finanzas Avanzadas</h4>
                  <p className="text-[11px] text-stone-300 mt-0.5">Accede a reportes detallados de utilidad, márgenes de ganancia y ventas.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="p-1.5 bg-white/5 rounded-lg text-emerald-455 border border-white/10 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Soporte 24/7 y Estabilidad</h4>
                  <p className="text-[11px] text-stone-300 mt-0.5">Prioridad en soporte técnico de emergencia y servidores dedicados de alta velocidad.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-5 relative z-10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-400 font-bold uppercase">Comercio:</span>
              <span className="text-white font-black uppercase">{storeName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-400 font-bold uppercase">Concepto:</span>
              <span className="text-white font-bold">Suscripción Mensual Premium</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between items-end">
              <span className="text-xs text-stone-400 font-bold uppercase">Monto Mensual:</span>
              <span className="text-2xl font-black text-emerald-400">$499.00 MXN</span>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Checkout Pasarela */}
        <div className="flex-[1.2] p-8 md:p-12 flex flex-col justify-between">
          {!success ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-black text-stone-900 uppercase tracking-tight">Método de Pago Seguro</h3>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mt-1">Selecciona cómo deseas pagar tu suscripción</p>
              </div>

              {/* Payment Method Tabs */}
              <div className="flex bg-stone-100 p-1.5 rounded-2xl border border-stone-200/50">
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'card' 
                      ? 'bg-white text-emerald-800 shadow-sm border border-stone-200/40' 
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Tarjeta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('spei')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'spei' 
                      ? 'bg-white text-emerald-800 shadow-sm border border-stone-200/40' 
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Landmark size={14} />
                  <span>SPEI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('oxxo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'oxxo' 
                      ? 'bg-white text-emerald-800 shadow-sm border border-stone-200/40' 
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Barcode size={14} />
                  <span>OXXO Pay</span>
                </button>
              </div>

              {/* Tab Contents */}
              <form onSubmit={handleSubmitPayment} className="space-y-6">
                
                {activeTab === 'card' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Interactive Card Mockup Preview */}
                    <div className="bg-gradient-to-br from-indigo-800 via-purple-900 to-emerald-950 p-5 rounded-2xl shadow-xl relative text-white space-y-6 overflow-hidden border border-white/10">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-7 bg-amber-400/20 border border-amber-400/35 rounded-md flex items-center justify-center text-[10px] text-amber-200 font-bold tracking-widest font-mono">CHIP</div>
                        <span className="font-black italic tracking-widest text-sm uppercase">VISA / MC</span>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-305 font-extrabold tracking-widest uppercase">Número de Tarjeta</span>
                        <div className="font-mono text-lg sm:text-xl font-bold tracking-widest">
                          {cardNumber || '•••• •••• •••• ••••'}
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-gray-305 font-extrabold tracking-widest uppercase">Tarjetahabiente</span>
                          <div className="text-xs font-bold uppercase truncate max-w-[200px]">
                            {cardholderName || 'Nombre Completo'}
                          </div>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[8px] text-gray-305 font-extrabold tracking-widest uppercase">Expira</span>
                          <div className="text-xs font-mono font-bold">
                            {cardExpiry || 'MM/YY'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Nombre del Tarjetahabiente</label>
                        <input
                          type="text"
                          required
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-semibold text-stone-800 transition-all duration-300"
                        />
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Número de Tarjeta</label>
                        <input
                          type="text"
                          required
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          placeholder="0000 0000 0000 0000"
                          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-mono font-semibold text-stone-800 transition-all duration-300"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Vencimiento</label>
                          <input
                            type="text"
                            required
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            placeholder="MM/YY"
                            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-mono font-semibold text-stone-800 transition-all duration-300 text-center"
                          />
                        </div>

                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">CVC / CVV</label>
                          <input
                            type="password"
                            required
                            value={cardCvc}
                            onChange={handleCvcChange}
                            placeholder="•••"
                            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-mono font-semibold text-stone-800 transition-all duration-300 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'spei' && (
                  <div className="space-y-4 animate-fade-in text-stone-800">
                    <p className="text-xs font-semibold text-stone-500 leading-relaxed">
                      Realiza una transferencia electrónica SPEI usando los siguientes datos desde tu banca móvil:
                    </p>
                    
                    {/* Premium Digital SPEI Card */}
                    <div className="spei-card-box rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-250">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                            <Landmark size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider block">Transferencia</span>
                            <span className="text-xs font-black spei-title uppercase">SPEI Digital</span>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-600 text-white font-black uppercase px-2.5 py-0.5 rounded-full animate-pulse shadow-sm border border-emerald-500">
                          Verificación Automática
                        </span>
                      </div>
                      
                      <div className="space-y-3.5 font-sans">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-505 font-bold uppercase tracking-wider text-[9px]">Banco Receptor:</span>
                          <span className="spei-value font-black text-xs sm:text-sm">STP (Sistema de Transferencias)</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-550 font-bold uppercase tracking-wider text-[9px]">CLABE de Transferencia:</span>
                          <div className="flex items-center gap-2 spei-clabe-badge px-3 py-1.5 rounded-xl shadow-inner">
                            <span className="font-mono font-black text-xs sm:text-sm tracking-wider select-all">6461 8012 3456 7890 12</span>
                            <button
                              type="button"
                              onClick={() => handleCopy('646180123456789012', 'spei')}
                              className="hover:text-emerald-700 transition-colors cursor-pointer"
                              title="Copiar CLABE"
                            >
                              {copiedText === 'spei' ? <Check size={14} className="text-emerald-650 font-bold" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-550 font-bold uppercase tracking-wider text-[9px]">Beneficiario:</span>
                          <span className="spei-value font-black">SaaS SCORPION Inc.</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-550 font-bold uppercase tracking-wider text-[9px]">Referencia / Concepto:</span>
                          <span className="spei-concept-badge font-mono font-black px-2.5 py-0.5 rounded border">POS-{tenantId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="spei-warning-box text-[10px] p-3 rounded-xl leading-relaxed font-semibold">
                      Nota: Al hacer clic en "Pagar e Iniciar Modo Premium" abajo se simulará que la transferencia electrónica se recibió de forma instantánea.
                    </div>
                  </div>
                )}

                {activeTab === 'oxxo' && (
                  <div className="space-y-4 animate-fade-in text-stone-800">
                    <p className="text-xs font-semibold text-stone-500 leading-relaxed">
                      Presenta esta ficha de pago en la caja de cualquier sucursal OXXO para realizar el pago en efectivo:
                    </p>

                    {/* Premium OXXO Pay Ticket Mockup */}
                    <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col items-center">
                      {/* OXXO Header Banner */}
                      <div className="w-full flex items-center justify-between bg-gradient-to-r from-red-650 to-amber-500 text-white px-5 py-3 rounded-2xl shadow-sm mb-5" style={{ background: 'linear-gradient(90deg, #E52421 0%, #F5A623 100%)' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-black tracking-tighter bg-amber-400 text-red-700 px-2 py-0.5 rounded-md font-sans">OXXO</span>
                          <span className="text-xs font-bold uppercase tracking-widest">Pay</span>
                        </div>
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-105">Ficha Digital de Pago</span>
                      </div>

                      {/* Barcode representation */}
                      <div className="w-full flex flex-col items-center gap-2 pb-4 border-b border-stone-200/50">
                        {/* Realistic Barcode mockup */}
                        <div className="flex items-center justify-center h-14 w-full bg-white px-4 border border-stone-150 rounded-lg shadow-inner py-2 select-none overflow-hidden">
                          <div className="flex items-stretch justify-center h-full gap-[2px]">
                            <div className="w-[3px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[4px] bg-black"></div>
                            <div className="w-[2px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[3px] bg-black"></div>
                            <div className="w-[2px] bg-black"></div>
                            <div className="w-[4px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[3px] bg-black"></div>
                            <div className="w-[2px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[4px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[3px] bg-black"></div>
                            <div className="w-[2px] bg-black"></div>
                            <div className="w-[1px] bg-black"></div>
                            <div className="w-[4px] bg-black"></div>
                            <div className="w-[2px] bg-black"></div>
                            <div className="w-[3px] bg-black"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-black tracking-widest text-stone-850">9876-5432-1098-7654</span>
                          <button
                            type="button"
                            onClick={() => handleCopy('9876543210987654', 'oxxo')}
                            className="text-stone-400 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="Copiar Referencia"
                          >
                            {copiedText === 'oxxo' ? <Check size={14} className="text-emerald-600 font-bold" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="w-full pt-3.5 space-y-2.5 text-xs">
                        <div className="flex justify-between items-center text-stone-600 font-semibold">
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Concepto de Pago:</span>
                          <span>Suscripción POS-{tenantId}</span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600 font-semibold">
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Comisión de Tienda:</span>
                          <span>$15.00 MXN (Se paga en caja)</span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600 font-semibold">
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Total de Suscripción:</span>
                          <span className="text-stone-800 font-black">$499.00 MXN</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-stone-450 leading-relaxed font-semibold">
                      Instrucciones: Dile al cajero que vas a realizar un pago de servicio con **OXXO Pay**. Escaneará el código de barras o ingresará la referencia. El sistema acreditará tu pago al instante en esta simulación.
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-left">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <span className="text-xs font-bold">{error}</span>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 px-6 rounded-2xl hover:shadow-float active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer text-xs uppercase tracking-wider shadow-md disabled:bg-emerald-400"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Procesando Pago Seguro...</span>
                    </>
                  ) : (
                    <>
                      <span>Pagar e Iniciar Modo Premium</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-400 font-bold uppercase tracking-wider pt-2">
                <ShieldCheck size={14} className="text-emerald-600 animate-pulse" />
                <span>Transacción encriptada con cifrado AES de 256 bits</span>
              </div>
            </div>
          ) : (
            <div className="space-y-8 text-center py-12 animate-fade-in flex flex-col justify-center items-center h-full">
              <div className="flex justify-center">
                <div className="p-5 bg-emerald-100 rounded-full text-emerald-600 animate-pulse border border-emerald-200">
                  <CheckCircle size={48} className="animate-scale-up" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-brand-900 tracking-tight leading-none uppercase">¡Pago Aprobado con Éxito!</h2>
                <p className="text-xs text-stone-500 font-black uppercase tracking-widest mt-1">Tu suscripción Premium se encuentra Activa</p>
              </div>

              <div className="text-xs font-semibold text-stone-500 leading-relaxed max-w-xs mx-auto">
                Tu Punto de Venta se ha actualizado al Plan Premium sin límites. Serás redirigido automáticamente a tu panel administrativo en unos instantes.
              </div>

              <div className="flex justify-center pt-2">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSimulation;
