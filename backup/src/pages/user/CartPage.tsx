import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { Trash2, ShoppingCart, ArrowLeft, ArrowRight, Clock, Zap } from 'lucide-react';

const HOUR_PRESETS = [1, 5, 10, 50, 100, 400];
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCart = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchCart();

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, [fetchCart]);

  const handleRemove = async (itemId: number) => {
    try {
      const res = await apiFetch(`/api/v1/cart/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCart();
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handleUpdateHours = async (itemId: number, hours: number) => {
    try {
      const res = await apiFetch(`/api/v1/cart/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours_purchased: hours })
      });
      if (res.ok) fetchCart();
    } catch (err) {
      console.error('Failed to update hours:', err);
    }
  };

  const handleClearCart = async () => {
    try {
      await apiFetch('/api/v1/cart', { method: 'DELETE' });
      setCartItems([]);
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  const handlePayment = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    const targetLab = cartItems[0];

    try {
      const orderRes = await apiFetch('/api/v1/student/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_id: targetLab.lab_id,
          price: targetLab.price_inr * (targetLab.hours_purchased ?? 1),
          hours: targetLab.hours_purchased ?? 1
        })
      });

      if (!orderRes.ok) throw new Error('Failed to create order');
      const orderData = await orderRes.json();

      const options = {
        key: orderData.key || 'rzp_test_placeholder',
        amount: orderData.amount_paise,
        currency: orderData.currency,
        name: 'CyberRange Academy',
        description: `${targetLab.lab_title} — ${targetLab.hours_purchased ?? 1} hr(s)`,
        order_id: orderData.razorpay_order_id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '9999999999'
        },
        theme: { color: '#2563EB' },
        handler: async function (response: any) {
          try {
            const verifyRes = await apiFetch('/api/v1/student/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lab_id: targetLab.lab_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: orderData.amount,
                hours: targetLab.hours_purchased ?? 1
              })
            });
            if (verifyRes.ok) {
              await apiFetch('/api/v1/cart', { method: 'DELETE' });
              window.dispatchEvent(new Event('cart-updated'));
              window.dispatchEvent(new CustomEvent('lab-purchased', { detail: { lab_id: targetLab.lab_id } }));
              navigate('/labs?purchased=true');
            } else {
              const errData = await verifyRes.json().catch(() => ({}));
              alert(`Payment Error: ${errData?.detail || 'Payment verification failed. Please contact support.'}`);
            }
          } catch {
            alert('Network error during payment verification.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Checkout failed:', err);
      setIsProcessing(false);
    }
  };

  // Compute totals from live cart items
  const subtotal = cartItems.reduce(
    (acc, item) => acc + (item.price_inr ?? 0) * (item.hours_purchased ?? 1),
    0
  );
  const tax = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax;

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/labs')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl text-blue-600 dark:text-blue-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Lab Cart</h1>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {cartItems.length} {cartItems.length === 1 ? 'lab' : 'labs'} selected
            </span>
          </div>
        </div>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <ShoppingCart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Your cart is empty.</p>
          <button
            onClick={() => navigate('/labs')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors"
          >
            Browse Labs
          </button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="space-y-4">
            {cartItems.map((item) => {
              const hours = item.hours_purchased ?? 1;
              const ratePerHr = item.price_inr ?? 0;
              const itemTotal = ratePerHr * hours;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  {/* Lab name + remove */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {item.lab_title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Zap className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-[12px] font-extrabold text-blue-600 dark:text-blue-400">
                          {inr(ratePerHr)} / hr
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">(SysAdmin rate)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Hour presets */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        Select Hours
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {HOUR_PRESETS.map((h) => (
                        <button
                          key={h}
                          onClick={() => handleUpdateHours(item.id, h)}
                          className={`py-2 rounded-xl text-[12px] font-black transition-all ${
                            hours === h
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 scale-105'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {h}hr
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Item total */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      {hours} hr × {inr(ratePerHr)}
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {inr(itemTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Price Summary + CTA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>GST (18%)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inr(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-900 dark:text-white">Total</span>
                <span className="text-blue-600 dark:text-blue-400 text-base">{inr(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-sm py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span>{isProcessing ? 'Processing Payment...' : 'Proceed to Payment'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearCart}
              className="w-full text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-[12px] py-1 text-center transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </>
      )}
    </div>
  );
};
