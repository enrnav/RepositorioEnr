import { useState, useEffect } from 'react';
import AlertModal from '../components/AlertModal';
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
    telefono: '',
    correo: '',
    direccion: '',
    notas: ''
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

  const handleEditClick = (proveedor) => {
    setEditSupplierId(proveedor.id);
    setFormData({
      name: proveedor.name || '',
      rfc: proveedor.rfc || '',
      telefono: proveedor.telefono || '',
      correo: proveedor.correo || '',
      direccion: proveedor.direccion || '',
      notas: proveedor.notas || ''
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
      setFormData({ name: '', rfc: '', telefono: '', correo: '', direccion: '', notas: '' });
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
      (s.telefono && s.telefono.includes(q))
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
              setFormData({ name: '', rfc: '', telefono: '', correo: '', direccion: '', notas: '' });
              setShowForm(true);
            }}
            className="flex items-center justify-center space-x-2 bg-chiluda-red text-white px-5 py-2.5 rounded-full hover:bg-chiluda-darkred hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float w-full md:w-auto font-black text-xs uppercase tracking-wider shrink-0"
          >
            <Plus size={16} />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      <AlertModal 
        isOpen={!!success || !!error}
        tipo={success ? 'success' : 'error'}
        mensaje={success || error}
        onClose={() => { setSuccess(''); setError(''); }}
      />

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Truck className="text-emerald-600 w-5 h-5 shrink-0" />
                <span>{editSupplierId ? 'MODIFICAR PROVEEDOR' : 'REGISTRAR PROVEEDOR'}</span>
              </h2>
              <button 
                onClick={() => { setShowForm(false); setEditSupplierId(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
              {/* Supplier Name */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                  placeholder="Ej. Distribuidora Bimbo S.A."
                />
              </div>

              {/* RFC */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RFC (Opcional)</label>
                <input
                  type="text"
                  value={formData.rfc}
                  onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                  placeholder="Colocar de 12 a 13 caracteres"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                    placeholder="Ej. 8112345678"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo</label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({...formData, correo: e.target.value})}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                    placeholder="Ej. ventas@distribuidora.com"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dirección Física</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all"
                  placeholder="Ej. Av. Constitución #450, Monterrey, N.L."
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas o Comentarios</label>
                <textarea
                  rows="3"
                  value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 transition-all resize-none"
                  placeholder="Ej. Entrega los martes por la mañana..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditSupplierId(null); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-all text-sm uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all text-sm uppercase shadow-sm shadow-emerald-600/10 active:scale-95"
                >
                  {editSupplierId ? 'Guardar' : 'Registrar'}
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
                      {s.telefono && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} className="text-stone-400" />
                          {s.telefono}
                        </span>
                      )}
                      {s.correo && (
                        <span className="flex items-center gap-1.5 break-all">
                          <Mail size={12} className="text-stone-400" />
                          {s.correo}
                        </span>
                      )}
                      {!s.telefono && !s.correo && (
                        <span className="text-stone-450 italic">Sin datos</span>
                      )}
                    </div>
                  </td>
 
                  {/* Address and Notes */}
                  <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-xs font-semibold text-stone-500 max-w-xs text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      {s.direccion && (
                        <div className="flex items-start gap-1.5">
                          <MapPin size={12} className="text-stone-400 shrink-0 mt-0.5" />
                          <span className="truncate" title={s.direccion}>{s.direccion}</span>
                        </div>
                      )}
                      {s.notas && (
                        <div className="flex items-start gap-1.5 text-stone-400">
                          <FileText size={12} className="text-stone-400 shrink-0 mt-0.5" />
                          <span className="italic truncate" title={s.notas}>{s.notas}</span>
                        </div>
                      )}
                      {!s.direccion && !s.notas && (
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
