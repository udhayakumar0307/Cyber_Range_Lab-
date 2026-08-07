import React, { useState, useEffect } from 'react';
import type { SecurityLab } from '../../types/admin';
import type { CartItem } from '../../types/cart';
import { LabDetailModal } from '../../components/admin/LabDetailModal';
import { CartDrawer } from '../../components/admin/CartDrawer';
import { CheckoutModal } from '../../components/admin/CheckoutModal';
import { 
  Store, 
  Search, 
  Clock, 
  Star, 
  ShoppingCart, 
  Layers, 
  Play,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PurchasedLabsPage } from './PurchasedLabsPage';
import { PaymentHistoryPage } from './PaymentHistoryPage';

export const LabMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const [activeMarketTab, setActiveMarketTab] = useState<'browse' | 'purchased' | 'history'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'popularity' | 'price-asc' | 'price-desc' | 'difficulty'>('popularity');

  const [selectedModalLab, setSelectedModalLab] = useState<SecurityLab | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cart & Checkout State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutSummary, setCheckoutSummary] = useState<any>(null);
  const [purchasedLabIds, setPurchasedLabIds] = useState<Set<string>>(new Set());

  // Real catalog labs from backend PostgreSQL database
  const [labs, setLabs] = useState<SecurityLab[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Fetch Cart & Labs from Backend API
  useEffect(() => {
    const fetchCartAndLabs = async () => {
      const token = localStorage.getItem('token');
      try {
        // Fetch cart
        if (token) {
          const cartRes = await fetch('/api/v1/cart', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (cartRes.ok) {
            const data = await cartRes.json();
            setCartItems(Array.isArray(data?.items) ? data.items : []);
          }

          // Fetch purchased labs
          const purchasedRes = await fetch('/api/v1/admin/purchased-labs', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (purchasedRes.ok) {
            const purchasedData = await purchasedRes.json();
            if (Array.isArray(purchasedData)) {
              setPurchasedLabIds(new Set(purchasedData.map((item: any) => item.lab_id)));
            }
          }
        }

        // Fetch lab catalog
        const labsRes = await fetch('/api/v1/labs');
        if (labsRes.ok) {
          const labsData = await labsRes.json();
          setLabs(labsData || []);
        }
      } catch (err) {
        console.error('Error fetching cart/labs:', err);
      } finally {
        setLoadingLabs(false);
      }
    };

    fetchCartAndLabs();
  }, []);

  const syncLabRepository = async () => {
    setSyncing(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/labs/scan', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const labsRes = await fetch('/api/v1/labs');
        if (labsRes.ok) {
          const labsData = await labsRes.json();
          setLabs(labsData || []);
        }
      }
    } catch (err) {
      console.error('Error syncing lab repository:', err);
    } finally {
      setSyncing(false);
    }
  };

  const categories = ['All', ...Array.from(new Set((labs ?? []).map((l) => l.category ?? '')))];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredLabs = (labs ?? []).filter((lab) => {
    const matchesSearch =
      (lab.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lab.category ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lab.shortDescription ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lab.skillsCovered ?? []).some((s) => (s ?? '').toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDifficulty = selectedDifficulty === 'All' || lab.difficulty === selectedDifficulty;
    
    let matchesCategory = selectedCategory === 'All';
    if (!matchesCategory) {
      const catLower = (selectedCategory ?? '').toLowerCase();
      const labCatLower = (lab.category ?? '').toLowerCase();
      const labIdLower = (lab.id ?? '').toLowerCase();

      if (catLower === 'command line') {
        matchesCategory = labIdLower.includes('command-line') || labIdLower.includes('cmd') || labCatLower.includes('command');
      } else {
        matchesCategory = labCatLower.includes(catLower) || labIdLower.includes(catLower);
      }
    }

    return matchesSearch && matchesDifficulty && matchesCategory;
  });

  const sortedLabs = [...filteredLabs].sort((a, b) => {
    if (sortBy === 'price-asc') return (a.priceInr ?? 0) - (b.priceInr ?? 0);
    if (sortBy === 'price-desc') return (b.priceInr ?? 0) - (a.priceInr ?? 0);
    if (sortBy === 'difficulty') {
      const order: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };
      return (order[a.difficulty ?? ''] ?? 0) - (order[b.difficulty ?? ''] ?? 0);
    }
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  const handleOpenDetailModal = (lab: SecurityLab) => {
    setSelectedModalLab(lab);
    setIsModalOpen(true);
  };

  const getHourlyRate = (lab: SecurityLab) => {
    if (lab.priceInr !== undefined && lab.priceInr !== null && lab.priceInr > 0) {
      return lab.priceInr;
    }
    const d = (lab.difficulty ?? '').toLowerCase();
    if (d.includes('advanced') || d.includes('expert')) return 300;
    if (d.includes('intermediate')) return 200;
    return 100; // Beginner default
  };

  const handleAddToCart = async (lab: SecurityLab) => {
    const existingIndex = cartItems.findIndex((i) => i.lab_id === lab.id);
    if (existingIndex >= 0) {
      // Already in cart - just open it
      setIsCartOpen(true);
      return;
    }
    const hourlyRate = getHourlyRate(lab);
    const DEFAULT_HOURS = 1;
    const newItem: CartItem = {
      id: Date.now(),
      lab_id: lab.id,
      lab_title: lab.title ?? '',
      price_inr: hourlyRate,
      hours_purchased: DEFAULT_HOURS,
      item_total: hourlyRate * DEFAULT_HOURS,
    };
    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch('/api/v1/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            lab_id: lab.id,
            lab_title: lab.title ?? '',
            hours_purchased: DEFAULT_HOURS
          })
        });
        if (res.ok) {
          // Refresh cart from server to get server-computed price
          const cartRes = await fetch('/api/v1/cart', { headers: { Authorization: `Bearer ${token}` } });
          if (cartRes.ok) {
            const data = await cartRes.json();
            setCartItems(Array.isArray(data?.items) ? data.items : []);
          }
        }
      } catch (err) {
        console.error('Error syncing cart with API:', err);
      }
    }
  };

  const handleUpdateHours = async (id: number | string, hours: number) => {
    setCartItems((prev) => prev.map((item) => {
      if (item.id === id) {
        const rate = item.price_inr ?? 0;
        return { ...item, hours_purchased: hours, item_total: rate * hours };
      }
      return item;
    }));
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`/api/v1/cart/items/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ hours_purchased: hours })
        });
        // Refresh from server for recomputed totals
        const cartRes = await fetch('/api/v1/cart', { headers: { Authorization: `Bearer ${token}` } });
        if (cartRes.ok) {
          const data = await cartRes.json();
          setCartItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (err) {
        console.error('Error updating cart hours:', err);
      }
    }
  };

  const handleRemoveCartItem = async (id: number | string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`/api/v1/cart/items/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) { /* ignore */ }
    }
  };

  const handleClearCart = async () => {
    setCartItems([]);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/v1/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } catch (err) { /* ignore */ }
    }
  };

  const handleProceedToCheckout = (summary: any) => {
    setCheckoutSummary(summary);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handlePaymentSuccess = (resultData: any) => {
    if (cartItems.length > 0) {
      const newPurchased = new Set(purchasedLabIds);
      (cartItems ?? []).forEach((item) => newPurchased.add(item.lab_id));
      setPurchasedLabIds(newPurchased);
    }
    setCartItems([]);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP TOOLBAR: Search (~42%) | Category | Difficulty | Cart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search bar (~42%) */}
          <div className="relative w-full md:w-[42%]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Lab..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-[22%]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="Linux">Linux</option>
              <option value="Recon">Recon</option>
              <option value="Cloud">Cloud</option>
              <option value="Puzzle">Puzzle</option>
              <option value="OT">OT</option>
              <option value="Command Line">Command Line</option>
            </select>
          </div>

          {/* Difficulty Dropdown */}
          <div className="w-full md:w-[22%]">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="All">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          {/* Cart Button */}
          <div className="w-full md:w-[14%] flex justify-end">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full relative bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
              {cartItems.length > 0 && (
                <span className="bg-white text-[#0052CC] text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. TABS NAVIGATION BELOW TOOLBAR */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md">
        <button
          onClick={() => setActiveMarketTab('browse')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMarketTab === 'browse'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Browse Labs
        </button>
        <button
          onClick={() => setActiveMarketTab('purchased')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMarketTab === 'purchased'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Purchased Labs ({purchasedLabIds.size})
        </button>
        <button
          onClick={() => setActiveMarketTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMarketTab === 'history'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Purchase History
        </button>
      </div>

      {/* Tab 1: Browse Catalog */}
      {activeMarketTab === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedLabs.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <Store className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No Security Labs Found</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or clearing selected difficulty and category filters.
              </p>
            </div>
          ) : (
            sortedLabs.map((lab) => {
              const isPuzzle = lab.id.toLowerCase().includes('puzzle') || (lab.category ?? '').toLowerCase().includes('puzzle');
              const isCommandLine = lab.id.toLowerCase().includes('command-line') || lab.id.toLowerCase().includes('cmd');
              // isFree: use backend isFree field (reflects sysadmin fixed_rate == 0), or puzzle labs
              const isFree = lab.isFree === true || isPuzzle || (lab.priceInr ?? 0) === 0;
              // isPurchased: only true for FREE labs (price=0). Priced labs always show Add to Cart so admins can buy more hours.
              const isPurchased = isFree ? (lab.isPurchased ?? false) : false;
              const isInCart = cartItems.some((i) => i.lab_id === lab.id);

              const durationText = isPuzzle ? 'Unlimited' : isCommandLine ? '6 Hours' : '1.5 Hours';

              const difficultyBadgeColors: Record<string, string> = {
                Beginner: 'bg-emerald-50 dark:bg-emerald-950/40 text-[#28A745] dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                Intermediate: 'bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 border-blue-200 dark:border-blue-800',
                Advanced: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
              };

              return (
                <div
                  key={lab.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full truncate max-w-[180px]">
                        {lab.category}
                      </span>
                      <span
                        className={`text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${
                          difficultyBadgeColors[lab.difficulty ?? ''] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {lab.difficulty}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-[#0052CC] transition-colors line-clamp-1">
                      {lab.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {lab.shortDescription}
                    </p>
                  </div>

                  <div className="p-5 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {durationText}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {(lab.modules ?? []).length || 5} Modules
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(lab.skillsCovered ?? []).slice(0, 2).map((skill, idx) => (
                        <span
                          key={idx}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">
                        Price / Hour
                      </span>
                      {isPurchased ? (
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">INCLUDED</span>
                      ) : isFree ? (
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">FREE</span>
                      ) : (
                        <span className="text-lg font-black text-slate-900 dark:text-white">₹{getHourlyRate(lab).toLocaleString('en-IN')}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenDetailModal(lab)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                      >
                        View Details
                      </button>

                      {isPurchased ? (
                        <button
                          disabled
                          className="px-3 py-2 rounded-lg bg-emerald-50 text-[#28A745] border border-emerald-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Assigned</span>
                        </button>
                      ) : isPuzzle ? (
                        <button
                          onClick={() => {
                            // Auto purchase puzzle lab if needed then navigate
                            navigate('/labs/puzzle-lab');
                          }}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Start Puzzle
                        </button>
                      ) : (
                        <button
                          disabled={isInCart}
                          onClick={() => handleAddToCart(lab)}
                          className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs ${
                            isInCart
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-[#0052CC] hover:bg-blue-700 text-white cursor-pointer'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isInCart ? 'In Cart' : 'Add to Cart'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Purchased Labs */}
      {activeMarketTab === 'purchased' && (
        <PurchasedLabsPage />
      )}

      {/* Tab 3: Purchase History */}
      {activeMarketTab === 'history' && (
        <PaymentHistoryPage />
      )}

      <LabDetailModal
        lab={selectedModalLab}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateHours={handleUpdateHours}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartSummary={checkoutSummary}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
