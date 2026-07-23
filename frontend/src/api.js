// Force redeploy to trigger Vercel environment variable rebuild
import axios from 'axios';

let baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
if (import.meta.env.VITE_API_URL) {
    if (!baseApiUrl.startsWith('http://') && !baseApiUrl.startsWith('https://')) {
        baseApiUrl = `https://${baseApiUrl}`;
    }
    if (!baseApiUrl.endsWith('/api')) {
        baseApiUrl = baseApiUrl.endsWith('/') ? `${baseApiUrl}api` : `${baseApiUrl}/api`;
    }
}
export const API_URL = baseApiUrl;

// Add interceptor to inject the token
axios.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

axios.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response && error.response.status === 401) {
        // Automatically logout on 401 Unauthorized
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.inquilino_id === 1) {
                    localStorage.removeItem('last_tenant_subdomain');
                }
            } catch (e) {
                console.error("Error parsing user on 401 logout", e);
            }
        }
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
});

export const fetchTenantBranding = async (subdominio) => {
    try {
        const response = await axios.get(`${API_URL}/auth/inquilino-branding/${subdominio}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching inquilino branding:", error);
        throw error;
    }
};

export const fetchInventory = async () => {
    try {
        const response = await axios.get(`${API_URL}/inventory/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching inventory:", error);
        throw error;
    }
};

export const fetchDashboardStats = async () => {
    try {
        const response = await axios.get(`${API_URL}/dashboard/stats`);
        return response.data;
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};

export const createProduct = async (productData) => {
    try {
        const response = await axios.post(`${API_URL}/inventory/`, productData);
        return response.data;
    } catch (error) {
        console.error("Error creating producto:", error);
        throw error;
    }
};

export const updateProduct = async (id, productData) => {
    try {
        const response = await axios.put(`${API_URL}/inventory/${id}`, productData);
        return response.data;
    } catch (error) {
        console.error(`Error updating producto ${id}:`, error);
        throw error;
    }
};

export const deleteProduct = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/inventory/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting producto ${id}:`, error);
        throw error;
    }
};

export const searchProductImage = async (query) => {
    try {
        const response = await axios.get(`${API_URL}/inventory/search-imagen`, {
            params: { q: query }
        });
        return response.data;
    } catch (error) {
        console.error("Error searching producto imagen:", error);
        throw error;
    }
};

export const sellProduct = async (id, cantidad = 1) => {
    try {
        const response = await axios.post(`${API_URL}/inventory/${id}/sell`, { cantidad });
        return response.data;
    } catch (error) {
        console.error(`Error selling producto ${id}:`, error);
        throw error;
    }
};

export const fetchSalesReport = async () => {
    try {
        const response = await axios.get(`${API_URL}/inventory/sales_report`);
        return response.data;
    } catch (error) {
        console.error("Error fetching sales report:", error);
        throw error;
    }
};

export const fetchRecentSales = async () => {
    try {
        const response = await axios.get(`${API_URL}/sales/recent`);
        return response.data;
    } catch (error) {
        console.error("Error fetching recent sales:", error);
        throw error;
    }
};

export const cancelSale = async (saleId, motivo, auth_username = null, auth_password = null, cantidad = null) => {
    try {
        const payload = { motivo };
        if (auth_username && auth_password) {
            payload.auth_username = auth_username;
            payload.auth_password = auth_password;
        }
        if (cantidad !== null) {
            payload.cantidad = cantidad;
        }
        const response = await axios.post(`${API_URL}/sales/${saleId}/cancel`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error cancelling sale ${saleId}:`, error);
        throw error;
    }
};

export const fetchReturnsReport = async () => {
    try {
        const response = await axios.get(`${API_URL}/inventory/returns_report`);
        return response.data;
    } catch (error) {
        console.error("Error fetching returns report:", error);
        throw error;
    }
};

// --- SHIFTS & CASH API ENDPOINTS ---

export const fetchActiveShift = async () => {
    try {
        const response = await axios.get(`${API_URL}/shifts/active`);
        return response.data;
    } catch (error) {
        console.error("Error fetching active shift:", error);
        throw error;
    }
};

export const openShift = async (initialCash) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/open`, { efectivo_inicial: initialCash });
        return response.data;
    } catch (error) {
        console.error("Error opening shift:", error);
        throw error;
    }
};

export const closeShift = async (finalCashReal) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/close`, { efectivo_final_real: finalCashReal });
        return response.data;
    } catch (error) {
        console.error("Error closing shift:", error);
        throw error;
    }
};

export const addCashMovement = async (tipo, monto, motivo) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/movement`, { tipo, monto, motivo });
        return response.data;
    } catch (error) {
        console.error("Error adding cash movement:", error);
        throw error;
    }
};

export const fetchShiftReport = async (shiftId) => {
    try {
        const response = await axios.get(`${API_URL}/shifts/${shiftId}/report`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching report for shift ${shiftId}:`, error);
        throw error;
    }
};

export const fetchActiveShiftsAdmin = async () => {
    try {
        const response = await axios.get(`${API_URL}/shifts/active-all`);
        return response.data;
    } catch (error) {
        console.error("Error fetching active shifts for admin:", error);
        throw error;
    }
};

export const closeShiftAdmin = async (shiftId, finalCashReal) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/${shiftId}/close`, { efectivo_final_real: finalCashReal });
        return response.data;
    } catch (error) {
        console.error(`Error closing shift ${shiftId} for admin:`, error);
        throw error;
    }
};

// --- CHECKOUT API ENDPOINT ---

export const checkoutSales = async (checkoutData) => {
    try {
        const response = await axios.post(`${API_URL}/sales/checkout`, checkoutData);
        return response.data;
    } catch (error) {
        console.error("Error during sales checkout:", error);
        throw error;
    }
};

// --- PROFIT MARGIN REPORT ---

export const fetchProfitMarginReport = async () => {
    try {
        const response = await axios.get(`${API_URL}/reports/profit-margin`);
        return response.data;
    } catch (error) {
        console.error("Error fetching profit margin report:", error);
        throw error;
    }
};

// --- BACKUP & SECURITY API ---

export const exportBackupDatabase = async (format) => {
    try {
        const response = await axios.get(`${API_URL}/backup/export`, {
            params: { format },
            responseType: 'blob'
        });
        return response.data;
    } catch (error) {
        console.error("Error exporting backup database:", error);
        throw error;
    }
};

export const importBackupDatabase = async (file) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_URL}/backup/import`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error importing backup database:", error);
        throw error;
    }
};

// --- ADVANCED DASHBOARD DETAILS ---

export const fetchDashboardDetails = async () => {
    try {
        const response = await axios.get(`${API_URL}/reports/dashboard-details`);
        return response.data;
    } catch (error) {
        console.error("Error fetching dashboard details:", error);
        throw error;
    }
};

// --- BILLING & INVOICING API ---

export const fetchBillingProfiles = async (query = '') => {
    try {
        const response = await axios.get(`${API_URL}/billing/profiles`, {
            params: query ? { q: query } : {}
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching billing profiles:", error);
        throw error;
    }
};

export const createBillingProfile = async (profileData) => {
    try {
        const response = await axios.post(`${API_URL}/billing/profiles`, profileData);
        return response.data;
    } catch (error) {
        console.error("Error creating billing profile:", error);
        throw error;
    }
};

export const updateBillingProfile = async (profileId, profileData) => {
    try {
        const response = await axios.put(`${API_URL}/billing/profiles/${profileId}`, profileData);
        return response.data;
    } catch (error) {
        console.error(`Error updating billing profile ${profileId}:`, error);
        throw error;
    }
};

export const fetchTicketDetails = async (ticketId) => {
    try {
        const response = await axios.get(`${API_URL}/billing/tickets/${ticketId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ticket details ${ticketId}:`, error);
        throw error;
    }
};

export const createInvoice = async (invoiceData) => {
    try {
        const response = await axios.post(`${API_URL}/billing/invoice`, invoiceData);
        return response.data;
    } catch (error) {
        console.error("Error creating invoice:", error);
        throw error;
    }
};

export const fetchInvoices = async () => {
    try {
        const response = await axios.get(`${API_URL}/billing/invoices`);
        return response.data;
    } catch (error) {
        console.error("Error fetching invoices:", error);
        throw error;
    }
};

export const cancelInvoice = async (invoiceId) => {
    try {
        const response = await axios.post(`${API_URL}/billing/invoices/${invoiceId}/cancel`);
        return response.data;
    } catch (error) {
        console.error(`Error cancelling invoice ${invoiceId}:`, error);
        throw error;
    }
};

// --- SUPPLIERS API ENDPOINTS ---

export const fetchSuppliers = async () => {
    try {
        const response = await axios.get(`${API_URL}/suppliers/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
    }
};

export const createSupplier = async (supplierData) => {
    try {
        const response = await axios.post(`${API_URL}/suppliers/`, supplierData);
        return response.data;
    } catch (error) {
        console.error("Error creating proveedor:", error);
        throw error;
    }
};

export const updateSupplier = async (id, supplierData) => {
    try {
        const response = await axios.put(`${API_URL}/suppliers/${id}`, supplierData);
        return response.data;
    } catch (error) {
        console.error(`Error updating proveedor ${id}:`, error);
        throw error;
    }
};

export const deleteSupplier = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/suppliers/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting proveedor ${id}:`, error);
        throw error;
    }
};

// --- PURCHASES API ENDPOINTS ---

export const fetchPurchases = async () => {
    try {
        const response = await axios.get(`${API_URL}/purchases/`);
        return response.data;
    } catch (error) {
        console.error("Error fetching purchases:", error);
        throw error;
    }
};

export const fetchPurchaseDetails = async (id) => {
    try {
        const response = await axios.get(`${API_URL}/purchases/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching compra details ${id}:`, error);
        throw error;
    }
};

export const createPurchase = async (purchaseData) => {
    try {
        const response = await axios.post(`${API_URL}/purchases/`, purchaseData);
        return response.data;
    } catch (error) {
        console.error("Error creating compra:", error);
        throw error;
    }
};
// --- SETTINGS API ENDPOINTS ---
export const fetchStoreSettings = async () => {
    try {
        const response = await axios.get(`${API_URL}/settings`);
        return response.data;
    } catch (error) {
        console.error("Error fetching store settings:", error);
        throw error;
    }
};

export const updateStoreSettings = async (settingsData) => {
    try {
        const response = await axios.put(`${API_URL}/settings`, settingsData);
        return response.data;
    } catch (error) {
        console.error("Error updating store settings:", error);
        throw error;
    }
};

// --- CUSTOMERS API ENDPOINTS ---
export const fetchCustomers = async (query = '') => {
    try {
        const response = await axios.get(`${API_URL}/customers`, {
            params: query ? { q: query } : {}
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching customers:", error);
        throw error;
    }
};

export const createCustomer = async (customerData) => {
    try {
        const response = await axios.post(`${API_URL}/customers`, customerData);
        return response.data;
    } catch (error) {
        console.error("Error creating customer:", error);
        throw error;
    }
};

export const updateCustomer = async (id, customerData) => {
    try {
        const response = await axios.put(`${API_URL}/customers/${id}`, customerData);
        return response.data;
    } catch (error) {
        console.error(`Error updating customer ${id}:`, error);
        throw error;
    }
};

export const deleteCustomer = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/customers/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting customer ${id}:`, error);
        throw error;
    }
};

export const registerCustomerPayment = async (id, paymentData) => {
    try {
        const response = await axios.post(`${API_URL}/customers/${id}/pay`, paymentData);
        return response.data;
    } catch (error) {
        console.error(`Error registering payment for customer ${id}:`, error);
        throw error;
    }
};

export const fetchCustomerHistory = async (id) => {
    try {
        const response = await axios.get(`${API_URL}/customers/${id}/history`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching history for customer ${id}:`, error);
        throw error;
    }
};

export const sendTicketWhatsApp = async (saleId, phoneNumber) => {
    try {
        const response = await axios.post(`${API_URL}/sales/${saleId}/whatsapp`, {
            phone_number: phoneNumber
        });
        return response.data;
    } catch (error) {
        console.error(`Error sending ticket ${saleId} via WhatsApp:`, error);
        throw error;
    }
};

export const sendInvoiceWhatsApp = async (invoiceId, phoneNumber) => {
    try {
        const response = await axios.post(`${API_URL}/billing/invoices/${invoiceId}/whatsapp`, {
            phone_number: phoneNumber
        });
        return response.data;
    } catch (error) {
        console.error(`Error sending invoice ${invoiceId} via WhatsApp:`, error);
        throw error;
    }
};

export const fetchTenant = async () => {
    try {
        const response = await axios.get(`${API_URL}/auth/inquilino`);
        return response.data;
    } catch (error) {
        console.error("Error fetching inquilino info:", error);
        throw error;
    }
};

export const changeTenantPlan = async (planTier) => {
    try {
        const response = await axios.post(`${API_URL}/auth/inquilino/change-plan`, { nivel_plan: planTier });
        return response.data;
    } catch (error) {
        console.error("Error changing inquilino plan:", error);
        throw error;
    }
};

export const fetchSuperAdminTenants = async () => {
    try {
        const response = await axios.get(`${API_URL}/superadmin/tenants`);
        return response.data;
    } catch (error) {
        console.error("Error fetching superadmin tenants:", error);
        throw error;
    }
};

export const updateSuperAdminTenantPlan = async (tenantId, updateData) => {
    try {
        const response = await axios.put(`${API_URL}/superadmin/tenants/${tenantId}/plan`, updateData);
        return response.data;
    } catch (error) {
        console.error(`Error updating superadmin inquilino plan for ${tenantId}:`, error);
        throw error;
    }
};

export const deleteSuperAdminTenant = async (tenantId) => {
    try {
        const response = await axios.delete(`${API_URL}/superadmin/tenants/${tenantId}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting inquilino ${tenantId}:`, error);
        throw error;
    }
};

export const resetSuperAdminTenantPassword = async (tenantId, newPassword) => {
    try {
        const response = await axios.put(`${API_URL}/superadmin/tenants/${tenantId}/reset-password`, { new_password: newPassword });
        return response.data;
    } catch (error) {
        console.error(`Error resetting password for inquilino ${tenantId}:`, error);
        throw error;
    }
};

export const createCheckoutSession = async () => {
    try {
        const response = await axios.post(`${API_URL}/billing/create-checkout-session`);
        return response.data;
    } catch (error) {
        console.error("Error creating checkout session:", error);
        throw error;
    }
};

export const simulatePaymentSuccess = async () => {
    try {
        const response = await axios.post(`${API_URL}/billing/simulate-success`);
        return response.data;
    } catch (error) {
        console.error("Error simulating payment success:", error);
        throw error;
    }
};

export const fetchUserLogs = async () => {
    try {
        const response = await axios.get(`${API_URL}/auth/users/logs`);
        return response.data;
    } catch (error) {
        console.error("Error fetching user logs:", error);
        throw error;
    }
};

