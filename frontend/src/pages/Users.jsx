import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
import { createPortal } from 'react-dom';
import { Users as UsersIcon, UserPlus, Shield, User, Edit2, Trash2, X, Clock, Search, RefreshCw } from 'lucide-react';
import { API_URL, fetchUserLogs } from '../api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState('active_users');
  const [userLogs, setUserLogs] = useState([]);
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [userRole] = useState(sessionStorage.getItem('rol') || 'admin');
  
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    contrasena: '',
    nombre_completo: '',
    rol: 'cajero'
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

  const loadUserLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await fetchUserLogs();
      setUserLogs(data);
    } catch (err) {
      console.error("Error loading user logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    if (userRole === 'admin' || userRole === 'supervisor') {
      loadUserLogs();
    }
  }, [userRole]);

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
      nombre_usuario: user.nombre_usuario,
      contrasena: '',
      nombre_completo: user.nombre_completo,
      rol: user.rol
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
        if (userRole === 'admin' || userRole === 'supervisor') {
          loadUserLogs();
        }
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
    if (!nameRegex.test(formData.nombre_completo)) {
      setError("El nombre completo debe tener al menos 3 caracteres y contener únicamente letras y espacios (sin números o símbolos).");
      return;
    }

    // Validar Usuario (mínimo 3 caracteres, letras, números y guiones bajos)
    const userRegex = /^[a-zA-Z0-9_]{3,}$/;
    if (!userRegex.test(formData.nombre_usuario)) {
      setError("El usuario debe tener al menos 3 caracteres y contener únicamente letras, números o guiones bajos (sin espacios).");
      return;
    }

    // Validar fortaleza de contraseña antes de enviar
    const password = formData.contrasena;
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
        setFormData({ nombre_usuario: '', contrasena: '', nombre_completo: '', rol: 'cajero' });
        loadUsers();
        if (userRole === 'admin' || userRole === 'supervisor') {
          loadUserLogs();
        }
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
          <UsersIcon className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>Gestión de Usuarios</span>
        </h2>
        {activeTab === 'active_users' && (
          <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center animate-fade-in w-full xl:w-auto justify-center sm:justify-end shrink-0">
            <button
              onClick={() => {
                setEditUser(null);
                setFormData({ nombre_usuario: '', contrasena: '', nombre_completo: '', rol: 'cajero' });
                setShowForm(true);
              }}
              className="flex items-center space-x-2 bg-chiluda-red text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float w-full md:w-auto justify-center font-black text-[11px] sm:text-xs uppercase tracking-wider"
            >
              <UserPlus size={16} />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        )}
      </div>

      {/* Selector de Pestañas */}
      {(userRole === 'admin' || userRole === 'supervisor') && (
        <div className="flex border-b border-stone-200/40 pb-px mb-6">
          <button
            onClick={() => setActiveTab('active_users')}
            className={`flex items-center gap-2 py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all active:scale-95 ${
              activeTab === 'active_users'
                ? 'border-chiluda-red text-brand-900'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <UsersIcon size={14} />
            <span>Usuarios Activos</span>
          </button>
          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`flex items-center gap-2 py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all active:scale-95 ${
              activeTab === 'audit_logs'
                ? 'border-chiluda-red text-brand-900'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <Clock size={14} />
            <span>Bitácora de Cambios</span>
          </button>
        </div>
      )}

      <AlertModal 
        isOpen={!!success || !!error}
        tipo={success ? 'success' : 'error'}
        mensaje={success || error}
        onClose={() => { setSuccess(''); setError(''); }}
      />

      {deleteConfirm && createPortal(
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
        </div>,
        document.body
      )}

      {showForm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
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
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_completo}
                    onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Usuario</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_usuario}
                    onChange={(e) => setFormData({...formData, nombre_usuario: e.target.value})}
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
                    value={formData.contrasena}
                    onChange={(e) => setFormData({...formData, contrasena: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                    placeholder="••••••••"
                  />
                  
                  {formData.contrasena && (
                    <div className="mt-2 space-y-1 animate-fade-in">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Fortaleza de contraseña:</span>
                        <span className={`font-bold ${
                          getPasswordStrength(formData.contrasena) === 1 ? 'text-red-500' :
                          getPasswordStrength(formData.contrasena) === 2 ? 'text-orange-500' :
                          getPasswordStrength(formData.contrasena) === 3 ? 'text-amber-500' :
                          getPasswordStrength(formData.contrasena) === 4 ? 'text-green-600' :
                          'text-gray-400'
                        }`}>
                          {getPasswordStrength(formData.contrasena) === 0 && 'Ninguna'}
                          {getPasswordStrength(formData.contrasena) === 1 && 'Muy débil'}
                          {getPasswordStrength(formData.contrasena) === 2 && 'Regular'}
                          {getPasswordStrength(formData.contrasena) === 3 && 'Buena'}
                          {getPasswordStrength(formData.contrasena) === 4 && 'Fuerte'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            getPasswordStrength(formData.contrasena) === 1 ? 'bg-red-500 w-1/4' :
                            getPasswordStrength(formData.contrasena) === 2 ? 'bg-orange-500 w-2/4' :
                            getPasswordStrength(formData.contrasena) === 3 ? 'bg-amber-400 w-3/4' :
                            getPasswordStrength(formData.contrasena) === 4 ? 'bg-green-500 w-full' :
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
                    value={formData.rol}
                    onChange={(e) => setFormData({...formData, rol: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                  >
                    <option value="cajero">Cajero (Solo Punto de Venta)</option>
                    <option value="supervisor">Supervisor (Ventas, Inventario y Cortes)</option>
                    <option value="admin">Administrador (Acceso Total)</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-gray-50/80 border-t border-gray-100 flex justify-end space-x-3 flex-shrink-0">
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
        </div>,
        document.body
      )}

      {activeTab === 'active_users' ? (
        <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
                <tr>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tl-xl">ID</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Nombre</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold text-center">Usuario</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Rol</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tr-xl">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-gray-600 text-sm md:text-base text-center">#{u.id}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                      <div className="text-sm font-bold text-gray-900">{u.nombre_completo}</div>
                      <div className="text-xs text-gray-400 sm:hidden mt-0.5">@{u.nombre_usuario}</div>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-gray-600 text-sm md:text-base text-center">{u.nombre_usuario}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1.5 inline-flex items-center text-xs font-black rounded-full border ${
                        u.rol === 'admin' ? 'bg-purple-500/10 text-purple-800 border-purple-500/20' :
                        u.rol === 'supervisor' ? 'bg-blue-500/10 text-blue-800 border-blue-500/20' :
                        'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                      }`}>
                        {u.rol === 'admin' && <Shield size={12} className="mr-1.5" />}
                        {u.rol === 'supervisor' && <Shield size={12} className="mr-1.5 text-blue-600" />}
                        {u.rol === 'cajero' && <User size={12} className="mr-1.5" />}
                        
                        {u.rol === 'admin' ? 'Administrador' : 
                         u.rol === 'supervisor' ? 'Supervisor' : 'Cajero'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                      <div className="flex items-center justify-center space-x-2 md:space-x-3">
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
                    <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <UsersIcon className="h-8 w-8 text-gray-300 mb-2" />
                        <span>No hay usuarios registrados o cargando...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up space-y-4 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="text-xs sm:text-sm font-black text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={16} />
              <span>Historial de Movimientos de Usuarios</span>
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Buscar logs..."
                  value={logsSearchTerm}
                  onChange={(e) => setLogsSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent bg-stone-50/50 focus:bg-white text-stone-850 transition-all shadow-inner"
                />
              </div>
              <button
                onClick={loadUserLogs}
                disabled={logsLoading}
                className="p-2 bg-stone-100 hover:bg-stone-250 border border-stone-200 text-stone-700 rounded-xl transition-all active:scale-95 shadow-sm"
                title="Actualizar Bitácora"
              >
                <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider border-b border-gray-100/50">
                <tr>
                  <th className="px-4 md:px-6 py-3.5 font-bold text-center border-b border-white/20">Fecha y Hora</th>
                  <th className="px-4 md:px-6 py-3.5 font-bold text-center border-b border-white/20">Acción</th>
                  <th className="px-4 md:px-6 py-3.5 font-bold text-center border-b border-white/20">Usuario Afectado</th>
                  <th className="px-4 md:px-6 py-3.5 font-bold text-center border-b border-white/20">Rol</th>
                  <th className="px-4 md:px-6 py-3.5 font-bold text-center border-b border-white/20">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50 text-xs text-stone-700">
                {userLogs
                  .filter(l => 
                    l.nombre_usuario.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
                    l.nombre_completo.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
                    l.details.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
                    l.action.toLowerCase().includes(logsSearchTerm.toLowerCase())
                  )
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-brand-50/50 transition-all duration-200">
                      <td className="px-4 md:px-6 py-3.5 text-center whitespace-nowrap text-stone-500 font-mono">
                        {new Date(log.fecha_hora).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-center">
                        <span className={`px-2.5 py-1 inline-flex text-[10px] font-black uppercase rounded-full border ${
                          log.action === 'creacion' ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20' :
                          log.action === 'actualizacion' ? 'bg-blue-500/10 text-blue-800 border-blue-500/20' :
                          'bg-red-500/10 text-red-800 border-red-500/20'
                        }`}>
                          {log.action === 'creacion' ? 'Creación' :
                           log.action === 'actualizacion' ? 'Edición' : 'Eliminación'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-center">
                        <div className="font-bold text-stone-900">{log.nombre_completo}</div>
                        <div className="text-[10px] text-stone-400 font-mono">@{log.nombre_usuario}</div>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-center">
                        <span className="text-[11px] font-semibold text-stone-500 capitalize">{log.rol}</span>
                      </td>
                      <td className="px-4 md:px-6 py-3.5 text-left max-w-xs md:max-w-sm truncate text-stone-600 font-medium" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                {userLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-stone-400 font-semibold">
                      {logsLoading ? 'Cargando bitácora...' : 'No se han registrado movimientos de usuarios.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
