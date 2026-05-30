import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      try {
        const response = await fetch('http://localhost:8000/api/auth/login', {
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
      try {
        const response = await fetch('http://localhost:8000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, full_name: fullName }),
        });
        
        if (response.ok) {
          setIsLogin(true);
          setError('Registro exitoso. Ahora puedes iniciar sesión.');
          setFullName('');
          setPassword('');
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
      {/* Elementos decorativos de fondo envolventes */}
      <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-red-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[70rem] h-[70rem] bg-chiluda-red rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[30%] left-[30%] w-[50rem] h-[50rem] bg-orange-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-chiluda-darkred to-chiluda-red p-4 rounded-2xl flex items-center justify-center w-24 h-24 shadow-float hover:scale-105 transition-transform duration-300">
            <span className="text-6xl drop-shadow-md animate-slide-up" role="img" aria-label="chile">🌶️</span>
          </div>
        </div>
        <h2 className="mt-2 text-center text-4xl font-extrabold text-brand-900 tracking-tight">
          La Chiluda en Papas
        </h2>
        <p className="mt-3 text-center text-sm font-medium text-gray-500">
          {isLogin ? 'Ingresa a tu cuenta' : 'Crea una cuenta'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="bg-white/80 backdrop-blur-xl py-10 px-6 shadow-glass sm:rounded-3xl sm:px-12 border border-white/60">
          {error && (
            <div className={`mb-4 p-2 text-sm text-center rounded ${error.includes('exitoso') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {error}
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Nombre completo
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-brand-50/50 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red focus:border-transparent focus:bg-white transition-all duration-200 sm:text-sm font-medium"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Usuario
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-brand-50/50 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red focus:border-transparent focus:bg-white transition-all duration-200 sm:text-sm font-medium"
                  placeholder="admin_chiluda"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Contraseña
              </label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-brand-50/50 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-chiluda-red focus:border-transparent focus:bg-white transition-all duration-200 sm:text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-float text-sm font-bold text-white bg-chiluda-red hover:bg-chiluda-darkred hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chiluda-red transition-all duration-300"
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
              className="text-sm text-gray-500 hover:text-chiluda-red font-semibold transition-colors"
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
