import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Truck, Plus, Search, Edit2, Trash2, X, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    rfc: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadSuppliers = async () => {
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError('No se pudo cargar la lista de proveedores.');
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleEditClick = (supplier) => {
    setEditSupplierId(supplier.id);
    setFormData({
      name: supplier.name || '',
      rfc: supplier.rfc || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      await deleteSupplier(id);
      setSuccess('Proveedor eliminado exitosamente.');
      loadSuppliers();
    } catch (err) {
      const detailMsg = err.response?.data?.detail || 'Error al eliminar proveedor.';
      setError(detailMsg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('El nombre del proveedor es obligatorio.');
      return;
    }

    // Validar formato básico de RFC si se proporciona
    if (formData.rfc && formData.rfc.trim()) {
      const rfcClean = formData.rfc.trim().toUpperCase();
      const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!rfcRegex.test(rfcClean)) {
        setError('El RFC no tiene un formato válido (debe tener 12 o 13 caracteres alfanuméricos válidos para México).');
        return;
      }
    }

    try {
      if (editSupplierId) {
        await updateSupplier(editSupplierId, formData);
        setSuccess('Proveedor actualizado exitosamente.');
      } else {
        await createSupplier(formData);
        setSuccess('Proveedor registrado exitosamente.');
      }
      setShowForm(false);
      setEditSupplierId(null);
      setFormData({ name: '', rfc: '', phone: '', email: '', address: '', notes: '' });
      loadSuppliers();
    } catch (err) {
      const detailMsg = err.response?.data?.detail || 'Error al guardar proveedor.';
      setError(detailMsg);
    }
  };

  // Filtrado de proveedores
  const filteredSuppliers = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.rfc && s.rfc.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
          <Truck className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>Catálogo de Proveedores</span>
        </h2>
        <div className="flex flex-col md:flex-row gap-3 items-center w-full xl:w-auto animate-fade-in">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4.5 w-4.5 text-stone-400" />
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, RFC o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-full focus:outline-none focus:ring-2 focus:ring-chiluda-red/20 focus:border-transparent text-xs font-semibold shadow-sm transition-all"
            />
          </div>
          {/* Add button */}
          <button
            onClick={() => {
              setEditSupplierId(null);
              setFormData({ name: '', rfc: '', phone: '', email: '', address: '', notes: '' });
              setShowForm(true);
            }}
            className="flex items-center justify-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float w-full md:w-auto font-black text-xs uppercase tracking-wider shrink-0"
          >
            <Plus size={16} />
            <span>Nuevo Proveedor</span>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar Proveedor?</h3>
              <p className="text-gray-500 mb-6">Esta acción no se puede deshacer y fallará si el proveedor tiene compras registradas en el historial.</p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 rounded-md hover:bg-gray-50 transition-colors w-full font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirm)}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-md hover:bg-chiluda-darkred transition-colors w-full font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Form Dialog Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-white animate-scale-in">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50 flex-shrink-0">
              <h3 className="text-md font-bold text-stone-800">
                {editSupplierId ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
              </h3>
              <button 
                onClick={() => { setShowForm(false); setEditSupplierId(null); }}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Supplier Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Nombre o Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                    placeholder="Ej. Distribuidora Bimbo S.A."
                  />
                </div>

                {/* RFC */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">RFC (Opcional)</label>
                  <input
                    type="text"
                    value={formData.rfc}
                    onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                    placeholder="Ej. DBI120415XYZ"
                  />
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Teléfono</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                      placeholder="Ej. 8112345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Correo</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                      placeholder="Ej. ventas@distribuidora.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Dirección Física</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner"
                    placeholder="Ej. Av. Constitución #450, Monterrey, N.L."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1 uppercase tracking-wider">Notas o Comentarios</label>
                  <textarea
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-stone-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-chiluda-red/30 focus:border-transparent text-sm font-semibold transition-all shadow-inner resize-none"
                    placeholder="Ej. Entrega los martes por la mañana..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-stone-50/80 border-t border-stone-100 flex justify-end space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditSupplierId(null); }}
                  className="px-5 py-2.5 border border-stone-200 text-stone-600 rounded-full hover:bg-white hover:text-chiluda-red hover:border-chiluda-red/30 transition-all text-xs font-bold shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-chiluda-red text-white rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all shadow-float text-xs font-black"
                >
                  {editSupplierId ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Suppliers Table */}
      <div className="bg-white/10 backdrop-blur-[3px] rounded-3xl shadow-soft border border-white/40 overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className="bg-brand-50/50 text-brand-900 text-[10px] md:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tl-xl">Nombre / Razón Social</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">RFC</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center">Contacto</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-bold text-center">Dirección y Notas</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-center rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50 bg-transparent">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-brand-50/50 transition-all duration-200 group">
                  {/* Name */}
                  <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                    <div className="text-sm font-bold text-stone-900">{s.name}</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">ID: #{s.id}</div>
                  </td>
                  
                  {/* RFC */}
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-center">
                    {s.rfc ? (
                      <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md font-mono text-[10px] font-bold border border-stone-200/50">
                        {s.rfc}
                      </span>
                    ) : (
                      <span className="text-stone-400 text-xs italic">Sin registrar</span>
                    )}
                  </td>
                  
                  {/* Contact info */}
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-stone-600 text-center">
                    <div className="flex flex-col gap-1.5 items-center justify-center">
                      {s.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} className="text-stone-400" />
                          {s.phone}
                        </span>
                      )}
                      {s.email && (
                        <span className="flex items-center gap-1.5 break-all">
                          <Mail size={12} className="text-stone-400" />
                          {s.email}
                        </span>
                      )}
                      {!s.phone && !s.email && (
                        <span className="text-stone-450 italic">Sin datos</span>
                      )}
                    </div>
                  </td>
 
                  {/* Address and Notes */}
                  <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-stone-500 max-w-xs text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      {s.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin size={12} className="text-stone-400 shrink-0 mt-0.5" />
                          <span className="truncate" title={s.address}>{s.address}</span>
                        </div>
                      )}
                      {s.notes && (
                        <div className="flex items-start gap-1.5 text-stone-400">
                          <FileText size={12} className="text-stone-400 shrink-0 mt-0.5" />
                          <span className="italic truncate" title={s.notes}>{s.notes}</span>
                        </div>
                      )}
                      {!s.address && !s.notes && (
                        <span className="text-stone-400 italic">Sin datos adicionales</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                    <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                      <button 
                        onClick={() => handleEditClick(s)}
                        className="text-stone-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 p-2 rounded-xl transition-all"
                        title="Editar proveedor"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(s.id)}
                        className="text-stone-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 p-2 rounded-xl transition-all"
                        title="Eliminar proveedor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-sm text-stone-500">
                    <div className="flex flex-col items-center justify-center">
                      <Truck className="h-10 w-10 text-stone-300 mb-2 animate-pulse" />
                      <span className="font-bold text-stone-450">No se encontraron proveedores</span>
                      <span className="text-stone-400 text-xs mt-1 font-semibold">Intenta con otro término de búsqueda o crea uno nuevo.</span>
                    </div>
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

export default Suppliers;
