import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context';
import { CartDrawer } from '../../components/admin/CartDrawer';
import { LabDetailModal } from '../../components/admin/LabDetailModal';
import type { CartItem } from '../../types/cart';
import {
  Search,
  Clock,
  Layers,
  ShoppingCart,
  HelpCircle,
  ArrowRight,
  Check,
  Play,
  X,
  Star,
} from 'lucide-react';

interface Lab {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  description: string;
  difficulty: string;
  durationHours: number;
  tags: string[];
  priceInr: number;
  isFree: boolean;
  isPurchased: boolean;
  totalChallenges: number;
  modules: any[];
  rating?: number;
  reviewCount?: number;
  isCompleted?: boolean;
  certificateId?: string;
  certificatePdfUrl?: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  intermediate: 'bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border-blue-200 dark:border-blue-800',
  advanced: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  expert: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

export const AvailableLabs: React.FC = () => {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state — mirrors admin LabMarketplace
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  // Detail Modal State
  const [selectedModalLab, setSelectedModalLab] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'purchased'>('all');
  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  /* ─── Fetch Labs from Backend ─────────────────────────────── */
  const fetchLabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/labs');
      if (!res.ok) throw new Error();
      const items: any[] = await res.json();
      const normalized: Lab[] = (Array.isArray(items) ? items : []).map((item) => {
        const isCommandLine = (item?.id || '').toLowerCase().includes('command-line');
        const catRaw = String(item?.category ?? 'linux').toLowerCase();
        const fixed = item?.priceInr ?? item?.price_inr ?? 0;
        return {
          id: item?.id ?? '',
          title: item?.title ?? item?.name ?? '',
          category: catRaw,
          categoryLabel: item?.category ?? catRaw,
          description: item?.shortDescription ?? item?.description ?? '',
          difficulty: String(item?.difficulty ?? 'beginner').toLowerCase(),
          durationHours: isCommandLine ? 6 : (item?.durationHours ?? 1.5),
          tags: Array.isArray(item?.skillsCovered) ? item.skillsCovered : [catRaw],
          priceInr: fixed,
          isFree: item?.isFree !== undefined ? item.isFree : fixed === 0,
          isPurchased: item?.isPurchased ?? false,
          totalChallenges: item?.totalChallenges ?? (Array.isArray(item?.modules) ? item.modules.length : 5),
          modules: Array.isArray(item?.modules) ? item.modules : [],
          rating: item?.rating ?? 4.9,
          reviewCount: item?.reviewCount ?? 120,
          isCompleted: item?.isCompleted ?? false,
          certificateId: item?.certificateId ?? '',
          certificatePdfUrl: item?.certificatePdfUrl ?? '',
        };
      });
      // Filter out internal labs
      setLabs(normalized.filter(l =>
        !l.id.toLowerCase().includes('puzzle') &&
        !l.id.toLowerCase().includes('techcorp')
      ));
    } catch {
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  /* ─── Fetch Cart from Backend ─────────────────────────────── */
  const fetchCart = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch { /* ignore */ }
  }, [apiFetch]);

  /* ─── Fetch Purchased/Rented Labs ─────────────────────────── */
  const fetchRentals = useCallback(async () => {
    setRentalsLoading(true);
    try {
      const res = await apiFetch('/api/v1/user/rentals');
      if (res.ok) setRentals(await res.json());
    } catch { /* ignore */ }
    finally { setRentalsLoading(false); }
  }, [apiFetch]);

  useEffect(() => { fetchLabs(); fetchCart(); }, [fetchLabs, fetchCart]);
  useEffect(() => { if (activeTab === 'purchased') fetchRentals(); }, [activeTab, fetchRentals]);

  // Sync search with URL
  useEffect(() => { setSearchTerm(urlSearch); }, [urlSearch]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim()) setSearchParams({ search: val });
    else {
      const p = new URLSearchParams(searchParams);
      p.delete('search'); p.delete('q');
      setSearchParams(p);
    }
  };

  /* ─── Cart Operations (mirror admin LabMarketplace) ──────── */
  const handleAddToCart = async (lab: Lab) => {
    if (cartItems.some(i => i.lab_id === lab.id)) { setIsCartOpen(true); return; }
    setAddingToCart(lab.id);
    // Optimistic update
    const optimistic: CartItem = {
      id: Date.now(),
      lab_id: lab.id,
      lab_title: lab.title,
      price_inr: lab.priceInr,
      hours_purchased: 1,
      item_total: lab.priceInr,
    };
    setCartItems(prev => [...prev, optimistic]);
    setIsCartOpen(true);
    try {
      const res = await apiFetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: lab.id, lab_title: lab.title, hours_purchased: 1 })
      });
      if (res.ok || res.status === 409) {
        // Refresh from server to get server-computed price
        await fetchCart();
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch { /* ignore */ }
    finally { setAddingToCart(null); }
  };

  const handleUpdateHours = async (id: number | string, hours: number) => {
    setCartItems(prev => prev.map(item =>
      item.id === id ? { ...item, hours_purchased: hours, item_total: (item.price_inr ?? 0) * hours } : item
    ));
    try {
      await apiFetch(`/api/v1/cart/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours_purchased: hours })
      });
      await fetchCart(); // Refresh for correct server-side total
    } catch { /* ignore */ }
  };

  const handleRemoveCartItem = async (id: number | string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    try {
      await apiFetch(`/api/v1/cart/items/${id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('cart-updated'));
    } catch { /* ignore */ }
  };

  const handleClearCart = async () => {
    setCartItems([]);
    try {
      await apiFetch('/api/v1/cart', { method: 'DELETE' });
      window.dispatchEvent(new Event('cart-updated'));
    } catch { /* ignore */ }
  };

  const handleProceedToCheckout = async (_summary: any) => {
    // Navigate to cart page for student Razorpay flow
    setIsCartOpen(false);
    navigate('/cart');
  };

  /* ─── Navigate to lab session ─────────────────────────────── */
  const launchLab = (lab: Lab) => {
    const id = lab.id.toLowerCase().replace(/[\s_-]+/g, '-');
    if (id === 'command-line-lab') navigate('/labs/command-line-lab/session/sess-cll-01');
    else if (id === 'cryptography-lab') navigate('/labs/cryptography-lab/session/sess-crypto-01');
    else if (id === 'cloud-security-lab') navigate('/labs/cloud-security-lab/session/sess-cloud-01');
    else navigate(`/labs/${lab.id}/session/sess-123`);
  };

  /* ─── Filtered labs ───────────────────────────────────────── */
  const filteredLabs = labs.filter(lab => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q
      || lab.title.toLowerCase().includes(q)
      || lab.description.toLowerCase().includes(q)
      || lab.category.toLowerCase().includes(q)
      || lab.tags.some(t => t.toLowerCase().includes(q));
    const matchesCat = selectedCategory === 'all' || lab.category.includes(selectedCategory);
    const matchesDiff = selectedDifficulty === 'all' || lab.difficulty === selectedDifficulty;
    return matchesSearch && matchesCat && matchesDiff;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Available Labs</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explore and enroll in hands-on cybersecurity laboratories.
          </p>
        </div>
        <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900 self-start sm:self-center">
          {filteredLabs.length} {filteredLabs.length === 1 ? 'Lab' : 'Labs'} Available
        </span>
      </div>

      {/* ── Search + Filter toolbar (same layout as admin) ──── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-[42%]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search Lab..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
            />
            {searchTerm && (
              <button onClick={() => handleSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category */}
          <div className="w-full md:w-[22%]">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="linux">Linux Infrastructure</option>
              <option value="cloud">Cloud Security</option>
              <option value="crypto">Cryptography</option>
              <option value="ot">OT & Industrial Security</option>
              <option value="recon">Network Recon</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="w-full md:w-[22%]">
            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          {/* Cart Button */}
          <div className="w-full md:w-[14%] flex justify-end">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full relative bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
              {cartItems.length > 0 && (
                <span className="bg-white text-[#2563EB] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xs">
        {(['all', 'purchased'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab === 'all' ? 'All Labs' : 'My Purchased Labs'}
          </button>
        ))}
      </div>

      {/* ── Tab: All Labs ────────────────────────────────────── */}
      {activeTab === 'all' && (
        loading ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 font-semibold">Loading labs...</div>
        ) : filteredLabs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-12 px-6 text-center shadow-xs">
            <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No training labs match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLabs.map(lab => {
              const isFree = lab.isFree || lab.priceInr === 0;
              const isInCart = cartItems.some(i => i.lab_id === lab.id);
              const isCommandLine = lab.id.toLowerCase().includes('command-line');
              const durationText = isCommandLine ? '6 Hours' : `${lab.durationHours} Hours`;
              const moduleCount = lab.modules.length || lab.totalChallenges || 5;

              return (
                <div
                  key={lab.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card top */}
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full truncate max-w-[180px] uppercase tracking-wide">
                        {lab.categoryLabel}
                      </span>
                      <span className={`text-[11px] font-bold border px-2.5 py-0.5 rounded-full capitalize ${DIFFICULTY_COLORS[lab.difficulty] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {lab.difficulty}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-[#2563EB] transition-colors line-clamp-1">
                      {lab.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {lab.description}
                    </p>
                  </div>

                  {/* Card middle */}
                  <div className="p-5 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {durationText}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {lab.rating || 4.9}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {moduleCount} Modules
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {lab.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card footer — identical structure to admin */}
                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">
                        Price / Hour
                      </span>
                      {isFree ? (
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">FREE</span>
                      ) : (
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          ₹{lab.priceInr.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Launch Lab or Completed/Certificate button */}
                      {lab.isCompleted ? (
                        <>
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Completed
                          </span>
                          <button
                            onClick={() => { setSelectedModalLab(lab); setIsModalOpen(true); }}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                          >
                            View Details
                          </button>
                        </>
                      ) : isFree && lab.isPurchased ? (
                        <button
                          onClick={() => launchLab(lab)}
                          className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Launch Lab
                        </button>
                      ) : isFree ? (
                        <button
                          onClick={() => launchLab(lab)}
                          className="px-3 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Launch Lab
                        </button>
                      ) : lab.isPurchased ? (
                        <>
                          <button
                            disabled
                            className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Purchased
                          </button>
                          <button
                            onClick={() => launchLab(lab)}
                            className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Launch
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setSelectedModalLab(lab); setIsModalOpen(true); }}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            disabled={isInCart || addingToCart === lab.id}
                            onClick={() => handleAddToCart(lab)}
                            className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs ${
                              isInCart
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 cursor-not-allowed'
                                : 'bg-[#2563EB] hover:bg-blue-600 text-white cursor-pointer'
                            }`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>{isInCart ? 'In Cart' : addingToCart === lab.id ? 'Adding...' : 'Add to Cart'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Tab: My Purchased Labs ───────────────────────────── */}
      {activeTab === 'purchased' && (
        <div className="space-y-6">
          {rentalsLoading ? (
            <div className="py-12 text-center text-slate-500 font-semibold">Loading purchased labs...</div>
          ) : rentals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">No Purchased Labs</h3>
                <p className="text-xs text-slate-500 mt-1">Buy practical labs from the "All Labs" tab to begin training.</p>
              </div>
              <button
                onClick={() => setActiveTab('all')}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Browse Labs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentals.map(lab => {
                const hasHours = (lab.hours_remaining ?? 0) > 0;
                return (
                  <div key={lab.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${hasHours ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' : 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900'}`}>
                        {hasHours ? 'Active' : 'Expired'}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{lab.lab_title}</h3>
                    <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
                      <div className="flex justify-between">
                        <span>Hours Remaining</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{lab.hours_remaining ?? 0}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">₹{(lab.fixed_rate ?? 0).toLocaleString('en-IN')}/hr</span>
                      </div>
                    </div>
                    {hasHours && (
                      <button
                        onClick={() => navigate(`/labs/${lab.lab_id}/session/sess-123`)}
                        className="w-full bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs py-2 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Launch Lab
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Cart Drawer (same as admin) ──────────────────────── */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateHours={handleUpdateHours}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <LabDetailModal
        lab={selectedModalLab}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
