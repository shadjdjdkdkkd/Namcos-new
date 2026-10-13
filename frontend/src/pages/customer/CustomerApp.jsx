import React from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import BottomNav from '@/components/customer/BottomNav';
import CustomerHome from './CustomerHome';
import CustomerExplore from './CustomerExplore';
import StoreDetail from './StoreDetail';
import CustomerOrders from './CustomerOrders';
import OrderDetail from './OrderDetail';
import CustomerWallet from './CustomerWallet';
import CustomerProfile from './CustomerProfile';
import Cart from './Cart';
import CategoryPage from './CategoryPage';
import ClassifiedsLanding from './ClassifiedsLanding';
import MerchantRegisterPage from './MerchantRegisterPage';
import MyListings from './MyListings';
import AgricultureDetail from './AgricultureDetail';
import ServiceDetail from './ServiceDetail';
import ClassifiedDetail from './ClassifiedDetail';
import ListingDashboard from './ListingDashboard';
import CustomerNotifications from './CustomerNotifications';
import CustomerSupport from './CustomerSupport';
import CustomerSettings from './CustomerSettings';
import CustomerAddresses from './CustomerAddresses';

function SellRedirect() {
  const [params] = useSearchParams();
  const type = params.get('type');
  return <Navigate to={`/customer/register-merchant${type ? `?type=${type}` : ''}`} replace />;
}

export default function CustomerApp() {
  return (
    <div className="customer-app">
      <Routes>
        <Route index element={<CustomerHome />} />
        <Route path="explore" element={<CustomerExplore />} />
        <Route path="store/:storeId" element={<StoreDetail />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="my-listings" element={<MyListings />} />
        <Route path="my-listings/:kind/:id/dashboard" element={<ListingDashboard />} />
        <Route path="wallet" element={<CustomerWallet />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route path="profile/notifications" element={<CustomerNotifications />} />
        <Route path="profile/support" element={<CustomerSupport />} />
        <Route path="profile/settings" element={<CustomerSettings />} />
        <Route path="profile/addresses" element={<CustomerAddresses />} />
        <Route path="cart" element={<Cart />} />
        <Route path="sell" element={<SellRedirect />} />
        <Route path="category/classifieds" element={<ClassifiedsLanding />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="register-merchant" element={<MerchantRegisterPage />} />
        <Route path="agriculture/:id" element={<AgricultureDetail />} />
        <Route path="service/:id" element={<ServiceDetail />} />
        <Route path="classified/:id" element={<ClassifiedDetail />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
