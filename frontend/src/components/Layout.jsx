import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Bell, LogOut, ShoppingCart, Users, Menu, X } from 'lucide-react';
import { fetchInventory, fetchActiveShift } from '../api';

const Layout = () => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { role: 'cajero', username: '', full_name: '' };
  
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'admin' || user.role === 'supervisor';

  const checkStock = async () => {
    try {
      const inventory = await fetchInventory();
      // filter stock below custom product min_stock
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

  useEffect(() => {
    if (isStaff) {
      checkStock();
      const intervalId = setInterval(checkStock, 60000); // Check every minute
      return () => clearInterval(intervalId);
    }
  }, [isStaff]);

  useEffect(() => {
    checkShift();
    window.addEventListener("shiftChanged", checkShift);
    return () => window.removeEventListener("shiftChanged", checkShift);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Punto de Venta', path: '/sales', icon: ShoppingCart, allowedRoles: ['admin', 'supervisor', 'cajero'] },
    { name: 'Inventario', path: '/inventory', icon: Package, allowedRoles: ['admin', 'supervisor'] },
    { name: 'Usuarios', path: '/users', icon: Users, allowedRoles: ['admin'] },
  ];

  const renderShiftBadge = () => {
    if (activeShift) {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-emerald-100 mr-4">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Caja Abierta (Fondo: ${activeShift.initial_cash.toFixed(2)})</span>
        </div>
      );
    } else if (isAdmin) {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-blue-50 text-blue-700 px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-blue-100 mr-4">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>Modo Admin (Sin Caja)</span>
        </div>
      );
    } else {
      return (
        <div className="hidden sm:flex items-center gap-2 bg-rose-50 text-rose-700 px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-rose-100 mr-4 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Caja Cerrada</span>
        </div>
      );
    }
  };

  if (!isStaff) {
    // Layout for normal Cajero (no sidebar, full screen POS)
    return (
      <div className="flex flex-col h-screen bg-brand-50 font-sans selection:bg-chiluda-lightred selection:text-chiluda-red">
        <header className="h-20 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm border-b border-gray-100">
          <div className="flex items-center space-x-3 shrink-0 select-none">
            <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-12 w-auto object-contain animate-fade-in" />
            <span className="text-xl font-black text-brand-900 tracking-tight">ABARROTES <span className="text-chiluda-red">ED & E</span></span>
          </div>
          
          <div className="flex items-center">
            {renderShiftBadge()}
            
            <div className="flex flex-col items-end mr-4 text-right">
              <span className="text-xs font-extrabold text-brand-900 leading-none">{user.full_name}</span>
              <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Cajero</span>
            </div>

            <Link
              to="/login"
              onClick={() => {
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
              }}
              className="flex items-center space-x-1.5 px-2.5 py-2 sm:space-x-2 sm:px-5 sm:py-2.5 text-gray-500 hover:bg-red-50 hover:text-chiluda-red rounded-full transition-all duration-200 shrink-0"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">Cerrar Sesión</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in relative">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  // Layout for Staff (Admin and Supervisor, includes sidebar and notifications)
  return (
    <div className="flex h-screen bg-brand-50 font-sans selection:bg-chiluda-lightred selection:text-chiluda-red">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 w-72 bg-white/80 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col border-r border-gray-100 z-50 transition-transform duration-300`}>
        {/* Mobile Sidebar Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-chiluda-red hover:bg-brand-50 rounded-xl transition-all duration-200 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>

        <div className="h-24 flex items-center space-x-3 justify-center border-b border-gray-100/50 p-4 select-none">
          <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-20 w-auto object-contain animate-fade-in" />
          <div className="flex flex-col items-center text-center">
            <span className="text-lg font-black text-brand-900 tracking-tight leading-none">ABARROTES</span>
            <span className="text-xs font-bold text-chiluda-red tracking-wider mt-1.5 uppercase leading-none">ED & E</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-1.5">
          {navItems.map((item) => {
            if (!item.allowedRoles.includes(user.role)) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`group flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-chiluda-red text-white shadow-float' 
                    : 'text-gray-500 hover:bg-brand-50 hover:text-chiluda-red hover:shadow-soft'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-100/50 flex flex-col gap-2">
          <div className="px-4 py-2 bg-brand-50/50 rounded-xl text-xs text-gray-500 flex flex-col">
            <span className="font-extrabold text-brand-900">{user.full_name}</span>
            <span className="uppercase text-[9px] font-bold text-chiluda-red mt-0.5">{user.role === 'admin' ? 'Administrador' : 'Supervisor'}</span>
          </div>
          <Link
            to="/login"
            onClick={() => {
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('token');
            }}
            className="group flex items-center space-x-3 px-4 py-3 text-gray-500 hover:bg-red-50 hover:text-chiluda-red rounded-xl transition-all duration-200 w-full"
          >
            <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Cerrar Sesión</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-brand-50 relative">
        {/* Header */}
        <header className="h-20 glass sticky top-0 flex items-center justify-between px-4 lg:px-8 z-10 shadow-sm">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-chiluda-red transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center space-x-2 lg:hidden select-none">
              <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-8 w-auto object-contain animate-fade-in" />
              <span className="font-extrabold text-brand-900 text-sm tracking-tight leading-none">ABARROTES <span className="text-chiluda-red">ED & E</span></span>
            </div>
          </div>
          
          <div className="flex-1 flex justify-end items-center relative">
            {renderShiftBadge()}

            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-400 hover:text-chiluda-red transition-colors relative"
            >
              <Bell size={24} />
              {lowStockItems.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-chiluda-red rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setShowNotifications(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-glass border border-gray-100 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800">Alertas de Stock</h3>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">{lowStockItems.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {lowStockItems.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        <div className="flex justify-center mb-3">
                          <Package size={32} className="opacity-20" />
                        </div>
                        Todos los productos tienen stock suficiente.
                      </div>
                    ) : (
                      lowStockItems.map(item => (
                        <div key={item.id} className="p-4 border-b border-gray-50 hover:bg-red-50/50 transition-colors">
                          <p className="text-sm text-gray-800">
                            Stock bajo en: <span className="font-semibold text-chiluda-red">{item.name}</span>
                          </p>
                          <p className="text-xs font-bold text-gray-500 mt-1">
                            Quedan: <span className={item.quantity === 0 ? 'text-red-600' : 'text-orange-500'}>{item.quantity} unidades</span> (Min: {item.min_stock ?? 3})
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
        <div className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
