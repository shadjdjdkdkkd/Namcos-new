import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminStores from './AdminStores';
import AdminOrders from './AdminOrders';
import AdminListings from './AdminListings';
import AdminWithdrawals from './AdminWithdrawals';
import AdminTransactions from './AdminTransactions';
import AdminBusinessTypes from './AdminBusinessTypes';
import AdminAccount from './AdminAccount';
import AdminSettings from './AdminSettings';
import AdminChain from './AdminChain';
import AdminBanners from './AdminBanners';
import AdminCategories from './AdminCategories';
import AdminSubcategories from './AdminSubcategories';
import AdminInquiries from './AdminInquiries';
import AdminManualAdd from './AdminManualAdd';
import AdminNotifications from './AdminNotifications';
import AdminSupport from './AdminSupport';

export default function AdminApp() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="stores" element={<AdminStores />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="business-types" element={<AdminBusinessTypes />} />
        <Route path="account" element={<AdminAccount />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="subcategories" element={<AdminSubcategories />} />
        <Route path="inquiries" element={<AdminInquiries />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="add" element={<AdminManualAdd />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="chain" element={<AdminChain />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}
