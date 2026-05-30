import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

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
