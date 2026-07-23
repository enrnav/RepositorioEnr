import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AlertModal from '../components/AlertModal';
import { 
  Search, ShoppingCart, TrendingUp, Plus, Minus, Trash2, CheckCircle, 
  X, Printer, CreditCard, Banknote, History, Coins, ArrowRight, AlertCircle, Lock,
  Package, Keyboard, UserCheck, KeyRound
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  fetchInventory, checkoutSales, fetchRecentSales, cancelSale, 
  fetchActiveShift, openShift, closeShift, addCashMovement, fetchShiftReport,
  fetchActiveShiftsAdmin, closeShiftAdmin, fetchStoreSettings, fetchCustomers,
  sendTicketWhatsApp
} from '../api';



const Sales = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Store Settings & Customers
  const [storeSettings, setStoreSettings] = useState({
    nombre_tienda: 'Abarrotes ED & E',
    telefono: '',
    correo: '',
    direccion: '',
    tasa_impuesto: 16.0,
    pie_ticket: '¡Gracias por preferirnos!'
  });
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Shift Ticket Printing
  const [showShiftTicketModal, setShowShiftTicketModal] = useState(false);
  const [lastShiftReport, setLastShiftReport] = useState(null);
  
  // Checkout & Payment
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null); // 'efectivo' | 'tarjeta' | 'mixto' | 'credito'
  const [amountPaidCash, setAmountPaidCash] = useState('');
  const [amountPaidCard, setAmountPaidCard] = useState('');
  const [cartDiscount, setCartDiscount] = useState('0'); // percentage or fixed monto
  const [discountType, setDiscountType] = useState('fixed'); // 'percent' | 'fixed'
  
  // Modals & Printing
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState(null);
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'cart'
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  
  // Shift (Control de Caja)
  const [activeShift, setActiveShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [shiftTab, setShiftTab] = useState('report'); // 'report' | 'movement' | 'close'
  const [initialCashInput, setInitialCashInput] = useState('100');
  const [cashMovementType, setCashMovementType] = useState('entrada');
  const [cashMovementAmount, setCashMovementAmount] = useState('');
  const [cashMovementReason, setCashMovementReason] = useState('');
  const [closeCashReal, setCloseCashReal] = useState('');
  const [shiftReport, setShiftReport] = useState(null);
  
  // History & Cancellation
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('sales'); // 'sales' | 'cancellations'
  
  // Custom Alert & Confirmations
  const [customAlert, setCustomAlert] = useState({ show: false, title: '', message: '', tipo: 'success' });
  const [cancelConfirm, setCancelConfirm] = useState({ 
    show: false, 
    saleId: null, 
    motivo: '', 
    authUser: '', 
    authPass: '',
    productName: '',
    maxQuantity: 1,
    cantidad: 1
  });
  
  // Variants
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);

  // Admin Shift States
  const [adminShifts, setAdminShifts] = useState([]);
  const [loadingAdminShifts, setLoadingAdminShifts] = useState(false);
  const [adminCloseReal, setAdminCloseReal] = useState('');
  const [selectedShiftToClose, setSelectedShiftToClose] = useState(null);
  
  // Refs
  const searchInputRef = useRef(null);
  const selectedProductIndex = useRef(-1);

  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { rol: 'cajero', nombre_usuario: '', nombre_completo: '' };
  
  const isAdmin = user.rol === 'admin';
  const isStaff = user.rol === 'admin' || user.rol === 'supervisor';

  const showAlert = (title, message, tipo = 'success') => {
    setCustomAlert({ show: true, title, message, tipo });
  };

  // 1. Shift Verification
  const verifyShift = async () => {
    setLoadingShift(true);
    try {
      const shift = await fetchActiveShift();
      setActiveShift(shift);
      if (shift) {
        loadShiftReport(shift.id);
      }
    } catch (error) {
      console.error("Error checking active shift", error);
      showAlert("Error", "Error al verificar turno de caja", "error");
    } finally {
      setLoadingShift(false);
    }
  };

  const handleOpenShift = async () => {
    const cash = parseFloat(initialCashInput);
    if (isNaN(cash) || cash < 0) {
      showAlert("Monto Inválido", "Por favor ingresa un fondo de caja válido.", "warning");
      return;
    }
    try {
      const shift = await openShift(cash);
      setActiveShift(shift);
      window.dispatchEvent(new Event("shiftChanged"));
      showAlert("Caja Abierta", `Turno iniciado con un fondo de $${cash.toFixed(2)}`, "success");
      loadData();
    } catch (error) {
      console.error("Error opening shift", error);
      showAlert("Error", error.response?.data?.detail || "No se pudo abrir la caja.", "error");
    }
  };

  const handleCloseShift = async () => {
    const cashReal = parseFloat(closeCashReal);
    if (isNaN(cashReal) || cashReal < 0) {
      showAlert("Monto Inválido", "Ingresa el efectivo real contado en caja.", "warning");
      return;
    }
    try {
      const shiftId = activeShift.id;
      await closeShift(cashReal);
      
      try {
        const report = await fetchShiftReport(shiftId);
        setLastShiftReport(report);
        setShowShiftTicketModal(true);
      } catch (err) {
        console.error("Error loading final shift report for ticket", err);
      }

      window.dispatchEvent(new Event("shiftChanged"));
      showAlert("Caja Cerrada", "El turno de caja ha sido cerrado correctamente.", "success");
      setActiveShift(null);
      setCloseCashReal('');
      setShowShiftManager(false);
      setCart([]);
    } catch (error) {
      console.error("Error closing shift", error);
      showAlert("Error", error.response?.data?.detail || "No se pudo cerrar la caja.", "error");
    }
  };

  const handleCashMovement = async () => {
    const amt = parseFloat(cashMovementAmount);
    if (isNaN(amt) || amt <= 0) {
      showAlert("Monto Inválido", "Ingresa una cantidad mayor a 0.", "warning");
      return;
    }
    if (!cashMovementReason.trim()) {
      showAlert("Motivo Requerido", "Escribe una descripción del movimiento.", "warning");
      return;
    }
    try {
      await addCashMovement(cashMovementType, amt, cashMovementReason.trim());
      setCashMovementAmount('');
      setCashMovementReason('');
      showAlert("Movimiento Registrado", "El movimiento se guardó correctamente.", "success");
      if (activeShift) loadShiftReport(activeShift.id);
      window.dispatchEvent(new Event("shiftChanged"));
    } catch (error) {
      console.error("Error registering cash movement", error);
      showAlert("Error", error.response?.data?.detail || "No se pudo registrar el movimiento.", "error");
    }
  };

  const loadShiftReport = async (shiftId) => {
    try {
      const data = await fetchShiftReport(shiftId);
      setShiftReport(data);
    } catch (error) {
      console.error("Error loading shift report", error);
    }
  };

  const loadAdminShifts = async () => {
    setLoadingAdminShifts(true);
    try {
      const data = await fetchActiveShiftsAdmin();
      setAdminShifts(data);
    } catch (error) {
      console.error("Error loading active shifts", error);
      showAlert("Error", "No se pudieron cargar los turnos activos.", "error");
    } finally {
      setLoadingAdminShifts(false);
    }
  };

  const handleCloseShiftAdmin = async (shiftId, cashReal) => {
    if (isNaN(cashReal) || cashReal < 0) {
      showAlert("Monto Inválido", "Ingresa el efectivo real contado en caja.", "warning");
      return;
    }
    try {
      await closeShiftAdmin(shiftId, cashReal);
      
      try {
        const report = await fetchShiftReport(shiftId);
        setLastShiftReport(report);
        setShowShiftTicketModal(true);
      } catch (err) {
        console.error("Error loading final shift report for ticket as admin", err);
      }

      showAlert("Caja Cerrada", "El turno de caja del cajero ha sido cerrado correctamente.", "success");
      setAdminCloseReal('');
      setSelectedShiftToClose(null);
      loadAdminShifts();
      if (activeShift && activeShift.id === shiftId) {
        setActiveShift(null);
        setCart([]);
      }
      window.dispatchEvent(new Event("shiftChanged"));
    } catch (error) {
      console.error("Error closing shift as admin", error);
      showAlert("Error", error.response?.data?.detail || "No se pudo cerrar la caja.", "error");
    }
  };

  // 2. Inventory & Sales Operations
  const loadData = async () => {
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) {
      console.error("Error loading inventory", error);
    }
  };

  const loadStoreSettings = async () => {
    try {
      const data = await fetchStoreSettings();
      if (data) {
        setStoreSettings(data);
      }
    } catch (error) {
      console.error("Error loading store settings", error);
    }
  };

  const loadCustomersData = async (query = '') => {
    try {
      const data = await fetchCustomers(query);
      setCustomers(data);
    } catch (error) {
      console.error("Error loading customers", error);
    }
  };

  useEffect(() => {
    verifyShift();
    loadData();
    loadStoreSettings();
    loadCustomersData();

    window.addEventListener("store_settings_updated", loadStoreSettings);
    return () => {
      window.removeEventListener("store_settings_updated", loadStoreSettings);
    };
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDownGlobal = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 && (activeShift || isAdmin)) {
          setPaymentMethod(null);
          setAmountPaidCash('');
          setAmountPaidCard('');
          setShowCheckoutModal(true);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCart([]);
      } else if (e.key === 'Escape') {
        setSearchTerm('');
        setShowCheckoutModal(false);
        setShowTicketModal(false);
        setShowShiftManager(false);
        setShowHistoryModal(false);
        setShowVariantModal(false);
        setCustomAlert(prev => ({ ...prev, show: false }));
        setCancelConfirm(prev => ({ ...prev, show: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [cart, activeShift, isAdmin]);

  // Cart operations
  const handleProductSelect = (producto) => {
    if (producto.variantes && producto.variantes.length > 0) {
      setVariantProduct(producto);
      setShowVariantModal(true);
    } else {
      addToCart(producto);
    }
  };

  const addToCart = (producto, variante = null) => {
    setCart((prevCart) => {
      const cartItemId = variante ? `${producto.id}_${variante.id}` : `${producto.id}`;
      const existingItem = prevCart.find((item) => item.cartItemId === cartItemId);
      
      const maxQty = variante ? variante.cantidad : producto.cantidad;
      const precio = variante && variante.precio !== null ? variante.precio : producto.precio;
      const cost = variante && variante.precio_costo !== null ? variante.precio_costo : producto.precio_costo;
      const name = variante ? `${producto.name} (${variante.name})` : producto.name;

      if (existingItem) {
        if (existingItem.cartQuantity >= maxQty) {
          showAlert("Stock Insuficiente", "No hay más existencias disponibles en el inventario.", "warning");
          return prevCart;
        }
        return prevCart.map((item) =>
          item.cartItemId === cartItemId ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      } else {
        if (maxQty <= 0) {
          showAlert("Producto Agotado", "Este producto/variante se encuentra agotado.", "warning");
          return prevCart;
        }
        return [...prevCart, {
          cartItemId,
          id: producto.id,
          variante_id: variante ? variante.id : null,
          name,
          precio,
          precio_costo: cost,
          cartQuantity: 1,
          imagen: producto.imagen || null
        }];
      }
    });
  };

  const updateCartQuantity = (cartItemId, change) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.cartItemId === cartItemId) {
          const newQuantity = item.cartQuantity + change;
          
          let maxQty = 0;
          const originalProd = inventory.find(p => p.id === item.id);
          if (item.variante_id) {
            const v = originalProd?.variantes?.find(varnt => varnt.id === item.variante_id);
            maxQty = v ? v.cantidad : 0;
          } else {
            maxQty = originalProd ? originalProd.cantidad : 0;
          }

          if (newQuantity > 0 && newQuantity <= maxQty) {
            return { ...item, cartQuantity: newQuantity };
          } else if (newQuantity <= 0) {
            return item;
          } else {
            showAlert("Límite Alcanzado", "No puedes agregar una cantidad superior al stock actual.", "warning");
          }
        }
        return item;
      });
    });
  };

  const removeFromCart = (cartItemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartItemId !== cartItemId));
  };

  // Computations
  const subtotalTotal = cart.reduce((total, item) => total + (item.precio * item.cartQuantity), 0);
  
  const discountVal = parseFloat(cartDiscount) || 0;
  const cartDiscountTotal = discountType === 'percent' 
    ? (subtotalTotal * (discountVal / 100)) 
    : discountVal;
  
  const cartTotal = Math.max(0, subtotalTotal - cartDiscountTotal);
  const cartItemCount = cart.reduce((count, item) => count + item.cartQuantity, 0);

  // Search autocomplete & Barcode scanning
  const filteredInventory = inventory.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const barcodeMatch = (item.codigo_barras || '').toLowerCase() === searchTerm.toLowerCase();
    
    // Check if variante has codigo_barras match
    const variantBarcodeMatch = item.variantes?.some(v => (v.codigo_barras || '').toLowerCase() === searchTerm.toLowerCase());
    
    return nameMatch || barcodeMatch || variantBarcodeMatch;
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Look for exact codigo_barras match in main products
      const mainBarcodeMatch = inventory.find(p => p.codigo_barras && p.codigo_barras.toLowerCase() === searchTerm.toLowerCase());
      if (mainBarcodeMatch) {
        handleProductSelect(mainBarcodeMatch);
        setSearchTerm('');
        return;
      }

      // Look for exact codigo_barras match in variantes
      for (const p of inventory) {
        if (p.variantes) {
          const varMatch = p.variantes.find(v => v.codigo_barras && v.codigo_barras.toLowerCase() === searchTerm.toLowerCase());
          if (varMatch) {
            addToCart(p, varMatch);
            setSearchTerm('');
            return;
          }
        }
      }

      // Fallback: If filtered length is 1, select it
      if (filteredInventory.length === 1) {
        handleProductSelect(filteredInventory[0]);
        setSearchTerm('');
      }
    }
  };

  // Sales Checkout Submission
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return;
    if (!activeShift && !isAdmin) {
      showAlert("Caja Requerida", "Debes iniciar un turno de caja para vender.", "warning");
      return;
    }
    
    setIsProcessing(true);
    
    // Prepare payment fields
    let actualPaidCash = 0;
    let actualPaidCard = 0;
    
    const cashVal = parseFloat(amountPaidCash);
    const cardVal = parseFloat(amountPaidCard);

    if (paymentMethod === 'credito') {
      if (!selectedCustomer) {
        showAlert("Cliente Requerido", "Debes seleccionar un cliente registrado para vender a crédito.", "warning");
        setIsProcessing(false);
        return;
      }
      actualPaidCash = 0;
      actualPaidCard = 0;
    } else if (paymentMethod === 'efectivo') {
      actualPaidCash = isNaN(cashVal) ? cartTotal : cashVal;
      actualPaidCard = 0;
      if (actualPaidCash < cartTotal) {
        showAlert("Cobro Incompleto", "El efectivo recibido es menor al total de la venta.", "warning");
        setIsProcessing(false);
        return;
      }
    } else if (paymentMethod === 'tarjeta') {
      actualPaidCash = 0;
      actualPaidCard = cartTotal;
    } else if (paymentMethod === 'mixto') {
      actualPaidCash = isNaN(cashVal) ? 0 : cashVal;
      actualPaidCard = isNaN(cardVal) ? 0 : cardVal;
      
      if ((actualPaidCash + actualPaidCard) < cartTotal) {
        showAlert("Cobro Incompleto", "La suma de efectivo y tarjeta es menor al total de la venta.", "warning");
        setIsProcessing(false);
        return;
      }
    }

    const checkoutData = {
      elementos: cart.map(item => ({
        producto_id: item.id,
        variante_id: item.variante_id,
        cantidad: item.cartQuantity
      })),
      metodo_pago: paymentMethod,
      payment_method: paymentMethod,
      monto_efectivo: actualPaidCash,
      cash_amount: actualPaidCash,
      monto_tarjeta: actualPaidCard,
      card_amount: actualPaidCard,
      descuento: cartDiscountTotal,
      discount: cartDiscountTotal,
      turno_id: activeShift ? activeShift.id : null,
      cliente_id: selectedCustomer ? selectedCustomer.id : null
    };

    try {
      const response = await checkoutSales(checkoutData);
      const serverSaleId = response?.venta_id || Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      
      // Calculate change
      const change = (paymentMethod === 'tarjeta' || paymentMethod === 'credito') ? 0 : (actualPaidCash + actualPaidCard) - cartTotal;
      
      setLastSaleData({
        elementos: [...cart],
        subtotal: subtotalTotal,
        discount: cartDiscountTotal,
        total: cartTotal,
        paymentMethod: paymentMethod === 'credito' ? 'Crédito/Fiado' : paymentMethod,
        cashPaid: actualPaidCash,
        cardPaid: actualPaidCard,
        change: change,
        date: new Date(),
        saleId: serverSaleId,
        cashier: user?.nombre_completo || user?.nombre_usuario || 'Cajero',
        shiftId: activeShift ? activeShift.id : null,
        customerName: selectedCustomer ? selectedCustomer.name : null
      });

      // Auto-prefill customer telefono if available
      const customerPhone = selectedCustomer?.telefono || '';
      setWhatsAppPhone(customerPhone);
      
      // Reset cart and states
      setCart([]);
      setCartDiscount('0');
      setAmountPaidCash('');
      setAmountPaidCard('');
      setPaymentMethod(null);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      
      await loadData();
      if (activeShift) {
        await loadShiftReport(activeShift.id);
      }
      window.dispatchEvent(new Event("shiftChanged"));
      
      setShowCheckoutModal(false);
      setShowTicketModal(true);
      searchInputRef.current?.focus();
    } catch (error) {
      console.error("Checkout transaction error", error);
      let detailMsg = "Hubo un error al registrar la venta en el servidor.";
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') {
        detailMsg = detail;
      } else if (Array.isArray(detail)) {
        detailMsg = detail.map(d => d.msg || JSON.stringify(d)).join(", ");
      } else if (detail && typeof detail === 'object') {
        detailMsg = JSON.stringify(detail);
      }
      showAlert("Error en Cobro", detailMsg, "error");
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendTicketWhatsApp = async () => {
    if (!whatsAppPhone || !lastSaleData?.saleId) return;
    setSendingWhatsApp(true);
    try {
      await sendTicketWhatsApp(lastSaleData.saleId, whatsAppPhone);
      showAlert("WhatsApp Enviado", "El ticket de compra se ha enviado exitosamente por WhatsApp.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Error WhatsApp", err.response?.data?.detail || "No se pudo enviar el ticket por WhatsApp.", "error");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Recent Sales & Returns
  const loadRecentSalesHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchRecentSales();
      setRecentSales(data);
    } catch (error) {
      console.error("Error loading history", error);
      showAlert("Error", "Error al cargar las ventas recientes", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = () => {
    loadRecentSalesHistory();
    setShowHistoryModal(true);
    setHistoryTab('sales');
  };

  const triggerCancelSale = (saleId) => {
    const saleObj = recentSales.find(s => s.id === saleId);
    setCancelConfirm({ 
      show: true, 
      saleId, 
      motivo: '', 
      authUser: '', 
      authPass: '',
      productName: saleObj ? saleObj.nombre_producto : '',
      maxQuantity: saleObj ? saleObj.cantidad : 1,
      cantidad: saleObj ? saleObj.cantidad : 1
    });
  };

  const processCancelSale = async () => {
    if (!cancelConfirm.motivo.trim()) {
      showAlert("Motivo Requerido", "Por favor escribe el motivo de la cancelación.", "warning");
      return;
    }
    
    const qtyToCancel = parseInt(cancelConfirm.cantidad);
    if (isNaN(qtyToCancel) || qtyToCancel <= 0 || qtyToCancel > cancelConfirm.maxQuantity) {
      showAlert("Cantidad Inválida", `Ingresa una cantidad válida a cancelar (1 a ${cancelConfirm.maxQuantity}).`, "warning");
      return;
    }
    
    // If cashier (cajero), verify supervisor credentials are typed
    if (!isAdmin && !isStaff) {
      if (!cancelConfirm.authUser.trim() || !cancelConfirm.authPass.trim()) {
        showAlert("Autorización Requerida", "Se requiere usuario y contraseña del supervisor.", "warning");
        return;
      }
    }

    try {
      await cancelSale(
        cancelConfirm.saleId,
        cancelConfirm.motivo.trim(),
        cancelConfirm.authUser.trim() || null,
        cancelConfirm.authPass.trim() || null,
        qtyToCancel
      );
      setCancelConfirm({ 
        show: false, 
        saleId: null, 
        motivo: '', 
        authUser: '', 
        authPass: '',
        productName: '',
        maxQuantity: 1,
        cantidad: 1
      });
      showAlert("Devolución Exitosa", `Se han cancelado/devuelto ${qtyToCancel} piezas del producto correctamente.`, "success");
      
      loadRecentSalesHistory();
      loadData();
      if (activeShift) loadShiftReport(activeShift.id);
      window.dispatchEvent(new Event("shiftChanged"));
    } catch (error) {
      console.error("Cancel sale error", error);
      showAlert("Error de Cancelación", error.response?.data?.detail || "Hubo un problema al procesar la cancelación.", "error");
    }
  };

  const activeSales = recentSales.filter(sale => !sale.cancelado);
  const cancelledSales = recentSales.filter(sale => sale.cancelado);
  const displayedSales = historyTab === 'sales' ? activeSales : cancelledSales;

  const getAuthorizedBy = (cancelReason) => {
    if (!cancelReason) return "N/A";
    const match = cancelReason.match(/\(Autorizado por:\s*([^)]+)\)/);
    if (match) return match[1];
    const partialMatch = cancelReason.match(/\(([^)]+)\)$/);
    if (partialMatch) return partialMatch[1];
    return "Supervisor";
  };

  const getCleanReason = (cancelReason) => {
    if (!cancelReason) return "N/A";
    return cancelReason
      .replace(/\s*\(Autorizado por:\s*[^)]+\)/, '')
      .replace(/\s*\([^)]+\)$/, '');
  };

  return (
    <div className="space-y-4">
      {/* Mobile Tab Select (Products / Cart) */}
      <div className="flex lg:hidden bg-white/85 backdrop-blur-xl rounded-2xl p-1.5 shadow-sm border border-gray-100 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'products' ? 'bg-chiluda-red text-white shadow-sm' : 'text-gray-500 hover:text-chiluda-red'
          }`}
        >
          Productos ({filteredInventory.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cart')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${
            activeTab === 'cart' ? 'bg-chiluda-red text-white shadow-sm' : 'text-gray-500 hover:text-chiluda-red'
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

      {/* Header and Shift Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-900 tracking-tight flex items-center animate-fade-in">
          <ShoppingCart className="mr-3 text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          Punto de Venta
        </h2>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(activeShift || isAdmin) && (
            <button
              onClick={() => {
                if (activeShift) {
                  loadShiftReport(activeShift.id);
                  setShiftTab('report');
                } else {
                  setShiftTab('open');
                }
                if (isAdmin) {
                  loadAdminShifts();
                }
                setShowShiftManager(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-700 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-chiluda-red hover:border-chiluda-red/30 transition-all shadow-sm font-semibold text-xs"
            >
              <Coins size={14} className="text-emerald-500" />
              <span>Control de Caja</span>
            </button>
          )}

          <button
            onClick={openHistoryModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-700 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-chiluda-red hover:border-chiluda-red/30 transition-all shadow-sm font-semibold text-xs"
          >
            <History size={14} className="text-chiluda-red" />
            <span>Devoluciones e Historial</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 relative">
        {/* Left Column: Products Grid */}
        <div className={`flex-1 space-y-6 ${activeTab === 'products' ? 'block' : 'hidden lg:block'}`}>
          {/* Search bar */}
          <div className="bg-white/10 backdrop-blur-[3px] p-3 sm:p-4 rounded-3xl shadow-soft border border-white/40 flex items-center animate-slide-up">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Buscar producto por nombre o código de barra (F1/Enter)..." 
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3.5 bg-brand-50/50 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-chiluda-red text-sm sm:text-lg shadow-inner font-medium transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                disabled={!activeShift && !isAdmin}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-full active:scale-95 transition-all"
                >
                  <X size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Locked Shift Overlay */}
          {!activeShift && !loadingShift && !isAdmin && (
            <div className="bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/30 p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-2xl space-y-6 py-16 animate-scale-in max-w-2xl mx-auto my-6">
              <div className="w-20 h-20 bg-emerald-500/15 text-emerald-600 rounded-3xl border border-emerald-500/30 flex items-center justify-center animate-bounce shadow-lg">
                <Lock size={40} className="stroke-[2.5]" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-2xl sm:text-3xl font-black text-stone-850 tracking-tight leading-none">Turno de Caja Requerido</h3>
                <p className="text-stone-500 text-xs sm:text-sm font-semibold leading-relaxed">
                  Para poder registrar ventas y emitir comprobantes, inicia tu turno de caja ingresando el fondo inicial en efectivo de <span className="font-extrabold text-stone-700">{storeSettings.nombre_tienda}</span>.
                </p>
              </div>
              
              <div className="w-full max-w-sm p-6 bg-white/20 backdrop-blur-md rounded-3xl border border-white/30 flex flex-col gap-4 shadow-xl">
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-black text-stone-600 uppercase tracking-wider block">Fondo Inicial ($ MXN)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    className="w-full px-4 py-3.5 bg-stone-50/70 border border-stone-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-center font-black text-2xl text-stone-850 transition-all shadow-inner placeholder-stone-400"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(e.target.value)}
                    placeholder="100.00"
                  />
                </div>
                
                <button
                  onClick={handleOpenShift}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound size={18} />
                  <span>Abrir Turno de Caja</span>
                </button>
              </div>
            </div>
          )}

          {/* Grid Products */}
          {(activeShift || isAdmin) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
              {filteredInventory.map((item, i) => {
                return (
                  <div 
                    key={item.id} 
                    onClick={() => item.cantidad > 0 && handleProductSelect(item)}
                    className={`bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-sm border border-white/40 overflow-hidden transition-all duration-300 flex flex-col group animate-slide-up ${item.cantidad > 0 ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1.5 hover:border-[#064e3b]/30 active:scale-95' : 'opacity-70'}`}
                    style={{ animationDelay: `${i * 0.02}s` }}
                  >
                    <div className="p-3 sm:p-5 flex-1 relative flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm sm:text-lg font-black text-brand-900 line-clamp-2 min-h-[2.5rem] pr-1 leading-tight group-hover:text-[#064e3b] transition-colors">{item.name}</h3>
                        {item.variantes && item.variantes.length > 0 && (
                          <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-extrabold mt-1 inline-block uppercase">Variantes ({item.variantes.length})</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-base sm:text-2xl font-extrabold text-chiluda-red tracking-tight">${item.precio.toFixed(2)}</p>
                        
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className={`px-2 py-0.5 rounded-full font-extrabold text-[9px] ${
                            item.cantidad > (item.inventario_minimo ?? 3) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            item.cantidad > 0 ? 'bg-orange-50 text-orange-700 border border-orange-100 animate-pulse' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {item.cantidad > 0 ? `Stock: ${item.cantidad}` : 'Agotado'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 sm:p-3 bg-brand-50/30 border-t border-gray-100">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleProductSelect(item); }}
                        disabled={item.cantidad <= 0}
                        className={`w-full py-2 rounded-xl font-bold text-white transition-colors flex items-center justify-center space-x-1 sm:space-x-2 text-xs ${
                          item.cantidad > 0 ? 'bg-[#064e3b] hover:bg-[#059669]' : 'bg-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <Plus size={14} />
                        <span>{item.cantidad > 0 ? 'Agregar' : 'Agotado'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredInventory.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                  No se encontraron productos coincidentes.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Shopping Cart Sidebar */}
        {(activeShift || isAdmin) && (
          <div className={`w-full lg:w-[420px] bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-glass border border-white/40 flex flex-col lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 overflow-hidden animate-slide-up ${
            activeTab === 'cart' ? 'flex h-[calc(100vh-12rem)]' : 'hidden lg:flex'
          }`} style={{ animationDelay: '0.05s' }}>
            {/* Cart Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white/40">
              <h3 className="text-lg font-black text-brand-900 flex items-center gap-2">
                <ShoppingCart className="text-chiluda-red w-5 h-5" />
                Carrito
              </h3>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 active:bg-red-100 px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    <span>Limpiar</span>
                  </button>
                )}
                <span className="bg-chiluda-red text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                  {cartItemCount} prod.
                </span>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <div className="bg-brand-50 p-6 rounded-full border border-gray-100">
                    <ShoppingCart size={40} className="text-gray-300" />
                  </div>
                  <p className="font-semibold text-gray-400 text-sm">El carrito de compras está vacío</p>
                </div>
              ) : (
                cart.map((item) => {
                  return (
                    <div key={item.cartItemId} className="flex flex-col p-3 bg-brand-50/50 rounded-2xl border border-gray-100 group hover:border-gray-200 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex flex-col pr-2">
                            <span className="font-black text-brand-900 text-xs sm:text-base leading-tight">{item.name}</span>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 active:bg-red-100 rounded-xl"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-chiluda-red font-bold text-sm">${item.precio.toFixed(2)}</span>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center space-x-1 bg-white rounded-xl border border-gray-200 p-0.5">
                          <button 
                            type="button"
                            onClick={() => updateCartQuantity(item.cartItemId, -1)}
                            disabled={item.cartQuantity <= 1}
                            className="p-2.5 text-gray-500 hover:text-chiluda-red active:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-xs font-black">{item.cartQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => updateCartQuantity(item.cartItemId, 1)}
                            className="p-2.5 text-gray-500 hover:text-chiluda-red active:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer / Checkout config */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-gray-100 bg-white/40 backdrop-blur-md space-y-4">
                {/* Discount and Totals */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">Descuento:</span>
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white p-0.5">
                      <input 
                        type="number" 
                        className="w-12 text-center text-xs font-bold focus:outline-none" 
                        value={cartDiscount}
                        onChange={(e) => setCartDiscount(e.target.value)}
                      />
                      <select 
                        className="text-[10px] font-bold text-gray-500 bg-transparent focus:outline-none cursor-pointer pr-1"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                      >
                        <option value="fixed">$</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                  
                  {cartDiscountTotal > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                      <span>Ahorro:</span>
                      <span>-${cartDiscountTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">Total a Cobrar:</span>
                    <span className="text-3xl font-black text-brand-900 tracking-tight">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAmountPaidCash('');
                    setAmountPaidCard('');
                    setPaymentMethod(null);
                    setShowCheckoutModal(true);
                  }}
                  disabled={cart.length === 0 || isProcessing}
                  className="w-full py-4 bg-chiluda-red hover:bg-chiluda-darkred text-white text-base font-extrabold rounded-2xl shadow-float flex items-center justify-center space-x-2 active:scale-95 transition-all"
                >
                  <CheckCircle size={20} />
                  <span>Cobrar (F2)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Split Payment Modal */}
      {showCheckoutModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight uppercase">
                {paymentMethod ? 'PROCESAR PAGO' : 'MÉTODO DE PAGO'}
              </h2>
              <button 
                onClick={() => { setShowCheckoutModal(false); setPaymentMethod(null); }} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {!paymentMethod ? (
                <div className="space-y-6">
                  {/* Buscador de Cliente */}
                  <div className="relative pb-4 border-b border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cliente Asociado:</label>
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-3.5 rounded-xl border border-emerald-200/80 font-bold">
                        <div>
                          <div className="text-sm text-slate-900 font-extrabold">{selectedCustomer.name}</div>
                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Deuda actual: <span className="font-bold">${selectedCustomer.saldo_actual.toFixed(2)}</span> | Límite: <span className="font-bold">${selectedCustomer.limite_credito.toFixed(2)}</span>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { setSelectedCustomer(null); setCustomerSearchTerm(''); }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-emerald-100 rounded-lg transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative z-10">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar cliente por nombre..."
                            value={customerSearchTerm}
                            onChange={(e) => {
                              setCustomerSearchTerm(e.target.value);
                              loadCustomersData(e.target.value);
                              setShowCustomerDropdown(true);
                            }}
                            onFocus={() => setShowCustomerDropdown(true)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-semibold text-slate-800 transition-all"
                          />
                        </div>
                        {showCustomerDropdown && customers.length > 0 && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowCustomerDropdown(false)} />
                            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-40 divide-y divide-slate-100">
                              {customers.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomer(c);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors text-xs flex flex-col group cursor-pointer"
                                >
                                  <span className="font-bold text-slate-800 group-hover:text-emerald-800">{c.name}</span>
                                  <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                    Deuda: <strong className="text-amber-600">${c.saldo_actual.toFixed(2)}</strong> | Límite: <strong className="text-slate-700">${c.limite_credito.toFixed(2)}</strong>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-center pb-4 border-b border-slate-100">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Monto a cobrar:</span>
                    <span className="text-4xl font-black text-emerald-600">${cartTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('efectivo')}
                      className="flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-chiluda-red hover:bg-red-50/30 transition-all group cursor-pointer"
                    >
                      <Banknote size={32} className="text-slate-400 group-hover:text-chiluda-red mb-2 transition-colors" />
                      <span className="font-extrabold text-xs text-slate-700 group-hover:text-chiluda-red uppercase tracking-wider">Efectivo</span>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('tarjeta')}
                      className="flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition-all group cursor-pointer"
                    >
                      <CreditCard size={32} className="text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                      <span className="font-extrabold text-xs text-slate-700 group-hover:text-blue-600 uppercase tracking-wider">Tarjeta</span>
                    </button>

                    <button
                      onClick={() => {
                        setPaymentMethod('mixto');
                        setAmountPaidCash('');
                        setAmountPaidCard('');
                      }}
                      className="flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-purple-500 hover:bg-purple-50/30 transition-all group cursor-pointer"
                    >
                      <Coins size={32} className="text-slate-400 group-hover:text-purple-500 mb-2 transition-colors" />
                      <span className="font-extrabold text-xs text-slate-700 group-hover:text-purple-600 uppercase tracking-wider">Pago Mixto</span>
                    </button>

                    <button
                      onClick={() => {
                        if (!selectedCustomer) {
                          showAlert("Cliente Requerido", "Busca y selecciona un cliente en el buscador de arriba para autorizar la venta a crédito.", "warning");
                          return;
                        }
                        setPaymentMethod('credito');
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all group cursor-pointer ${
                        selectedCustomer 
                          ? 'bg-emerald-50/60 border-emerald-500/80 text-emerald-800 hover:bg-emerald-100/60 shadow-xs' 
                          : 'bg-slate-50 border-slate-200/80 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                      }`}
                    >
                      <UserCheck size={32} className={`mb-2 transition-colors ${selectedCustomer ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="font-extrabold text-xs uppercase tracking-wider">Crédito / Fiar</span>
                      {selectedCustomer && (
                        <span className="text-[10px] font-bold text-emerald-700 mt-0.5 truncate max-w-full">
                          {selectedCustomer.name}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-sm font-bold pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Monto Neto:</span>
                    <span className="text-xl text-slate-800 font-extrabold">${cartTotal.toFixed(2)}</span>
                  </div>

                  {paymentMethod === 'efectivo' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Efectivo Recibido:</label>
                      <input
                        type="number"
                        placeholder="Ej. 200"
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-2xl text-center font-bold text-slate-800"
                        value={amountPaidCash}
                        onChange={(e) => setAmountPaidCash(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleCheckoutSubmit()}
                      />
                      {parseFloat(amountPaidCash) >= cartTotal && (
                        <div className="bg-emerald-50 text-emerald-800 text-sm font-extrabold p-3 rounded-xl border border-emerald-100 text-center animate-fade-in">
                          Cambio a devolver: ${(parseFloat(amountPaidCash) - cartTotal).toFixed(2)}
                        </div>
                      )}

                      {/* Quick cash presets */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setAmountPaidCash(cartTotal.toFixed(2))}
                          className="py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-xs border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          Exacto
                        </button>
                        {[50, 100, 200, 500, 1000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAmountPaidCash(val.toString())}
                            className="py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-xs border border-slate-200 transition-all active:scale-95 cursor-pointer"
                          >
                            ${val}
                          </button>
                        ))}
                      </div>

                      {/* Touch numeric keypad */}
                      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto pt-2 border-t border-slate-100 mt-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setAmountPaidCash(prev => prev + num.toString())}
                            className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAmountPaidCash('')}
                          className="h-11 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-sm rounded-xl flex items-center justify-center border border-red-100 transition-all active:scale-95 cursor-pointer"
                        >
                          C
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountPaidCash(prev => prev + '0')}
                          className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountPaidCash(prev => prev.slice(0, -1))}
                          className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          ⌫
                        </button>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'tarjeta' && (
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 text-blue-800 text-center flex flex-col items-center gap-2 animate-fade-in">
                      <CreditCard size={32} className="text-blue-500" />
                      <p className="font-bold text-sm">Cobro por Tarjeta bancaria</p>
                      <p className="text-xs opacity-75">Favor de deslizar o insertar la tarjeta en la terminal bancaria por el monto exacto de: <strong>${cartTotal.toFixed(2)}</strong></p>
                    </div>
                  )}

                  {paymentMethod === 'credito' && (
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 text-emerald-800 text-center flex flex-col items-center gap-2 animate-fade-in">
                      <UserCheck size={32} className="text-emerald-600 animate-bounce" />
                      <p className="font-bold text-sm">Cobro a Crédito / Fiado</p>
                      <p className="text-xs opacity-75">Se registrará el monto de <strong>${cartTotal.toFixed(2)}</strong> como saldo deudor en la cuenta de <strong>{selectedCustomer?.name}</strong>.</p>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-1">Saldo deudor previo: ${selectedCustomer?.saldo_actual.toFixed(2)} | Límite: ${selectedCustomer?.limite_credito.toFixed(2)}</p>
                    </div>
                  )}

                  {paymentMethod === 'mixto' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efectivo:</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold text-slate-800"
                            value={amountPaidCash}
                            onChange={(e) => {
                              const cash = parseFloat(e.target.value) || 0;
                              setAmountPaidCash(e.target.value);
                              const remaining = Math.max(0, cartTotal - cash);
                              setAmountPaidCard(remaining.toFixed(2));
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tarjeta:</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold bg-slate-50 text-slate-500"
                            value={amountPaidCard}
                            onChange={(e) => setAmountPaidCard(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold text-center italic">
                        Tip: Escribe la cantidad de efectivo y calcularemos el remanente en tarjeta.
                      </div>

                      {/* Touch numeric keypad for Mixto Efectivo */}
                      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto pt-2 border-t border-slate-100 mt-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setAmountPaidCash(prev => {
                                const newVal = prev + num.toString();
                                const cash = parseFloat(newVal) || 0;
                                const remaining = Math.max(0, cartTotal - cash);
                                setAmountPaidCard(remaining.toFixed(2));
                                return newVal;
                              });
                            }}
                            className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setAmountPaidCash('');
                            setAmountPaidCard(cartTotal.toFixed(2));
                          }}
                          className="h-11 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-sm rounded-xl flex items-center justify-center border border-red-100 transition-all active:scale-95 cursor-pointer"
                        >
                          C
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAmountPaidCash(prev => {
                              const newVal = prev + '0';
                              const cash = parseFloat(newVal) || 0;
                              const remaining = Math.max(0, cartTotal - cash);
                              setAmountPaidCard(remaining.toFixed(2));
                              return newVal;
                            });
                          }}
                          className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAmountPaidCash(prev => {
                              const newVal = prev.slice(0, -1);
                              const cash = parseFloat(newVal) || 0;
                              const remaining = Math.max(0, cartTotal - cash);
                              setAmountPaidCard(remaining.toFixed(2));
                              return newVal;
                            });
                          }}
                          className="h-11 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-lg rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          ⌫
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setPaymentMethod(null)}
                      className="w-1/3 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer uppercase text-xs tracking-wider"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={handleCheckoutSubmit}
                      disabled={isProcessing}
                      className="flex-1 py-3 bg-chiluda-red hover:bg-chiluda-darkred text-white font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer uppercase text-xs tracking-wider"
                    >
                      {isProcessing ? 'Confirmando...' : 'Confirmar Venta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Product Variant Quick Selection Modal */}
      {showVariantModal && variantProduct && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase">SELECCIONA VARIANTE</h2>
              <button onClick={() => setShowVariantModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Producto Base:</h4>
                <p className="text-base font-extrabold text-slate-800">{variantProduct.name}</p>
              </div>
              <div className="space-y-2">
                {variantProduct.variantes?.map(v => {
                  const varPrice = v.precio !== null ? v.precio : variantProduct.precio;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        addToCart(variantProduct, v);
                        setShowVariantModal(false);
                      }}
                      disabled={v.cantidad <= 0}
                      className={`w-full p-3.5 border border-slate-200/80 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-left flex justify-between items-center transition-all ${
                        v.cantidad <= 0 ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer active:scale-95'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-slate-800 sm:text-sm">{v.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Stock: {v.cantidad}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-emerald-600">${varPrice.toFixed(2)}</span>
                        <ArrowRight size={14} className="text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Ticket Modal (Thermal adaptation) */}
      {showTicketModal && lastSaleData && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 print:p-0 print:bg-white print:items-start">
          <div id="printable-ticket" className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
              <h3 className="text-lg font-black text-brand-900">Venta Completada</h3>
              <button onClick={() => setShowTicketModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0 font-mono text-[11px] text-gray-800 print:overflow-visible">
              <div className="text-center mb-4 flex flex-col items-center">
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-900">{storeSettings.nombre_tienda}</h2>
                {storeSettings.direccion && (
                  <p className="text-[9px] text-gray-500 font-semibold tracking-wide uppercase max-w-[250px]">{storeSettings.direccion}</p>
                )}
                {storeSettings.telefono && (
                  <p className="text-[9px] text-gray-500">Tel: {storeSettings.telefono}</p>
                )}
                <p className="text-[9px] text-gray-500 mt-2">{lastSaleData.date.toLocaleString()}</p>
                <p className="text-[10px] text-brand-900 font-bold mt-1">Ticket #{lastSaleData.saleId}</p>
                {lastSaleData.customerName && (
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">Cliente: {lastSaleData.customerName}</p>
                )}
                <p className="text-[9px] text-gray-400">Turno Caja #{lastSaleData.shiftId} | Atendido por: {lastSaleData.cashier}</p>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-2.5 mb-3 space-y-1.5">
                {lastSaleData.elementos.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div className="flex-1 pr-2">
                      <span>{item.cartQuantity}x {item.name}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      ${(item.precio * item.cartQuantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1.5 text-right mb-4">
                <div className="flex justify-between text-[10px]">
                  <span>Subtotal:</span>
                  <span>${lastSaleData.subtotal.toFixed(2)}</span>
                </div>
                {lastSaleData.discount > 0 && (
                  <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
                    <span>Descuento:</span>
                    <span>-${lastSaleData.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs border-t border-gray-200 pt-1.5 text-brand-900">
                  <span>TOTAL:</span>
                  <span>${lastSaleData.total.toFixed(2)}</span>
                </div>
                
                <div className="border-t border-gray-100 pt-1 text-[10px] text-gray-500 space-y-0.5">
                  <div className="flex justify-between uppercase">
                    <span>Método Pago:</span>
                    <span>{lastSaleData.paymentMethod}</span>
                  </div>
                  {lastSaleData.cashPaid > 0 && (
                    <div className="flex justify-between">
                      <span>Efectivo Recibido:</span>
                      <span>${lastSaleData.cashPaid.toFixed(2)}</span>
                    </div>
                  )}
                  {lastSaleData.cardPaid > 0 && (
                    <div className="flex justify-between">
                      <span>Tarjeta cobrado:</span>
                      <span>${lastSaleData.cardPaid.toFixed(2)}</span>
                    </div>
                  )}
                  {lastSaleData.change > 0 && (
                    <div className="flex justify-between font-bold text-[11px] text-brand-900">
                      <span>CAMBIO EN EFECTIVO:</span>
                      <span>${lastSaleData.change.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
 
              <div className="flex flex-col items-center mt-5">
                <QRCodeSVG value={`https://abarrotesedye.com/ticket/${lastSaleData.saleId}`} size={100} level="L" />
                <p className="text-center text-[9px] text-gray-400 mt-2 max-w-[200px]">Escanea para ticket digital</p>
                <p className="text-center font-bold text-[10px] text-gray-800 mt-3">{storeSettings.pie_ticket || "¡Gracias por preferirnos!"}</p>
              </div>

              {/* Panel de WhatsApp (escondido al imprimir) */}
              <div className="border-t border-dashed border-gray-300 pt-4 mt-4 print:hidden space-y-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider text-left">
                  Enviar ticket por WhatsApp
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. 5218112345678"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent transition-all shadow-inner"
                  />
                  <button
                    onClick={handleSendTicketWhatsApp}
                    disabled={sendingWhatsApp || !whatsAppPhone}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:scale-100"
                  >
                    {sendingWhatsApp ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex gap-2 bg-gray-50 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 shadow-sm text-sm"
              >
                <Printer size={16} />
                <span>Imprimir Ticket</span>
              </button>
              <button
                onClick={() => {
                  setShowTicketModal(false);
                  searchInputRef.current?.focus();
                }}
                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-chiluda-red hover:bg-chiluda-darkred shadow-lg transition-all text-sm"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Shift Closure Ticket Modal */}
      {showShiftTicketModal && lastShiftReport && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 print:p-0 print:bg-white print:items-start">
          <div id="printable-shift-ticket" className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
              <h3 className="text-lg font-black text-brand-900">Corte de Caja Completo</h3>
              <button onClick={() => setShowShiftTicketModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0 font-mono text-[11px] text-gray-800 print:overflow-visible">
              <div className="text-center mb-4 flex flex-col items-center">
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-900">{storeSettings.nombre_tienda}</h2>
                <p className="text-[10px] font-black text-gray-500 mt-1 uppercase">REPORTE DE CIERRE DE CAJA</p>
                <p className="text-[9px] text-gray-400 mt-2">Impreso: {new Date().toLocaleString()}</p>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-2.5 mb-3 space-y-1.5">
                <div className="flex justify-between">
                  <span>Turno ID:</span>
                  <span className="font-bold">#{lastShiftReport.shift.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cajero:</span>
                  <span className="font-bold">{lastShiftReport.shift.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Apertura:</span>
                  <span>{new Date(lastShiftReport.shift.hora_inicio).toLocaleString()}</span>
                </div>
                {lastShiftReport.shift.hora_fin && (
                  <div className="flex justify-between">
                    <span>Cierre:</span>
                    <span>{new Date(lastShiftReport.shift.hora_fin).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estado:</span>
                  <span className="font-black uppercase text-red-600">{lastShiftReport.shift.estado}</span>
                </div>
              </div>
              
              <div className="space-y-1.5 mb-4">
                <div className="font-bold border-b border-gray-150 pb-1 mb-1 text-[10px] text-gray-500 uppercase">Resumen de Caja</div>
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <span>${lastShiftReport.shift.efectivo_inicial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ventas en Efectivo:</span>
                  <span>+${lastShiftReport.totals.cash_sales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Abonos Recibidos:</span>
                  <span>+${lastShiftReport.totals.cash_entries.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Salidas/Retiros:</span>
                  <span>-${lastShiftReport.totals.cash_withdrawals.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-brand-900 border-t border-gray-100 pt-1.5">
                  <span>Efectivo Esperado:</span>
                  <span>${lastShiftReport.shift.efectivo_final_esperado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-brand-900">
                  <span>Efectivo Real Contado:</span>
                  <span>${lastShiftReport.shift.efectivo_final_real?.toFixed(2) || "0.00"}</span>
                </div>
                
                {lastShiftReport.shift.diferencia !== 0 && (
                  <div className={`flex justify-between font-black border-t border-gray-100 pt-1.5 ${lastShiftReport.shift.diferencia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    <span>{lastShiftReport.shift.diferencia < 0 ? 'FALTANTE (DIFERENCIA):' : 'SOBRANTE (DIFERENCIA):'}</span>
                    <span>${lastShiftReport.shift.diferencia.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mb-4 border-t border-gray-100 pt-3">
                <div className="font-bold border-b border-gray-150 pb-1 mb-1 text-[10px] text-gray-500 uppercase">Otros Métodos de Venta</div>
                <div className="flex justify-between">
                  <span>Ventas con Tarjeta:</span>
                  <span>${lastShiftReport.totals.card_sales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ventas a Crédito (Fiado):</span>
                  <span>${lastShiftReport.totals.credit_sales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-700 border-t border-gray-100 pt-1.5">
                  <span>Total Ventas Brutas:</span>
                  <span>${(lastShiftReport.totals.cash_sales + lastShiftReport.totals.card_sales + (lastShiftReport.totals.credit_sales || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Ventas Canceladas:</span>
                  <span>-${lastShiftReport.totals.cancelled_sales_total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="text-center text-[9px] text-stone-400 mt-6 pt-3 border-t border-dashed border-stone-200">
                Fin del Reporte de Turno. Firma Cajero / Supervisor
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex gap-2 bg-gray-50 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 shadow-sm text-sm"
              >
                <Printer size={16} />
                <span>Imprimir Corte</span>
              </button>
              <button
                onClick={() => setShowShiftTicketModal(false)}
                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-chiluda-red hover:bg-chiluda-darkred shadow-lg transition-all text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Control de Caja / Shift Manager Modal */}
      {showShiftManager && (activeShift || isAdmin) && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Coins className="text-emerald-600 w-5 h-5 shrink-0" />
                <span>GESTIÓN DE TURNO Y CONTROL DE CAJA</span>
              </h2>
              <button 
                onClick={() => setShowShiftManager(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              {activeShift && (
                <>
                  <button 
                    onClick={() => setShiftTab('report')}
                    className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                      shiftTab === 'report' ? 'border-chiluda-red text-chiluda-red bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Corte X (Ventas & Resumen)
                  </button>
                  <button 
                    onClick={() => setShiftTab('movement')}
                    className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                      shiftTab === 'movement' ? 'border-chiluda-red text-chiluda-red bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Registrar Movimiento Efectivo
                  </button>
                  <button 
                    onClick={() => setShiftTab('close')}
                    className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                      shiftTab === 'close' ? 'border-chiluda-red text-chiluda-red bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Corte Z (Cierre de Caja)
                  </button>
                </>
              )}
              {!activeShift && isAdmin && (
                <button 
                  onClick={() => setShiftTab('open')}
                  className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                    shiftTab === 'open' ? 'border-chiluda-red text-chiluda-red bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Abrir Mi Caja
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => {
                    setShiftTab('adminShifts');
                    loadAdminShifts();
                  }}
                  className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                    shiftTab === 'adminShifts' ? 'border-chiluda-red text-chiluda-red bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Turnos de Cajeros
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-5">
              {shiftTab === 'open' && !activeShift && isAdmin && (
                <div className="space-y-4 max-w-md mx-auto text-center py-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce border border-emerald-100">
                    <Coins size={32} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">Abrir Turno de Caja</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Como administrador, puedes iniciar tu propio turno de caja si deseas realizar ventas directas y registrar movimientos en esta sesión.
                    </p>
                  </div>
                  
                  <div className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col gap-3 text-left">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fondo Inicial ($ MXN) *</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold text-xl text-slate-800 transition-all"
                      value={initialCashInput}
                      onChange={(e) => setInitialCashInput(e.target.value)}
                    />
                    <button
                      onClick={handleOpenShift}
                      className="w-full py-3 bg-chiluda-red text-white font-bold rounded-xl hover:bg-chiluda-darkred transition-all shadow-sm active:scale-95 text-sm uppercase tracking-wider"
                    >
                      Iniciar Turno
                    </button>
                  </div>
                </div>
              )}

              {shiftTab === 'report' && shiftReport && activeShift && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fondo de Caja:</span>
                      <span className="text-xl font-extrabold text-slate-800">${shiftReport.shift.efectivo_inicial.toFixed(2)}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Efectivo Esperado:</span>
                      <span className="text-xl font-extrabold text-emerald-600">${shiftReport.shift.efectivo_final_esperado.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50 space-y-2.5">
                    <h4 className="text-xs font-black uppercase text-slate-700 pb-2 border-b border-slate-200/60 tracking-wider">Desglose de Ventas del Turno:</h4>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Ventas en Efectivo:</span>
                      <span className="text-slate-800">${shiftReport.totals.cash_sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Ventas en Tarjeta:</span>
                      <span className="text-slate-800">${shiftReport.totals.card_sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-200/60 text-slate-900">
                      <span>Total de Ventas:</span>
                      <span>${shiftReport.totals.total_sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-red-500 pt-1">
                      <span>Cancelaciones Totales:</span>
                      <span>${shiftReport.totals.cancelled_sales_total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50 space-y-2.5">
                    <h4 className="text-xs font-black uppercase text-slate-700 pb-2 border-b border-slate-200/60 tracking-wider">Movimientos Manuales:</h4>
                    <div className="flex justify-between text-xs font-bold text-emerald-600">
                      <span>Entradas:</span>
                      <span>+${shiftReport.totals.cash_entries.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-red-500">
                      <span>Retiros / Salidas:</span>
                      <span>-${shiftReport.totals.cash_withdrawals.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {shiftTab === 'movement' && activeShift && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setCashMovementType('entrada')}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border-2 transition-all ${
                        cashMovementType === 'entrada' 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Entrada (Ingreso Cambio)
                    </button>
                    <button
                      onClick={() => setCashMovementType('salida')}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border-2 transition-all ${
                        cashMovementType === 'salida' 
                          ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Salida / Retiro Parcial
                    </button>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cantidad ($) *</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-bold text-slate-800 transition-all"
                      value={cashMovementAmount}
                      onChange={(e) => setCashMovementAmount(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción / Motivo *</label>
                    <textarea
                      rows={3}
                      placeholder="Ej. Cambio de caja, compra de insumos, retiro parcial de seguridad..."
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-semibold resize-none text-slate-800 transition-all"
                      value={cashMovementReason}
                      onChange={(e) => setCashMovementReason(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleCashMovement}
                    className="w-full py-3.5 bg-chiluda-red text-white font-bold rounded-xl hover:bg-chiluda-darkred active:scale-95 transition-all text-sm uppercase shadow-sm"
                  >
                    Registrar Movimiento
                  </button>
                </div>
              )}

              {shiftTab === 'close' && shiftReport && activeShift && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs sm:text-sm shadow-xs">
                    <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={20} />
                    <div className="space-y-1">
                      <p className="font-extrabold text-amber-900">Procedimiento de Corte Z</p>
                      <p className="opacity-90 leading-relaxed text-xs text-amber-800 font-medium">
                        El Corte Z cerrará este turno de caja. A continuación, favor de contar físicamente todo el efectivo disponible en la gaveta e ingresarlo. Se calcularán automáticamente los descuadres de caja.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Efectivo Esperado (Fórmula Sistema):</span>
                    <span className="text-lg font-extrabold text-slate-800">${shiftReport.shift.efectivo_final_esperado.toFixed(2)}</span>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Efectivo Físico Contado ($) *</label>
                    <input
                      type="number"
                      placeholder="Ej. 1000"
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold text-2xl text-slate-800 transition-all"
                      value={closeCashReal}
                      onChange={(e) => setCloseCashReal(e.target.value)}
                    />
                  </div>

                  {closeCashReal !== '' && (
                    <div className={`p-4 rounded-2xl border text-center font-extrabold text-sm animate-fade-in ${
                      parseFloat(closeCashReal) - shiftReport.shift.efectivo_final_esperado === 0 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      {parseFloat(closeCashReal) - shiftReport.shift.efectivo_final_esperado === 0 
                        ? 'Caja cuadrada con éxito ($0.00 descuadre)' 
                        : `Diferencia (Descuadre): $${(parseFloat(closeCashReal) - shiftReport.shift.efectivo_final_esperado).toFixed(2)}`
                      }
                    </div>
                  )}

                  <button
                    onClick={handleCloseShift}
                    className="w-full py-3.5 bg-chiluda-red text-white font-bold rounded-xl hover:bg-chiluda-darkred active:scale-95 transition-all text-sm uppercase shadow-sm"
                  >
                    Confirmar Corte Z y Cerrar Caja
                  </button>
                </div>
              )}

              {shiftTab === 'adminShifts' && isAdmin && (
                <div className="space-y-4">
                  {selectedShiftToClose ? (
                    <div className="space-y-4 animate-scale-in">
                      <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
                        <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={20} />
                        <div className="space-y-1">
                          <p className="font-extrabold">Corte Forzado por Administrador</p>
                          <p className="opacity-90 leading-relaxed text-xs text-amber-800 font-medium">
                            Estás realizando el cierre del turno del cajero <strong>{selectedShiftToClose.nombre_completo || selectedShiftToClose.nombre_usuario}</strong>. El cajero será desconectado del control de caja.
                          </p>
                        </div>
                      </div>

                      <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50 space-y-2.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Fondo Inicial:</span>
                          <span className="text-slate-800">${selectedShiftToClose.efectivo_inicial.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Efectivo Esperado en Caja:</span>
                          <span className="text-emerald-600 font-extrabold">${selectedShiftToClose.efectivo_final_esperado.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Hora de Inicio:</span>
                          <span className="text-slate-800">{new Date(selectedShiftToClose.hora_inicio).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Efectivo Físico Contado ($) *</label>
                        <input
                          type="number"
                          placeholder="Ej. 1000"
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold text-2xl text-slate-800 transition-all"
                          value={adminCloseReal}
                          onChange={(e) => setAdminCloseReal(e.target.value)}
                        />
                      </div>

                      {adminCloseReal !== '' && (
                        <div className={`p-4 rounded-2xl border text-center font-extrabold text-sm animate-fade-in ${
                          parseFloat(adminCloseReal) - selectedShiftToClose.efectivo_final_esperado === 0 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          {parseFloat(adminCloseReal) - selectedShiftToClose.efectivo_final_esperado === 0 
                            ? 'Caja cuadrada ($0.00 descuadre)' 
                            : `Diferencia (Descuadre): $${(parseFloat(adminCloseReal) - selectedShiftToClose.efectivo_final_esperado).toFixed(2)}`
                          }
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setSelectedShiftToClose(null);
                            setAdminCloseReal('');
                          }}
                          className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 active:scale-95 transition-all text-xs uppercase"
                        >
                          Atrás
                        </button>
                        <button
                          onClick={() => handleCloseShiftAdmin(selectedShiftToClose.id, parseFloat(adminCloseReal))}
                          className="flex-[2] py-3 bg-chiluda-red text-white font-extrabold rounded-xl hover:bg-chiluda-darkred active:scale-95 transition-all text-xs uppercase shadow-sm"
                        >
                          Confirmar Corte y Cerrar Caja
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loadingAdminShifts ? (
                        <div className="text-center py-8 text-slate-500 font-medium text-xs">
                          Cargando turnos de cajeros...
                        </div>
                      ) : adminShifts.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 font-medium text-xs">
                          No hay turnos activos de otros cajeros.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200/60 rounded-2xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <th className="p-3">Cajero</th>
                                <th className="p-3">Apertura</th>
                                <th className="p-3 text-right">Esperado</th>
                                <th className="p-3 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {adminShifts.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50 font-medium">
                                  <td className="p-3">
                                    <div className="font-bold text-slate-800">{s.nombre_completo}</div>
                                    <div className="text-[10px] text-slate-400">@{s.nombre_usuario}</div>
                                  </td>
                                  <td className="p-3 text-slate-500">
                                    {new Date(s.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-right font-bold text-emerald-600">
                                    ${s.efectivo_final_esperado.toFixed(2)}
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => {
                                        setSelectedShiftToClose(s);
                                        setAdminCloseReal('');
                                      }}
                                      className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-xl font-bold transition-all text-[11px]"
                                    >
                                      Hacer Corte
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sales History and Return Modal */}
      {showHistoryModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <History className="text-emerald-600 w-5 h-5 shrink-0" />
                <span>HISTORIAL DE VENTAS E INCIDENCIAS</span>
              </h2>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-grow">
              <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 max-w-md">
                <button
                  type="button"
                  onClick={() => setHistoryTab('sales')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    historyTab === 'sales' 
                      ? 'bg-emerald-600 text-white shadow-sm hover:text-white' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Ventas Completadas ({activeSales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('cancellations')}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    historyTab === 'cancellations' 
                      ? 'bg-emerald-600 text-white shadow-sm hover:text-white' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Canceladas / Reembolsos ({cancelledSales.length})
                </button>
              </div>

              {historyLoading ? (
                <div className="py-12 text-center text-slate-500 animate-pulse font-medium text-xs">Cargando...</div>
              ) : displayedSales.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium text-xs">No se encontraron registros.</div>
              ) : (
                <div className="overflow-x-auto w-full border border-slate-150 rounded-xl">
                  <table className="w-full min-w-[800px] text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Fecha / Hora</th>
                        <th className="px-4 py-3">Vendedor</th>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-center">Cant.</th>
                        <th className="px-4 py-3 text-right">Precio Unit.</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        {historyTab === 'sales' ? (
                          <th className="px-4 py-3 text-center">Acción</th>
                        ) : (
                          <>
                            <th className="px-4 py-3">Autorizó</th>
                            <th className="px-4 py-3">Razón / Bitácora</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayedSales.map((sale) => {
                        const date = new Date(sale.creado_en);
                        const formattedDate = isNaN(date.getTime()) 
                          ? sale.creado_en.replace("T", " ").split(".")[0] 
                          : date.toLocaleString('es-MX', { hour12: false });
                        
                        const unitPrice = sale.product_price;
                        const total = (unitPrice * sale.cantidad);
                        
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                            <td className="px-4 py-3 text-slate-600 font-semibold">{sale.cashier_name || "Desconocido"}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{sale.nombre_producto}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">{sale.cantidad}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-600">${unitPrice.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">${total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sale.cancelado ? 'bg-red-50 text-red-700 animate-pulse' : 'bg-green-50 text-green-700'
                              }`}>
                                {sale.cancelado ? 'Cancelada' : 'Completada'}
                              </span>
                            </td>
                            {historyTab === 'sales' ? (
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => triggerCancelSale(sale.id)}
                                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 transition-all"
                                >
                                  Cancelar/Devolver
                                </button>
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-slate-600 font-bold">{getAuthorizedBy(sale.motivo_cancelacion)}</td>
                                <td className="px-4 py-3 text-slate-500 font-medium italic">{getCleanReason(sale.motivo_cancelacion)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {cancelConfirm.show && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Lock className="text-emerald-600 w-5 h-5 shrink-0" />
                <span>AUTORIZACIÓN DEL SUPERVISOR</span>
              </h2>
              <button 
                onClick={() => setCancelConfirm({ show: false, saleId: null, motivo: '', authUser: '', authPass: '', productName: '', maxQuantity: 1, cantidad: 1 })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-wider block">Producto a Cancelar:</span>
                <span className="text-sm font-bold text-slate-800 block">{cancelConfirm.productName}</span>
                <span className="text-[10px] text-slate-500 block">Vendidas originalmente: <strong>{cancelConfirm.maxQuantity}</strong></span>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cantidad a Cancelar/Devolver *</label>
                <input
                  type="number"
                  min="1"
                  max={cancelConfirm.maxQuantity}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center font-bold text-lg text-slate-800 transition-all"
                  value={cancelConfirm.cantidad}
                  onChange={(e) => setCancelConfirm(prev => ({ ...prev, cantidad: e.target.value }))}
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Motivo de la cancelación *</label>
                <textarea
                  placeholder="Ej. Error de cobro, devolución física de cliente..."
                  rows={2}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-semibold resize-none text-slate-800 transition-all"
                  value={cancelConfirm.motivo}
                  onChange={(e) => setCancelConfirm(prev => ({ ...prev, motivo: e.target.value }))}
                />
              </div>

              <p className="text-xs text-slate-400 leading-normal">
                Esta acción requiere la clave de autorización de un <strong>Supervisor</strong> o <strong>Administrador</strong> para poder devolver el inventario e impactar el balance de caja.
              </p>
              
              {/* Only show credentials input if NOT admin/supervisor */}
              {!isAdmin && !isStaff && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Usuario Supervisor *</label>
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-bold text-slate-800 transition-all"
                      value={cancelConfirm.authUser}
                      onChange={(e) => setCancelConfirm(prev => ({ ...prev, authUser: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Contraseña *</label>
                    <input
                      type="password"
                      className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-bold text-slate-800 transition-all"
                      value={cancelConfirm.authPass}
                      onChange={(e) => setCancelConfirm(prev => ({ ...prev, authPass: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 p-5 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCancelConfirm({ show: false, saleId: null, motivo: '', authUser: '', authPass: '', productName: '', maxQuantity: 1, cantidad: 1 })}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-100 transition-all text-sm uppercase"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={processCancelSale}
                className="px-5 py-2.5 rounded-xl bg-chiluda-red hover:bg-chiluda-darkred text-white font-bold transition-all text-sm uppercase shadow-sm active:scale-95"
              >
                Confirmar Autorización
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Global alert Toast overlay */}
      <AlertModal
        isOpen={customAlert.show}
        tipo={customAlert.tipo}
        titulo={customAlert.title}
        mensaje={customAlert.message}
        onClose={() => setCustomAlert(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default Sales;
