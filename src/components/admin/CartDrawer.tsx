import React, { useState } from 'react';
import { X, ShoppingCart, Trash2, ArrowRight, ShieldCheck, Tag, Plus, Minus } from 'lucide-react';
import type { CartItem } from '../../types/cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: number | string, qty: number) => void;
  onUpdateDuration: (id: number | string, months: number) => void;
  onRemoveItem: (id: number | string) => void;
  onClearCart: () => void;
  onProceedToCheckout: (cartSummary: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onUpdateDuration,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout
}) => {
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);

  if (!isOpen) return null;

  const safeCartItems = cartItems ?? [];
  const subtotal = safeCartItems.reduce((acc, item) => acc + (item.price_inr ?? 0) * (item.quantity ?? 0), 0);
  const tax = Math.round((subtotal - discountAmount) * 0.18);
  const grandTotal = subtotal - discountAmount + tax;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (discountCode.trim().toUpperCase() === 'ASTRA10' || discountCode.trim().toUpperCase() === 'CYBER10') {
      const disc = Math.round(subtotal * 0.10);
      setDiscountAmount(disc);
      setCouponApplied(true);
    } else {
      alert('Invalid Promo Code. Try "ASTRA10" for 10% off.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl text-blue-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">Shopping Cart</h2>
                <span className="text-xs text-slate-500">{safeCartItems.length} {safeCartItems.length === 1 ? 'Lab' : 'Labs'} Selected</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {safeCartItems.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <ShoppingCart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Your cart is currently empty.</p>
                <p className="text-xs text-slate-400">Browse the Lab Marketplace to add cybersecurity training labs.</p>
              </div>
            ) : (
              safeCartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{item.lab_title}</h4>
                      <p className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                        ₹{(item.price_inr ?? 0).toLocaleString()} / seat
                      </p>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="Remove Lab"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity (Seats) & Duration Selectors */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Student Seats</span>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.id, Math.max(1, (item.quantity ?? 0) - 1))}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex-1 text-center">{item.quantity ?? 0}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, (item.quantity ?? 0) + 1)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">License Duration</span>
                      <select
                        value={item.license_duration_months ?? 12}
                        onChange={(e) => onUpdateDuration(item.id, Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                      >
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months (1 Year)</option>
                        <option value={24}>24 Months (2 Years)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Lab Subtotal:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      ₹{((item.price_inr ?? 0) * (item.quantity ?? 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout & Summary Footer */}
          {safeCartItems.length > 0 && (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 space-y-4">
              {/* Promo Code Input */}
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Promo Code (ASTRA10)"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
                >
                  Apply
                </button>
              </form>

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount (10%)</span>
                    <span>- ₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>GST (18%)</span>
                  <span>₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Grand Total</span>
                  <span className="text-blue-600 dark:text-blue-400">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() =>
                    onProceedToCheckout({
                      subtotal,
                      discountAmount,
                      tax,
                      grandTotal,
                      cartItems: safeCartItems
                    })
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onClearCart}
                  className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-[11px] py-1 text-center"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
