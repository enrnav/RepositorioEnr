import { useState, useEffect, useLayoutEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Bell, 
  LogOut, 
  ShoppingCart, 
  Users, 
  Menu, 
  X, 
  Leaf, 
  Keyboard, 
  Receipt, 
  Truck, 
  ClipboardList, 
  Settings as SettingsIcon, 
  UserCheck,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { fetchInventory, fetchActiveShift, fetchStoreSettings, createCheckoutSession } from '../api';
import FloatingStoreIconsBg from './FloatingStoreIconsBg';


const CustomLeaf = ({ className }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className} 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M 50 5 C 85 25, 95 65, 50 95 C 5 65, 15 25, 50 5 Z" />
    <line x1="50" y1="5" x2="50" y2="95" strokeWidth="1.8" />
    <line x1="50" y1="25" x2="78" y2="40" />
    <line x1="50" y1="25" x2="22" y2="40" />
    
    <line x1="50" y1="45" x2="84" y2="60" />
    <line x1="50" y1="45" x2="16" y2="60" />
    
    <line x1="50" y1="65" x2="80" y2="80" />
    <line x1="50" y1="65" x2="20" y2="80" />
    
    <line x1="50" y1="80" x2="65" y2="90" />
    <line x1="50" y1="80" x2="35" y2="90" />
  </svg>
);

const Layout = () => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const getCachedSettings = () => {
    try {
      const uStr = sessionStorage.getItem('user');
      const u = uStr ? JSON.parse(uStr) : null;
      const currentInquilinoId = u?.inquilino_id;

      const cached = localStorage.getItem('cached_store_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!currentInquilinoId || !parsed.inquilino_id || parsed.inquilino_id === currentInquilinoId) {
          return parsed;
        }
      }

      const tbStr = localStorage.getItem('cached_tenant_branding');
      if (tbStr) {
        const tb = JSON.parse(tbStr);
        if (!currentInquilinoId || !tb.inquilino_id || tb.inquilino_id === currentInquilinoId) {
          return {
            nombre_tienda: tb.storeName || 'ABARROTES ED & E',
            color_primario: tb.primaryColor || '#064E3B',
            color_secundario: tb.accentColor || '#064E3B',
            logo_url: tb.logoUrl || null,
            inquilino_id: currentInquilinoId
          };
        }
      }
    } catch (e) {}
    return {
      nombre_tienda: 'ABARROTES ED & E',
      color_primario: '#064E3B',
      color_secundario: '#064E3B'
    };
  };

  const [storeSettings, setStoreSettings] = useState(getCachedSettings());
  
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { rol: 'cajero', nombre_usuario: '', nombre_completo: '', inquilino_id: 1, estado_suscripcion: 'active' };
  
  const isAdmin = user.rol === 'admin';
  const isStaff = user.rol === 'admin' || user.rol === 'supervisor';

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handleSubscriptionPayment = async () => {
    setPaying(true);
    setPayError('');
    try {
      const response = await createCheckoutSession();
      if (response && response.url) {
        window.location.href = response.url;
      } else {
        setPayError('Ocurrió un problema al obtener la pasarela de pagos.');
      }
    } catch (err) {
      console.error(err);
      setPayError('Error de red. No se pudo iniciar el proceso de pago.');
    } finally {
      setPaying(false);
    }
  };

  const isSuspended = (user.estado_suscripcion === 'suspended' || user.estado_suscripcion === 'canceled') && user.inquilino_id !== 1;
  const isBranded = user.inquilino_id && user.inquilino_id !== 1;

  const checkStock = async () => {
    try {
      const inventory = await fetchInventory();
      const lowStock = inventory.filter(item => item.cantidad <= (item.inventario_minimo ?? 3));
      setLowStockItems(lowStock);
    } catch (err) {
      console.error("Error fetching inventory for notifications", err);
    }
  };

  const checkShift = async () => {
    try {
      const res = await fetchActiveShift();
      setActiveShift(res);
    } catch (err) {
      console.error("Error fetching active shift in layout", err);
    }
  };

  const checkStoreSettings = async () => {
    try {
      const data = await fetchStoreSettings();
      if (data && data.nombre_tienda) {
        const settingsWithTenant = { ...data, inquilino_id: user.inquilino_id };
        setStoreSettings(settingsWithTenant);
        localStorage.setItem('cached_store_settings', JSON.stringify(settingsWithTenant));
      }
    } catch (err) {
      console.error("Error fetching settings in layout:", err);
    }
  };

  useEffect(() => {
    if (isStaff) {
      checkStock();
      const intervalId = setInterval(checkStock, 60000); // Check every minute
      return () => clearInterval(intervalId);
    }
  }, [isStaff]);

  useEffect(() => {
    checkShift();
    checkStoreSettings();
    window.addEventListener("shiftChanged", checkShift);
    window.addEventListener("store_settings_updated", checkStoreSettings);
    return () => {
      window.removeEventListener("shiftChanged", checkShift);
      window.removeEventListener("store_settings_updated", checkStoreSettings);
    };
  }, []);

  useLayoutEffect(() => {
    // Hex to RGB Helper
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

    if (isBranded) {
      const pColor = storeSettings.color_primario || '#064E3B';
      const aColor = storeSettings.color_secundario || '#064E3B';
      const pRgb = hexToRgb(pColor);
      const aRgb = hexToRgb(aColor);

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
      
      document.documentElement.style.setProperty('--primary-color', pColor);
      if (pRgb) {
        document.documentElement.style.setProperty('--primary-color-light', `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.08)`);
        document.documentElement.style.setProperty('--primary-color-surface', `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.35)`);
        
        const pLum = (pRgb.r * 299 + pRgb.g * 587 + pRgb.b * 114) / 1000;
        const isLightColor = pLum > 140;
        document.documentElement.style.setProperty('--primary-text-color', isLightColor ? '#111827' : '#ffffff');
        document.documentElement.style.setProperty('--primary-text-muted', isLightColor ? 'rgba(17, 24, 39, 0.65)' : 'rgba(255, 255, 255, 0.7)');
        document.documentElement.style.setProperty('--primary-sidebar-active-bg', isLightColor ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)');
        document.documentElement.style.setProperty('--primary-sidebar-hover-bg', isLightColor ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)');
        document.documentElement.style.setProperty('--primary-sidebar-border', isLightColor ? 'rgba(17, 24, 39, 0.1)' : 'rgba(255, 255, 255, 0.1)');
      } else {
        document.documentElement.style.setProperty('--primary-color-light', 'rgba(59, 130, 246, 0.08)');
        document.documentElement.style.setProperty('--primary-color-surface', 'rgba(255, 255, 255, 0.08)');
        document.documentElement.style.setProperty('--primary-text-color', '#ffffff');
        document.documentElement.style.setProperty('--primary-text-muted', 'rgba(255, 255, 255, 0.7)');
        document.documentElement.style.setProperty('--primary-sidebar-active-bg', 'rgba(255, 255, 255, 0.1)');
        document.documentElement.style.setProperty('--primary-sidebar-hover-bg', 'rgba(255, 255, 255, 0.05)');
        document.documentElement.style.setProperty('--primary-sidebar-border', 'rgba(255, 255, 255, 0.1)');
      }

      document.documentElement.style.setProperty('--accent-color', aColor);
      document.documentElement.style.setProperty('--accent-color-hover', aColor);
      if (aRgb) {
        document.documentElement.style.setProperty('--accent-color-light', `rgba(${aRgb.r}, ${aRgb.g}, ${aRgb.b}, 0.08)`);
        const lum = (aRgb.r * 299 + aRgb.g * 587 + aRgb.b * 114) / 1000;
        document.documentElement.style.setProperty('--accent-text-color', lum > 140 ? '#111827' : '#ffffff');
      } else {
        document.documentElement.style.setProperty('--accent-color-light', 'rgba(5, 150, 105, 0.08)');
        document.documentElement.style.setProperty('--accent-text-color', '#ffffff');
      }
    } else {
      document.body.classList.remove('branded-dark-theme');
      document.documentElement.classList.remove('branded-dark-theme');
      
      // Reset variables to the creator's default green/light palette
      document.documentElement.style.setProperty('--primary-color', '#064E3B');
      document.documentElement.style.setProperty('--primary-color-light', 'rgba(59, 130, 246, 0.08)');
      document.documentElement.style.setProperty('--body-bg-color', '#f3f6f4');
      document.documentElement.style.setProperty('--accent-color', '#064E3B');
      document.documentElement.style.setProperty('--accent-color-hover', '#059669');
      document.documentElement.style.setProperty('--accent-color-light', 'rgba(5, 150, 105, 0.08)');
      document.documentElement.style.setProperty('--primary-text-color', '#ffffff');
      document.documentElement.style.setProperty('--primary-text-muted', 'rgba(255, 255, 255, 0.7)');
      document.documentElement.style.setProperty('--primary-sidebar-active-bg', 'rgba(255, 255, 255, 0.1)');
      document.documentElement.style.setProperty('--primary-sidebar-hover-bg', 'rgba(255, 255, 255, 0.05)');
      document.documentElement.style.setProperty('--primary-sidebar-border', 'rgba(255, 255, 255, 0.1)');
    }
  }, [storeSettings, user.inquilino_id]);

  const navItems = [
    { name: 'Panel', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Punto de Venta', path: '/sales', icon: ShoppingCart, allowedRoles: ['admin', 'supervisor', 'cajero'] },
    { name: 'Clientes', path: '/customers', icon: UserCheck, allowedRoles: ['admin', 'supervisor', 'cajero'] },
    { name: 'Inventario', path: '/inventory', icon: Package, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Compras', path: '/purchases', icon: ClipboardList, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Proveedores', path: '/suppliers', icon: Truck, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Facturación', path: '/billing', icon: Receipt, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Usuarios', path: '/users', icon: Users, allowedRoles: ['admin'] },
    { name: 'Ajustes', path: '/settings', icon: SettingsIcon, allowedRoles: ['admin', 'supervisor'] },
  ];

  if (user.inquilino_id === 1) {
    navItems.push({ name: 'Consola SaaS', path: '/superadmin', icon: Shield, allowedRoles: ['admin'] });
  }

  const renderHotkeys = () => {
    if (location.pathname !== '/sales') return null;
    return (
      <div className="hidden xl:flex items-center gap-4 bg-stone-50 border border-stone-200/60 px-3.5 py-1.5 rounded-full text-[11px] text-stone-500 shadow-sm mr-4 select-none">
        <span className="font-extrabold tracking-wider uppercase text-[9px] text-stone-400 flex items-center gap-1.5">
          <Keyboard size={13} className="text-stone-400" />
          Teclas Rápidas:
        </span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded shadow-sm font-mono font-bold text-[9px] text-stone-600">F1</kbd>
          <span>Buscar</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded shadow-sm font-mono font-bold text-[9px] text-stone-600">F2</kbd>
          <span>Cobrar</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded shadow-sm font-mono font-bold text-[9px] text-stone-600">F4</kbd>
          <span>Limpiar</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded shadow-sm font-mono font-bold text-[9px] text-stone-600">Esc</kbd>
          <span>Cerrar</span>
        </div>
      </div>
    );
  };

  const renderShiftBadge = () => {
    if (activeShift) {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 text-emerald-800 px-4 py-2 rounded-full text-xs font-black border border-emerald-500/20 mr-4 shadow-[0_2px_12px_rgba(16,185,129,0.06)] backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Caja Abierta (Fondo: ${activeShift.efectivo_inicial.toFixed(2)})</span>
        </div>
      );
    } else if (isAdmin) {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-blue-500/10 text-blue-800 px-4 py-2 rounded-full text-xs font-black border border-blue-500/20 mr-4 shadow-[0_2px_12px_rgba(59,130,246,0.06)] backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Modo Admin (Sin Caja)</span>
        </div>
      );
    } else {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-amber-500/10 text-amber-800 px-4 py-2 rounded-full text-xs font-black border border-amber-500/20 mr-4 animate-pulse shadow-[0_2px_12px_rgba(245,158,11,0.06)] backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Caja Cerrada</span>
        </div>
      );
    }
  };

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
        {/* Background animation or leaf decoration */}
        <FloatingStoreIconsBg color={isBranded && storeSettings.color_secundario ? storeSettings.color_secundario + '15' : undefined} />
        
        <div className="w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-stone-200/60 shadow-xl p-10 text-center space-y-6 relative z-10 animate-scale-up">
          <div className="flex justify-center">
            <div className="p-5 bg-amber-50 rounded-full text-amber-500 animate-pulse border border-amber-200/60">
              <ShieldAlert size={42} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-brand-900 tracking-tight">Suscripción Pendiente de Renovación</h2>
            <p className="text-[10px] text-amber-600 font-extrabold uppercase tracking-widest leading-none">Cuenta Temporalmente en Espera (Standby)</p>
          </div>

          <div className="text-xs font-semibold text-stone-500 leading-relaxed max-w-md mx-auto space-y-3">
            <p>
              Estimado administrador de <span className="font-extrabold text-brand-900 uppercase">{storeSettings.nombre_tienda}</span>:
            </p>
            <p>
              Queremos informarte cordialmente que el periodo de facturación de tu Punto de Venta mensual ha finalizado. 
              Para continuar disfrutando de la carga ilimitada de productos, reportes fiscales, facturación CFDI 4.0 y control de turnos de caja, te invitamos a renovar tu suscripción.
            </p>
          </div>

          {payError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-bold text-left">
              {payError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <button
              onClick={() => {
                if (user && user.inquilino_id === 1) {
                  localStorage.removeItem('last_tenant_subdomain');
                  localStorage.removeItem('cached_tenant_branding');
                }
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="px-6 py-3 border border-stone-200 text-stone-600 font-bold rounded-xl text-xs hover:bg-stone-50 transition-all active:scale-95 cursor-pointer"
            >
              Cerrar Sesión
            </button>
            <button
              onClick={handleSubscriptionPayment}
              disabled={paying}
              className="flex-1 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {paying ? 'Preparando pasarela...' : 'Pagar Suscripción Mensual ($499 MXN)'}
            </button>
          </div>

          <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">
            Soporte Técnico: soporte@abarrotes-saas.com
          </p>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    // Layout for normal Cajero (no sidebar, full screen POS)
    return (
      <div className="flex flex-col h-screen w-screen max-w-full overflow-hidden bg-transparent font-sans selection:bg-[#d1fae5] selection:text-[#064e3b] relative">
        {/* Background floating store icons animation */}
        <FloatingStoreIconsBg color={isBranded && storeSettings.color_secundario ? storeSettings.color_secundario + '20' : undefined} />

        <header className="h-20 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm border-b border-gray-100 relative">
          <div className="flex items-center space-x-3 shrink-0 select-none">
            <img src={storeSettings.logo_url || "/logo.png?v=4"} alt={`${storeSettings.nombre_tienda} Logo`} className="h-16 w-auto object-contain animate-fade-in drop-shadow-sm rounded-lg" />
            <div className="hidden sm:flex flex-col items-start max-w-[140px] lg:max-w-[180px]">
              <span className="text-sm font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.nombre_tienda}</span>
            </div>

            <nav className="flex items-center space-x-1.5 ml-2 border-l border-stone-200/60 pl-3">
              <Link
                to="/sales"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                  location.pathname === '/sales'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <ShoppingCart size={16} />
                <span className="hidden sm:inline">Ventas</span>
              </Link>
              <Link
                to="/customers"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                  location.pathname === '/customers'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <UserCheck size={16} />
                <span className="hidden sm:inline">Crédito / Clientes</span>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center">
            {renderHotkeys()}
            {renderShiftBadge()}
            
            <div className="hidden sm:flex flex-col items-end mr-4 text-right">
              <span className="text-xs font-semibold text-stone-700 truncate max-w-[160px] block leading-tight">{user.nombre_completo}</span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Cajero</span>
            </div>

            <button
              onClick={() => {
                if (user && user.inquilino_id === 1) {
                  localStorage.removeItem('last_tenant_subdomain');
                  localStorage.removeItem('cached_tenant_branding');
                }
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="flex items-center space-x-1.5 px-2.5 py-2 sm:space-x-2 sm:px-5 sm:py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 shrink-0 cursor-pointer"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="font-semibold text-xs sm:text-sm whitespace-nowrap hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8 relative z-10">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  // Layout for Staff (Admin and Supervisor, includes sidebar and notifications)
  return (
    <div className="flex h-screen w-screen max-w-full overflow-hidden bg-transparent font-sans selection:bg-chiluda-lightred selection:text-chiluda-red relative">
      {/* Background floating store icons animation */}
      <FloatingStoreIconsBg color={isBranded && storeSettings.color_secundario ? storeSettings.color_secundario + '20' : undefined} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 w-72 shadow-2xl flex flex-col z-50 lg:z-10 transition-all duration-300`}
        style={{
          backgroundColor: storeSettings.color_primario || '#064e3b'
        }}
      >
        {/* Mobile Sidebar Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 text-stone-500 hover:text-brand-900 hover:bg-stone-100 rounded-xl transition-all duration-200 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>

        <div className="h-20 flex items-center space-x-3 px-6 border-b border-stone-200 select-none bg-white flex-shrink-0">
          <img src={storeSettings.logo_url || "/logo.png?v=4"} alt={`${storeSettings.nombre_tienda} Logo`} className="h-16 w-auto object-contain animate-fade-in rounded-lg" />
          <div className="flex flex-col items-start max-w-[180px]">
            <span className="text-sm font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.nombre_tienda}</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.allowedRoles.includes(user.rol)) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className="group relative flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300"
                style={{
                  backgroundColor: isActive ? 'var(--primary-sidebar-active-bg)' : 'transparent',
                  color: isActive ? 'var(--primary-text-color)' : 'var(--primary-text-muted)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--primary-sidebar-hover-bg)';
                    e.currentTarget.style.color = 'var(--primary-text-color)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--primary-text-muted)';
                  }
                }}
              >
                <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-bold text-sm tracking-wide uppercase">{item.name}</span>
                {isActive && (
                  <span className="absolute left-1.5 top-1/3 bottom-1/3 w-1 rounded-full" style={{ backgroundColor: 'var(--primary-text-color)' }}></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t flex flex-col gap-2 flex-shrink-0" style={{ borderColor: 'var(--primary-sidebar-border)' }}>
          <div 
            className="px-4 py-3 rounded-xl text-xs flex flex-col border" 
            style={{ 
              backgroundColor: 'var(--primary-sidebar-hover-bg)', 
              borderColor: 'var(--primary-sidebar-border)' 
            }}
          >
            <span className="font-black text-sm" style={{ color: 'var(--primary-text-color)' }}>{user.nombre_completo}</span>
            <span className="uppercase text-[9px] font-black mt-1 tracking-wider" style={{ color: 'var(--primary-text-color)', opacity: 0.75 }}>{user.rol === 'admin' ? 'Administrador' : 'Supervisor'}</span>
          </div>
          <span className="text-[9px] text-center mt-2 font-black select-none tracking-widest uppercase opacity-45" style={{ color: 'var(--primary-text-color)' }}>
            © {new Date().getFullYear()} SaaS SCORPION.
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10 lg:z-20 bg-transparent">
        {/* Header */}
        <header className="h-20 glass sticky top-0 flex items-center justify-between px-4 lg:px-8 z-10 shadow-sm border-b border-stone-200/30 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-stone-500 hover:text-[#064e3b] transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center space-x-2 lg:hidden select-none">
              <img src={storeSettings.logo_url || "/logo.png?v=4"} alt={`${storeSettings.nombre_tienda} Logo`} className="h-12 w-auto object-contain animate-fade-in rounded-lg" />
              <div className="hidden sm:flex flex-col items-start max-w-[140px]">
                <span className="text-xs font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.nombre_tienda}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex justify-end items-center relative">
            {renderHotkeys()}
            {renderShiftBadge()}

            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 text-stone-400 hover:text-chiluda-red transition-colors relative hover:bg-stone-100 rounded-full"
            >
              <Bell size={20} />
              {lowStockItems.length > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-chiluda-red rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            <div className="hidden sm:flex flex-col items-end mr-4 text-right select-none ml-4">
              <span className="text-xs font-semibold text-stone-700 truncate max-w-[160px] block leading-tight">{user.nombre_completo}</span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                {user.rol === 'admin' ? 'Administrador' : 'Supervisor'}
              </span>
            </div>

            <button
              onClick={() => {
                if (user && user.inquilino_id === 1) {
                  localStorage.removeItem('last_tenant_subdomain');
                }
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="flex items-center space-x-1.5 px-2.5 py-2 sm:space-x-2 sm:px-4 sm:py-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 shrink-0 cursor-pointer"
            >
              <LogOut size={18} className="shrink-0" />
              <span className="font-semibold text-xs sm:text-sm whitespace-nowrap hidden lg:inline">Cerrar Sesión</span>
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setShowNotifications(false)} 
                />
                <div className="absolute right-0 top-full mt-3 w-80 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-glass border border-stone-200/50 overflow-hidden z-50 animate-slide-up">
                  <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <h3 className="font-bold text-stone-800 text-sm">Alertas de Stock</h3>
                    <span className="text-xs bg-chiluda-red/10 text-chiluda-red px-2 py-1 rounded-full font-black">{lowStockItems.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {lowStockItems.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs font-semibold">
                        <div className="flex justify-center mb-3">
                          <Package size={28} className="opacity-30 text-stone-400" />
                        </div>
                        Todos los productos tienen stock suficiente.
                      </div>
                    ) : (
                      lowStockItems.map(item => (
                        <div key={item.id} className="p-4 border-b border-stone-50 hover:bg-chiluda-lightred/50 transition-colors">
                          <p className="text-xs text-stone-850">
                            Stock bajo en: <span className="font-extrabold text-chiluda-red">{item.name}</span>
                          </p>
                          <p className="text-[10px] font-bold text-stone-500 mt-1">
                            Quedan: <span className={item.cantidad === 0 ? 'text-chiluda-red font-black' : 'text-amber-600 font-black'}>{item.cantidad} unidades</span> (Min: {item.inventario_minimo ?? 3})
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
