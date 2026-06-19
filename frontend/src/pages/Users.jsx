import { useState, useEffect } from 'react';
import { Users as UsersIcon, UserPlus, Shield, User, Edit2, Trash2, X } from 'lucide-react';
import { API_URL } from '../api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'cajero'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error loading users', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // No auto-dismiss for errors so users have time to read detailed validation requirements

  const handleEditClick = (user) => {
    setEditUser(user.id);
    setFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      role: user.role
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      const response = await fetch(`${API_URL}/auth/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        setSuccess('Usuario eliminado exitosamente');
        loadUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Error al eliminar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validar Nombre Completo (mínimo 3 caracteres, solo letras, espacios y acentos)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.']{3,}$/;
    if (!nameRegex.test(formData.full_name)) {
      setError("El nombre completo debe tener al menos 3 caracteres y contener únicamente letras y espacios (sin números o símbolos).");
      return;
    }

    // Validar Usuario (mínimo 3 caracteres, letras, números y guiones bajos)
    const userRegex = /^[a-zA-Z0-9_]{3,}$/;
    if (!userRegex.test(formData.username)) {
      setError("El usuario debe tener al menos 3 caracteres y contener únicamente letras, números o guiones bajos (sin espacios).");
      return;
    }

    // Validar fortaleza de contraseña antes de enviar
    const password = formData.password;
    if (!password) {
      setError("La contraseña no puede estar vacía.");
      return;
    }

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
      const url = editUser 
        ? `${API_URL}/auth/users/${editUser}`
        : `${API_URL}/auth/register`;
      const method = editUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(editUser ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
        setShowForm(false);
        setEditUser(null);
        setFormData({ username: '', password: '', full_name: '', role: 'cajero' });
        loadUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Error al guardar usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <h2 className="text-2xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center whitespace-nowrap">
          <UsersIcon className="mr-3 text-chiluda-red w-8 h-8" />
          Gestión de Usuarios
        </h2>
        <div className="flex flex-row flex-nowrap overflow-x-auto pb-2 lg:pb-0 gap-3 items-center animate-fade-in w-full lg:w-auto justify-start lg:justify-end shrink-0">
          <button
            onClick={() => {
              setEditUser(null);
              setFormData({ username: '', password: '', full_name: '', role: 'cajero' });
              setShowForm(true);
            }}
            className="flex items-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float w-full md:w-auto justify-center font-black text-xs uppercase tracking-wider"
          >
            <UserPlus size={16} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up border border-red-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Aviso</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">{error}</p>
              <button
                onClick={() => setError('')}
                className="px-6 py-2.5 bg-chiluda-red text-white font-bold rounded-md w-full hover:bg-chiluda-darkred transition-colors shadow-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up border border-green-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¡Éxito!</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">{success}</p>
              <button
                onClick={() => setSuccess('')}
                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-md w-full hover:bg-green-700 transition-colors shadow-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar registro?</h3>
              <p className="text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors w-full font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirm)}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors w-full font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-soft w-full max-w-md overflow-hidden border border-white animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                {editUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
              </h3>
              <button 
                onClick={() => { setShowForm(false); setEditUser(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Usuario</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                  placeholder="Ej. juanp"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                  placeholder="••••••••"
                />
                
                {formData.password && (
                  <div className="mt-2 space-y-1 animate-fade-in">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Fortaleza de contraseña:</span>
                      <span className={`font-bold ${
                        getPasswordStrength(formData.password) === 1 ? 'text-red-500' :
                        getPasswordStrength(formData.password) === 2 ? 'text-orange-500' :
                        getPasswordStrength(formData.password) === 3 ? 'text-amber-500' :
                        getPasswordStrength(formData.password) === 4 ? 'text-green-600' :
                        'text-gray-400'
                      }`}>
                        {getPasswordStrength(formData.password) === 0 && 'Ninguna'}
                        {getPasswordStrength(formData.password) === 1 && 'Muy débil'}
                        {getPasswordStrength(formData.password) === 2 && 'Regular'}
                        {getPasswordStrength(formData.password) === 3 && 'Buena'}
                        {getPasswordStrength(formData.password) === 4 && 'Fuerte'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          getPasswordStrength(formData.password) === 1 ? 'bg-red-500 w-1/4' :
                          getPasswordStrength(formData.password) === 2 ? 'bg-orange-500 w-2/4' :
                          getPasswordStrength(formData.password) === 3 ? 'bg-amber-400 w-3/4' :
                          getPasswordStrength(formData.password) === 4 ? 'bg-green-500 w-full' :
                          'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-[11px] text-gray-500 leading-normal mt-2">
                  * La contraseña debe tener al menos <strong>12 caracteres</strong>, incluir letras <strong>mayúsculas</strong>, <strong>números</strong> y <strong>caracteres especiales</strong>.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Rol</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                >
                  <option value="cajero">Cajero (Solo Punto de Venta)</option>
                  <option value="supervisor">Supervisor (Ventas, Inventario y Cortes)</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>
              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditUser(null); }}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-full hover:bg-white hover:text-chiluda-red hover:border-chiluda-red/30 transition-all text-xs font-bold shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-chiluda-red text-white rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all shadow-float text-xs font-black"
                >
                  {editUser ? 'Actualizar Usuario' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-[2px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
              <tr>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold rounded-tl-xl">ID</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold">Nombre</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold">Usuario</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold">Rol</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-right rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                  <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-gray-600 text-sm md:text-base">#{u.id}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="text-sm font-bold text-gray-900">{u.full_name}</div>
                    <div className="text-xs text-gray-400 sm:hidden mt-0.5">@{u.username}</div>
                  </td>
                  <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-gray-600 text-sm md:text-base">{u.username}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <span className={`px-3 py-1.5 inline-flex items-center text-xs font-black rounded-full border ${
                      u.role === 'admin' ? 'bg-purple-500/10 text-purple-800 border-purple-500/20' :
                      u.role === 'supervisor' ? 'bg-blue-500/10 text-blue-800 border-blue-500/20' :
                      'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                    }`}>
                      {u.role === 'admin' && <Shield size={12} className="mr-1.5" />}
                      {u.role === 'supervisor' && <Shield size={12} className="mr-1.5 text-blue-600" />}
                      {u.role === 'cajero' && <User size={12} className="mr-1.5" />}
                      
                      {u.role === 'admin' ? 'Administrador' : 
                       u.role === 'supervisor' ? 'Supervisor' : 'Cajero'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center justify-end space-x-2 md:space-x-3">
                      <button 
                        onClick={() => handleEditClick(u)}
                        className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 p-2.5 rounded-xl transition-all"
                        title="Editar usuario"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="text-gray-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 p-2.5 rounded-xl transition-all"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500 flex flex-col items-center">
                    <UsersIcon className="h-8 w-8 text-gray-300 mb-2" />
                    No hay usuarios registrados o cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
