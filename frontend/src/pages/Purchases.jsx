import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, Plus, Search, Trash2, X, Eye, FileText, Calendar, DollarSign, Tag, Info, User } from 'lucide-react';
import { fetchInventory, fetchSuppliers, fetchPurchases, createPurchase } from '../api';

const Purchases = () => {
  // Tabs: 'register' or 'history'
  const [activeTab, setActiveTab] = useState('register');
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);

  // Search and Select Product State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // New Item Row State
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemCostPrice, setItemCostPrice] = useState(0);
  const [itemRetailPrice, setItemRetailPrice] = useState(0);

  // Purchase Details State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);

  // Detail Modal State
  const [viewingPurchase, setViewingPurchase] = useState(null);

  // Status Alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const [invData, supData, purData] = await Promise.all([
        fetchInventory(),
        fetchSuppliers(),
        fetchPurchases()
      ]);
      setInventory(invData);
      setSuppliers(supData);
      setPurchases(purData);
    } catch (err) {
      console.error('Error loading page data:', err);
      setError('No se pudo cargar la información necesaria.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle product selection
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setProductSearchQuery(product.name);
    setShowProductDropdown(false);

    // Default values
    if (product.variants && product.variants.length > 0) {
      // If product has variants, select the first one by default
      const firstVar = product.variants[0];
      setSelectedVariantId(firstVar.id);
      setItemCostPrice(firstVar.cost_price ?? product.cost_price ?? 0);
      setItemRetailPrice(firstVar.price ?? product.price ?? 0);
    } else {
      setSelectedVariantId('');
      setItemCostPrice(product.cost_price ?? 0);
      setItemRetailPrice(product.price ?? 0);
    }
    setItemQuantity(1);
  };

  // Handle variant change
  const handleVariantChange = (variantId) => {
    setSelectedVariantId(variantId);
    if (selectedProduct) {
      const variant = selectedProduct.variants.find(v => v.id === parseInt(variantId));
      if (variant) {
        setItemCostPrice(variant.cost_price ?? selectedProduct.cost_price ?? 0);
        setItemRetailPrice(variant.price ?? selectedProduct.price ?? 0);
      }
    }
  };

  // Add Item to List
  const handleAddItem = () => {
    if (!selectedProduct) {
      setError('Debe seleccionar un producto.');
      return;
    }
    if (itemQuantity <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (itemCostPrice < 0) {
      setError('El precio de costo no puede ser menor a 0.');
      return;
    }

    // Check if variant is chosen but product has variants
    if (selectedProduct.variants && selectedProduct.variants.length > 0 && !selectedVariantId) {
      setError('Debe seleccionar una variante del producto.');
      return;
    }

    // Find variant details if applicable
    let variantName = '';
    let variantIdInt = null;
    if (selectedVariantId) {
      variantIdInt = parseInt(selectedVariantId);
      const foundVar = selectedProduct.variants.find(v => v.id === variantIdInt);
      if (foundVar) {
        variantName = foundVar.name;
      }
    }

    // Check if item is already in purchase items (same product + variant)
    const existingIndex = purchaseItems.findIndex(
      item => item.product_id === selectedProduct.id && item.variant_id === variantIdInt
    );

    if (existingIndex > -1) {
      // Overwrite or append? Let's overwrite with new quantity and prices
      const updatedItems = [...purchaseItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + itemQuantity,
        cost_price: itemCostPrice, // Use the latest cost price
        price: itemRetailPrice > 0 ? itemRetailPrice : updatedItems[existingIndex].price
      };
      setPurchaseItems(updatedItems);
    } else {
      setPurchaseItems([
        ...purchaseItems,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          variant_id: variantIdInt,
          variant_name: variantName,
          quantity: itemQuantity,
          cost_price: itemCostPrice,
          price: itemRetailPrice > 0 ? itemRetailPrice : null
        }
      ]);
    }

    // Clear search selection
    setSelectedProduct(null);
    setSelectedVariantId('');
    setProductSearchQuery('');
    setItemQuantity(1);
    setItemCostPrice(0);
    setItemRetailPrice(0);
  };

  // Remove Item from List
  const handleRemoveItem = (index) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  // Calculate Subtotal and Grand Total
  const calculateTotal = () => {
    return purchaseItems.reduce((acc, item) => acc + (item.cost_price * item.quantity), 0);
  };

  // Submit Purchase
  const handleSubmitPurchase = async () => {
    if (purchaseItems.length === 0) {
      setError('Debe agregar al menos un artículo a la compra.');
      return;
    }

    const payload = {
      supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
      invoice_number: invoiceNumber || null,
      notes: purchaseNotes || null,
      items: purchaseItems.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        cost_price: item.cost_price,
        price: item.price
      }))
    };

    try {
      await createPurchase(payload);
      setSuccess('Compra registrada y stock actualizado con éxito.');
      
      // Clear forms
      setPurchaseItems([]);
      setSelectedSupplierId('');
      setInvoiceNumber('');
      setPurchaseNotes('');
      
      // Reload lists
      loadData();
      
      // Switch tab
      setActiveTab('history');
    } catch (err) {
      const detailMsg = err.response?.data?.detail || 'Error al procesar el registro de compra.';
      setError(detailMsg);
    }
  };

  // Filtered inventory list for dropdown search
  const filteredProducts = inventory.filter(p => {
    const q = productSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    );
  }).slice(0, 5); // Limit to top 5 results for fast selection

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>Compras y Entradas de Mercancía</span>
        </h2>

        {/* Tab Selector */}
        <div className="flex bg-stone-100 border border-stone-200/50 p-1 rounded-full shadow-inner w-full sm:w-auto self-center xl:self-auto shrink-0 select-none">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all duration-300 w-1/2 sm:w-auto text-center ${
              activeTab === 'register' 
                ? 'bg-[#064e3b] text-white shadow-sm' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Nueva Compra
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-full font-bold text-xs uppercase transition-all duration-300 w-1/2 sm:w-auto text-center ${
              activeTab === 'history' 
                ? 'bg-[#064e3b] text-white shadow-sm' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Historial
          </button>
        </div>
      </div>

      {/* Error Alert Modal */}
      {error && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up border border-red-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Error</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">{error}</p>
              <button
                onClick={() => setError('')}
                className="px-6 py-2.5 bg-chiluda-red text-white font-bold rounded-md w-full hover:bg-chiluda-darkred transition-colors shadow-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Alert Modal */}
      {success && createPortal(
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
        </div>,
        document.body
      )}

      {/* VIEW PURCHASE DETAIL MODAL */}
      {viewingPurchase && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-white animate-scale-in">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50 flex-shrink-0">
              <h3 className="text-md font-bold text-stone-800">
                Detalle de Entrada / Compra #{viewingPurchase.id}
              </h3>
              <button 
                onClick={() => setViewingPurchase(null)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-150 font-semibold text-stone-600">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-stone-450" />
                    <span>Fecha: <strong className="text-stone-800">{formatDate(viewingPurchase.created_at)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-stone-450" />
                    <span>Proveedor: <strong className="text-stone-800">{viewingPurchase.supplier_name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-stone-450" />
                    <span>Factura/Ticket: <strong className="text-stone-800">{viewingPurchase.invoice_number || 'N/A'}</strong></span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-stone-450" />
                    <span>Registrado por: <strong className="text-stone-800">{viewingPurchase.user_name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-[#10b981]" />
                    <span>Costo Total: <strong className="text-emerald-700 text-sm font-black">${viewingPurchase.total_cost.toFixed(2)}</strong></span>
                  </div>
                </div>
                {viewingPurchase.notes && (
                  <div className="md:col-span-2 pt-2 border-t border-stone-200 text-stone-500 italic">
                    Notas: {viewingPurchase.notes}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase text-stone-500 tracking-wider text-[10px]">Artículos Ingresados</h4>
                <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-50 text-stone-800 uppercase text-[9px] tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">Producto</th>
                        <th className="px-4 py-2.5 font-bold text-center">Cantidad</th>
                        <th className="px-4 py-2.5 font-bold text-right">Costo Unitario</th>
                        <th className="px-4 py-2.5 font-bold text-right">Precio Venta (Asignado)</th>
                        <th className="px-4 py-2.5 font-bold text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {viewingPurchase.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/50">
                          <td className="px-4 py-2.5 font-bold text-stone-800">{item.product_name}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-stone-600">{item.quantity} pzs</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-stone-600">${item.cost_price.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-stone-500">
                            {item.price ? `$${item.price.toFixed(2)}` : <span className="text-stone-400 italic">Sin actualizar</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-stone-800">${(item.cost_price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 bg-stone-50/80 border-t border-stone-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-6 py-2 bg-[#064e3b] text-white font-bold rounded-full hover:bg-stone-800 transition-colors shadow-md text-xs uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ACTIVE TAB VIEWS */}
      {activeTab === 'register' ? (
        // ================= REGISTER PURCHASE TAB =================
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Form Left Side (Supplier & Metadata) */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl p-6 border border-white/40 shadow-soft flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase text-[#064e3b] tracking-wider border-b border-stone-100 pb-2">Información del Proveedor</h3>
              
              {/* Supplier Select */}
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Proveedor</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 text-xs font-bold"
                >
                  <option value="">Compra Directa (Sin Proveedor)</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.rfc ? `(${s.rfc})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Factura / Ticket # (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. FAC-12345"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 text-xs font-bold"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Notas de Entrada</label>
                <textarea
                  rows="3"
                  placeholder="Ej. Mercancía recibida en buen estado..."
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 text-xs font-bold resize-none"
                />
              </div>
            </div>

            {/* Subtotals & Submit Box */}
            <div className="bg-[#064e3b] text-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-white/10 relative overflow-hidden">
              {/* Background accent */}
              <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 select-none pointer-events-none">
                <ClipboardList size={220} />
              </div>

              <h3 className="text-sm font-black uppercase tracking-wider border-b border-white/10 pb-2">Resumen de Registro</h3>
              
              <div className="flex justify-between items-center text-xs font-semibold">
                <span>Artículos Añadidos:</span>
                <span className="bg-white/10 px-3 py-1 rounded-full text-white font-black">{purchaseItems.reduce((acc, item) => acc + item.quantity, 0)} pzs</span>
              </div>

              <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-2">
                <span className="text-xs font-bold text-gray-300">Costo Total Compra:</span>
                <span className="text-2xl font-black text-[#4ade80]">${calculateTotal().toFixed(2)}</span>
              </div>

              <button
                onClick={handleSubmitPurchase}
                disabled={purchaseItems.length === 0}
                className={`w-full mt-4 py-3 rounded-full font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-lg text-center ${
                  purchaseItems.length === 0 
                    ? 'bg-white/10 text-white/50 cursor-not-allowed border border-white/5' 
                    : 'bg-white text-[#064e3b] hover:bg-stone-50 active:scale-[0.98]'
                }`}
              >
                Registrar Entrada de Mercancía
              </button>
            </div>
          </div>

          {/* Cart & Selector Right Side */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Search & Add product card */}
            <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl p-6 border border-white/40 shadow-soft flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase text-[#064e3b] tracking-wider border-b border-stone-100 pb-2">Agregar Productos al Registro</h3>
              
              {/* Dynamic Search Box */}
              <div className="relative">
                <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Buscar Producto</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-4.5 w-4.5 text-stone-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Escribe nombre o código de barra..."
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 text-xs font-bold shadow-inner"
                  />
                  {selectedProduct && (
                    <button 
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductSearchQuery('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-450 hover:text-stone-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {showProductDropdown && productSearchQuery && !selectedProduct && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowProductDropdown(false)} />
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg z-30 overflow-hidden divide-y divide-stone-100">
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="px-4 py-3 hover:bg-stone-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <p className="font-bold text-stone-800">{p.name}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">Barras: {p.barcode || 'Sin código'} | Stock: {p.quantity} pzs</p>
                          </div>
                          <span className="bg-stone-100 border border-stone-200 px-2 py-1 rounded text-stone-600 font-bold">${p.price.toFixed(2)}</span>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="px-4 py-4 text-center text-stone-400 text-xs italic">
                          No se encontraron productos coincidentes.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Selected Product Information & Inputs */}
              {selectedProduct && (
                <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/80 animate-fade-in text-xs space-y-4">
                  
                  {/* Selected product title header */}
                  <div className="flex items-start justify-between border-b border-stone-200 pb-2">
                    <div>
                      <h4 className="font-black text-stone-800 text-sm">{selectedProduct.name}</h4>
                      <p className="text-[10px] text-stone-400 mt-0.5 font-semibold">Stock actual: {selectedProduct.quantity} pzs</p>
                    </div>
                    {/* Satellite units if any */}
                    <div className="flex gap-2">
                      <span className="bg-stone-200 border border-stone-300 text-stone-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">SAT: {selectedProduct.sat_key}</span>
                    </div>
                  </div>

                  {/* Variant Selection if exists */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Variante del Producto</label>
                      <select
                        value={selectedVariantId}
                        onChange={(e) => handleVariantChange(e.target.value)}
                        className="px-3 py-2 bg-white border border-stone-250 rounded-xl focus:outline-none text-xs font-bold w-full md:w-80"
                      >
                        {selectedProduct.variants.map(v => (
                          <option key={v.id} value={v.id}>{v.name} (Stock: {v.quantity} pzs | Costo: ${v.cost_price?.toFixed(2) ?? '-'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Quantities & Price configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    
                    {/* Quantity input */}
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                        <Plus size={11} className="text-stone-400" /> Cantidad a Ingresar
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-xs font-bold text-center"
                      />
                    </div>

                    {/* Cost price input */}
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                        <Tag size={11} className="text-[#064e3b]" /> Costo Unitario Compra ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemCostPrice}
                        onChange={(e) => setItemCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-xs font-bold text-center"
                      />
                    </div>

                    {/* New Retail Selling Price */}
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                        <DollarSign size={11} className="text-[#10b981]" /> Nuevo Precio Venta ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Opcional"
                        value={itemRetailPrice || ''}
                        onChange={(e) => setItemRetailPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white border border-stone-200 p-3.5 rounded-xl shadow-sm text-xs font-bold text-stone-600 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-stone-400 uppercase">Subtotal del Concepto</span>
                      <span className="text-[#064e3b] font-black text-sm">${(itemCostPrice * itemQuantity).toFixed(2)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-5 py-2 bg-chiluda-red text-white text-xs font-black uppercase rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all"
                    >
                      Añadir a la Compra
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List of current added items (Cart Table) */}
            <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl p-6 border border-white/40 shadow-soft flex flex-col gap-4 min-h-[300px]">
              <h3 className="text-sm font-black uppercase text-[#064e3b] tracking-wider border-b border-stone-100 pb-2">Artículos Añadidos a la Entrada</h3>
              
              <div className="overflow-x-auto flex-1">
                {purchaseItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400 text-xs font-bold h-full">
                    <ClipboardList size={36} className="text-stone-300 mb-2 animate-pulse" />
                    <span>No hay artículos en la lista</span>
                    <span className="text-stone-400 text-[10px] mt-1 font-semibold">Usa el buscador superior para agregar productos.</span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs font-semibold">
                    <thead className="bg-stone-50 text-stone-800 uppercase text-[9px] tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">Producto</th>
                        <th className="px-4 py-2.5 font-bold text-center">Cantidad</th>
                        <th className="px-4 py-2.5 font-bold text-right">Costo Unitario</th>
                        <th className="px-4 py-2.5 font-bold text-right">Nuevo Precio Venta</th>
                        <th className="px-4 py-2.5 font-bold text-right">Subtotal</th>
                        <th className="px-4 py-2.5 font-bold text-right">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-stone-800">{item.product_name}</div>
                            {item.variant_name && (
                              <div className="text-[10px] text-stone-400 font-bold mt-0.5">Variante: {item.variant_name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-stone-600">{item.quantity} pzs</td>
                          <td className="px-4 py-3 text-right font-semibold text-stone-600">${item.cost_price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-stone-500">
                            {item.price ? `$${item.price.toFixed(2)}` : <span className="text-stone-400 italic">No actualizar</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#064e3b]">${(item.cost_price * item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-stone-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="Quitar de la lista"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {purchaseItems.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-stone-100/50 flex-shrink-0">
                  <button
                    onClick={handleSubmitPurchase}
                    className="px-6 py-3 bg-[#064e3b] text-white font-black text-xs uppercase tracking-wider rounded-full hover:bg-stone-850 hover:shadow-float active:scale-[0.98] transition-all shadow-md"
                  >
                    Registrar Entrada de Mercancía (${calculateTotal().toFixed(2)})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ================= HISTORY TAB =================
        <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tl-xl">Entrada ID</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Fecha / Hora</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Proveedor</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Factura / Ticket</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Costo Total</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold text-center">Encargado / Notas</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tr-xl">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50 bg-transparent text-xs">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                    <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-stone-850 text-center">#{p.id}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-semibold text-stone-600 whitespace-nowrap text-center">{formatDate(p.created_at)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-stone-800 text-center">{p.supplier_name}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                      {p.invoice_number ? (
                        <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md font-mono text-[10px] font-bold border border-stone-200/50">
                          {p.invoice_number}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">Directo</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center font-black text-emerald-800">${p.total_cost.toFixed(2)}</td>
                    
                    {/* User and Notes */}
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 max-w-xs font-semibold text-stone-500 text-center">
                      <div className="flex flex-col gap-0.5 items-center justify-center">
                        <span className="text-stone-700 flex items-center gap-1"><User size={12} className="text-stone-400" /> {p.user_name}</span>
                        {p.notes && <span className="text-stone-400 italic truncate max-w-[200px]" title={p.notes}>Nota: {p.notes}</span>}
                      </div>
                    </td>
 
                    {/* Actions */}
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                      <button
                        onClick={() => setViewingPurchase(p)}
                        className="text-[#064e3b] hover:text-white hover:bg-[#064e3b] p-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 font-bold justify-center"
                        title="Ver detalles"
                      >
                        <Eye size={15} />
                        <span>Detalles</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {purchases.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-stone-500">
                      <div className="flex flex-col items-center justify-center">
                        <ClipboardList className="h-10 w-10 text-stone-300 mb-2" />
                        <span className="font-bold text-stone-450">No hay compras registradas en el historial</span>
                        <span className="text-stone-400 text-xs mt-1 font-semibold">Registra una entrada de mercancía en la pestaña anterior.</span>
                      </div>
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

export default Purchases;
