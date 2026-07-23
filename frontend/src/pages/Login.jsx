import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, fetchTenantBranding } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const Login = () => {
  const navigate = useNavigate();
  const [nombre_usuario, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Branding states loaded synchronously from localStorage cache to prevent color flashing
  const getCachedBranding = () => {
    try {
      const cached = localStorage.getItem('cached_tenant_branding');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return {
      storeName: 'ED & E',
      logoUrl: '',
      primaryColor: '#064E3B',
      accentColor: '#064E3B',
      isBranded: false
    };
  };

  const initialBranding = getCachedBranding();

  const [storeName, setStoreName] = useState(initialBranding.storeName);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primaryColor);
  const [accentColor, setAccentColor] = useState(initialBranding.accentColor);
  const [isBranded, setIsBranded] = useState(initialBranding.isBranded);
  
  // Custom subdominio selector for local testing/multi-inquilino access
  const [showSubdomainInput, setShowSubdomainInput] = useState(false);
  const [tempSubdomain, setTempSubdomain] = useState('');

  const loadBranding = async (sub, isManual = false) => {
    try {
      const data = await fetchTenantBranding(sub);
      if (data) {
        const pColor = data.color_primario || '#064E3B';
        const aColor = data.color_secundario || '#064E3B';
        const newBranding = {
          inquilino_id: data.id,
          storeName: data.nombre_tienda,
          logoUrl: data.logo_url,
          primaryColor: pColor,
          accentColor: aColor,
          isBranded: sub !== 'principal'
        };
        const storeSettingsCache = {
          inquilino_id: data.id,
          nombre_tienda: data.nombre_tienda,
          logo_url: data.logo_url,
          color_primario: pColor,
          color_secundario: aColor
        };
        setStoreName(newBranding.storeName);
        setLogoUrl(newBranding.logoUrl);
        setPrimaryColor(newBranding.primaryColor);
        setAccentColor(newBranding.accentColor);
        setIsBranded(newBranding.isBranded);
        
        // Cache the values synchronously
        localStorage.setItem('cached_tenant_branding', JSON.stringify(newBranding));
        localStorage.setItem('cached_store_settings', JSON.stringify(storeSettingsCache));
        localStorage.setItem('last_tenant_subdomain', sub);
        setError('');
        if (isManual) {
          setShowSubdomainInput(false);
          setTempSubdomain('');
        }
      }
    } catch (err) {
      console.error("Could not load inquilino branding:", err);
      if (isManual) {
        setError('El identificador de tienda (Slug) no existe.');
      } else {
        // Reset to default settings on error (deleted inquilino)
        const defaults = {
          storeName: 'ED & E',
          logoUrl: '',
          primaryColor: '#064E3B',
          accentColor: '#064E3B',
          isBranded: false
        };
        setStoreName(defaults.storeName);
        setLogoUrl(defaults.logoUrl);
        setPrimaryColor(defaults.primaryColor);
        setAccentColor(defaults.accentColor);
        setIsBranded(defaults.isBranded);
        localStorage.removeItem('cached_tenant_branding');
        localStorage.removeItem('cached_store_settings');
        localStorage.removeItem('last_tenant_subdomain');
      }
    }
  };

  useEffect(() => {
    // Clean up subdominio cache if the current user session is Superadmin (inquilino 1)
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && u.inquilino_id === 1) {
          localStorage.removeItem('last_tenant_subdomain');
          localStorage.removeItem('cached_tenant_branding');
        }
      } catch (e) {}
    }

    // 1. Detect subdominio from query parameter ?store=...
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    
    if (storeParam) {
      loadBranding(storeParam);
      return;
    }

    // 2. Detect subdominio from window.location.hostname
    const hostname = window.location.hostname;
    const isDeploymentDomain = hostname.endsWith('vercel.app') || hostname.endsWith('onrender.com');
    if (!isDeploymentDomain) {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const sub = parts[0];
        if (sub !== 'www' && sub !== 'localhost') {
          loadBranding(sub);
          return;
        }
      }
    }

    // 3. Fallback to last logged in inquilino in localStorage
    const lastSub = localStorage.getItem('last_tenant_subdomain');
    if (lastSub) {
      loadBranding(lastSub);
    }
  }, []);

  // useLayoutEffect runs synchronously before browser paints to prevent flashes of unstyled colors
  useLayoutEffect(() => {
    if (!isBranded) {
      document.body.classList.remove('branded-dark-theme');
      document.documentElement.classList.remove('branded-dark-theme');
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
        document.documentElement.classList.remove('branded-dark-theme');
      } else {
        document.body.classList.add('branded-dark-theme');
        document.documentElement.classList.add('branded-dark-theme');
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
  }, [isBranded, primaryColor, accentColor]);

  const handleCustomStoreSubmit = async (e) => {
    e.preventDefault();
    if (tempSubdomain.trim()) {
      await loadBranding(tempSubdomain.trim().toLowerCase(), true);
    }
  };

  const handleResetBranding = () => {
    setStoreName('ED & E');
    setLogoUrl('');
    setPrimaryColor('#064E3B');
    setAccentColor('#064E3B');
    setIsBranded(false);
    setTempSubdomain('');
    setNombreUsuario('');
    setPassword('');
    localStorage.removeItem('last_tenant_subdomain');
    localStorage.removeItem('cached_tenant_branding');
    setShowSubdomainInput(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const activeSubdomain = localStorage.getItem('last_tenant_subdomain') || null;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_usuario,
          contrasena: password,
          subdominio: activeSubdomain
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('user', JSON.stringify(data.usuario));
        sessionStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.usuario));
        localStorage.setItem('token', data.access_token);
        if (data.usuario.subdominio) {
          localStorage.setItem('last_tenant_subdomain', data.usuario.subdominio);
        } else if (data.usuario.inquilino_id === 1) {
          localStorage.removeItem('last_tenant_subdomain');
          localStorage.removeItem('cached_tenant_branding');
          localStorage.removeItem('cached_store_settings');
        }
        
        // Ensure cache matches logged in user's inquilino_id
        const cachedStoreStr = localStorage.getItem('cached_store_settings');
        if (cachedStoreStr) {
          try {
            const parsedStore = JSON.parse(cachedStoreStr);
            if (parsedStore.inquilino_id && parsedStore.inquilino_id !== data.usuario.inquilino_id) {
              localStorage.removeItem('cached_store_settings');
              localStorage.removeItem('cached_tenant_branding');
            }
          } catch(e) {}
        }
        if (data.usuario.rol === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/sales');
        }
      } else {
        const data = await response.json();
        setError(data.detail || 'Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };


  // --- BRANDED CUSTOM DARK THEME ---
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

  if (isBranded && !isLight) {
    return (
      <div 
        className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans transition-all duration-700"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 100%)`
        }}
      >
        {/* Dynamic colored background store icons */}
        <FloatingStoreIconsBg color={accentColor + '20'} />

        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt={`${storeName} Logo`} className="h-28 w-auto object-contain rounded-2xl shadow-md border border-white/10 animate-scale-in" />
            ) : (
              <img src="/logo.png?v=4" alt="SaaS POS Logo" className="h-28 w-auto object-contain hover:scale-105 transition-transform duration-500" />
            )}
          </div>
          <h2 className="mt-2 text-center text-4xl font-black text-white tracking-tight drop-shadow-md uppercase">
            Abarrotes <span style={{ color: accentColor }}>{storeName}</span>
          </h2>
          <p className="mt-3 text-center text-sm font-bold text-gray-300">
            Ingresa a tu cuenta
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
          <div className="bg-white/10 backdrop-blur-md py-10 px-6 shadow-2xl sm:rounded-[2rem] sm:px-12 border border-white/20">
            {error && (
              <div className="mb-6 p-3.5 text-xs font-bold text-center rounded-xl border bg-red-950/80 border-red-500/30 text-red-300 animate-shake">
                {error}
              </div>
            )}
            
            <form className="space-y-6 bg-transparent" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-black text-gray-200 uppercase tracking-wider">
                  Usuario
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={nombre_usuario}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/15 text-sm font-semibold text-white transition-all duration-300"
                    placeholder="Ej. carlos_admin"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-200 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/15 text-sm font-semibold text-white transition-all duration-300"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-black hover:scale-[1.02] active:scale-[0.98] focus:outline-none transition-all duration-300"
                  style={{ 
                    backgroundColor: accentColor,
                    color: 'var(--accent-text-color, #ffffff)'
                  }}
                >
                  Iniciar Sesión
                </button>
              </div>
            </form>
 
            <div className="mt-6 border-t border-white/10 pt-4 flex flex-col items-center gap-3">
              {showSubdomainInput ? (
                <form onSubmit={handleCustomStoreSubmit} className="w-full flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    required
                    value={tempSubdomain}
                    onChange={(e) => setTempSubdomain(e.target.value)}
                    placeholder="Slug de tu tienda"
                    className="flex-1 px-3 py-1.5 bg-white/5 border border-white/15 rounded-lg text-xs font-semibold text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ 
                      backgroundColor: accentColor,
                      color: 'var(--accent-text-color, #ffffff)'
                    }}
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempSubdomain('')}
                    className="px-2 py-1.5 text-xs text-gray-400 hover:text-white uppercase tracking-wider font-bold cursor-pointer"
                  >
                    Reset
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const currentSub = localStorage.getItem('last_tenant_subdomain') || '';
                      setTempSubdomain(currentSub);
                      setShowSubdomainInput(true);
                    }}
                    className="text-[11px] text-gray-400 hover:text-white font-bold transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Acceder a otra tienda (Slug)
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate('/register-inquilino')}
                className="text-xs text-gray-300 hover:text-white font-bold transition-colors uppercase tracking-wider"
              >
                ¿Registrar nueva tienda? Regístrate aquí
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT LIGHT POS THEME (ED & E ORIGINAL LOOK) ---
  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Dynamic colored background store icons */}
      <FloatingStoreIconsBg color={isBranded ? accentColor + '20' : undefined} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-4">
          {isBranded && logoUrl ? (
            <img src={logoUrl} alt={`${storeName} Logo`} className="h-28 w-auto object-contain rounded-2xl shadow-md border border-stone-200 animate-scale-in" />
          ) : (
            <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-28 w-auto object-contain hover:scale-105 transition-transform duration-500" />
          )}
        </div>
        <h2 className="mt-2 text-center text-4xl font-black text-brand-900 tracking-tight uppercase">
          Abarrotes <span style={{ color: isBranded ? accentColor : '#064e3b' }}>{isBranded ? storeName : 'ED & E'}</span>
        </h2>
        <p className="mt-3 text-center text-sm font-bold text-stone-500">
          Ingresa a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="glass py-10 px-6 sm:rounded-[2rem] sm:px-12">
          {error && (
            <div className="mb-6 p-3.5 text-xs font-bold text-center rounded-xl border bg-rose-50 border-rose-100 text-chiluda-red animate-shake">
              {error}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-black text-stone-500 uppercase tracking-wider">
                Usuario
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  required
                  value={nombre_usuario}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/50 border border-stone-200 rounded-xl shadow-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all duration-300 sm:text-sm font-semibold text-stone-850"
                  placeholder="Ej. carlos_admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-stone-500 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/50 border border-stone-200 rounded-xl shadow-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all duration-300 sm:text-sm font-semibold text-stone-850"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-black hover:scale-[1.02] active:scale-[0.98] focus:outline-none transition-all duration-300"
                style={{ 
                  backgroundColor: isBranded ? accentColor : '#064e3b',
                  color: isBranded ? 'var(--accent-text-color, #ffffff)' : '#ffffff'
                }}
              >
                Iniciar Sesión
              </button>
            </div>
          </form>

          {/* Custom domain selector section */}
          <div className="mt-6 border-t border-stone-100 pt-4 flex flex-col items-center gap-3">
            {showSubdomainInput ? (
              <form onSubmit={handleCustomStoreSubmit} className="w-full flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  required
                  value={tempSubdomain}
                  onChange={(e) => setTempSubdomain(e.target.value)}
                  placeholder="Slug de tu tienda"
                  className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-850 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{ 
                    backgroundColor: isBranded ? accentColor : '#064e3b',
                    color: isBranded ? 'var(--accent-text-color, #ffffff)' : '#ffffff'
                  }}
                >
                  Cargar
                </button>
                <button
                  type="button"
                  onClick={handleResetBranding}
                  className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600"
                >
                  Reset
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubdomainInput(true)}
                className="text-[11px] text-stone-400 hover:text-stone-600 font-bold transition-colors uppercase tracking-wider"
              >
                Acceder a otra tienda (Slug)
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/register-inquilino')}
              className="text-xs text-stone-500 hover:text-stone-700 font-black transition-colors uppercase tracking-wider"
            >
              ¿Registrar nueva tienda? Regístrate aquí
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
