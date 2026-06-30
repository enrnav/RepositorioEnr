import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings as SettingsIcon, Save, Store, Receipt, AlertCircle, CheckCircle, Database, Download, UploadCloud, HelpCircle, FileText } from 'lucide-react';
import { fetchStoreSettings, updateStoreSettings, exportBackupDatabase, importBackupDatabase } from '../api';

const Settings = () => {
  const [formData, setFormData] = useState({
    store_name: '',
    rfc: '',
    phone: '',
    email: '',
    address: '',
    tax_rate: '16.0',
    ticket_footer: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Backup states
  const [backupFormat, setBackupFormat] = useState('json');
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [showBackupHelp, setShowBackupHelp] = useState(false);

  const handleExportBackup = async () => {
    setBackupError('');
    setBackupSuccess('');
    setExportingBackup(true);
    try {
      const blob = await exportBackupDatabase(backupFormat);
      
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      
      const ext = backupFormat === 'excel' ? 'xlsx' : backupFormat;
      const todayStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `tienda_backup_${todayStr}.${ext}`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setBackupSuccess(`Copia de seguridad en formato ${backupFormat.toUpperCase()} descargada correctamente.`);
    } catch (err) {
      console.error('Error exporting backup', err);
      setBackupError('Error al exportar la copia de seguridad.');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    e.target.value = null;
    
    const confirmRestore = window.confirm(
      "¡ATENCIÓN! Restaurar un respaldo eliminará todos los registros actuales (ventas, productos, clientes) y los reemplazará con los datos del archivo. Esta acción es IRREVERSIBLE. ¿Está completamente seguro de continuar?"
    );
    if (!confirmRestore) return;
    
    setBackupError('');
    setBackupSuccess('');
    setImportingBackup(true);
    try {
      await importBackupDatabase(file);
      setBackupSuccess('Base de datos restaurada exitosamente.');
      loadSettings();
      window.dispatchEvent(new Event('store_settings_updated'));
    } catch (err) {
      console.error('Error importing backup', err);
      setBackupError(err.response?.data?.detail || 'Error al restaurar el respaldo. Verifique que sea un archivo JSON válido.');
    } finally {
      setImportingBackup(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await fetchStoreSettings();
      setFormData({
        store_name: data.store_name || '',
        rfc: data.rfc || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        tax_rate: data.tax_rate !== undefined ? data.tax_rate.toString() : '16.0',
        ticket_footer: data.ticket_footer || ''
      });
    } catch (err) {
      console.error('Error loading settings', err);
      setError('Error al cargar la configuración. Asegúrese de tener permisos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const parsedTax = parseFloat(formData.tax_rate);

    // Validation
    if (!formData.store_name.trim()) {
      setError('El nombre de la tienda es requerido.');
      setSaving(false);
      return;
    }

    if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
      setError('La tasa de IVA debe estar entre 0% y 100%.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        tax_rate: parsedTax
      };
      await updateStoreSettings(payload);
      setSuccess('Configuración guardada exitosamente.');
      window.dispatchEvent(new Event('store_settings_updated'));
    } catch (err) {
      console.error('Error updating settings', err);
      setError(err.response?.data?.detail || 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
            <SettingsIcon className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
            <span>Ajustes Generales</span>
          </h2>
          <p className="text-xs text-stone-400 font-bold mt-1 uppercase tracking-wider">
            Configura la información comercial, fiscal y el diseño de tus comprobantes
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-[3px] rounded-[2.2rem] border border-white/40 shadow-lg p-6 md:p-8 space-y-8">
        {/* Sección: Datos de la Tienda */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Store className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-700">INFORMACIÓN DEL NEGOCIO</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="store_name" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre de la Tienda</label>
              <input
                type="text"
                id="store_name"
                name="store_name"
                value={formData.store_name}
                onChange={handleChange}
                placeholder="Ej. Abarrotes La Esquina"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="phone" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teléfono de Contacto</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. 8112345678"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contacto@mitienda.com"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="rfc" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RFC del Negocio (Emisor SAT)</label>
              <input
                type="text"
                id="rfc"
                name="rfc"
                value={formData.rfc}
                onChange={handleChange}
                placeholder="Ej. XAXX010101000"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase"
              />
            </div>

            <div className="flex flex-col space-y-1.5 md:col-span-2">
              <label htmlFor="address" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dirección Física Completa</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Calle, Número, Colonia, Municipio, Estado, C.P. (Código Postal de 5 dígitos al final es recomendado para CFDI)"
                rows={2}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sección: Impuestos y Facturación */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-700">IMPUESTOS Y COMPROBANTES</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="tax_rate" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tasa de IVA General (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  id="tax_rate"
                  name="tax_rate"
                  value={formData.tax_rate}
                  onChange={handleChange}
                  placeholder="16.0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>

            <div className="flex flex-col space-y-1.5 md:col-span-2">
              <label htmlFor="ticket_footer" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensaje al Pie del Ticket</label>
              <input
                type="text"
                id="ticket_footer"
                name="ticket_footer"
                value={formData.ticket_footer}
                onChange={handleChange}
                placeholder="Ej. ¡Gracias por su preferencia! Vuelva pronto"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Botón de envío */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center space-x-2 bg-chiluda-red hover:bg-chiluda-darkred disabled:bg-chiluda-lightred text-white px-6 py-3 rounded-full hover:shadow-float active:scale-[0.98] transition-all duration-300 shadow-float font-black text-xs uppercase tracking-wider shrink-0"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Configuración</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sección de Respaldo de Base de Datos */}
      <div className="bg-white/10 backdrop-blur-[3px] rounded-[2.2rem] border border-white/40 shadow-lg p-6 md:p-8 space-y-6 mt-6">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h2 className="text-lg font-semibold text-slate-700">COPIAS DE SEGURIDAD (BACKUP)</h2>
          </div>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBackupHelp(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black transition-all uppercase tracking-wider border border-emerald-200/20"
            >
              <HelpCircle size={13} className="animate-bounce" />
              <span>Manual de Uso</span>
            </button>
            
            {showBackupHelp && createPortal(
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="absolute inset-0" onClick={() => setShowBackupHelp(false)} />
                
                <div className="bg-white/95 backdrop-blur-2xl rounded-[2.2rem] shadow-glass w-full max-w-lg p-6 md:p-8 relative z-10 border border-white/55 animate-slide-up space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Database size={20} className="text-emerald-600 animate-pulse" />
                      <span className="text-sm font-black uppercase tracking-wider">Manual de Backup</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowBackupHelp(false)} 
                      className="text-stone-400 hover:text-stone-605 font-bold text-xs uppercase"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="space-y-4 text-left">
                    <div>
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wide mb-1.5">¿Qué contiene el respaldo?</h4>
                      <p className="text-[12px] text-stone-500 leading-relaxed font-semibold">
                        El archivo <code>.json</code> es el formato recomendado y contiene toda la información de tu negocio estructurada: configuración, cuentas de usuario, catálogo de productos, variantes, clientes, saldos a crédito e historial de ventas y compras.
                      </p>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black text-red-650 uppercase tracking-wide mb-1.5">Pasos para importar/restaurar</h4>
                      <ol className="list-decimal pl-5 space-y-2 text-stone-500 text-[12px] leading-relaxed font-semibold">
                        <li>Haz clic en <strong>"Seleccionar Archivo JSON"</strong> en el panel.</li>
                        <li>Busca y abre el archivo de respaldo descargado (ej. <code>tienda_backup.json</code>).</li>
                        <li>Confirma la ventana de advertencia de restauración en el navegador.</li>
                        <li>El sistema se reiniciará automáticamente para cargar la base de datos limpia.</li>
                      </ol>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBackupHelp(false)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-md"
                  >
                    Entendido
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>

        {backupError && (
          <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{backupError}</span>
          </div>
        )}

        {backupSuccess && (
          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{backupSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Exportar */}
          <div className="space-y-4 flex flex-col justify-between h-full bg-slate-50/30 p-5 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Descargar Respaldo</h3>
                <div className="relative group">
                  <button
                    type="button"
                    className="text-stone-400 hover:text-stone-605 transition-colors p-0.5"
                  >
                    <HelpCircle size={14} />
                  </button>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex flex-col w-64 bg-stone-900 text-white text-[11px] p-4.5 rounded-2xl shadow-xl z-55 pointer-events-none before:content-[''] before:absolute before:top-full before:left-4 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-stone-900 leading-relaxed font-semibold">
                    <span className="font-bold text-xs text-white mb-2 block uppercase tracking-wider text-center">Contenido del Respaldo JSON</span>
                    <span>El archivo contiene la base de datos completa de tu negocio de forma estructurada: configuración, cuentas de usuarios, catálogo de productos y variantes, clientes, saldos a crédito e historial de ventas y compras.</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Exporta la información actual del sistema. Puedes guardarla como respaldo preventivo o para análisis de negocio.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <select
                value={backupFormat}
                onChange={(e) => setBackupFormat(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold text-slate-600 text-xs sm:text-sm"
              >
                <option value="json">JSON (Recomendado para Restauración)</option>
                <option value="sql">SQL (Script de Inserts para pgAdmin/DBeaver)</option>
                <option value="excel">Excel (.xlsx para Reporte)</option>
              </select>

              <button
                onClick={handleExportBackup}
                disabled={exportingBackup}
                className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-md active:scale-95"
              >
                {exportingBackup ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                    <span>Exportando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar Respaldo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Importar */}
          <div className="space-y-4 flex flex-col justify-between h-full bg-red-50/5 p-5 rounded-2xl border border-red-100/40">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide">Restaurar Base de Datos</h3>
                <div className="relative group">
                  <button
                    type="button"
                    className="text-stone-400 hover:text-stone-605 transition-colors p-0.5"
                  >
                    <HelpCircle size={14} />
                  </button>
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col w-64 bg-stone-900 text-white text-[11px] p-4.5 rounded-2xl shadow-xl z-55 pointer-events-none before:content-[''] before:absolute before:top-full before:right-4 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-stone-900 leading-relaxed font-semibold">
                    <span className="font-bold text-xs text-white mb-2 block uppercase tracking-wider text-center text-red-400">Pasos para Restaurar</span>
                    <span className="mb-1 block">1. Haz clic en "Seleccionar Archivo JSON" abajo.</span>
                    <span className="mb-1 block">2. Abre el archivo de respaldo descargado (ej. tienda_backup.json).</span>
                    <span className="mb-1 block">3. Confirma la ventana de advertencia de tu navegador.</span>
                    <span className="block">4. El sistema cargará el respaldo y se reiniciará automáticamente.</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Restaura una copia de seguridad previamente descargada en formato **JSON**. Reemplazará permanentemente el contenido actual.
              </p>
            </div>

            <div className="mt-4">
              <label className="relative flex items-center justify-center space-x-2 border-2 border-dashed border-red-200 hover:border-red-400 bg-red-50/20 hover:bg-red-50/40 cursor-pointer py-5 px-4 rounded-xl transition-all">
                <UploadCloud className="w-5 h-5 text-red-500 animate-bounce" />
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                  {importingBackup ? 'Restaurando...' : 'Seleccionar Archivo JSON'}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  disabled={importingBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
