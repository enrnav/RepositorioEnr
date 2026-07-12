import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
import { createPortal } from 'react-dom';
import { ShieldAlert, Users, CreditCard, Award, Activity, Search, RefreshCw, Trash2, Edit2, Check, X, Shield, Key } from 'lucide-react';
import { fetchSuperAdminTenants, updateSuperAdminTenantPlan, deleteSuperAdminTenant, resetSuperAdminTenantPassword } from '../api';

const SuperAdmin = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  
  // Custom modal confirm states
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Reset password states
  const [resetPasswordTenant, setResetPasswordTenant] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessData, setResetSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    premium: 0,
    free: 0,
    projectedRevenue: 0
  });

  const loadTenants = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await fetchSuperAdminTenants();
      // Filter out the primary creator inquilino from the list to avoid editing it
      const customTenants = data.filter(t => t.id !== 1);
      setTenants(customTenants);
      
      // Calculate statistics
      const total = customTenants.length;
      const premium = customTenants.filter(t => t.nivel_plan === 'premium').length;
      const free = total - premium;
      const projectedRevenue = premium * 499; // Assume $499 MXN per premium store/month

      setStats({ total, premium, free, projectedRevenue });
    } catch (err) {
      console.error("Error loading tenants:", err);
      setError("Error al cargar la información de las tiendas de la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleUpdatePlan = async (tenantId, currentPlan, currentStatus) => {
    setUpdatingId(tenantId);
    setError('');
    setSuccess('');
    
    const newPlan = currentPlan === 'premium' ? 'free' : 'premium';
    const newStatus = currentPlan === 'premium' ? 'trialing' : 'active';

    try {
      await updateSuperAdminTenantPlan(tenantId, {
        nivel_plan: newPlan,
        estado_suscripcion: newStatus
      });
      setSuccess(`Plan de la tienda actualizado a ${newPlan.toUpperCase()} con éxito.`);
      loadTenants();
    } catch (err) {
      console.error("Error updating plan:", err);
      setError("No se pudo actualizar el plan de la tienda.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateStatus = async (tenantId, planTier, currentStatus) => {
    setUpdatingId(tenantId);
    setError('');
    setSuccess('');

    const newStatus = currentStatus === 'active' ? 'canceled' : 'active';

    try {
      await updateSuperAdminTenantPlan(tenantId, {
        nivel_plan: planTier,
        estado_suscripcion: newStatus
      });
      setSuccess(`Estado de suscripción actualizado a ${newStatus.toUpperCase()} con éxito.`);
      loadTenants();
    } catch (err) {
      console.error("Error updating estado:", err);
      setError("No se pudo actualizar el estado de la suscripción.");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDeleteTenant = async () => {
    if (!deleteConfirm || deleteConfirmInput !== deleteConfirm.nombre) return;
    
    const tenantId = deleteConfirm.id;
    const tenantName = deleteConfirm.nombre;
    setDeleteConfirm(null);
    setDeleteConfirmInput('');

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await deleteSuperAdminTenant(tenantId);
      setSuccess(`La tienda "${tenantName}" fue eliminada de la plataforma.`);
      loadTenants();
    } catch (err) {
      console.error("Error deleting inquilino:", err);
      setError("Error al eliminar la tienda de la base de datos.");
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const generateSecurePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const num = "0123456789";
    const spec = "!@#$%^&*";
    
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += num[Math.floor(Math.random() * num.length)];
    password += spec[Math.floor(Math.random() * spec.length)];
    
    for (let i = 0; i < 10; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    setNewPassword(password);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPasswordTenant) return;
    
    const strength = getPasswordStrength(newPassword);
    if (strength < 4) {
      setError("La contraseña no cumple con los requisitos mínimos de seguridad.");
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await resetSuperAdminTenantPassword(resetPasswordTenant.id, newPassword);
      setResetSuccessData({
        storeName: resetPasswordTenant.nombre,
        adminName: resetPasswordTenant.nombre_admin,
        adminUsername: resetPasswordTenant.usuario_admin,
        newPassword: newPassword,
        subdominio: resetPasswordTenant.subdominio
      });
      setResetPasswordTenant(null);
    } catch (err) {
      console.error("Error resetting password:", err);
      setError("No se pudo restablecer la contraseña del inquilino.");
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!resetSuccessData) return;
    const text = `Comercio: ${resetSuccessData.storeName}\nURL de Acceso: https://${resetSuccessData.subdominio}.tu-dominio.com\nUsuario Administrador: ${resetSuccessData.adminUsername}\nNueva Contraseña: ${resetSuccessData.newPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTenants = tenants.filter(t => 
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.subdominio && t.subdominio.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.usuario_admin && t.usuario_admin.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight flex items-center gap-2">
            <Shield className="text-emerald-700 w-8 h-8 shrink-0 animate-pulse" />
            <span>Consola de Administración SaaS</span>
          </h2>
          <p className="text-xs text-stone-400 font-bold mt-1 uppercase tracking-wider">
            Supervisa, habilita y administra todos los inquilinos y sus suscripciones
          </p>
        </div>
        <button
          onClick={loadTenants}
          className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      <AlertModal 
        isOpen={!!success || !!error}
        tipo={success ? 'success' : 'error'}
        mensaje={success || error}
        onClose={() => { setSuccess(''); setError(''); }}
      />

      {/* Tarjetas de Métricas de SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/20 transition-all duration-300 group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Tiendas Registradas</span>
            <p className="text-3xl font-black text-brand-900">{stats.total}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-700 group-hover:scale-110 transition-transform">
            <Users size={24} className="animate-bounce" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 hover:-translate-y-1.5 hover:shadow-xl hover:border-purple-500/20 transition-all duration-300 group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Planes Premium Activos</span>
            <p className="text-3xl font-black text-purple-700">{stats.premium}</p>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
            <Award size={24} className="animate-bounce" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300 group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Planes Gratis / Demo</span>
            <p className="text-3xl font-black text-blue-705 text-blue-700">{stats.free}</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
            <Activity size={24} className="animate-bounce" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/20 transition-all duration-300 group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Ingreso Proyectado</span>
            <p className="text-3xl font-black text-emerald-700">${stats.projectedRevenue.toLocaleString()} <span className="text-[10px] text-stone-500">MXN/mes</span></p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
            <CreditCard size={24} className="animate-bounce" />
          </div>
        </div>
      </div>

      {/* Contenedor Principal de la Tabla */}
      <div className="bg-white/10 backdrop-blur-[3px] rounded-[2rem] border border-white/40 shadow-soft overflow-hidden transition-all duration-300">
        {/* Barra de Búsqueda */}
        <div className="p-6 border-b border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5">
          <h3 className="text-sm sm:text-base font-black text-brand-900 uppercase tracking-tight">Tiendas en la Plataforma</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nombre, slug o admin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/30 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white/10 focus:bg-white/30 text-stone-750 transition-all shadow-inner placeholder-stone-400"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className="bg-emerald-500/10 text-emerald-900 text-[10px] font-black uppercase tracking-wider border-b border-white/30">
              <tr>
                <th className="px-6 py-4 font-black text-center">Tienda / Identificador</th>
                <th className="px-6 py-4 font-black text-center">Administrador</th>
                <th className="px-6 py-4 font-black text-center">Registro</th>
                <th className="px-6 py-4 font-black text-center">Inventario</th>
                <th className="px-6 py-4 font-black text-center">Ventas Realizadas</th>
                <th className="px-6 py-4 font-black text-center">Último Pago / Vencimiento</th>
                <th className="px-6 py-4 font-black text-center">Plan Suscripción</th>
                <th className="px-6 py-4 font-black text-center">Estado</th>
                <th className="px-6 py-4 font-black text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 text-xs font-bold text-stone-700">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors">
                  {/* Tienda */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-extrabold text-brand-900 block uppercase tracking-wide">{t.nombre}</span>
                    <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">{t.subdominio}</span>
                  </td>

                  {/* Administrador */}
                  <td className="px-6 py-4 text-center">
                    <span className="block text-stone-850 font-bold">{t.nombre_admin}</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 font-mono">{t.usuario_admin}</span>
                  </td>

                  {/* Registro */}
                  <td className="px-6 py-4 text-center text-stone-600 font-semibold">
                    {t.creado_en ? new Date(t.creado_en).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A'}
                  </td>

                  {/* Inventario */}
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full font-mono text-xs border ${
                      t.cantidad_productos >= 50 && t.nivel_plan === 'free'
                        ? 'text-red-700 bg-red-500/10 border-red-500/20 font-black animate-pulse'
                        : 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      {t.cantidad_productos}
                    </span>
                  </td>

                  {/* Ventas */}
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-xs bg-stone-500/10 text-stone-700 border border-stone-500/20">
                      {t.cantidad_ventas} v.
                    </span>
                  </td>

                  {/* Pagos */}
                  <td className="px-6 py-4 text-center">
                    <span className="block font-black text-stone-800">
                      {t.fecha_ultimo_pago ? new Date(t.fecha_ultimo_pago).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'Sin pagos'}
                    </span>
                    <span className="block text-[9px] text-stone-500 font-extrabold uppercase mt-1 tracking-wider">
                      {t.fin_suscripcion ? `Vence: ${new Date(t.fin_suscripcion).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}` : 'N/A'}
                    </span>
                  </td>

                  {/* Plan */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleUpdatePlan(t.id, t.nivel_plan, t.estado_suscripcion)}
                      disabled={updatingId !== null}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all shadow-sm ${
                        t.nivel_plan === 'premium'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent hover:shadow-purple-500/20 hover:scale-105'
                          : 'bg-white/10 text-stone-700 border-white/30 hover:bg-white/30 hover:scale-105'
                      }`}
                    >
                      {t.nivel_plan === 'premium' ? '🏆 PREMIUM (ILIMITADO)' : '🆓 GRATIS (MAX 50)'}
                    </button>
                  </td>

                  {/* Estado */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleUpdateStatus(t.id, t.nivel_plan, t.estado_suscripcion)}
                      disabled={updatingId !== null}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all shadow-sm ${
                        t.estado_suscripcion === 'active'
                          ? 'bg-emerald-500/20 text-emerald-800 border-emerald-500/30 hover:bg-emerald-500/30 hover:scale-105'
                          : t.estado_suscripcion === 'trialing'
                          ? 'bg-blue-500/20 text-blue-800 border-blue-500/30 hover:bg-blue-500/30 hover:scale-105'
                          : 'bg-red-500/20 text-red-800 border-red-500/30 hover:bg-red-500/30 hover:scale-105'
                      }`}
                    >
                      {t.estado_suscripcion === 'active' && '● ACTIVA'}
                      {t.estado_suscripcion === 'trialing' && '● EN PRUEBA'}
                      {t.estado_suscripcion === 'canceled' && '● SUSPENDIDA'}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => {
                        setResetPasswordTenant(t);
                        setNewPassword('');
                      }}
                      className="p-2 text-stone-450 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-xl transition-all active:scale-90 cursor-pointer border border-transparent hover:border-emerald-200 mr-1"
                      title="Restablecer Contraseña Admin"
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirm({ id: t.id, nombre: t.nombre });
                        setDeleteConfirmInput('');
                      }}
                      className="p-2 text-stone-450 hover:text-red-650 hover:bg-red-500/10 rounded-xl transition-all active:scale-90 cursor-pointer border border-transparent hover:border-red-200"
                      title="Eliminar Tienda Completa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-stone-400 font-semibold">
                    {loading ? 'Cargando información...' : 'No se encontraron tiendas registradas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Venta Emergente de Eliminación Crítica */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full border border-stone-200 shadow-2xl animate-scale-up space-y-6">
            <div>
              <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-2">¡ATENCIÓN CRÍTICA!</h3>
              <p className="text-xs font-bold text-stone-600 leading-relaxed">
                ¿Estás completamente seguro de que deseas eliminar permanentemente la tienda <strong className="text-stone-900">"{deleteConfirm.nombre}"</strong> (ID: {deleteConfirm.id})?
              </p>
              <p className="text-xs font-semibold text-red-500 mt-2 leading-relaxed">
                Esta acción eliminará de forma irreversible toda su información, incluyendo usuarios, inventarios, transacciones de caja e historial de ventas.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider block">
                Para confirmar la eliminación, escribe el nombre de la tienda exactamente:
              </label>
              <input
                type="text"
                placeholder={deleteConfirm.nombre}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-semibold text-stone-700 text-xs shadow-inner"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteConfirmInput('');
                }}
                className="flex-1 py-3 px-4 border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteTenant}
                disabled={deleteConfirmInput !== deleteConfirm.nombre}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:shadow-none disabled:cursor-not-allowed"
              >
                Eliminar Tienda
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Venta Emergente de Restablecimiento de Contraseña */}
      {resetPasswordTenant && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full border border-stone-200 shadow-2xl animate-scale-up space-y-6">
            <div>
              <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Key size={16} />
                <span>Restablecer Contraseña Admin</span>
              </h3>
              <p className="text-xs font-bold text-stone-600 leading-relaxed">
                Estás a punto de cambiar la contraseña de administrador para la tienda <strong className="text-stone-900">"{resetPasswordTenant.nombre}"</strong>.
              </p>
              <div className="mt-2 p-3 bg-stone-50 border border-stone-150 rounded-xl space-y-1 text-[11px] font-semibold text-stone-500">
                <p>Usuario: <strong className="text-stone-700 font-mono">@{resetPasswordTenant.usuario_admin}</strong></p>
                <p>Nombre: <strong className="text-stone-700">{resetPasswordTenant.nombre_admin}</strong></p>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider block">
                  Nueva Contraseña:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Contraseña de al menos 12 caracteres..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold text-stone-700 text-xs shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                  >
                    Generar
                  </button>
                </div>

                {newPassword && (
                  <div className="mt-2 space-y-1 animate-fade-in">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-stone-500 font-bold">Fortaleza:</span>
                      <span className={`font-black uppercase ${
                        getPasswordStrength(newPassword) === 1 ? 'text-red-500' :
                        getPasswordStrength(newPassword) === 2 ? 'text-orange-500' :
                        getPasswordStrength(newPassword) === 3 ? 'text-amber-500' :
                        getPasswordStrength(newPassword) === 4 ? 'text-emerald-700' :
                        'text-stone-400'
                      }`}>
                        {getPasswordStrength(newPassword) === 0 && 'Ninguna'}
                        {getPasswordStrength(newPassword) === 1 && 'Muy débil'}
                        {getPasswordStrength(newPassword) === 2 && 'Regular'}
                        {getPasswordStrength(newPassword) === 3 && 'Buena'}
                        {getPasswordStrength(newPassword) === 4 && 'Fuerte (Segura)'}
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          getPasswordStrength(newPassword) === 1 ? 'bg-red-500 w-1/4' :
                          getPasswordStrength(newPassword) === 2 ? 'bg-orange-500 w-2/4' :
                          getPasswordStrength(newPassword) === 3 ? 'bg-amber-400 w-3/4' :
                          getPasswordStrength(newPassword) === 4 ? 'bg-emerald-500 w-full' :
                          'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTenant(null)}
                  className="flex-1 py-3 px-4 border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={getPasswordStrength(newPassword) < 4}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:shadow-none disabled:cursor-not-allowed"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Venta Emergente de Credenciales Copiables */}
      {resetSuccessData && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full border border-stone-200 shadow-2xl animate-scale-up space-y-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="p-4 bg-emerald-500/15 text-emerald-700 rounded-full animate-bounce">
                <Check size={28} />
              </div>
              <h3 className="text-base font-black text-emerald-800 uppercase tracking-widest">¡Contraseña Restablecida!</h3>
              <p className="text-xs font-semibold text-stone-500 leading-relaxed">
                La contraseña ha sido actualizada. Comparte estas credenciales con el administrador de la tienda.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-150 rounded-[1.5rem] p-5 space-y-3 text-left font-semibold text-xs text-stone-600">
              <div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Comercio:</span>
                <span className="text-stone-850 font-extrabold">{resetSuccessData.storeName}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">URL de Acceso:</span>
                <a 
                  href={`https://${resetSuccessData.subdominio}.tu-dominio.com`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-emerald-700 hover:underline font-mono"
                >
                  https://{resetSuccessData.subdominio}.tu-dominio.com
                </a>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Usuario Admin:</span>
                  <span className="text-stone-850 font-mono">@{resetSuccessData.adminUsername}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Nueva Contraseña:</span>
                  <span className="text-stone-850 font-mono select-all bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{resetSuccessData.newPassword}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={copyCredentials}
                className="flex-1 py-3 px-4 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span>{copied ? '¡Copiado!' : 'Copiar Credenciales'}</span>
              </button>
              <button
                type="button"
                onClick={() => setResetSuccessData(null)}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SuperAdmin;
