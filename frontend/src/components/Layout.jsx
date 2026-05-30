import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Bell, LogOut, ShoppingCart, Users, Menu, X } from 'lucide-react';
import { fetchInventory } from '../api';

const Layout = () => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { role: 'user' };
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    
    const checkStock = async () => {
      try {
        const inventory = await fetchInventory();
        const lowStock = inventory.filter(item => item.quantity < 10);
        setLowStockItems(lowStock);
      } catch (err) {
        console.error("Error fetching inventory for notifications", err);
      }
    };
    
    checkStock();
    const intervalId = setInterval(checkStock, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [isAdmin]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, adminOnly: true },
    { name: 'Punto de Venta', path: '/sales', icon: ShoppingCart, adminOnly: false },
    { name: 'Inventario', path: '/inventory', icon: Package, adminOnly: true },
    { name: 'Usuarios', path: '/users', icon: Users, adminOnly: true },
  ];

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-screen bg-brand-50 font-sans selection:bg-chiluda-lightred selection:text-chiluda-red">
        <header className="h-20 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 z-10 shadow-sm border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="text-3xl drop-shadow-sm animate-fade-in" role="img" aria-label="chile">🌶️</span>
            <h1 className="text-xl font-extrabold text-brand-900 tracking-tight leading-tight">
              LA CHILUDA <br /> <span className="text-sm font-bold text-chiluda-red tracking-widest">EN PAPAS</span>
            </h1>
          </div>
          <Link
            to="/login"
            onClick={() => {
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('token');
            }}
            className="flex items-center space-x-2 px-5 py-2.5 text-gray-500 hover:bg-red-50 hover:text-chiluda-red rounded-full transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-semibold text-sm">Cerrar Sesión</span>
          </Link>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in relative z-0">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

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
        <div className="h-24 flex flex-col items-center justify-center border-b border-gray-100/50 p-4">
          <div className="flex items-center space-x-2">
            <span className="text-3xl drop-shadow-sm animate-fade-in" role="img" aria-label="chile">🌶️</span>
            <h1 className="text-xl font-extrabold text-brand-900 tracking-tight leading-tight">
              LA CHILUDA <br /> <span className="text-sm font-bold text-chiluda-red tracking-widest">EN PAPAS</span>
            </h1>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-1.5">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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

        <div className="p-6 border-t border-gray-100/50">
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
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:text-chiluda-red transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1 flex justify-end relative">
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
                          Quedan: <span className={item.quantity === 0 ? 'text-red-600' : 'text-orange-500'}>{item.quantity} unidades</span>
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
        <div className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in relative z-0">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
