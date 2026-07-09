import { useState, useEffect } from 'react';
import { ShieldAlert, Users, CreditCard, Award, Activity, Search, RefreshCw, Trash2, Edit2, Check, X, Shield } from 'lucide-react';
import { fetchSuperAdminTenants, updateSuperAdminTenantPlan, deleteSuperAdminTenant } from '../api';

const SuperAdmin = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

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
    try {
      const data = await fetchSuperAdminTenants();
      // Filter out the primary creator tenant from the list to avoid editing it
      const customTenants = data.filter(t => t.id !== 1);
      setTenants(customTenants);
      
      // Calculate statistics
      const total = customTenants.length;
      const premium = customTenants.filter(t => t.plan_tier === 'premium').length;
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
        plan_tier: newPlan,
        subscription_status: newStatus
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
        plan_tier: planTier,
        subscription_status: newStatus
      });
      setSuccess(`Estado de suscripción actualizado a ${newStatus.toUpperCase()} con éxito.`);
      loadTenants();
    } catch (err) {
      console.error("Error updating status:", err);
      setError("No se pudo actualizar el estado de la suscripción.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    const confirmDelete = window.confirm(
      `¡ATENCIÓN CRÍTICA! ¿Estás completamente seguro de que deseas eliminar permanentemente la tienda "${tenantName}" (ID: ${tenantId})?\n\nEsta acción eliminará de forma irreversible toda su información, incluyendo usuarios, inventarios, transacciones de caja e historial de ventas.`
    );
    if (!confirmDelete) return;

    const finalConfirm = window.prompt(
      `Para proceder, escribe el nombre de la tienda exactamente igual a: "${tenantName}"`
    );
    if (finalConfirm !== tenantName) {
      alert("Confirmación incorrecta. Eliminación cancelada.");
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await deleteSuperAdminTenant(tenantId);
      setSuccess(`La tienda "${tenantName}" fue eliminada de la plataforma.`);
      loadTenants();
    } catch (err) {
      console.error("Error deleting tenant:", err);
      setError("Error al eliminar la tienda de la base de datos.");
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.subdomain && t.subdomain.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.admin_username && t.admin_username.toLowerCase().includes(searchTerm.toLowerCase()))
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
          className="flex items-center gap-2 bg-white/10 backdrop-blur-[3px] border border-white/40 text-stone-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-white/30 hover:shadow-md active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/20 text-red-700 px-4 py-3 rounded-xl backdrop-blur-[3px]">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-4 py-3 rounded-xl backdrop-blur-[3px]">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{success}</span>
        </div>
      )}

      {/* Tarjetas de Métricas de SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Tiendas Registradas</span>
            <p className="text-3xl font-black text-brand-900">{stats.total}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-700">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Planes Premium Activos</span>
            <p className="text-3xl font-black text-purple-700">{stats.premium}</p>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-600">
            <Award size={24} />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Planes Gratis / Demo</span>
            <p className="text-3xl font-black text-blue-705 text-blue-700">{stats.free}</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] border border-white/40 shadow-soft flex items-center justify-between hover:scale-[1.02] hover:bg-white/20 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Ingreso Proyectado</span>
            <p className="text-3xl font-black text-emerald-700">${stats.projectedRevenue.toLocaleString()} <span className="text-[10px] text-stone-500">MXN/mes</span></p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
            <CreditCard size={24} />
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
                    <span className="font-extrabold text-brand-900 block uppercase tracking-wide">{t.name}</span>
                    <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">{t.subdomain}</span>
                  </td>

                  {/* Administrador */}
                  <td className="px-6 py-4 text-center">
                    <span className="block text-stone-850 font-bold">{t.admin_name}</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 font-mono">{t.admin_username}</span>
                  </td>

                  {/* Registro */}
                  <td className="px-6 py-4 text-center text-stone-600 font-semibold">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A'}
                  </td>

                  {/* Inventario */}
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full font-mono text-xs border ${
                      t.product_count >= 50 && t.plan_tier === 'free'
                        ? 'text-red-700 bg-red-500/10 border-red-500/20 font-black animate-pulse'
                        : 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      {t.product_count}
                    </span>
                  </td>

                  {/* Ventas */}
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-xs bg-stone-500/10 text-stone-700 border border-stone-500/20">
                      {t.sale_count} v.
                    </span>
                  </td>

                  {/* Pagos */}
                  <td className="px-6 py-4 text-center">
                    <span className="block font-black text-stone-800">
                      {t.last_payment_date ? new Date(t.last_payment_date).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'Sin pagos'}
                    </span>
                    <span className="block text-[9px] text-stone-500 font-extrabold uppercase mt-1 tracking-wider">
                      {t.subscription_end ? `Vence: ${new Date(t.subscription_end).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}` : 'N/A'}
                    </span>
                  </td>

                  {/* Plan */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleUpdatePlan(t.id, t.plan_tier, t.subscription_status)}
                      disabled={updatingId !== null}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all shadow-sm ${
                        t.plan_tier === 'premium'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent hover:shadow-purple-500/20 hover:scale-105'
                          : 'bg-white/10 text-stone-700 border-white/30 hover:bg-white/30 hover:scale-105'
                      }`}
                    >
                      {t.plan_tier === 'premium' ? '🏆 PREMIUM (ILIMITADO)' : '🆓 GRATIS (MAX 50)'}
                    </button>
                  </td>

                  {/* Estado */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleUpdateStatus(t.id, t.plan_tier, t.subscription_status)}
                      disabled={updatingId !== null}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all shadow-sm ${
                        t.subscription_status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-800 border-emerald-500/30 hover:bg-emerald-500/30 hover:scale-105'
                          : t.subscription_status === 'trialing'
                          ? 'bg-blue-500/20 text-blue-800 border-blue-500/30 hover:bg-blue-500/30 hover:scale-105'
                          : 'bg-red-500/20 text-red-800 border-red-500/30 hover:bg-red-500/30 hover:scale-105'
                      }`}
                    >
                      {t.subscription_status === 'active' && '● ACTIVA'}
                      {t.subscription_status === 'trialing' && '● EN PRUEBA'}
                      {t.subscription_status === 'canceled' && '● SUSPENDIDA'}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDeleteTenant(t.id, t.name)}
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
    </div>
  );
};

export default SuperAdmin;
