import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { API_URL } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const RegisterTenant = () => {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [subdominio, setSubdomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Branding states
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#064E3B');
  const [accentColor, setAccentColor] = useState('#064E3B');
  const [isColorModified, setIsColorModified] = useState(false);

  useEffect(() => {
    if (!isColorModified) {
      document.body.classList.remove('branded-dark-theme');
      document.documentElement.style.setProperty('--primary-color', '#064E3B');
      document.documentElement.style.setProperty('--primary-color-light', 'rgba(59, 130, 246, 0.08)');
      document.documentElement.style.setProperty('--body-bg-color', '#f3f6f4');
      document.documentElement.style.setProperty('--accent-color', '#064E3B');
      document.documentElement.style.setProperty('--accent-color-hover', '#059669');
      document.documentElement.style.setProperty('--accent-color-light', 'rgba(5, 150, 105, 0.08)');
    } else {
      const hexToRgb = (hex) => {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      const pRgb = hexToRgb(primaryColor);
      const aRgb = hexToRgb(accentColor);

      let isLight = false;
      if (pRgb) {
        const pLum = (pRgb.r * 299 + pRgb.g * 587 + pRgb.b * 114) / 1000;
        isLight = pLum > 140;
      }

      if (isLight) {
        document.body.classList.remove('branded-dark-theme');
      } else {
        document.body.classList.add('branded-dark-theme');
      }

      document.documentElement.style.setProperty('--primary-color', primaryColor);
      if (pRgb) {
        document.documentElement.style.setProperty('--primary-color-light', `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.08)`);
        document.documentElement.style.setProperty('--primary-color-surface', `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.35)`);
      } else {
        document.documentElement.style.setProperty('--primary-color-light', 'rgba(59, 130, 246, 0.08)');
        document.documentElement.style.setProperty('--primary-color-surface', 'rgba(255, 255, 255, 0.08)');
      }

      document.documentElement.style.setProperty('--accent-color', accentColor);
      document.documentElement.style.setProperty('--accent-color-hover', accentColor);
      if (aRgb) {
        document.documentElement.style.setProperty('--accent-color-light', `rgba(${aRgb.r}, ${aRgb.g}, ${aRgb.b}, 0.08)`);
        const lum = (aRgb.r * 299 + aRgb.g * 587 + aRgb.b * 114) / 1000;
        document.documentElement.style.setProperty('--accent-text-color', lum > 140 ? '#111827' : '#ffffff');
      } else {
        document.documentElement.style.setProperty('--accent-color-light', 'rgba(5, 150, 105, 0.08)');
        document.documentElement.style.setProperty('--accent-text-color', '#ffffff');
      }
    }
  }, [isColorModified, primaryColor, accentColor]);

  // Predefined palettes
  const palettes = [
    { name: 'Esmeralda', primary: '#064E3B', accent: '#10B981' },
    { name: 'Chiluda', primary: '#1B1C1E', accent: '#DC2626' },
    { name: 'Zafiro', primary: '#0F172A', accent: '#0EA5E9' },
    { name: 'Amatista', primary: '#1E1B4B', accent: '#8B5CF6' }
  ];

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const handleSubdomainChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(val);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("El tamaño del logo debe ser menor a 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePaletteSelect = (p) => {
    setPrimaryColor(p.primary);
    setAccentColor(p.accent);
    setIsColorModified(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (storeName.trim().length < 3) {
      setError("El nombre de la tienda debe tener al menos 3 caracteres.");
      return;
    }

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.']{3,}$/;
    if (!nameRegex.test(adminName)) {
      setError("El nombre del administrador debe tener al menos 3 caracteres y contener únicamente letras.");
      return;
    }

    const userRegex = /^[a-zA-Z0-9_]{3,}$/;
    if (!userRegex.test(adminUsername)) {
      setError("El usuario debe tener al menos 3 caracteres (letras, números o guiones bajos).");
      return;
    }

    const strength = getPasswordStrength(adminPassword);
    if (strength < 4) {
      let missing = [];
      if (adminPassword.length < 12) missing.push("mínimo 12 caracteres");
      if (!/[A-Z]/.test(adminPassword)) missing.push("al menos una mayúscula");
      if (!/[0-9]/.test(adminPassword)) missing.push("al menos un número");
      if (!/[^A-Za-z0-9]/.test(adminPassword)) missing.push("al menos un carácter especial");
      setError("La contraseña no cumple con los requisitos: falta " + missing.join(", ") + ".");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register-inquilino`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_tienda: storeName,
          subdominio: subdominio || undefined,
          nombre_admin: adminName,
          usuario_admin: adminUsername,
          contrasena_admin: adminPassword,
          logo_url: logoUrl || undefined,
          color_primario: primaryColor,
          color_secundario: accentColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const registeredSubdomain = data.subdominio;
        if (registeredSubdomain) {
          localStorage.setItem('last_tenant_subdomain', registeredSubdomain);
        }
        setShowSuccessModal(true);
      } else {
        const data = await response.json();
        setError(data.detail || 'Error al registrar la tienda.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    }
  };

  const getRgbFromHex = (hex) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  const pRgbVal = getRgbFromHex(primaryColor);
  const pLumVal = pRgbVal ? (pRgbVal.r * 299 + pRgbVal.g * 587 + pRgbVal.b * 114) / 1000 : 0;
  const isLight = pLumVal > 140;
  const showDarkBg = isColorModified && !isLight;

  return (
    <div 
      className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans transition-all duration-700 ${showDarkBg ? '' : 'bg-transparent'}`}
      style={showDarkBg ? {
        background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 100%)`
      } : undefined}
    >
      {/* Floating background store icons */}
      <FloatingStoreIconsBg color={isColorModified ? accentColor + '25' : undefined} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Store Custom Logo" className={`h-24 w-auto object-contain rounded-2xl shadow-lg border animate-scale-in transition-all duration-700 ${showDarkBg ? 'border-white/20' : 'border-stone-200'}`} />
          ) : (
            <img src="/logo.png?v=4" alt="SaaS POS Logo" className="h-24 w-auto object-contain" />
          )}
        </div>
        <h2 className={`text-center text-3xl font-black tracking-tight uppercase transition-colors duration-700 ${showDarkBg ? 'text-white drop-shadow-md' : 'text-brand-900'}`}>
          Crea tu Tienda en <span style={{ color: accentColor }}>Abarrotes SaaS</span>
        </h2>
        <p className={`mt-2 text-center text-sm font-bold transition-colors duration-700 ${showDarkBg ? 'text-gray-300' : 'text-stone-500'}`}>
          Personaliza tu marca, colores e identidad desde el primer momento.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 animate-slide-up">
        <div className={`py-10 px-6 sm:px-12 sm:rounded-[2rem] transition-all duration-700 ${showDarkBg ? 'bg-white/10 backdrop-blur-md border border-white/10 shadow-2xl' : 'glass'}`}>
          <AlertModal 
            isOpen={!!success || !!error}
            tipo={success ? 'success' : 'error'}
            mensaje={success || error}
            onClose={() => { setSuccess(''); setError(''); }}
          />

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* --- SECCIÓN 1: IDENTIDAD Y DISEÑO --- */}
            <div className={`border-b pb-5 transition-colors duration-700 ${isColorModified ? 'border-white/10' : 'border-stone-200'}`}>
              <h3 className={`text-xs font-black uppercase tracking-wider mb-4 transition-colors duration-700 ${isColorModified ? 'text-gray-200' : 'text-stone-500'}`}>
                1. Identidad y Diseño de la Tienda
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                    Nombre del Negocio
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className={`mt-1 appearance-none block w-full px-4 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm font-semibold transition-all duration-700 ${
                      isColorModified 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-white/20 focus:bg-white/15' 
                        : 'bg-white/50 border border-stone-200 text-stone-850 placeholder-stone-400 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'
                    }`}
                    placeholder="Ej. Tienda Mi Barrio"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                      Identificador de tienda (Slug)
                    </label>
                    <input
                      type="text"
                      value={subdominio}
                      onChange={handleSubdomainChange}
                      className={`mt-1 appearance-none block w-full px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 text-sm font-semibold transition-all duration-700 ${
                        isColorModified 
                          ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-white/20 focus:bg-white/15' 
                          : 'bg-white/50 border border-stone-200 text-stone-850 placeholder-stone-400 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'
                      }`}
                      placeholder="tiendadebarrio"
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                      Cargar Logo Comercial
                    </label>
                    <label className={`mt-1 flex items-center justify-center border border-dashed rounded-xl cursor-pointer py-2.5 transition-all text-xs font-bold duration-700 ${
                      isColorModified 
                        ? 'border-white/25 hover:border-white/50 bg-white/5 text-white' 
                        : 'border-stone-300 hover:border-stone-400 bg-white/50 hover:bg-white text-stone-700'
                    }`}>
                      <span>Seleccionar archivo</span>
                      <input
                        type="file"
                        accept="imagen/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* --- SECCIÓN PALETA DE COLORES --- */}
                <div className="space-y-3 pt-2">
                  <span className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                    Paleta de Colores de tu Marca
                  </span>
                  
                  {/* Preselecciones */}
                  <div className="flex flex-wrap gap-2">
                    {palettes.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handlePaletteSelect(p)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all duration-700 ${
                          isColorModified 
                            ? 'border-white/10 hover:border-white/30 bg-white/5 text-white' 
                            : 'border-stone-200 hover:border-stone-350 bg-white/50 hover:bg-white text-stone-700'
                        }`}
                      >
                        <span 
                          className={`w-2.5 h-2.5 rounded-full border inline-block transition-colors duration-700 ${isColorModified ? 'border-white/20' : 'border-stone-200'}`} 
                          style={{ backgroundColor: p.primary }}
                        />
                        <span 
                          className={`w-2.5 h-2.5 rounded-full border inline-block transition-colors duration-700 ${isColorModified ? 'border-white/20' : 'border-stone-200'}`} 
                          style={{ backgroundColor: p.accent }}
                        />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Personalizado */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 transition-colors duration-700 ${isColorModified ? 'text-gray-400' : 'text-stone-400'}`}>
                        Fondo Principal
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => {
                            setPrimaryColor(e.target.value);
                            setIsColorModified(true);
                          }}
                          className={`w-8 h-8 rounded-lg bg-transparent cursor-pointer border transition-colors duration-700 ${isColorModified ? 'border-white/10' : 'border-stone-200'}`}
                        />
                        <span className={`text-xs font-mono transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>{primaryColor.toUpperCase()}</span>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 transition-colors duration-700 ${isColorModified ? 'text-gray-400' : 'text-stone-400'}`}>
                        Iconos y Botones
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => {
                            setAccentColor(e.target.value);
                            setIsColorModified(true);
                          }}
                          className={`w-8 h-8 rounded-lg bg-transparent cursor-pointer border transition-colors duration-700 ${isColorModified ? 'border-white/10' : 'border-stone-200'}`}
                        />
                        <span className={`text-xs font-mono transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>{accentColor.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* --- SECCIÓN 2: DATOS DEL ADMINISTRADOR --- */}
            <div>
              <h3 className={`text-xs font-black uppercase tracking-wider mb-4 transition-colors duration-700 ${isColorModified ? 'text-gray-200' : 'text-stone-500'}`}>
                2. Datos de Acceso de Administrador
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className={`mt-1 appearance-none block w-full px-4 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm font-semibold transition-all duration-700 ${
                      isColorModified 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-white/20 focus:bg-white/15' 
                        : 'bg-white/50 border border-stone-200 text-stone-850 placeholder-stone-400 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'
                    }`}
                    placeholder="Ej. Carlos Pérez"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                      Usuario
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className={`mt-1 appearance-none block w-full px-4 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm font-semibold transition-all duration-700 ${
                        isColorModified 
                          ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-white/20 focus:bg-white/15' 
                          : 'bg-white/50 border border-stone-200 text-stone-850 placeholder-stone-400 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'
                      }`}
                      placeholder="Ej. carlos_admin"
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>
                      Contraseña
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className={`mt-1 appearance-none block w-full px-4 py-2.5 rounded-xl shadow-sm focus:outline-none focus:ring-2 text-sm font-semibold transition-all duration-700 ${
                        isColorModified 
                          ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-white/20 focus:bg-white/15' 
                          : 'bg-white/50 border border-stone-200 text-stone-850 placeholder-stone-400 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'
                      }`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {adminPassword && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={`font-bold transition-colors duration-700 ${isColorModified ? 'text-gray-300' : 'text-stone-500'}`}>Fortaleza de contraseña:</span>
                      <span className="font-extrabold uppercase text-[10px]" style={{
                        color: getPasswordStrength(adminPassword) === 1 ? '#ef4444' :
                               getPasswordStrength(adminPassword) === 2 ? '#f97316' :
                               getPasswordStrength(adminPassword) === 3 ? '#d97706' :
                               getPasswordStrength(adminPassword) === 4 ? '#059669' : '#9ca3af'
                      }}>
                        {getPasswordStrength(adminPassword) === 0 && 'Ninguna'}
                        {getPasswordStrength(adminPassword) === 1 && 'Muy débil'}
                        {getPasswordStrength(adminPassword) === 2 && 'Regular'}
                        {getPasswordStrength(adminPassword) === 3 && 'Buena'}
                        {getPasswordStrength(adminPassword) === 4 && 'Fuerte'}
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 overflow-hidden transition-colors duration-700 ${isColorModified ? 'bg-white/10' : 'bg-stone-200/60'}`}>
                      <div 
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: getPasswordStrength(adminPassword) === 1 ? '25%' :
                                 getPasswordStrength(adminPassword) === 2 ? '50%' :
                                 getPasswordStrength(adminPassword) === 3 ? '75%' :
                                 getPasswordStrength(adminPassword) === 4 ? '100%' : '0%',
                          backgroundColor: getPasswordStrength(adminPassword) === 1 ? '#ef4444' :
                                           getPasswordStrength(adminPassword) === 2 ? '#f97316' :
                                           getPasswordStrength(adminPassword) === 3 ? '#d97706' :
                                           getPasswordStrength(adminPassword) === 4 ? '#059669' : 'transparent'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={success}
                className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{ 
                  backgroundColor: accentColor,
                  color: 'var(--accent-text-color, #ffffff)'
                }}
              >
                Crear mi tienda (Plan Gratis)
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className={`text-xs font-black transition-colors uppercase tracking-wider duration-700 ${isColorModified ? 'text-gray-300 hover:text-white' : 'text-stone-500 hover:text-stone-700'}`}
            >
              ¿Ya tienes una tienda? Inicia sesión
            </button>
          </div>
        </div>
      </div>
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div 
            className={`backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 animate-scale-in text-center relative overflow-hidden transition-all duration-700 ${
              showDarkBg 
                ? 'border border-white/20 text-white shadow-2xl' 
                : 'bg-white/95 border border-white/50 text-stone-800'
            }`}
            style={showDarkBg ? {
              background: `linear-gradient(145deg, ${primaryColor}66 0%, #111827 95%)`
            } : undefined}
          >
            {/* Background design elements */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20" style={{ backgroundColor: accentColor }}></div>
            
            <div 
              className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center shadow-inner transition-colors duration-700 ${
                showDarkBg 
                  ? 'border' 
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-650'
              }`}
              style={showDarkBg ? {
                backgroundColor: accentColor + '20',
                borderColor: accentColor + '40',
                color: accentColor
              } : undefined}
            >
              <CheckCircle size={40} className="animate-bounce" />
            </div>
            
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight transition-colors duration-700 ${showDarkBg ? 'text-white' : 'text-brand-900'}`}>
              ¡Tienda Registrada!
            </h3>
            <p className={`text-sm font-semibold mb-6 transition-colors duration-700 ${showDarkBg ? 'text-gray-300' : 'text-stone-500'}`}>
              Tu tienda ha sido creada correctamente en Abarrotes SaaS.
            </p>
            
            <div className={`rounded-2xl p-4 text-left space-y-2.5 mb-8 text-xs font-bold transition-all duration-700 ${
              showDarkBg 
                ? 'bg-white/10 border border-white/15 text-gray-200' 
                : 'bg-stone-50/80 border border-stone-200/50 text-stone-600'
            }`}>
              <div className="flex justify-between">
                <span className={showDarkBg ? 'text-gray-300 uppercase' : 'text-stone-400 uppercase'}>Tienda:</span>
                <span className={`font-extrabold uppercase ${showDarkBg ? 'text-white' : 'text-brand-900'}`}>{storeName}</span>
              </div>
              {subdominio && (
                <div className="flex justify-between">
                  <span className={showDarkBg ? 'text-gray-300 uppercase' : 'text-stone-400 uppercase'}>Identificador (Slug):</span>
                  <span className={`font-extrabold font-mono ${showDarkBg ? 'text-white' : 'text-stone-700'}`}>{subdominio}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={showDarkBg ? 'text-gray-300 uppercase' : 'text-stone-400 uppercase'}>Administrador:</span>
                <span className={`font-extrabold ${showDarkBg ? 'text-white' : 'text-stone-700'}`}>{adminUsername}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-full font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-lg hover:shadow-float active:scale-[0.98]"
              style={{
                backgroundColor: accentColor,
                color: (function() {
                  const hex = accentColor.replace('#', '');
                  const fullHex = hex.length === 3 ? hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2] : hex;
                  const r = parseInt(fullHex.substring(0, 2), 16) || 0;
                  const g = parseInt(fullHex.substring(2, 4), 16) || 0;
                  const b = parseInt(fullHex.substring(4, 6), 16) || 0;
                  const lum = (r * 299 + g * 587 + b * 114) / 1000;
                  return lum > 140 ? '#111827' : '#ffffff';
                })(),
                boxShadow: `0 10px 25px -5px ${accentColor}40`
              }}
            >
              <span>Ir al Inicio de Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterTenant;
