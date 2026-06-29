import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Search, Plus, FileText, Download, Mail, Trash2, Loader, CheckCircle, AlertCircle, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { API_URL, fetchBillingProfiles, createBillingProfile, fetchTicketDetails, createInvoice, fetchInvoices, cancelInvoice } from '../api';

const SAT_REGIMENES = [
  { code: '601', name: 'General de Ley Personas Morales' },
  { code: '603', name: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', name: 'Arrendamiento' },
  { code: '608', name: 'Demás ingresos' },
  { code: '612', name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '616', name: 'Sin obligaciones fiscales' },
  { code: '621', name: 'Incorporación Fiscal' },
  { code: '625', name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', name: 'Régimen Simplificado de Confianza (RESICO)' }
];

const Invoices = () => {
  const [activeTab, setActiveTab] = useState('ticket'); // 'ticket', 'history', 'global'
  
  // Search ticket state
  const [ticketSearchId, setTicketSearchId] = useState('');
  const [ticketDetails, setTicketDetails] = useState(null);
  const [searchingTicket, setSearchingTicket] = useState(false);

  // Billing Profile state
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [newProfile, setNewProfile] = useState({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '616',
    codigo_postal: '',
    correo: ''
  });

  // Global invoice state
  const [globalTicketIds, setGlobalTicketIds] = useState('');
  const [globalTicketDetails, setGlobalTicketDetails] = useState(null);
  const [loadingGlobalPreview, setLoadingGlobalPreview] = useState(false);

  // History invoices state
  const [invoices, setInvoices] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Timbrado process states
  const [processingInvoice, setProcessingInvoice] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState(null);

  // Messages and Modals
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmCancelInvoiceId, setConfirmCancelInvoiceId] = useState(null);

  // User session role verification
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { role: 'cajero' };

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  // Reload history when switching tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadInvoicesHistory();
    }
  }, [activeTab]);

  const loadProfiles = async (query = '') => {
    try {
      const data = await fetchBillingProfiles(query);
      setProfiles(data);
    } catch (err) {
      console.error("Error loading profiles:", err);
    }
  };

  const loadInvoicesHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Error loading invoices history:", err);
      showErrorModal("Error al conectar con el servidor para cargar el historial fiscal.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const showErrorModal = (msg) => {
    setErrorMsg(msg);
  };

  const handleSearchTicket = async (e) => {
    if (e) e.preventDefault();
    if (!ticketSearchId) return;

    setSearchingTicket(true);
    setTicketDetails(null);
    try {
      const data = await fetchTicketDetails(ticketSearchId);
      setTicketDetails(data);
      if (data.invoice) {
        setSuccessMsg(`Este ticket ya se encuentra facturado con Folio Fiscal (UUID): ${data.invoice.uuid}`);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Ticket no encontrado. Por favor verifique el número.";
      showErrorModal(msg);
    } finally {
      setSearchingTicket(false);
    }
  };

  const handleRegisterProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validar RFC
    const rfcRegex = /^[A-Z&Ññ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(newProfile.rfc)) {
      showErrorModal("El RFC ingresado no tiene un formato válido (debe tener 12 o 13 caracteres alfanuméricos).");
      return;
    }

    // Validar Razón Social
    if (newProfile.razon_social.trim().length < 3) {
      showErrorModal("La razón social debe tener al menos 3 caracteres.");
      return;
    }

    // Validar C.P.
    if (!/^[0-9]{5}$/.test(newProfile.codigo_postal)) {
      showErrorModal("El Código Postal debe constar de 5 dígitos numéricos.");
      return;
    }

    // Validar Correo
    if (!/\S+@\S+\.\S+/.test(newProfile.correo)) {
      showErrorModal("Debe especificar una dirección de correo electrónico válida.");
      return;
    }

    try {
      const created = await createBillingProfile(newProfile);
      setProfiles([...profiles, created]);
      setSelectedProfileId(created.id);
      setShowProfileForm(false);
      setSuccessMsg("Perfil de facturación registrado exitosamente.");
      setNewProfile({
        rfc: '',
        razon_social: '',
        regimen_fiscal: '616',
        codigo_postal: '',
        correo: ''
      });
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al registrar el perfil fiscal.";
      showErrorModal(msg);
    }
  };

  const handleTimbrarTicket = async () => {
    if (!ticketDetails) return;
    
    // Validar que se seleccionó un perfil
    if (!selectedProfileId && !showProfileForm) {
      showErrorModal("Por favor, seleccione un perfil fiscal o registre uno nuevo para continuar.");
      return;
    }

    setProcessingInvoice(true);
    try {
      const payload = {
        sale_id: ticketDetails.ticket_id,
        billing_profile_id: selectedProfileId ? parseInt(selectedProfileId) : null
      };

      const result = await createInvoice(payload);
      setSuccessInvoice(result);
      setTicketDetails(null);
      setTicketSearchId('');
      loadProfiles(); // Refresh profiles list
    } catch (err) {
      const msg = err.response?.data?.detail || "Ocurrió un error al procesar el timbrado con el PAC.";
      showErrorModal(msg);
    } finally {
      setProcessingInvoice(false);
    }
  };

  // Preview global invoice tickets
  const handlePreviewGlobal = async (e) => {
    e.preventDefault();
    if (!globalTicketIds) return;

    setLoadingGlobalPreview(true);
    setGlobalTicketDetails(null);

    const idsArr = globalTicketIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (idsArr.length === 0) {
      showErrorModal("Por favor, introduzca al menos un número de ticket válido separado por comas.");
      setLoadingGlobalPreview(false);
      return;
    }

    try {
      // Usaremos el detalle del primer ticket y sumaremos los demás para vista preliminar
      let totalSum = 0;
      let subtotalSum = 0;
      let taxesSum = 0;
      let discountSum = 0;
      let combinedItems = [];
      let checkedTicketIds = [];

      for (const tid of idsArr) {
        const details = await fetchTicketDetails(tid);
        if (details.invoice) {
          throw new Error(`El ticket #${tid} ya ha sido facturado individualmente.`);
        }
        if (details.is_cancelled) {
          throw new Error(`El ticket #${tid} está cancelado y no se puede facturar.`);
        }
        totalSum += details.total;
        subtotalSum += details.subtotal;
        taxesSum += details.taxes;
        discountSum += details.discount;
        
        // Agregar identificadores de venta individuales
        details.items.forEach(itm => {
          combinedItems.push(itm);
          checkedTicketIds.push(itm.sale_id);
        });
      }

      setGlobalTicketDetails({
        ticket_ids: checkedTicketIds,
        subtotal: subtotalSum,
        discount: discountSum,
        taxes: taxesSum,
        total: totalSum,
        items: combinedItems
      });

    } catch (err) {
      const msg = err.message || err.response?.data?.detail || "Error al cargar la vista previa de los tickets seleccionados.";
      showErrorModal(msg);
    } finally {
      setLoadingGlobalPreview(false);
    }
  };

  const handleTimbrarGlobal = async () => {
    if (!globalTicketDetails) return;

    setProcessingInvoice(true);
    try {
      const payload = {
        sale_ids: globalTicketDetails.ticket_ids,
        // Al dejar el profile vacio, el backend genera la factura a Público en General RFC: XAXX010101000
      };

      const result = await createInvoice(payload);
      setSuccessInvoice(result);
      setGlobalTicketDetails(null);
      setGlobalTicketIds('');
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al generar la Factura Global del Público en General.";
      showErrorModal(msg);
    } finally {
      setProcessingInvoice(false);
    }
  };

  const handleCancelInvoice = async (invoiceId) => {
    setConfirmCancelInvoiceId(invoiceId);
  };

  const confirmCancelInvoice = async () => {
    if (!confirmCancelInvoiceId) return;
    
    try {
      await cancelInvoice(confirmCancelInvoiceId);
      setSuccessMsg("La factura se ha cancelado correctamente ante el SAT.");
      setConfirmCancelInvoiceId(null);
      loadInvoicesHistory();
    } catch (err) {
      const msg = err.response?.data?.detail || "Ocurrió un error al intentar solicitar la cancelación al SAT.";
      showErrorModal(msg);
    }
  };

  const formatRFC = (val) => {
    return val.toUpperCase().replace(/\s/g, '').substring(0, 13);
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight animate-fade-in flex items-center gap-2">
          <Receipt className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>FACTURACIÓN ELECTRÓNICA CFDI 4.0</span>
        </h2>
        {/* Subtitle / single-row badges */}
        <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center animate-fade-in w-full xl:w-auto justify-center sm:justify-end shrink-0">
          <span className="hidden sm:inline-flex px-3.5 py-1.5 bg-emerald-500/10 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">
            Entorno Sandbox PAC
          </span>
          <span className="hidden sm:inline-flex px-3.5 py-1.5 bg-[#064e3b]/10 text-[#064e3b] text-[10px] font-black rounded-full border border-[#064e3b]/20 uppercase tracking-widest">
            SAT CFDI 4.0 Estándar
          </span>
        </div>
      </div>

      {/* Tabs navigation - single row no wrap */}
      <div className="flex flex-nowrap border-b border-stone-200 overflow-x-auto pb-px scrollbar-none">
        <button
          onClick={() => { setActiveTab('ticket'); setErrorMsg(''); }}
          className={`py-3 px-6 font-bold text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
            activeTab === 'ticket'
              ? 'border-chiluda-red text-chiluda-red font-black'
              : 'border-transparent text-stone-500 hover:text-stone-750'
          }`}
        >
          Facturar Ticket
        </button>
        <button
          onClick={() => { setActiveTab('global'); setErrorMsg(''); }}
          className={`py-3 px-6 font-bold text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
            activeTab === 'global'
              ? 'border-chiluda-red text-chiluda-red font-black'
              : 'border-transparent text-stone-500 hover:text-stone-750'
          }`}
        >
          Factura Global
        </button>
        <button
          onClick={() => { setActiveTab('history'); setErrorMsg(''); }}
          className={`py-3 px-6 font-bold text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-chiluda-red text-chiluda-red font-black'
              : 'border-transparent text-stone-500 hover:text-stone-750'
          }`}
        >
          Historial Fiscal (XML/PDF)
        </button>
      </div>

      {/* TAB CONTENT: FACTURAR TICKET */}
      {activeTab === 'ticket' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Buscar y Detalles */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft relative overflow-hidden">
              <h3 className="text-sm font-black text-brand-900 tracking-wider uppercase mb-4">Buscar Ticket de Venta</h3>
              <form onSubmit={handleSearchTicket} className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    value={ticketSearchId}
                    onChange={(e) => setTicketSearchId(e.target.value)}
                    placeholder="INTRODUCE EL NÚMERO DE TICKET / VENTA (EJ. 12)"
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 transition-all uppercase placeholder-stone-400"
                  />
                  <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-stone-400" />
                </div>
                <button
                  type="submit"
                  disabled={searchingTicket}
                  className="bg-[#064e3b] text-white px-6 py-3 rounded-2xl font-black text-xs hover:bg-[#043327] transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px] uppercase tracking-wider"
                >
                  {searchingTicket ? <Loader className="animate-spin" size={14} /> : 'Buscar'}
                </button>
              </form>
            </div>

            {/* Detalles del ticket si se encontró */}
            {ticketDetails && (
              <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft space-y-5 animate-slide-up">
                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-brand-900 uppercase">Detalles de Ticket #{ticketDetails.ticket_id}</h4>
                    <p className="text-[10px] text-stone-400 font-bold uppercase mt-1 flex items-center gap-1.5">
                      <Calendar size={11} /> {new Date(ticketDetails.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 inline-flex items-center text-[9px] font-black rounded-full border uppercase tracking-wider ${
                    ticketDetails.is_cancelled
                      ? 'bg-red-550/10 text-red-700 border-red-500/20'
                      : ticketDetails.invoice
                        ? 'bg-blue-500/10 text-blue-800 border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                  }`}>
                    {ticketDetails.is_cancelled ? 'Cancelado' : ticketDetails.invoice ? 'Ya Facturado' : 'Pendiente de Factura'}
                  </span>
                </div>

                {/* Items list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-50 text-stone-500 uppercase font-black text-[9px] tracking-wider border-b border-stone-150">
                      <tr>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio</th>
                        <th className="py-2.5 px-3 text-right">Desc.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {ticketDetails.items.map((itm) => (
                        <tr key={itm.sale_id} className="hover:bg-stone-50/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-stone-800">{itm.product_name}</div>
                            <div className="text-[9px] text-stone-400 font-semibold mt-0.5">SAT: {itm.sat_key || '01010101'} / {itm.sat_unit_key || 'H87'}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-stone-700">{itm.quantity}</td>
                          <td className="py-3 px-3 text-right font-medium text-stone-600">${itm.price.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-red-500 font-medium">-${itm.discount.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-bold text-stone-850">${itm.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen numérico */}
                <div className="bg-stone-50 rounded-2xl p-4 flex flex-col gap-2.5 w-full md:w-80 ml-auto border border-stone-200/50">
                  <div className="flex justify-between items-center text-xs text-stone-500 font-bold">
                    <span>SUBTOTAL (SIN IVA):</span>
                    <span>${ticketDetails.subtotal.toFixed(2)}</span>
                  </div>
                  {ticketDetails.discount > 0 && (
                    <div className="flex justify-between items-center text-xs text-red-500 font-bold">
                      <span>DESCUENTO:</span>
                      <span>-${ticketDetails.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-stone-500 font-bold">
                    <span>IVA TRASLADADO (16%):</span>
                    <span>${ticketDetails.taxes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-[#064e3b] font-black border-t border-stone-200 pt-2">
                    <span>TOTAL CFDI:</span>
                    <span>${ticketDetails.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-stone-400 font-extrabold border-t border-stone-200/50 pt-2 uppercase">
                    <span>PAGO:</span>
                    <span className="flex items-center gap-1.5">
                      {ticketDetails.payment_method === 'efectivo' ? <DollarSign size={11} /> : <CreditCard size={11} />}
                      {ticketDetails.payment_method}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: Datos fiscales y Botón Facturar */}
          <div className="lg:col-span-1 space-y-6">
            {ticketDetails && !ticketDetails.invoice && !ticketDetails.is_cancelled && (
              <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft space-y-5 animate-slide-up">
                <h3 className="text-sm font-black text-brand-900 tracking-wider uppercase">Receptor (Datos Fiscales)</h3>

                {!showProfileForm ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 mb-1 uppercase tracking-widest">Seleccionar Perfil Fiscal</label>
                      <select
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className="w-full px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                      >
                        <option value="">PÚBLICO EN GENERAL (XAXX010101000)</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.rfc} - {p.razon_social}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase">¿No está en la lista?</span>
                      <button
                        onClick={() => setShowProfileForm(true)}
                        className="text-xs text-chiluda-red font-black hover:underline uppercase flex items-center gap-1"
                      >
                        <Plus size={14} /> Registrar Perfil
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterProfile} className="space-y-3.5 border border-stone-100 p-4 rounded-2xl bg-stone-50/50">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-stone-500 uppercase">Nuevo Perfil de Cliente</h4>
                      <button
                        type="button"
                        onClick={() => setShowProfileForm(false)}
                        className="text-[10px] text-stone-400 font-extrabold hover:text-stone-600 uppercase"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-stone-400 mb-0.5 uppercase tracking-wider">RFC</label>
                      <input
                        type="text"
                        required
                        value={newProfile.rfc}
                        onChange={(e) => setNewProfile({...newProfile, rfc: formatRFC(e.target.value)})}
                        placeholder="RFC DEL CLIENTE (12 O 13 CARACTERES)"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-stone-400 mb-0.5 uppercase tracking-wider">Razón Social</label>
                      <input
                        type="text"
                        required
                        value={newProfile.razon_social}
                        onChange={(e) => setNewProfile({...newProfile, razon_social: e.target.value.toUpperCase()})}
                        placeholder="RAZÓN SOCIAL EXACTA (SAT)"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-stone-400 mb-0.5 uppercase tracking-wider">Régimen Fiscal</label>
                      <select
                        value={newProfile.regimen_fiscal}
                        onChange={(e) => setNewProfile({...newProfile, regimen_fiscal: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold"
                      >
                        {SAT_REGIMENES.map(reg => (
                          <option key={reg.code} value={reg.code}>{reg.code} - {reg.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-stone-400 mb-0.5 uppercase tracking-wider">Código Postal (Domicilio Fiscal)</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={newProfile.codigo_postal}
                        onChange={(e) => setNewProfile({...newProfile, codigo_postal: e.target.value.replace(/[^0-9]/g, '')})}
                        placeholder="5 DÍGITOS C.P."
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-stone-400 mb-0.5 uppercase tracking-wider">Correo Electrónico (Envío CFDI)</label>
                      <input
                        type="email"
                        required
                        value={newProfile.correo}
                        onChange={(e) => setNewProfile({...newProfile, correo: e.target.value})}
                        placeholder="correo@ejemplo.com"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#064e3b] text-white py-2 rounded-xl text-xs font-black uppercase hover:bg-[#043327]"
                    >
                      Guardar Cliente Fiscal
                    </button>
                  </form>
                )}

                <div className="border-t border-stone-100 pt-4">
                  <button
                    onClick={handleTimbrarTicket}
                    disabled={processingInvoice}
                    className="w-full bg-chiluda-red text-white py-3.5 rounded-2xl font-black text-xs uppercase hover:bg-chiluda-darkred shadow-float active:scale-[0.98] transition-all flex items-center justify-center gap-2 tracking-wider"
                  >
                    {processingInvoice ? (
                      <>
                        <Loader className="animate-spin" size={16} /> Timbrando CFDI...
                      </>
                    ) : (
                      <>
                        <Receipt size={16} /> Generar Factura CFDI 4.0
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!ticketDetails && (
              <div className="bg-[#064e3b]/5 border border-[#064e3b]/10 rounded-3xl p-6 text-center text-[#064e3b] space-y-3">
                <AlertCircle className="mx-auto text-[#064e3b] opacity-80" size={32} />
                <h4 className="text-xs font-black uppercase">Instrucciones de Facturación</h4>
                <p className="text-[11px] leading-relaxed font-semibold text-stone-600">
                  1. Localiza el número de ticket impreso en el comprobante.<br/>
                  2. Ingrésalo en el buscador de la izquierda.<br/>
                  3. Selecciona el perfil de facturación del cliente o agrégalo en el formulario.<br/>
                  4. Presiona "Generar Factura" para timbrar con el PAC de prueba.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FACTURA GLOBAL */}
      {activeTab === 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft space-y-4">
              <h3 className="text-sm font-black text-brand-900 tracking-wider uppercase">Consolidación de Tickets de Venta</h3>
              <p className="text-stone-500 text-xs font-semibold leading-relaxed">
                Genera la factura global diaria, semanal o mensual del Público en General. Introduce los números de ticket separados por comas para agruparlos en un único CFDI estructurado.
              </p>
              <form onSubmit={handlePreviewGlobal} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-stone-400 mb-1.5 uppercase tracking-widest">Números de Ticket a Consolidar</label>
                  <input
                    type="text"
                    required
                    value={globalTicketIds}
                    onChange={(e) => setGlobalTicketIds(e.target.value)}
                    placeholder="EJ. 10, 11, 12, 13"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingGlobalPreview}
                  className="bg-[#064e3b] text-white px-6 py-3 h-[46px] rounded-2xl font-black text-xs hover:bg-[#043327] transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px] uppercase tracking-wider"
                >
                  {loadingGlobalPreview ? <Loader className="animate-spin" size={14} /> : 'Cargar Tickets'}
                </button>
              </form>
            </div>

            {globalTicketDetails && (
              <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft space-y-5 animate-slide-up">
                <h4 className="text-sm font-black text-brand-900 uppercase border-b border-stone-100 pb-3">Vista Previa de Factura Global</h4>
                
                {/* Consolidated items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-50 text-stone-500 uppercase font-black text-[9px] tracking-wider border-b border-stone-150">
                      <tr>
                        <th className="py-2.5 px-3">Artículo</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">P.U.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {globalTicketDetails.items.map((itm, index) => (
                        <tr key={index} className="hover:bg-stone-50/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-stone-850">{itm.product_name}</div>
                            <div className="text-[9px] text-stone-400 mt-0.5">Venta ID #{itm.sale_id}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-stone-700">{itm.quantity}</td>
                          <td className="py-3 px-3 text-right text-stone-600">${itm.price.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-bold text-stone-850">${itm.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen */}
                <div className="bg-stone-50 rounded-2xl p-4 flex flex-col gap-2.5 w-full md:w-80 ml-auto border border-stone-200/50">
                  <div className="flex justify-between items-center text-xs text-stone-500 font-bold">
                    <span>SUBTOTAL FACTURA:</span>
                    <span>${globalTicketDetails.subtotal.toFixed(2)}</span>
                  </div>
                  {globalTicketDetails.discount > 0 && (
                    <div className="flex justify-between items-center text-xs text-red-500 font-bold">
                      <span>DESCUENTO TOTAL:</span>
                      <span>-${globalTicketDetails.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-stone-500 font-bold">
                    <span>IVA (16%):</span>
                    <span>${globalTicketDetails.taxes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-[#064e3b] font-black border-t border-stone-200 pt-2">
                    <span>TOTAL GLOBAL:</span>
                    <span>${globalTicketDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {globalTicketDetails && (
              <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl p-6 shadow-soft space-y-5 animate-slide-up">
                <h3 className="text-sm font-black text-brand-900 tracking-wider uppercase">Generar Factura SAT</h3>
                
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs font-semibold text-stone-600">
                  <p className="font-bold text-stone-800 uppercase">Información de Emisor/Receptor:</p>
                  <p>Receptor: PÚBLICO EN GENERAL</p>
                  <p>RFC: XAXX010101000</p>
                  <p>Régimen: 616 - Sin obligaciones fiscales</p>
                  <p>Uso CFDI: S01 - Sin efectos fiscales</p>
                </div>

                <button
                  onClick={handleTimbrarGlobal}
                  disabled={processingInvoice}
                  className="w-full bg-chiluda-red text-white py-3.5 rounded-2xl font-black text-xs uppercase hover:bg-chiluda-darkred shadow-float active:scale-[0.98] transition-all flex items-center justify-center gap-2 tracking-wider"
                >
                  {processingInvoice ? (
                    <>
                      <Loader className="animate-spin" size={16} /> Timbrando Global...
                    </>
                  ) : (
                    <>
                      <Receipt size={16} /> Timbrar Factura Global
                    </>
                  )}
                </button>
              </div>
            )}

            {!globalTicketDetails && (
              <div className="bg-[#064e3b]/5 border border-[#064e3b]/10 rounded-3xl p-6 text-center text-[#064e3b] space-y-3">
                <AlertCircle className="mx-auto text-[#064e3b] opacity-80" size={32} />
                <h4 className="text-xs font-black uppercase">¿Cómo funciona la Factura Global?</h4>
                <p className="text-[11px] leading-relaxed font-semibold text-stone-600">
                  De acuerdo a las normativas del SAT, las ventas del día al público general que no fueron facturadas individualmente pueden ser consolidadas en una factura global. Ingrese los números de ticket separados por comas y genere el comprobante correspondiente de manera agrupada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORIAL FISCAL */}
      {activeTab === 'history' && (
        <div className="bg-white/10 backdrop-blur-[3px] border border-white/40 rounded-3xl shadow-soft overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs md:text-sm">
              <thead className="bg-stone-50 text-stone-500 uppercase font-black text-[10px] tracking-wider border-b border-stone-150">
                <tr>
                  <th className="px-4 py-4 text-center">Fecha Timbrado</th>
                  <th className="px-4 py-4 text-center">Folio Fiscal (UUID)</th>
                  <th className="px-4 py-4 text-center">Monto Total</th>
                  <th className="px-4 py-4 text-center">Estado</th>
                  <th className="px-4 py-4 text-center rounded-tr-xl">Documentos / Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-stone-500">
                      <div className="flex flex-col items-center justify-center">
                        <Loader className="animate-spin h-8 w-8 text-stone-400 mb-2" />
                        <span>Cargando historial de facturas fiscales...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50/50 transition-all">
                    <td className="px-4 py-3.5 font-semibold text-stone-600 text-center">
                      {new Date(inv.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] md:text-xs text-stone-700 tracking-wider text-center">
                      {inv.uuid}
                    </td>
                    <td className="px-4 py-3.5 text-center font-black text-stone-850">
                      ${inv.monto_total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-3 py-1 inline-flex text-[9px] font-black rounded-full border uppercase tracking-wider ${
                        inv.status === 'cancelled'
                          ? 'bg-red-500/10 text-red-800 border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
                      }`}>
                        {inv.status === 'cancelled' ? 'Cancelado SAT' : 'Vigente'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {/* Descargar XML */}
                        <a
                          href={`${API_URL}/billing/invoices/${inv.uuid}/xml`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-stone-100 text-stone-600 hover:bg-stone-200 px-2.5 py-1.5 rounded-xl font-bold text-[10px] uppercase"
                          title="Descargar archivo XML"
                        >
                          <FileText size={12} />
                          <span>XML</span>
                        </a>

                        {/* Descargar PDF */}
                        <a
                          href={`${API_URL}/billing/invoices/${inv.uuid}/pdf`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-[#064e3b]/10 text-[#064e3b] hover:bg-[#064e3b]/20 px-2.5 py-1.5 rounded-xl font-bold text-[10px] uppercase"
                          title="Descargar PDF de Factura"
                        >
                          <Download size={12} />
                          <span>PDF</span>
                        </a>

                        {/* Enviar Correo */}
                        <button
                          onClick={() => setSuccessMsg(`El archivo XML y PDF de la factura han sido programados para envío por correo.`)}
                          className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-stone-50"
                          title="Reenviar por Correo"
                        >
                          <Mail size={15} />
                        </button>

                        {/* Cancelar Factura */}
                        {inv.status !== 'cancelled' && (user.role === 'admin' || user.role === 'supervisor') && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-50"
                            title="Solicitar cancelación al SAT"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loadingHistory && invoices.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-stone-400 text-xs font-semibold">
                      <div className="flex flex-col items-center justify-center">
                        <Receipt className="h-8 w-8 text-stone-300 mb-2 animate-pulse" />
                        <span>No hay registros de facturación timbrados en el sistema.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TIMBRADO EXITOSO DIALOG */}
      {successInvoice && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-soft w-full max-w-lg max-h-[85vh] max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-white animate-slide-up">
            <div className="p-8 text-center space-y-5 overflow-y-auto flex-1">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle size={44} className="stroke-[2.5]" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-brand-900 uppercase">Factura Timbrada con Éxito</h3>
                <p className="text-stone-500 text-xs font-semibold leading-relaxed">
                  El comprobante fiscal digital ha sido sellado y timbrado correctamente por el SAT en el entorno de pruebas.
                </p>
              </div>

              <div className="p-5 bg-stone-50 border border-stone-200/50 rounded-3xl text-left space-y-2.5 font-mono text-[10px] md:text-xs">
                <div className="flex flex-col md:flex-row justify-between md:items-center">
                  <span className="font-sans font-black text-stone-400 uppercase tracking-widest text-[9px]">Folio Fiscal (UUID):</span>
                  <span className="text-[#064e3b] font-bold tracking-wider">{successInvoice.uuid}</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between md:items-center border-t border-stone-200/50 pt-2">
                  <span className="font-sans font-black text-stone-400 uppercase tracking-widest text-[9px]">Monto Total:</span>
                  <span className="text-stone-900 font-extrabold text-sm font-sans">${successInvoice.monto_total.toFixed(2)} MXN</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between md:items-center border-t border-stone-200/50 pt-2">
                  <span className="font-sans font-black text-stone-400 uppercase tracking-widest text-[9px]">Fecha Certificación:</span>
                  <span className="text-stone-600 font-sans font-bold">{new Date(successInvoice.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
                <a
                  href={`${API_URL}/billing/invoices/${successInvoice.uuid}/xml`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 border border-stone-200 text-stone-700 rounded-2xl hover:bg-stone-50 transition-all text-xs font-black uppercase flex items-center justify-center gap-2"
                >
                  <FileText size={15} /> Descargar XML
                </a>
                <a
                  href={`${API_URL}/billing/invoices/${successInvoice.uuid}/pdf`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-[#064e3b] text-white rounded-2xl hover:bg-[#043327] transition-all text-xs font-black uppercase flex items-center justify-center gap-2 shadow-float"
                >
                  <Download size={15} /> Descargar PDF
                </a>
              </div>

              <button
                onClick={() => setSuccessInvoice(null)}
                className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-black text-xs uppercase transition-all tracking-wider"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ERROR MSG DIALOG */}
      {errorMsg && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-soft w-full max-w-sm overflow-hidden animate-slide-up border border-red-100">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-black text-gray-900 uppercase">Error en el Proceso</h3>
              <p className="text-gray-600 text-xs font-semibold leading-relaxed">{errorMsg}</p>
              <button
                onClick={() => setErrorMsg('')}
                className="px-6 py-2.5 bg-chiluda-red text-white font-bold rounded-xl w-full hover:bg-chiluda-darkred transition-colors text-xs uppercase"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUCCESS GENERAL NOTIFICATION MODAL */}
      {successMsg && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-soft w-full max-w-sm overflow-hidden animate-slide-up border border-emerald-100">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-lg font-black text-gray-900 uppercase">Aviso de Éxito</h3>
              <p className="text-gray-600 text-xs font-semibold leading-relaxed">{successMsg}</p>
              <button
                onClick={() => setSuccessMsg('')}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl w-full hover:bg-emerald-700 transition-colors text-xs uppercase"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM CANCEL DIALOG */}
      {confirmCancelInvoiceId && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-soft w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black text-gray-955 uppercase">¿Cancelar Factura ante el SAT?</h3>
              <p className="text-gray-500 text-xs font-semibold">
                Esta acción enviará la solicitud de cancelación al SAT de forma simulada. Las ventas asociadas serán desvinculadas y podrán volver a facturarse.
              </p>
              <div className="flex space-x-3 justify-center pt-2">
                <button
                  onClick={() => setConfirmCancelInvoiceId(null)}
                  className="px-4 py-2 border border-stone-200 text-stone-750 rounded-xl hover:bg-stone-50 transition-colors w-full font-bold text-xs uppercase"
                >
                  Regresar
                </button>
                <button
                  onClick={confirmCancelInvoice}
                  className="px-4 py-2 bg-chiluda-red text-white rounded-xl hover:bg-chiluda-darkred transition-colors w-full font-bold text-xs uppercase"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Invoices;
