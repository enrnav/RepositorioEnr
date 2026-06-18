import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
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
    } else {
      // Validar Nombre Completo (mínimo 3 caracteres, solo letras, espacios y acentos)
      const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.']{3,}$/;
      if (!nameRegex.test(fullName)) {
        setError("El nombre completo debe tener al menos 3 caracteres y contener únicamente letras y espacios (sin números o símbolos).");
        return;
      }

      // Validar Usuario (mínimo 3 caracteres, letras, números y guiones bajos)
      const userRegex = /^[a-zA-Z0-9_]{3,}$/;
      if (!userRegex.test(username)) {
        setError("El usuario debe tener al menos 3 caracteres y contener únicamente letras, números o guiones bajos (sin espacios).");
        return;
      }

      // Validar fortaleza de contraseña antes de enviar
      const strength = getPasswordStrength(password);
      if (strength < 4) {
        let missing = [];
        if (password.length < 12) missing.push("mínimo 12 caracteres");
        if (!/[A-Z]/.test(password)) missing.push("al menos una mayúscula");
        if (!/[0-9]/.test(password)) missing.push("al menos un número");
        if (!/[^A-Za-z0-9]/.test(password)) missing.push("al menos un carácter especial");
        setError("La contraseña no cumple con los requisitos: falta " + missing.join(", ") + ".");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, full_name: fullName }),
        });
        
        if (response.ok) {
          setIsLogin(true);
          setError('Registro exitoso. Ahora puedes iniciar sesión.');
          setFullName('');
          setPassword('');
          setUsername('');
        } else {
          const data = await response.json();
          setError(data.detail || 'Error al registrarse');
        }
      } catch (err) {
        setError('Error de conexión con el servidor');
      }
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Fondo animado de iconos de tienda flotantes */}
      <FloatingStoreIconsBg />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-6">
          <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-32 w-auto object-contain hover:scale-105 transition-transform duration-500" />
        </div>
        <h2 className="mt-2 text-center text-4xl font-black text-brand-900 tracking-tight">
          Abarrotes <span className="text-chiluda-red">ED & E</span>
        </h2>
        <p className="mt-3 text-center text-sm font-bold text-stone-500">
          {isLogin ? 'Ingresa a tu cuenta' : 'Crea una cuenta'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="bg-white/5 backdrop-blur-[2px] py-10 px-6 shadow-glass sm:rounded-[2rem] sm:px-12 border border-white/40">
          {error && (
            <div className={`mb-6 p-3.5 text-xs font-bold text-center rounded-xl border ${error.includes('exitoso') ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-chiluda-red animate-shake'}`}>
              {error}
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-xs font-black text-stone-500 uppercase tracking-wider">
                  Nombre completo
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-white/50 border border-stone-200 rounded-xl shadow-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-chiluda-red focus:bg-white transition-all duration-300 sm:text-sm font-semibold text-stone-850"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>
            )}
            
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
                  className="appearance-none block w-full px-4 py-3 bg-white/50 border border-stone-200 rounded-xl shadow-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-chiluda-red focus:bg-white transition-all duration-300 sm:text-sm font-semibold text-stone-850"
                  placeholder="admin_abarrotes"
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
                  className="appearance-none block w-full px-4 py-3 bg-white/50 border border-stone-200 rounded-xl shadow-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-chiluda-red focus:bg-white transition-all duration-300 sm:text-sm font-semibold text-stone-850"
                  placeholder="••••••••"
                />
              </div>
              
              {!isLogin && password && (
                <div className="mt-3 space-y-1.5 animate-fade-in">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-stone-500 font-bold">Fortaleza de contraseña:</span>
                    <span className={`font-black ${
                      getPasswordStrength(password) === 1 ? 'text-red-500' :
                      getPasswordStrength(password) === 2 ? 'text-orange-500' :
                      getPasswordStrength(password) === 3 ? 'text-amber-500' :
                      getPasswordStrength(password) === 4 ? 'text-emerald-600' :
                      'text-stone-400'
                    }`}>
                      {getPasswordStrength(password) === 0 && 'Ninguna'}
                      {getPasswordStrength(password) === 1 && 'Muy débil'}
                      {getPasswordStrength(password) === 2 && 'Regular'}
                      {getPasswordStrength(password) === 3 && 'Buena'}
                      {getPasswordStrength(password) === 4 && 'Fuerte'}
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        getPasswordStrength(password) === 1 ? 'bg-red-500 w-1/4' :
                        getPasswordStrength(password) === 2 ? 'bg-orange-500 w-2/4' :
                        getPasswordStrength(password) === 3 ? 'bg-amber-400 w-3/4' :
                        getPasswordStrength(password) === 4 ? 'bg-emerald-500 w-full' :
                        'w-0'
                      }`}
                    />
                  </div>
                </div>
              )}
              
              {!isLogin && (
                <p className="text-[10px] text-stone-500 leading-normal mt-2">
                  * Requisitos: Mínimo <strong>12 caracteres</strong>, una <strong>mayúscula</strong>, un <strong>número</strong> y un <strong>carácter especial</strong>.
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-float text-sm font-black text-white bg-chiluda-red hover:bg-chiluda-darkred hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chiluda-red transition-all duration-300"
              >
                {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-xs text-stone-400 hover:text-chiluda-red font-black transition-colors uppercase tracking-wider"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
