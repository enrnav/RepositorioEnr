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
    const token = sessionStorage.getItem('token');
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
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
});

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
        console.error("Error creating product:", error);
        throw error;
    }
};

export const updateProduct = async (id, productData) => {
    try {
        const response = await axios.put(`${API_URL}/inventory/${id}`, productData);
        return response.data;
    } catch (error) {
        console.error(`Error updating product ${id}:`, error);
        throw error;
    }
};

export const deleteProduct = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/inventory/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting product ${id}:`, error);
        throw error;
    }
};

export const searchProductImage = async (query) => {
    try {
        const response = await axios.get(`${API_URL}/inventory/search-image`, {
            params: { q: query }
        });
        return response.data;
    } catch (error) {
        console.error("Error searching product image:", error);
        throw error;
    }
};

export const sellProduct = async (id, quantity = 1) => {
    try {
        const response = await axios.post(`${API_URL}/inventory/${id}/sell`, { quantity });
        return response.data;
    } catch (error) {
        console.error(`Error selling product ${id}:`, error);
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

export const cancelSale = async (saleId, reason, auth_username = null, auth_password = null, quantity = null) => {
    try {
        const payload = { reason };
        if (auth_username && auth_password) {
            payload.auth_username = auth_username;
            payload.auth_password = auth_password;
        }
        if (quantity !== null) {
            payload.quantity = quantity;
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
        const response = await axios.post(`${API_URL}/shifts/open`, { initial_cash: initialCash });
        return response.data;
    } catch (error) {
        console.error("Error opening shift:", error);
        throw error;
    }
};

export const closeShift = async (finalCashReal) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/close`, { final_cash_real: finalCashReal });
        return response.data;
    } catch (error) {
        console.error("Error closing shift:", error);
        throw error;
    }
};

export const addCashMovement = async (type, amount, reason) => {
    try {
        const response = await axios.post(`${API_URL}/shifts/movement`, { type, amount, reason });
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
        const response = await axios.post(`${API_URL}/shifts/${shiftId}/close`, { final_cash_real: finalCashReal });
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
        console.error("Error creating supplier:", error);
        throw error;
    }
};

export const updateSupplier = async (id, supplierData) => {
    try {
        const response = await axios.put(`${API_URL}/suppliers/${id}`, supplierData);
        return response.data;
    } catch (error) {
        console.error(`Error updating supplier ${id}:`, error);
        throw error;
    }
};

export const deleteSupplier = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/suppliers/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting supplier ${id}:`, error);
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
        console.error(`Error fetching purchase details ${id}:`, error);
        throw error;
    }
};

export const createPurchase = async (purchaseData) => {
    try {
        const response = await axios.post(`${API_URL}/purchases/`, purchaseData);
        return response.data;
    } catch (error) {
        console.error("Error creating purchase:", error);
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

