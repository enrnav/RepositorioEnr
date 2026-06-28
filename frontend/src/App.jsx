import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Users from './pages/Users';
import Invoices from './pages/Invoices';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Settings from './pages/Settings';
import Customers from './pages/Customers';


const ProtectedRoute = ({ children, allowedRoles }) => {
  const userStr = sessionStorage.getItem('user');
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  
  const user = JSON.parse(userStr);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/sales" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    return user.role === 'admin' ? <Navigate to="/dashboard" replace /> : <Navigate to="/sales" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicRoute><Navigate to="/login" replace /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Inventory />
            </ProtectedRoute>
          } />
          <Route path="/suppliers" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Suppliers />
            </ProtectedRoute>
          } />
          <Route path="/purchases" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Purchases />
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Invoices />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/customers" element={<Customers />} />
          <Route path="/sales" element={<Sales />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

