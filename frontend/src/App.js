import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@/App.css';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { Toaster } from '@/components/ui/sonner';
import { PageLoader } from '@/components/shared/LoadingSpinner';

// Lazy-load portals
const AuthPage = React.lazy(() => import('@/pages/auth/AuthPage'));
const CustomerApp = React.lazy(() => import('@/pages/customer/CustomerApp'));
const MerchantApp = React.lazy(() => import('@/pages/merchant/MerchantApp'));
const AdminApp = React.lazy(() => import('@/pages/admin/AdminApp'));
const AdminLoginPage = React.lazy(() => import('@/pages/admin/AdminLoginPage'));

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader text="Loading NAMCOS..." />;
  if (!user) return <Navigate to="/auth" replace />;
  const roles = user.roles || [];
  if (roles.includes('admin') || roles.includes('super_admin')) return <Navigate to="/admin" replace />;
  if (roles.includes('merchant')) return <Navigate to="/merchant" replace />;
  return <Navigate to="/customer" replace />;
}

function ProtectedRoute({ children, requiredRoles, redirectTo = '/auth' }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader text="Loading..." />;
  if (!user) return <Navigate to={redirectTo} replace />;
  if (requiredRoles && !requiredRoles.some(r => user.roles?.includes(r))) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <React.Suspense fallback={<PageLoader text="Loading NAMCOS..." />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth/*" element={<AuthPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/customer/*" element={
          <ProtectedRoute>
            <CustomerApp />
          </ProtectedRoute>
        } />
        <Route path="/merchant/*" element={
          <ProtectedRoute>
            <MerchantApp />
          </ProtectedRoute>
        } />
        <Route path="/admin/*" element={
          <ProtectedRoute requiredRoles={['admin', 'super_admin']} redirectTo="/admin/login">
            <AdminApp />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
