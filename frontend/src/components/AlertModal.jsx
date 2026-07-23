import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

const AlertModal = ({ isOpen, tipo, mensaje, titulo, onClose }) => {
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
  const isWarning = tipo === 'warning';

  const defaultTitle = isSuccess ? '¡Éxito!' : isWarning ? '¡Advertencia!' : '¡Atención!';

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />
      
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 text-center relative z-10 animate-scale-in">
        {/* Close icon button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex justify-center mb-4">
          {isSuccess ? (
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 animate-pulse">
              <CheckCircle2 size={36} className="stroke-[2]" />
            </div>
          ) : isWarning ? (
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
              <AlertTriangle size={36} className="stroke-[2]" />
            </div>
          ) : (
            <div className="p-3 bg-red-50 text-red-600 rounded-full border border-red-100 animate-pulse">
              <XCircle size={36} className="stroke-[2]" />
            </div>
          )}
        </div>

        <h3 className={`text-base font-extrabold tracking-tight mb-1.5 ${
          isSuccess ? 'text-slate-800' : isWarning ? 'text-amber-800' : 'text-red-800'
        }`}>
          {titulo || defaultTitle}
        </h3>
        
        <p className="text-xs font-semibold text-slate-600 leading-relaxed mb-6 px-2">
          {typeof mensaje === 'object' ? JSON.stringify(mensaje) : String(mensaje || '')}
        </p>

        <button
          onClick={onClose}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-sm ${
            isSuccess 
              ? 'bg-emerald-600 hover:bg-emerald-700' 
              : isWarning
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-chiluda-red hover:bg-chiluda-darkred'
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
