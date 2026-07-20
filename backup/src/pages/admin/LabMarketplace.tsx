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
  Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LabMarketplace: React.FC = () => {
  const navigate = useNavigate();
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
              setPurchasedLabIds(new Set(purchasedData.map((p: any) => p.lab_id)));
            }
          }
        }

        // Fetch labs catalog from PostgreSQL
        const labsRes = await fetch('/api/v1/labs');
        if (labsRes.ok) {
          const labsData = await labsRes.json();
          setLabs(Array.isArray(labsData) ? labsData : []);
        }
      } catch (err) {
        console.error('Error fetching marketplace data:', err);
      } finally {
        setLoadingLabs(false);
      }
    };
    fetchCartAndLabs();
  }, []);

  const syncLabRepository = async () => {
    const token = localStorage.getItem('token');
    setSyncing(true);
    try {
      const response = await fetch('/api/v1/admin/labs/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('sync failed');
      const labsResponse = await fetch('/api/v1/labs');
      if (labsResponse.ok) {
        const labsData = await labsResponse.json();
        setLabs(Array.isArray(labsData) ? labsData : []);
      }
    } catch (error) {
      console.error('Lab repository sync failed', error);
    } finally {
      setSyncing(false);
    }
  };

  const categories = ['All', ...Array.from(new Set((labs ?? []).map((l) => l.category ?? '')))];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredLabs = (labs ?? []).filter((lab) => {
    const matchesSearch =
      (lab.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lab.shortDescription ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lab.skillsCovered ?? []).some((s) => (s ?? '').toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDifficulty = selectedDifficulty === 'All' || lab.difficulty === selectedDifficulty;
    const matchesCategory = selectedCategory === 'All' || lab.category === selectedCategory;

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

  const handleAddToCart = async (lab: SecurityLab) => {
    const existingIndex = cartItems.findIndex((i) => i.lab_id === lab.id);
    let updated: CartItem[] = [];
    if (existingIndex >= 0) {
      updated = cartItems.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: (item.quantity ?? 0) + 1 } : item
      );
    } else {
      const newItem: CartItem = {
        id: Date.now(),
        lab_id: lab.id,
        lab_title: lab.title ?? '',
        price_inr: lab.priceInr ?? 0,
        quantity: 1,
        license_duration_months: 12
      };
      updated = [...cartItems, newItem];
    }
    setCartItems(updated);
    setIsCartOpen(true);

    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/v1/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            lab_id: lab.id,
            lab_title: lab.title ?? '',
            price_inr: lab.priceInr ?? 0,
            quantity: 1,
            license_duration_months: 12
          })
        });
      } catch (err) {
        console.error('Error syncing cart with API:', err);
      }
    }
  };

  const handleUpdateQuantity = (id: number | string, qty: number) => {
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item)));
  };

  const handleUpdateDuration = (id: number | string, months: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, license_duration_months: months } : item))
    );
  };

  const handleRemoveCartItem = (id: number | string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[#0052CC] dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Enterprise Lab Marketplace</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse, purchase, and deploy enterprise-grade hands-on cybersecurity training labs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={syncLabRepository}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
          >
            {syncing ? 'Syncing…' : 'Sync Lab Repository'}
          </button>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[#0052CC] dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold text-xs px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Cart</span>
            {cartItems.length > 0 && (
              <span className="bg-[#0052CC] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labs by title, skill, or keyword..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/20 focus:border-[#0052CC]"
            />
          </div>

          <div className="md:col-span-7 flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Difficulty:</span>
            {['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-3 py-1.5 rounded-lg border transition-all ${
                  selectedDifficulty === diff
                    ? 'bg-[#0052CC] text-white border-[#0052CC]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1">Category:</span>
            {['All', 'Web Security', 'Cloud Security', 'SOC & Forensics', 'Reverse Engineering'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  selectedCategory === cat
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0052CC] dark:text-blue-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sort Catalog By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="popularity">Highest Rating & Popularity</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="difficulty">Difficulty Level</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
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
            const isPurchased = lab.isPurchased || purchasedLabIds.has(lab.id);
            const isInCart = cartItems.some((i) => i.lab_id === lab.id);

            const difficultyBadgeColors: Record<string, string> = {
              Beginner: 'bg-emerald-50 dark:bg-emerald-950/40 text-[#28A745] dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
              Intermediate: 'bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 border-blue-200 dark:border-blue-800',
              Advanced: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
              Expert: 'bg-purple-50 dark:bg-purple-950/40 text-[#6F42C1] dark:text-purple-400 border-purple-200 dark:border-purple-800',
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
                      {lab.durationHours} Hours
                    </span>
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {lab.rating} ({lab.reviewCount})
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {(lab.modules ?? []).length} Modules
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
                    {(lab.skillsCovered ?? []).length > 2 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold px-1">
                        +{(lab.skillsCovered ?? []).length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">
                      Price / Seat
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">₹{(lab.priceInr ?? 0).toLocaleString('en-IN')}</span>
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
                        onClick={() => navigate(lab.id === 'lab1-recon' ? '/labs/lab1-recon/session' : '/labs/command-line-lab/session')}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Launch Lab
                      </button>
                    ) : (
                      <button
                        disabled={isInCart}
                        onClick={() => handleAddToCart(lab)}
                        className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs ${
                          isInCart
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-[#0052CC] hover:bg-blue-700 text-white'
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

      <LabDetailModal
        lab={selectedModalLab}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateDuration={handleUpdateDuration}
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
