import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
import { createPortal } from 'react-dom';
import { 
  Users as CustomersIcon, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  DollarSign, 
  History, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  registerCustomerPayment, 
  fetchCustomerHistory 
} from '../api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Estados de datos
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    telefono: '',
    correo: '',
    limite_credito: 0.0
  });

  const [paymentData, setPaymentData] = useState({
    monto: '',
    notas: '',
    auth_username: '',
    auth_password: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
    loadCustomers();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers('');
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError('Error al cargar la lista de clientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const handleAddClick = () => {
    setSelectedCustomer(null);
    setFormData({
      name: '',
      telefono: '',
      correo: '',
      limite_credito: '0'
    });
    setError('');
    setShowFormModal(true);
  };

  const handleEditClick = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      telefono: customer.telefono || '',
      correo: customer.correo || '',
      limite_credito: customer.limite_credito.toString()
    });
    setError('');
    setShowFormModal(true);
  };

  const handleDeleteClick = (customer) => {
    if (customer.saldo_actual > 0) {
      setError('No se puede eliminar un cliente con saldo deudor pendiente.');
      return;
    }
    setDeleteConfirm(customer);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    try {
      await deleteCustomer(deleteConfirm.id);
      setSuccess('Cliente eliminado exitosamente.');
      setDeleteConfirm(null);
      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error al eliminar el cliente.');
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name.trim()) {
      setError('El nombre es requerido.');
      return;
    }

    try {
      const payload = {
        ...formData,
        limite_credito: parseFloat(formData.limite_credito) || 0
      };
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, payload);
        setSuccess('Cliente actualizado exitosamente.');
      } else {
        await createCustomer(payload);
        setSuccess('Cliente registrado exitosamente.');
      }
      setShowFormModal(false);
      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error al guardar el cliente.');
    }
  };

  const handlePaymentClick = (customer) => {
    setSelectedCustomer(customer);
    setPaymentData({
      monto: '',
      notas: '',
      auth_username: '',
      auth_password: ''
    });
    setError('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(paymentData.monto);
    if (isNaN(amt) || amt <= 0) {
      setError('El monto del abono debe ser un número mayor a 0.');
      return;
    }

    if (currentUser?.rol === 'cajero') {
      if (!paymentData.auth_username.trim() || !paymentData.auth_password) {
        setError('Para registrar un abono como Cajero se requiere el usuario y contraseña de Administrador o Supervisor.');
        return;
      }
    }

    try {
      const payload = {
        monto: amt,
        notas: paymentData.notas
      };
      if (currentUser?.rol === 'cajero') {
        payload.auth_username = paymentData.auth_username.trim();
        payload.auth_password = paymentData.auth_password;
      }
      await registerCustomerPayment(selectedCustomer.id, payload);
      setSuccess(`Abono de $${amt.toFixed(2)} registrado para ${selectedCustomer.name}.`);
      setShowPaymentModal(false);
      loadCustomers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error al registrar el abono.');
    }
  };

  const handleHistoryClick = async (customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const data = await fetchCustomerHistory(customer.id);
      setCustomerHistory(data.history || []);
    } catch (err) {
      console.error(err);
      setError('Error al obtener el historial del cliente.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const name = c.name || '';
    const phone = c.telefono || '';
    const email = c.correo || '';
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      phone.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
            <CustomersIcon className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
            <span>Crédito y Clientes</span>
          </h2>
          <p className="text-xs text-stone-400 font-bold mt-1 uppercase tracking-wider">
            Administra cuentas corrientes, límites de crédito y abonos de clientes
          </p>
        </div>

        {(currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor') && (
          <button
            onClick={handleAddClick}
            className="flex items-center justify-center space-x-2 bg-chiluda-red hover:bg-chiluda-darkred text-white px-5 py-2.5 rounded-full hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float w-full xl:w-auto font-black text-xs uppercase tracking-wider shrink-0"
          >
            <UserPlus size={16} />
            <span>Nuevo Cliente</span>
          </button>
        )}
      </div>

      <AlertModal 
        isOpen={!!success || !!error}
        tipo={success ? 'success' : 'error'}
        mensaje={success || error}
        onClose={() => { setSuccess(''); setError(''); }}
      />

      {/* Buscador */}
      <div className="bg-white/10 backdrop-blur-[3px] rounded-[2.2rem] border border-white/40 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
          >
            BUSCAR
          </button>
        </form>
      </div>

      {/* Listado de Clientes */}
      <div className="bg-white/10 backdrop-blur-[3px] rounded-[2.2rem] border border-white/40 shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron clientes registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Cliente</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Contacto</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Límite de Crédito</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Saldo Deudor</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center rounded-tr-xl">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center">
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">ID: {c.id}</div>
                    </td>
                    <td className="p-4 space-y-1 text-center">
                      {c.telefono && (
                        <div className="flex items-center justify-center text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {c.telefono}
                        </div>
                      )}
                      {c.correo && (
                        <div className="flex items-center justify-center text-xs text-slate-600">
                          <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {c.correo}
                        </div>
                      )}
                      {!c.telefono && !c.correo && <span className="text-xs text-slate-400 italic">Sin datos</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium text-slate-700">${c.limite_credito.toFixed(2)}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-bold text-sm px-2.5 py-1 rounded-full ${
                        c.saldo_actual > 0 
                          ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        ${c.saldo_actual.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handlePaymentClick(c)}
                          className="flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all text-xs font-bold"
                          title="Registrar Abono"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>ABONAR</span>
                        </button>
                        <button
                          onClick={() => handleHistoryClick(c)}
                          className="flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-all text-xs font-bold"
                          title="Historial de Movimientos"
                        >
                          <History className="w-4 h-4" />
                          <span>DETALLE</span>
                        </button>
                        {(currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor') && (
                          <button
                            onClick={() => handleEditClick(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor') && (
                          <button
                            onClick={() => handleDeleteClick(c)}
                            disabled={c.saldo_actual > 0}
                            className={`p-1.5 rounded-lg transition-all ${
                              c.saldo_actual > 0 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            title={c.saldo_actual > 0 ? "No se puede eliminar con saldo pendiente" : "Eliminar"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PORTALES / MODALES */}

      {/* Modal Formulario Cliente */}
      {showFormModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                {selectedCustomer ? 'MODIFICAR CLIENTE' : 'REGISTRAR CLIENTE'}
              </h2>
              <button onClick={() => setShowFormModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Juan Pérez"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="Ej. 8112345678"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  value={formData.correo}
                  onChange={(e) => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                  placeholder="ejemplo@correo.com"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Límite de Crédito Autorizado ($)</label>
                <div className="relative">
                  <DollarSign className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.limite_credito}
                    onChange={(e) => setFormData(prev => ({ ...prev, limite_credito: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-all text-sm uppercase"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all text-sm uppercase"
                >
                  GUARDAR
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Registrar Abono */}
      {showPaymentModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] max-w-md w-full shadow-2xl border border-stone-200/60 overflow-hidden animate-scale-up flex flex-col">
            <div className="p-6 border-b border-stone-200/40 bg-stone-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/20">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-brand-900 tracking-tight uppercase">REGISTRAR ABONO</h2>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Abono a cuenta corriente</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-500/10 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Cliente</div>
                <div className="font-black text-lg text-stone-850 leading-tight">{selectedCustomer?.name}</div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-emerald-500/20 font-bold">
                  <span className="text-stone-500">Saldo actual deudor:</span>
                  <span className="font-black text-emerald-600 text-sm">${selectedCustomer?.saldo_actual.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-extrabold text-stone-600 uppercase tracking-wider">Monto a Abonar (Efectivo) *</label>
                <div className="relative">
                  <DollarSign className="w-5 h-5 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentData.monto}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, monto: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 bg-stone-50/50 text-sm font-bold text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-extrabold text-stone-600 uppercase tracking-wider">Notas / Observaciones</label>
                <input
                  type="text"
                  value={paymentData.notas}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Ej. Abono parcial en efectivo"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-stone-50/50 text-xs font-semibold text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {currentUser?.rol === 'cajero' && (
                <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>Autorización de Supervisor Requerida</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Usuario Supervisor *</label>
                      <input
                        type="text"
                        required
                        value={paymentData.auth_username}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, auth_username: e.target.value }))}
                        placeholder="Ej. admin"
                        className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-amber-500/30 bg-white/70 text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Contraseña Autorización *</label>
                      <input
                        type="password"
                        required
                        value={paymentData.auth_password}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, auth_password: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-amber-500/30 bg-white/70 text-stone-850 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-stone-200/40">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-5 py-3 border border-stone-300/60 text-stone-600 hover:bg-stone-500/10 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md hover:shadow-float active:scale-[0.98] transition-all cursor-pointer"
                >
                  REGISTRAR PAGO
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Historial de Cliente */}
      {showHistoryModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-[80vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">HISTORIAL DE CUENTA</h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
              <div>
                <div className="text-sm font-bold text-slate-800">{selectedCustomer?.name}</div>
                <div className="text-xs text-slate-500">Límite de crédito: ${selectedCustomer?.limite_credito.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase text-slate-400">Saldo actual deudor</div>
                <div className="text-xl font-bold text-emerald-700">${selectedCustomer?.saldo_actual.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
                </div>
              ) : customerHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <FileText className="w-12 h-12 text-slate-300" />
                  <div>No hay movimientos registrados para este cliente.</div>
                </div>
              ) : (
                <div className="relative border-l border-slate-200 ml-4 space-y-6 pb-4">
                  {customerHistory.map((h, index) => {
                    const isAbono = h.tipo === 'abono';
                    return (
                      <div key={index} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 bg-white ${
                          isAbono ? 'border-emerald-600' : 'border-amber-500'
                        }`} />
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                          <div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              isAbono 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : h.tipo === 'compra_credito'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-blue-50 text-blue-700'
                            }`}>
                              {isAbono ? 'ABONO EN EFECTIVO' : h.tipo === 'compra_credito' ? 'COMPRA A CRÉDITO' : 'COMPRA ASOCIADA'}
                            </span>
                            <p className="text-sm font-semibold text-slate-800 mt-1">{h.description}</p>
                            <p className="text-xs text-slate-400">{new Date(h.creado_en).toLocaleString()}</p>
                          </div>
                          <div className={`font-bold text-right text-sm ${
                            isAbono ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {isAbono ? '-' : '+'}${h.monto.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all text-sm uppercase"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmación de Eliminación */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-full w-fit mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">¿Eliminar cliente?</h3>
              <p className="text-sm text-slate-500 mt-1">
                ¿Está seguro de que desea eliminar a <b>{deleteConfirm.name}</b>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all text-sm uppercase"
              >
                CANCELAR
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-all text-sm uppercase"
              >
                ELIMINAR
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Customers;
