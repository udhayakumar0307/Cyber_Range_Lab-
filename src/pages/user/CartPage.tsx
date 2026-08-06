import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { Trash2, CreditCard, ArrowLeft } from 'lucide-react';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCart = async () => {
    try {
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  };

  useEffect(() => {
    fetchCart();
    
    // Load Razorpay checkout script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleRemove = async (itemId: number) => {
    try {
      const res = await apiFetch(`/api/v1/cart/items/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCart();
        // Dispatches event to update cart badges in the layout
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handlePayment = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    const targetLab = cartItems[0];

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await apiFetch('/api/v1/student/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_id: targetLab.lab_id,
          price: targetLab.price_inr
        })
      });

      if (!orderRes.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await orderRes.json();

      // 2. Configure and open Razorpay standard checkout
      const options = {
        key: orderData.key || 'rzp_test_placeholder',
        amount: orderData.amount_paise,
        currency: orderData.currency,
        name: 'CyberRange Academy',
        description: `Purchase for ${targetLab.lab_title}`,
        order_id: orderData.razorpay_order_id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '9999999999'
        },
        theme: {
          color: '#2563EB'
        },
        handler: async function (response: any) {
          try {
            // 3. Verify Razorpay Payment Signature — pass exact values from Razorpay response
            const verifyRes = await apiFetch('/api/v1/student/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lab_id: targetLab.lab_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: orderData.amount
              })
            });

            if (verifyRes.ok) {
              // 4. Clear cart on verification success
              await apiFetch('/api/v1/cart', { method: 'DELETE' });
              window.dispatchEvent(new Event('cart-updated'));
              // Signal labs page to re-fetch purchased status
              window.dispatchEvent(new CustomEvent('lab-purchased', { detail: { lab_id: targetLab.lab_id } }));
              navigate('/labs?purchased=true');
            } else {
              const errData = await verifyRes.json().catch(() => ({}));
              const errMsg = errData?.detail || 'Payment verification failed. Please contact support.';
              alert(`Payment Error: ${errMsg}`);
            }
          } catch (verifyErr) {
            console.error('Error during signature verification:', verifyErr);
            alert('Network error during payment verification. Please check your connection.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Checkout failed:', err);
      setIsProcessing(false);
    }
  };

  const totalAmount = cartItems.reduce((acc, item) => acc + (item.price_inr * item.quantity), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/labs')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Shopping Cart</h1>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Your cart is empty.</p>
          <button
            onClick={() => navigate('/labs')}
            className="mt-4 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
          >
            Browse Labs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Student Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Student Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{user?.name || 'Student'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Email Address</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Phone Number</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{user?.phone || '9999999999'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Lab Details</h2>
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.lab_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Price: ₹{item.price_inr}</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-slate-800 dark:text-white text-sm">₹{item.price_inr * item.quantity}</span>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs h-fit space-y-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Order Summary</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₹{totalAmount}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (GST 18%)</span>
                <span>₹0.00</span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between text-sm font-bold">
                <span className="text-slate-800 dark:text-white">Total Amount</span>
                <span className="text-slate-800 dark:text-white">₹{totalAmount}</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full bg-[#2563EB] hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isProcessing ? 'Processing Payment...' : 'Continue to Payment'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
