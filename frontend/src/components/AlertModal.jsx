import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

const AlertModal = ({ isOpen, tipo, mensaje, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSuccess = tipo === 'success' || tipo === 'exito';
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-sm animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />
      
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl rounded-[2rem] border border-stone-200/60 shadow-2xl p-8 text-center relative z-10 animate-scale-up">
        {/* Close icon button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex justify-center mb-5">
          {isSuccess ? (
            <div className="p-4 bg-emerald-50 text-emerald-500 rounded-full border border-emerald-100 animate-pulse">
              <CheckCircle2 size={40} className="stroke-[1.8]" />
            </div>
          ) : (
            <div className="p-4 bg-rose-50 text-rose-500 rounded-full border border-rose-100 animate-pulse">
              <AlertTriangle size={40} className="stroke-[1.8]" />
            </div>
          )}
        </div>

        <h3 className={`text-base font-black tracking-wide uppercase mb-2 ${isSuccess ? 'text-emerald-800' : 'text-rose-800'}`}>
          {isSuccess ? '¡Éxito!' : '¡Atención!'}
        </h3>
        
        <p className="text-xs font-semibold text-stone-600 leading-relaxed mb-6 px-2">
          {mensaje}
        </p>

        <button
          onClick={onClose}
          className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-md ${
            isSuccess 
              ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/10' 
              : 'bg-rose-600 hover:bg-rose-700 hover:shadow-rose-600/10'
          }`}
        >
          Aceptar
        </button>
      </div>
    </div>,
    document.body
  );
};

export default AlertModal;
