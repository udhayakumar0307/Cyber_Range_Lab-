import React, { useState } from 'react';
import { X, Shield, CreditCard, Building, CheckCircle2, ArrowRight, Download, RefreshCw } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartSummary: any;
  onPaymentSuccess: (resultData: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartSummary,
  onPaymentSuccess
}) => {
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Institution details form
  const [institutionName, setInstitutionName] = useState('IIT Madras Cyber Center');
  const [gstNumber, setGstNumber] = useState('33AAATI1234F1Z9');
  const [address, setAddress] = useState('IIT Campus, Sardar Patel Road, Chennai');
  const [gateway, setGateway] = useState<'razorpay' | 'mock'>('mock');

  const [orderResult, setOrderResult] = useState<any>(null);

  if (!isOpen || !cartSummary) return null;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          institution_name: institutionName
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create order.');
      }

      setOrderResult(data);
      setStep('payment');
    } catch (err: any) {
      setError(err.message || 'Error processing order.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');

    // Check if Razorpay SDK script is loaded in browser
    if (gateway === 'razorpay' && (window as any).Razorpay) {
      try {
        const options = {
          key: 'rzp_test_mockkeyid', // Mock / test Razorpay key
          amount: Math.round(cartSummary.grandTotal * 100),
          currency: 'INR',
          name: 'CyberRange Enterprise',
          description: `Lab License Purchase (${cartSummary.cartItems?.length || 1} labs)`,
          order_id: orderResult.razorpay_order_id,
          handler: async (response: any) => {
            await finalizePaymentVerification(response.razorpay_payment_id, response.razorpay_signature, 'razorpay');
          },
          prefill: {
            name: institutionName,
            email: 'admin@cyberrange.in'
          },
          theme: { color: '#2563EB' }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        setLoading(false);
        return;
      } catch (err) {
        console.warn('Razorpay SDK fallback to mock mode:', err);
      }
    }

    // Fallback or explicit Mock Payment processing
    await finalizePaymentVerification(`TXN-MOCK-${Date.now()}`, 'MOCK_SIG', 'mock');
  };

  const finalizePaymentVerification = async (txnId: string, sig: string, method: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/checkout/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderResult.order_id,
          razorpay_payment_id: txnId,
          razorpay_signature: sig,
          gateway: method
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Payment verification failed.');
      }

      setOrderResult({ ...orderResult, ...data });
      setStep('success');
      onPaymentSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-base">Secure Checkout</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Institution Details */}
        {step === 'details' && (
          <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Institution / Billing Name *
              </label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                GST Number / Tax ID
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Billing Address *
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              ></textarea>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex justify-between items-center">
              <span>Grand Total Amount Payable:</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400">
                ₹{cartSummary.grandTotal?.toLocaleString()}
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <span>{loading ? 'Creating Order...' : 'Continue to Payment'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Payment Gateway Options */}
        {step === 'payment' && (
          <div className="p-6 space-y-6">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payment Gateway</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Select your preferred enterprise payment channel for Order #{orderResult?.order_number}.
              </p>
            </div>

            <div className="space-y-3">
              <label
                onClick={() => setGateway('razorpay')}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  gateway === 'razorpay'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Razorpay Payment Gateway</p>
                    <p className="text-[11px] text-slate-400">UPI, NetBanking, Corporate Cards, NEFT</p>
                  </div>
                </div>
                <input type="radio" name="gateway" checked={gateway === 'razorpay'} readOnly />
              </label>

              <label
                onClick={() => setGateway('mock')}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  gateway === 'mock'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Mock Payment Sandbox (Local Development)</p>
                    <p className="text-[11px] text-slate-400">Instant test fulfillment without real money charge</p>
                  </div>
                </div>
                <input type="radio" name="gateway" checked={gateway === 'mock'} readOnly />
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-xs font-bold text-slate-500 hover:underline"
              >
                Back
              </button>

              <button
                onClick={handleProcessPayment}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>{loading ? 'Processing Payment...' : `Pay ₹${cartSummary.grandTotal?.toLocaleString()}`}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Order Success */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Payment Successful!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your lab licenses have been activated. Invoice #{orderResult?.invoice_number} has been generated.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Order Number:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{orderResult?.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{orderResult?.transaction_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600">₹{orderResult?.amount_paid?.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  alert(`Downloading Invoice ${orderResult?.invoice_number}...`);
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Invoice</span>
              </button>

              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
