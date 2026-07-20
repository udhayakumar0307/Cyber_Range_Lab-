import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { LicenseTierType, LicenseOption, SecurityLab } from '../../types/admin';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle, 
  Building2, 
  FileText, 
  ArrowLeft, 
  Clock, 
  Layers, 
  Star, 
  Lock,
  Sparkles
} from 'lucide-react';

export const LabPurchaseConfirmation: React.FC = () => {
  const { labId } = useParams<{ labId: string }>();
  const navigate = useNavigate();

  // Mock lookup lab data based on URL param or default
  const labData: SecurityLab = {
    id: labId || 'lab-net-01',
    title: 'Network Traffic Forensics & PCAP Analysis',
    shortDescription: 'Analyze Wireshark packet captures to isolate C2 server malware communication.',
    fullDescription: 'Investigate enterprise PCAP network dumps under SOC scenario conditions. Filter DNS tunneling attacks, decrypt TLS streams, and reconstruct payload drops.',
    difficulty: 'Intermediate',
    category: 'Network Forensics & SOC',
    priceInr: 12499,
    durationHours: 2.5,
    rating: 4.7,
    reviewCount: 98,
    prerequisites: ['TCP/IP stack knowledge', 'Wireshark filter syntax'],
    skillsCovered: ['Packet Inspection', 'DNS Tunneling Analysis', 'TLD Beacon Identification'],
    modules: [
      { id: 'm1', title: 'Isolating Anomaly Beaconing Interval', durationMinutes: 40, points: 150 },
      { id: 'm2', title: 'Reconstructing Exfiltrated Data Stream', durationMinutes: 50, points: 250 },
    ],
  };

  // State
  const [selectedLicense, setSelectedLicense] = useState<LicenseTierType>('annual_subscription');
  const [userSeatsCount, setUserSeatsCount] = useState<number>(25);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice' | 'credits'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const labPrice = labData.priceInr ?? 0;

  const licenseOptions: LicenseOption[] = [
    {
      type: 'perpetual',
      label: 'Single Event License',
      description: 'One-time cohort training event up to 10 participants.',
      baseMultiplier: 1.0,
      unitPrice: labPrice,
    },
    {
      type: 'annual_subscription',
      label: '1-Year Unlimited Subscription',
      description: 'Unlimited user launches and retries across all groups for 365 days.',
      baseMultiplier: 2.5,
      unitPrice: Math.round(labPrice * 2.5),
    },
    {
      type: 'per_user_seats',
      label: 'Per-User Seat Allocation',
      description: 'Pay per active user seat assigned. Scale flexibly.',
      baseMultiplier: 0.15,
      unitPrice: Math.round(labPrice * 0.15),
    },
  ];

  // Pricing calculations
  const currentOption = licenseOptions.find((opt) => opt.type === selectedLicense)!;
  const baseSubtotal =
    selectedLicense === 'per_user_seats'
      ? currentOption.unitPrice * userSeatsCount
      : currentOption.unitPrice;
  const estimatedTax = Math.round(baseSubtotal * 0.08); // 8% Tax
  const grandTotal = baseSubtotal + estimatedTax;

  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/labs')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#0052CC] bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lab Marketplace
        </button>

        <span className="text-xs font-semibold text-slate-400">
          Step 2 of 2: Procurement Confirmation
        </span>
      </div>

      {/* Main Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-[#0052CC]" />
          Procure Lab License & Checkout
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review lab specs, select enterprise license tiers, and confirm lab inventory addition.
        </p>
      </div>

      {/* Main Grid: Left Order Form & Right Receipt Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Selected Lab Overview Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-blue-50 text-[#0052CC] border border-blue-100 px-2.5 py-0.5 rounded-full">
                {labData.category}
              </span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-500" /> {labData.rating} Rating
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900">{labData.title}</h2>
            <p className="text-xs text-slate-600">{labData.shortDescription}</p>

            <div className="pt-2 flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {labData.durationHours} Hours Duration
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" /> {(labData.modules ?? []).length} Security Modules
              </span>
            </div>
          </div>

          {/* 4.2 Interactive License Tier Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center justify-between">
              <span>Select Enterprise License Model</span>
              <span className="text-xs text-[#0052CC] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Flexible Allocation
              </span>
            </h3>

            <div className="space-y-3">
              {licenseOptions.map((opt) => (
                <label
                  key={opt.type}
                  onClick={() => setSelectedLicense(opt.type)}
                  className={`block p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedLicense === opt.type
                      ? 'border-[#0052CC] bg-blue-50/50 ring-2 ring-[#0052CC]/15 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="licenseType"
                        checked={selectedLicense === opt.type}
                        onChange={() => setSelectedLicense(opt.type)}
                        className="mt-1 text-[#0052CC] focus:ring-[#0052CC]"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-base font-black text-slate-900">
                        ₹{opt.unitPrice.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        {opt.type === 'per_user_seats' ? 'per seat' : 'base cost'}
                      </span>
                    </div>
                  </div>

                  {/* Seat count slider if per_user_seats selected */}
                  {opt.type === 'per_user_seats' && selectedLicense === 'per_user_seats' && (
                    <div className="mt-4 pt-3 border-t border-blue-100 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Number of User Seats: <span className="text-[#0052CC] font-black">{userSeatsCount} Seats</span>
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="250"
                          step="5"
                          value={userSeatsCount}
                          onChange={(e) => setUserSeatsCount(Number(e.target.value))}
                          className="w-full accent-[#0052CC]"
                        />
                      </div>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* 4.3 Payment Method Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Payment Method
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'card'
                    ? 'border-[#0052CC] bg-blue-50 text-[#0052CC] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs block">Corporate Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('invoice')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'invoice'
                    ? 'border-[#0052CC] bg-blue-50 text-[#0052CC] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs block">PO / Invoice Billing</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credits')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  paymentMethod === 'credits'
                    ? 'border-[#0052CC] bg-blue-50 text-[#0052CC] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileText className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs block">Prepaid Credits</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Order Invoice & Checkout Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md sticky top-24 space-y-6">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Order Invoice Breakdown</span>
              <Lock className="w-4 h-4 text-emerald-600" />
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Selected Lab:</span>
                <span className="font-bold text-slate-800 text-right max-w-[180px] truncate">{labData.title}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>License Model:</span>
                <span className="font-bold text-slate-800">{currentOption.label}</span>
              </div>

              {selectedLicense === 'per_user_seats' && (
                <div className="flex justify-between text-slate-600">
                  <span>Assigned Seats:</span>
                  <span className="font-bold text-[#0052CC]">{userSeatsCount} Seats</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Subtotal Base Amount:</span>
                <span className="font-bold text-slate-900">₹{baseSubtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Estimated Taxes (8% GST/VAT):</span>
                <span className="font-bold text-slate-800">₹{estimatedTax.toLocaleString('en-IN')}</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-black text-slate-900">Total Purchase Amount:</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#0052CC]">₹{grandTotal.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400 block font-semibold">INR Currency</span>
                </div>
              </div>
            </div>

            {/* Procurement Policy Callout */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-[#28A745]" /> Instant License Activation
              </div>
              <p className="text-[11px] leading-tight">
                Labs are immediately added to your organizational inventory upon confirmation.
              </p>
            </div>

            {/* Submit CTA Button */}
            <button
              onClick={handleConfirmPurchase}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 bg-[#0052CC] hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Processing Procurement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirm & Procure Lab (₹{grandTotal.toLocaleString('en-IN')})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4.4 Checkout Success Modal Dialog */}
      {isSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-50 text-[#28A745] rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
              <ShieldCheck className="w-10 h-10 animate-shield" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">Procurement Successful!</h2>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-bold text-slate-700">{labData.title}</span> has been added to your enterprise lab inventory.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-left space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Receipt Ref:</span>
                <span className="font-bold text-slate-700">INV-2026-8842</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>License Type:</span>
                <span className="font-bold text-slate-700">{currentOption.label}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Amount Paid:</span>
                <span className="font-bold text-[#0052CC]">₹{grandTotal.toLocaleString('en-IN')} INR</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => navigate('/admin/labs')}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Return to Marketplace
              </button>
              <button
                onClick={() => navigate('/admin/allocations')}
                className="py-2.5 px-3 rounded-xl bg-[#28A745] hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Allocate to Group Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
