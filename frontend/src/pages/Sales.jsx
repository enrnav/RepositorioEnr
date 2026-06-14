import { useState, useEffect } from 'react';
import { Search, ShoppingCart, TrendingUp, Plus, Minus, Trash2, CheckCircle, X, Printer, CreditCard, Banknote, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchInventory, sellProduct, fetchRecentSales, cancelSale } from '../api';


const Sales = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState(null); // 'efectivo' or 'tarjeta'
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState(null);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'cart'
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Estados para alertas y confirmaciones personalizadas
  const [customAlert, setCustomAlert] = useState({ show: false, title: '', message: '', type: 'success' });
  const [cancelConfirm, setCancelConfirm] = useState({ show: false, saleId: null, reason: '' });

  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const showAlert = (title, message, type = 'success') => {
    setCustomAlert({ show: true, title, message, type });
  };

  const loadRecentSales = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchRecentSales();
      setRecentSales(data);
    } catch (error) {
      console.error("Error loading recent sales", error);
      showAlert("Error", "Error al cargar las ventas", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = () => {
    loadRecentSales();
    setShowHistoryModal(true);
  };

  const triggerCancelSale = (saleId) => {
    setCancelConfirm({ show: true, saleId, reason: '' });
  };

  const processCancelSale = async () => {
    if (!cancelConfirm.reason.trim()) {
      showAlert("Motivo Requerido", "Por favor, escribe el motivo de la cancelación.", "warning");
      return;
    }
    try {
      await cancelSale(cancelConfirm.saleId, cancelConfirm.reason.trim());
      setCancelConfirm({ show: false, saleId: null, reason: '' });
      showAlert("Venta Cancelada", "La venta ha sido cancelada y el stock ha sido devuelto al inventario exitosamente.", "success");
      loadRecentSales();
      loadData();
    } catch (error) {
      console.error("Error cancelling sale", error);
      const detail = error.response?.data?.detail || "Hubo un error al cancelar la venta";
      showAlert("Error al Cancelar", detail, "error");
    }
  };


  const loadData = async () => {
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) {
      console.error("Error loading inventory", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        if (existingItem.cartQuantity >= product.quantity) {
          showAlert("Stock Insuficiente", "No hay suficiente stock disponible para este producto.", "warning");
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      } else {
        if (product.quantity <= 0) {
          showAlert("Producto Agotado", "Este producto se encuentra agotado.", "warning");
          return prevCart;
        }
        return [...prevCart, { ...product, cartQuantity: 1 }];
      }
    });
  };

  const updateCartQuantity = (productId, change) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === productId) {
          const newQuantity = item.cartQuantity + change;
          const productInInventory = inventory.find(p => p.id === productId);
          
          if (newQuantity > 0 && newQuantity <= (productInInventory?.quantity || 0)) {
            return { ...item, cartQuantity: newQuantity };
          } else if (newQuantity <= 0) {
            // Se mantiene la cantidad si es <= 0 para no borrar por accidente. 
            // Podría ser removido, pero es mejor usar el botón de X.
            return item;
          } else {
             showAlert("Límite Alcanzado", "Se ha alcanzado el límite de stock disponible para este producto.", "warning");
          }
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setIsProcessing(true);
    try {
      // Process all items in cart sequentially
      for (const item of cart) {
        await sellProduct(item.id, item.cartQuantity);
      }
      
      // Calculate final change before clearing cart
      const paid = paymentMethod === 'tarjeta' ? cartTotal : (amountPaid === '' ? cartTotal : parseFloat(amountPaid));
      const change = paymentMethod === 'tarjeta' ? 0 : paid - cartTotal;
      
      setLastSaleData({
        items: [...cart],
        total: cartTotal,
        paymentMethod: paymentMethod,
        amountPaid: paid,
        change: change,
        date: new Date(),
        saleId: Math.floor(Math.random() * 1000000).toString().padStart(6, '0') // random 6 digit ID
      });

      // Clear cart and reload inventory
      setCart([]);
      setAmountPaid('');
      setPaymentMethod(null);
      await loadData();
      
      // Show ticket modal
      setShowCheckoutModal(false);
      setShowTicketModal(true);
    } catch (error) {
      console.error("Error al procesar la venta", error);
      showAlert("Error de Venta", "Hubo un error al registrar la venta. Por favor, revisa el inventario.", "error");
      // Recargar inventario para reflejar cualquier cambio parcial
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const productName = item?.name || '';
    const productBarcode = item?.barcode || '';
    return productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           productBarcode.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const exactMatch = filteredInventory.find(p => 
        p.name.toLowerCase() === searchTerm.toLowerCase() || 
        (p.barcode && p.barcode.toLowerCase() === searchTerm.toLowerCase())
      );
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      } else if (filteredInventory.length === 1) {
        addToCart(filteredInventory[0]);
        setSearchTerm('');
      }
    }
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.cartQuantity), 0);
  const cartItemCount = cart.reduce((count, item) => count + item.cartQuantity, 0);

  return (
    <div className="space-y-4">
      {/* Mobile Tab Toggle (Visible only on screens < lg) */}
      <div className="flex lg:hidden bg-white/80 backdrop-blur-xl rounded-2xl p-1.5 shadow-sm border border-gray-100/50 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'products' 
              ? 'bg-chiluda-red text-white shadow-sm' 
              : 'text-gray-500 hover:text-chiluda-red'
          }`}
        >
          Productos ({filteredInventory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cart')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${
            activeTab === 'cart' 
              ? 'bg-chiluda-red text-white shadow-sm' 
              : 'text-gray-500 hover:text-chiluda-red'
          }`}
        >
          Carrito
          {cartItemCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'cart' ? 'bg-white text-chiluda-red' : 'bg-chiluda-red text-white'
            }`}>
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-900 tracking-tight flex items-center animate-fade-in">
          <ShoppingCart className="mr-2 sm:mr-3 text-chiluda-red w-6 h-6 sm:w-8 sm:h-8" />
          Punto de Venta
        </h2>
        {isAdmin && (
          <button
            onClick={openHistoryModal}
            className="flex items-center space-x-0 sm:space-x-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-700 p-2 sm:px-4 sm:py-2 rounded-full hover:bg-brand-50 hover:text-chiluda-red hover:border-chiluda-red/30 transition-all shadow-sm hover:shadow-md font-semibold text-sm"
          >
            <History size={16} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Cancelación de Producto</span>
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Products Grid */}
        <div className={`flex-1 space-y-6 ${activeTab === 'products' ? 'block' : 'hidden lg:block'}`}>

        {/* Toolbar */}
        <div className="bg-white/80 backdrop-blur-xl p-3 sm:p-4 rounded-3xl shadow-soft border border-white flex items-center animate-slide-up">
          <div className="relative w-full">
            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input 
              type="text" 
              placeholder="Buscar producto (Enter para agregar)..." 
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 bg-brand-50/50 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-chiluda-red text-sm sm:text-lg shadow-inner font-medium transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
          {filteredInventory.map((item, i) => (
            <div 
              key={item.id} 
              onClick={() => item.quantity > 0 && addToCart(item)}
              className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-100/50 overflow-hidden transition-all duration-300 flex flex-col group animate-slide-up ${item.quantity > 0 ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1.5 hover:border-chiluda-red/30 active:scale-95' : 'opacity-70'}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="p-3 sm:p-5 flex-1 relative">
                <h3 className="text-xs sm:text-lg font-bold text-brand-900 line-clamp-2 min-h-[2rem] sm:min-h-[3.5rem] pr-1">{item.name}</h3>
                <p className="text-base sm:text-3xl font-extrabold text-chiluda-red mt-1 sm:mt-3 tracking-tight">${item.price.toFixed(2)}</p>
                
                <div className="mt-2 sm:mt-4 flex items-center justify-between text-sm">
                  <span className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium text-[9px] sm:text-xs ${
                    item.quantity > 10 ? 'bg-green-100 text-green-800' : item.quantity > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    Stock: {item.quantity}
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                  disabled={item.quantity <= 0}
                  className={`w-full py-1.5 sm:py-2.5 rounded-lg font-bold text-white transition-colors flex items-center justify-center space-x-1 sm:space-x-2 text-[10px] sm:text-base ${
                    item.quantity > 0 
                      ? 'bg-chiluda-red hover:bg-chiluda-darkred active:scale-[0.98]' 
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span>{item.quantity > 0 ? 'Agregar' : 'Agotado'}</span>
                </button>
              </div>
            </div>
          ))}
          {filteredInventory.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              No se encontraron productos con ese nombre.
            </div>
          )}
        </div>
      </div>

        {/* Right Column: Shopping Cart Sidebar */}
        <div className={`w-full lg:w-[420px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white flex flex-col lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 overflow-hidden animate-slide-up ${
          activeTab === 'cart' ? 'flex h-[calc(100vh-12rem)]' : 'hidden lg:flex'
        }`} style={{ animationDelay: '0.1s' }}>
        {/* Cart Header */}
        <div className="p-6 border-b border-gray-100/50 flex justify-between items-center bg-white/40">
          <h3 className="text-xl font-extrabold text-brand-900 flex items-center">
            Carrito de Compra
          </h3>
          <span className="bg-chiluda-red text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
            {cartItemCount} items
          </span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="bg-brand-50 p-6 rounded-full">
                <ShoppingCart size={48} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex flex-col p-4 bg-brand-50/50 rounded-2xl border border-gray-100 group hover:border-gray-200 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col pr-2">
                    <span className="font-bold text-brand-900 text-sm leading-tight">{item.name}</span>
                    {item.barcode && <span className="text-[10px] text-gray-400 mt-0.5">Cód: {item.barcode}</span>}
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-chiluda-red font-bold">${item.price.toFixed(2)}</span>
                  
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-2 bg-white rounded-md border border-gray-200 p-1">
                    <button 
                      onClick={() => updateCartQuantity(item.id, -1)}
                      disabled={item.cartQuantity <= 1}
                      className="p-1 text-gray-500 hover:text-chiluda-red disabled:opacity-50"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.cartQuantity}</span>
                    <button 
                      onClick={() => updateCartQuantity(item.id, 1)}
                      disabled={item.cartQuantity >= inventory.find(p => p.id === item.id)?.quantity}
                      className="p-1 text-gray-500 hover:text-chiluda-red disabled:opacity-50"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer / Checkout */}
        <div className="p-6 border-t border-gray-100/50 bg-white/40 backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-500 font-bold uppercase text-sm tracking-wider">Total a cobrar:</span>
            <span className="text-4xl font-extrabold text-brand-900 tracking-tight">${cartTotal.toFixed(2)}</span>
          </div>
          
          <button
            onClick={() => { setAmountPaid(''); setShowCheckoutModal(true); }}
            disabled={cart.length === 0 || isProcessing}
            className={`w-full py-4.5 rounded-2xl font-extrabold text-white text-lg transition-all flex items-center justify-center space-x-3 shadow-float ${
              cart.length > 0 && !isProcessing
                ? 'bg-chiluda-red hover:bg-chiluda-darkred hover:-translate-y-1 active:translate-y-0 active:scale-95' 
                : 'bg-gray-300 shadow-none cursor-not-allowed opacity-70'
            }`}
          >
            {isProcessing ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <CheckCircle size={24} />
                <span>Cobrar ${cartTotal.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">
                {paymentMethod ? 'Cobrar Venta' : 'Método de Pago'}
              </h3>
              <button 
                onClick={() => { setShowCheckoutModal(false); setPaymentMethod(null); setAmountPaid(''); }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {!paymentMethod ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-lg mb-6 pb-6 border-b border-gray-100">
                    <span className="text-gray-600">Total a cobrar:</span>
                    <span className="text-4xl font-bold text-chiluda-red">${cartTotal.toFixed(2)}</span>
                  </div>
                  <h4 className="font-semibold text-gray-700 mb-4 text-center">Seleccione método de pago:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setPaymentMethod('efectivo')}
                      className="flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-chiluda-red hover:bg-red-50 hover:text-chiluda-red transition-all group"
                    >
                      <Banknote size={40} className="text-gray-400 group-hover:text-chiluda-red mb-3 transition-colors" />
                      <span className="font-bold text-gray-700 group-hover:text-chiluda-red">Efectivo</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('tarjeta')}
                      className="flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all group"
                    >
                      <CreditCard size={40} className="text-gray-400 group-hover:text-blue-500 mb-3 transition-colors" />
                      <span className="font-bold text-gray-700 group-hover:text-blue-600">Tarjeta</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-gray-600">Total a cobrar:</span>
                    <span className="text-3xl font-bold text-chiluda-red">${cartTotal.toFixed(2)}</span>
                  </div>
                  
                  {paymentMethod === 'efectivo' && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Monto recibido (Efectivo)</label>
                        <input
                          type="number"
                          placeholder="Ej. 500"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 focus:border-chiluda-red text-2xl text-center font-bold"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (amountPaid === '' || parseFloat(amountPaid) >= cartTotal)) {
                              handleCheckout();
                            }
                          }}
                        />
                      </div>

                      {amountPaid !== '' && parseFloat(amountPaid) < cartTotal && (
                        <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                          El monto recibido es menor al total.
                        </div>
                      )}
                    </>
                  )}

                  {paymentMethod === 'tarjeta' && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-center flex flex-col items-center">
                      <CreditCard size={32} className="mb-2" />
                      <p className="font-semibold">Cobro con Tarjeta</p>
                      <p className="text-sm opacity-80">Por favor, procese el cobro exacto en la terminal.</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setPaymentMethod(null); setAmountPaid(''); }}
                      className="w-1/3 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={isProcessing || (paymentMethod === 'efectivo' && amountPaid !== '' && parseFloat(amountPaid) < cartTotal)}
                      className={`flex-1 py-4 rounded-xl font-bold text-white text-lg transition-all flex items-center justify-center space-x-2 ${
                        !isProcessing && (paymentMethod === 'tarjeta' || amountPaid === '' || parseFloat(amountPaid) >= cartTotal)
                          ? 'bg-chiluda-red hover:bg-chiluda-darkred shadow-lg shadow-chiluda-red/30 hover:-translate-y-0.5' 
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle size={24} />
                      <span>{isProcessing ? 'Procesando...' : 'Confirmar Venta'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {showTicketModal && lastSaleData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:items-start">
          <div id="printable-ticket" className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
              <h3 className="text-xl font-bold text-gray-800">Ticket de Compra</h3>
              <button onClick={() => setShowTicketModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 font-mono text-sm text-gray-800 print:overflow-visible">
              <div className="text-center mb-6 flex flex-col items-center">
                <img src="/logo.png?v=4" alt="Abarrotes ED & E Logo" className="h-16 w-auto object-contain mb-2" />
                <h2 className="text-base font-bold uppercase tracking-wider text-brand-900">Abarrotes ED & E</h2>
                <p className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase">Tu mercado de confianza</p>
                <p className="text-xs text-gray-500 mt-2">{lastSaleData.date.toLocaleString()}</p>
                <p className="text-xs text-gray-500 font-bold">Ticket #{lastSaleData.saleId}</p>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 space-y-2">
                {lastSaleData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <span>{item.cartQuantity}x {item.name}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      ${(item.price * item.cartQuantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1 text-right mb-6">
                <div className="flex justify-between font-bold text-base mb-1">
                  <span>TOTAL:</span>
                  <span>${lastSaleData.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Método:</span>
                  <span className="uppercase">{lastSaleData.paymentMethod}</span>
                </div>
                {lastSaleData.paymentMethod === 'efectivo' && (
                  <>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Efectivo:</span>
                      <span>${lastSaleData.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm mt-2 border-t border-gray-200 pt-2 text-brand-900">
                      <span>CAMBIO:</span>
                      <span>${lastSaleData.change.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center mt-8">
                <QRCodeSVG value={`https://abarrotesedye.com/ticket/${lastSaleData.saleId}`} size={140} level="L" />
                <p className="text-center text-[10px] text-gray-400 mt-3 max-w-[200px]">Escanea para ver tu ticket digital</p>
                <p className="text-center font-bold text-sm text-gray-800 mt-4">¡Gracias por su compra!</p>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                <Printer size={20} />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setShowTicketModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-chiluda-red hover:bg-chiluda-darkred shadow-lg shadow-chiluda-red/30 transition-all"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-start sm:items-center justify-center z-[100] p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl w-[95vw] lg:w-full max-w-4xl overflow-hidden border border-white flex flex-col max-h-[90vh] my-4">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-brand-900 flex items-center gap-2">
                <History className="text-chiluda-red" size={24} />
                Cancelación de Producto
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center text-gray-500 animate-pulse font-medium">
                  Cargando ventas...
                </div>
              ) : recentSales.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium">
                  No hay ventas registradas recientemente.
                </div>
              ) : (
                <div className="overflow-x-auto w-full border border-gray-100 rounded-2xl">
                  <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead className="bg-brand-50/50 text-brand-900 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-bold">Fecha / Hora</th>
                        <th className="px-4 py-3 font-bold">Producto</th>
                        <th className="px-4 py-3 font-bold text-center">Cant.</th>
                        <th className="px-4 py-3 font-bold text-right">Precio Unit.</th>
                        <th className="px-4 py-3 font-bold text-right">Total</th>
                        <th className="px-4 py-3 font-bold text-center">Estado</th>
                        <th className="px-4 py-3 font-bold text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {recentSales.map((sale) => {
                        const date = new Date(sale.created_at);
                        const formattedDate = isNaN(date.getTime()) 
                          ? sale.created_at.replace("T", " ").split(".")[0] 
                          : date.toLocaleString('es-MX', { hour12: false });
                        const total = sale.product_price * sale.quantity;
                        
                        // Check if current logged-in user is admin
                        const userStr = sessionStorage.getItem('user');
                        const userObj = userStr ? JSON.parse(userStr) : null;
                        const isAdmin = userObj?.role === 'admin';

                        return (
                          <tr key={sale.id} className={`hover:bg-brand-50/30 ${sale.is_cancelled ? 'opacity-60 bg-gray-50/50' : ''}`}>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formattedDate}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              <span>{sale.product_name}</span>
                              {sale.is_cancelled && sale.cancel_reason && (
                                <span className="block text-xs font-semibold text-red-500 mt-1">
                                  Motivo: "{sale.cancel_reason}"
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-700">{sale.quantity}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-600">${sale.product_price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">${total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                sale.is_cancelled 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {sale.is_cancelled ? 'Cancelada' : 'Completada'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!sale.is_cancelled && (
                                <button
                                  onClick={() => triggerCancelSale(sale.id)}
                                  disabled={!isAdmin}
                                  title={isAdmin ? "Cancelar venta y devolver stock" : "Solo administradores pueden cancelar ventas"}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isAdmin 
                                      ? 'bg-red-500 hover:bg-red-600 text-white active:scale-95' 
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end bg-gray-50/30">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert.show && (
        <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-start sm:items-center justify-center z-[100] p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white p-6 text-center animate-scale-in my-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              customAlert.type === 'success' ? 'bg-green-100 text-green-600' :
              customAlert.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              {customAlert.type === 'success' ? (
                <CheckCircle size={32} />
              ) : customAlert.type === 'warning' ? (
                <TrendingUp size={32} className="rotate-45" />
              ) : (
                <X size={32} />
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{customAlert.title}</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">{customAlert.message}</p>
            <button
              onClick={() => setCustomAlert({ ...customAlert, show: false })}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                customAlert.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                customAlert.type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-red-600 hover:bg-red-700'
              }`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirm.show && (
        <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-start sm:items-center justify-center z-[100] p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white p-6 animate-scale-in my-4">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-brand-900 flex items-center gap-2">
                <Trash2 className="text-red-500" size={24} />
                Confirmar Cancelación
              </h3>
              <button
                onClick={() => setCancelConfirm({ show: false, saleId: null, reason: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600 text-sm font-medium">
                ¿Está seguro de que desea cancelar la venta y devolver el stock correspondiente al inventario?
              </p>
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Motivo o comentario de la cancelación:
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. Producto dañado, devolución de cliente..."
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-medium transition-all resize-none"
                  value={cancelConfirm.reason}
                  onChange={(e) => setCancelConfirm({ ...cancelConfirm, reason: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setCancelConfirm({ show: false, saleId: null, reason: '' })}
                className="w-1/3 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
              >
                Volver
              </button>
              <button
                onClick={processCancelSale}
                disabled={!cancelConfirm.reason.trim()}
                className={`flex-1 py-3 rounded-xl font-bold text-white transition-all text-sm flex items-center justify-center gap-2 ${
                  cancelConfirm.reason.trim()
                    ? 'bg-red-500 hover:bg-red-600 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
