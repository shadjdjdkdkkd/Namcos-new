import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [storeName, setStoreName] = useState('');

  const addItem = useCallback((product, quantity = 1, currentStoreId, currentStoreName) => {
    if (storeId && storeId !== currentStoreId) {
      const confirm = window.confirm(
        'Your cart has items from another store. Clear and add from this store?'
      );
      if (!confirm) return false;
      setItems([]);
    }
    setStoreId(currentStoreId);
    setStoreName(currentStoreName || '');
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.sale_price || product.price,
        quantity,
        image: product.images?.[0] || null,
        unit: product.unit,
      }];
    });
    return true;
  }, [storeId]);

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.product_id !== productId));
    } else {
      setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity } : i));
    }
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => {
      const next = prev.filter(i => i.product_id !== productId);
      if (next.length === 0) { setStoreId(null); setStoreName(''); }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setStoreId(null);
    setStoreName('');
  }, []);

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, storeId, storeName, addItem, updateQuantity, removeItem, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
