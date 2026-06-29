import { useState, useEffect } from 'react';
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
  UserCheck 
} from 'lucide-react';
import { fetchInventory, fetchActiveShift, fetchStoreSettings } from '../api';
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
  const [storeSettings, setStoreSettings] = useState({
    store_name: 'ABARROTES ED & E'
  });
  
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { role: 'cajero', username: '', full_name: '' };
  
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'admin' || user.role === 'supervisor';

  const checkStock = async () => {
    try {
      const inventory = await fetchInventory();
      const lowStock = inventory.filter(item => item.quantity <= (item.min_stock ?? 3));
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
      if (data && data.store_name) {
        setStoreSettings(data);
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
          <span>Caja Abierta (Fondo: ${activeShift.initial_cash.toFixed(2)})</span>
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

  if (!isStaff) {
    // Layout for normal Cajero (no sidebar, full screen POS)
    return (
      <div className="flex flex-col h-screen w-screen max-w-full overflow-hidden bg-transparent font-sans selection:bg-[#d1fae5] selection:text-[#064e3b] relative">
        {/* Background floating store icons animation */}
        <FloatingStoreIconsBg />

        <header className="h-20 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm border-b border-gray-100 relative">
          <div className="flex items-center space-x-3 shrink-0 select-none">
            <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-16 w-auto object-contain animate-fade-in drop-shadow-sm" />
            <div className="hidden sm:flex flex-col items-start max-w-[180px]">
              <span className="text-sm font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.store_name}</span>
            </div>
          </div>
          
          <div className="flex items-center">
            {renderHotkeys()}
            {renderShiftBadge()}
            
            <div className="hidden sm:flex flex-col items-end mr-4 text-right">
              <span className="text-xs font-extrabold text-brand-900 leading-none">{user.full_name}</span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Cajero</span>
            </div>

            <Link
              to="/login"
              onClick={() => {
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
              }}
              className="flex items-center space-x-1.5 px-2.5 py-2 sm:space-x-2 sm:px-5 sm:py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 shrink-0"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="font-semibold text-xs sm:text-sm whitespace-nowrap hidden sm:inline">Cerrar Sesión</span>
            </Link>
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
      <FloatingStoreIconsBg />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 w-72 bg-[#064e3b] shadow-2xl flex flex-col z-50 lg:z-10 transition-transform duration-300`}>
        {/* Mobile Sidebar Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 text-stone-500 hover:text-brand-900 hover:bg-stone-100 rounded-xl transition-all duration-200 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>

        <div className="h-20 flex items-center space-x-3 px-6 border-b border-stone-200 select-none bg-white flex-shrink-0">
          <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-16 w-auto object-contain animate-fade-in" />
          <div className="flex flex-col items-start max-w-[180px]">
            <span className="text-sm font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.store_name}</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.allowedRoles.includes(user.role)) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`group relative flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-bold text-sm tracking-wide uppercase">{item.name}</span>
                {isActive && (
                  <span className="absolute left-1.5 top-1/3 bottom-1/3 w-1 bg-white rounded-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10 flex flex-col gap-2 flex-shrink-0">
          <div className="px-4 py-3 bg-white/5 rounded-xl text-xs text-gray-300 flex flex-col border border-white/10">
            <span className="font-black text-white text-sm">{user.full_name}</span>
            <span className="uppercase text-[9px] font-black text-[#4ade80] mt-1 tracking-wider">{user.role === 'admin' ? 'Administrador' : 'Supervisor'}</span>
          </div>
          <Link
            to="/login"
            onClick={() => {
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('token');
            }}
            className="group flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-300 w-full font-bold text-sm"
          >
            <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span>Cerrar Sesión</span>
          </Link>
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
              <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-12 w-auto object-contain animate-fade-in" />
              <div className="hidden sm:flex flex-col items-start max-w-[140px]">
                <span className="text-xs font-black text-brand-900 tracking-tight leading-none uppercase truncate">{storeSettings.store_name}</span>
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
              <span className="text-xs font-extrabold text-brand-900 leading-none">{user.full_name}</span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                {user.role === 'admin' ? 'Administrador' : 'Supervisor'}
              </span>
            </div>

            <Link
              to="/login"
              onClick={() => {
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
              }}
              className="flex items-center space-x-1.5 px-2.5 py-2 sm:space-x-2 sm:px-4 sm:py-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-all duration-200 shrink-0"
            >
              <LogOut size={18} className="shrink-0" />
              <span className="font-semibold text-xs sm:text-sm whitespace-nowrap hidden lg:inline">Cerrar Sesión</span>
            </Link>

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
                            Quedan: <span className={item.quantity === 0 ? 'text-chiluda-red font-black' : 'text-amber-600 font-black'}>{item.quantity} unidades</span> (Min: {item.min_stock ?? 3})
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
