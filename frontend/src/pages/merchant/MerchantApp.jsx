import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MerchantLayout from '@/components/merchant/MerchantLayout';
import MerchantDashboard from './MerchantDashboard';
import MerchantProducts from './MerchantProducts';
import MerchantOrders from './MerchantOrders';
import MerchantPayments from './MerchantPayments';
import MerchantWithdrawals from './MerchantWithdrawals';
import MerchantSettings from './MerchantSettings';

export default function MerchantApp() {
  return (
    <MerchantLayout>
      <Routes>
        <Route index element={<MerchantDashboard />} />
        <Route path="products" element={<MerchantProducts />} />
        <Route path="orders" element={<MerchantOrders />} />
        <Route path="payments" element={<MerchantPayments />} />
        <Route path="withdrawals" element={<MerchantWithdrawals />} />
        <Route path="settings" element={<MerchantSettings />} />
        <Route path="*" element={<Navigate to="/merchant" replace />} />
      </Routes>
    </MerchantLayout>
  );
}
