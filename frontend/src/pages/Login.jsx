import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, fetchTenantBranding } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Branding states (defaulting to Abarrotes ED & E branding)
  const [storeName, setStoreName] = useState('ED & E');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#064E3B');
  const [accentColor, setAccentColor] = useState('#064E3B');
  const [isBranded, setIsBranded] = useState(false); // Control theme mode
  
  // Custom subdomain selector for local testing/multi-tenant access
  const [showSubdomainInput, setShowSubdomainInput] = useState(false);
  const [tempSubdomain, setTempSubdomain] = useState('');

  const loadBranding = async (sub) => {
    try {
      const data = await fetchTenantBranding(sub);
      if (data) {
        setStoreName(data.store_name);
        setLogoUrl(data.logo_url);
        setPrimaryColor(data.primary_color || '#064E3B');
        setAccentColor(data.accent_color || '#064E3B');
        setIsBranded(true);
        localStorage.setItem('last_tenant_subdomain', sub);
        setError('');
      }
    } catch (err) {
      console.error("Could not load tenant branding:", err);
      // Reset to default settings on error (deleted tenant)
      setStoreName('ED & E');
      setLogoUrl('');
      setPrimaryColor('#064E3B');
      setAccentColor('#064E3B');
      setIsBranded(false);
      localStorage.removeItem('last_tenant_subdomain');
    }
  };

  useEffect(() => {
    // 1. Detect subdomain from query parameter ?store=...
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    
    if (storeParam) {
      loadBranding(storeParam);
      return;
    }

    // 2. Detect subdomain from window.location.hostname
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 1) {
      const sub = parts[0];
      if (sub !== 'www' && sub !== 'localhost') {
        loadBranding(sub);
        return;
      }
    }

    // 3. Fallback to last logged in tenant in localStorage
    const lastSub = localStorage.getItem('last_tenant_subdomain');
    if (lastSub) {
      loadBranding(lastSub);
    }
  }, []);

  const handleCustomStoreSubmit = (e) => {
    e.preventDefault();
    if (tempSubdomain.trim()) {
      loadBranding(tempSubdomain.trim().toLowerCase());
      setShowSubdomainInput(false);
    }
  };

  const handleResetBranding = () => {
    setStoreName('ED & E');
    setLogoUrl('');
    setPrimaryColor('#064E3B');
    setAccentColor('#064E3B');
    setIsBranded(false);
    localStorage.removeItem('last_tenant_subdomain');
    setShowSubdomainInput(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('token', data.access_token);
        if (data.user.subdomain) {
          localStorage.setItem('last_tenant_subdomain', data.user.subdomain);
        }
        if (data.user.role === 'admin') {
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
  if (isBranded) {
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
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-black text-gray-200 uppercase tracking-wider">
                  Usuario
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={username}
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
                  className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-black text-white hover:scale-[1.02] active:scale-[0.98] focus:outline-none transition-all duration-300"
                  style={{ backgroundColor: accentColor }}
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
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                    style={{ backgroundColor: accentColor }}
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBranding}
                    className="px-2 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Reset
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubdomainInput(true)}
                  className="text-[11px] text-gray-400 hover:text-white font-bold transition-colors uppercase tracking-wider"
                >
                  Acceder a otra tienda (Slug)
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/register-tenant')}
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
    <div className="min-h-screen bg-brand-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Original light green icons */}
      <FloatingStoreIconsBg />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-4">
          <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-28 w-auto object-contain hover:scale-105 transition-transform duration-500" />
        </div>
        <h2 className="mt-2 text-center text-4xl font-black text-brand-900 tracking-tight uppercase">
          Abarrotes <span className="text-[#064e3b]">ED & E</span>
        </h2>
        <p className="mt-3 text-center text-sm font-bold text-stone-500">
          Ingresa a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="bg-white/5 backdrop-blur-[2px] py-10 px-6 shadow-glass sm:rounded-[2rem] sm:px-12 border border-white/40">
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
                  value={username}
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
                className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-black text-white bg-[#064e3b] hover:bg-emerald-800 hover:scale-[1.02] active:scale-[0.98] focus:outline-none transition-all duration-300"
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
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#064e3b] hover:bg-emerald-800"
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
              onClick={() => navigate('/register-tenant')}
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
