import React from 'react';
import { X, ShoppingCart, Trash2, ArrowRight, Clock, Zap } from 'lucide-react';
import type { CartItem } from '../../types/cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateHours: (id: number | string, hours: number) => void;
  onUpdateQuantity?: (id: number | string, qty: number) => void;
  onUpdateDuration?: (id: number | string, months: number) => void;
  onRemoveItem: (id: number | string) => void;
  onClearCart: () => void;
  onProceedToCheckout: (cartSummary: any) => void;
}

const HOUR_PRESETS = [1, 5, 10, 50, 100, 400];

const inr = (n: number) => '\u20B9' + n.toLocaleString('en-IN');

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateHours,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const safeItems = cartItems ?? [];
  const subtotal = safeItems.reduce(
    (acc, item) => acc + (item.price_inr ?? 0) * (item.hours_purchased ?? 1),
    0
  );
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Cart Panel - Light & Dark theme responsive */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[500px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-colors duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl text-blue-600 dark:text-blue-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">Lab Cart</h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {safeItems.length} {safeItems.length === 1 ? 'lab' : 'labs'} selected
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {safeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-850 rounded-2xl">
                <ShoppingCart className="w-10 h-10 text-slate-400 dark:text-slate-650 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Cart is empty</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add a lab from the marketplace</p>
              </div>
            </div>
          ) : (
            safeItems.map((item) => {
              const hours = item.hours_purchased ?? 1;
              const ratePerHr = item.price_inr ?? 0;
              const itemTotal = ratePerHr * hours;

              return (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4"
                >
                  {/* Lab name + remove */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {item.lab_title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Zap className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-[12px] font-extrabold text-blue-600 dark:text-blue-400">
                          {inr(ratePerHr)} / hr
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">(SysAdmin rate)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Hour presets */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-slate-450 dark:text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wide">
                        Select Hours
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {HOUR_PRESETS.map((h) => (
                        <button
                          key={h}
                          onClick={() => onUpdateHours(item.id, h)}
                          className={`py-2 rounded-xl text-[12px] font-black transition-all ${
                            hours === h
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 scale-105'
                              : 'bg-white dark:bg-slate-700/60 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600/40'
                          }`}
                        >
                          {h}hr
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Item total */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[12px] text-slate-500 dark:text-slate-450">
                      {hours} hr &times; {inr(ratePerHr)}
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {inr(itemTotal)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Price Summary */}
        {safeItems.length > 0 && (
          <div className="px-5 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 space-y-3">
            {/* Price breakdown */}
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-bold text-slate-850 dark:text-slate-200">{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>GST (18%)</span>
                <span className="font-bold text-slate-850 dark:text-slate-200">{inr(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-950 dark:text-white">Total</span>
                <span className="text-blue-600 dark:text-blue-400 text-base">{inr(grandTotal)}</span>
              </div>
            </div>

            {/* CTA buttons */}
            <button
              onClick={() =>
                onProceedToCheckout({
                  subtotal,
                  tax,
                  grandTotal,
                  cartItems: safeItems,
                })
              }
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-sm py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Proceed to Payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClearCart}
              className="w-full text-slate-455 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 font-bold text-[12px] py-1.5 text-center transition-colors"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
};
