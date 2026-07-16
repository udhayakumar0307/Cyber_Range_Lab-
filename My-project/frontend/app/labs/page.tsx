'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Script from 'next/script'
import { Cloud, Brain, Boxes, Cpu, Search, Shield, Layers } from 'lucide-react'
import Header from '@/components/Header'
import { LabCatalogCard } from '@/components/labs/LabCatalogCard'
import { api, type PublicContentPage } from '@/lib/api'
import { labUrlId, toLab, type Lab } from '@/lib/labs'
import logger from '@/lib/logger'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const UPCOMING = [
  { icon: Cloud, title: 'Cloud Security', desc: 'AWS / Azure scenarios' },
  { icon: Brain, title: 'AI Model Security', desc: 'Adversarial testing' },
  { icon: Boxes, title: 'Blockchain Systems', desc: 'Smart contract vulnerabilities' },
  { icon: Cpu, title: 'IoT Security', desc: 'Device-level exploitation' },
]

function LabsPageContent() {
  const searchParams = useSearchParams()
  const buyParam = searchParams.get('buy')?.trim() || ''

  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cmsPage, setCmsPage] = useState<PublicContentPage | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [buyTriggerId, setBuyTriggerId] = useState<string | null>(null)
  
  // Interactive Search and Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.catalogLabs()
      setLabs(rows.map(toLab))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Failed to load lab catalog:', msg, err)
      setError('Could not load labs right now. Please refresh.')
      setLabs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    void loadCatalog()
    const loadCms = async () => {
      try {
        const page = await api.publicContentPageBySlug('labs')
        setCmsPage(page)
      } catch {
        setCmsPage(null)
      }
    }
    void loadCms()
  }, [loadCatalog])

  // Deep link: /labs?buy=slug — expand matching lab and trigger checkout once
  useEffect(() => {
    if (!buyParam || labs.length === 0) return
    const p = buyParam.toLowerCase()
    const match = labs.find(
      (l) =>
        labUrlId(l).toLowerCase() === p ||
        l.id.toLowerCase() === p ||
        l.id.toLowerCase().replace(/-/g, '') === p.replace(/-/g, ''),
    )
    if (match) {
      setExpandedId(match.id)
      setBuyTriggerId(match.id)
    }
  }, [buyParam, labs])

  const cmsByKey = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {}
    for (const s of cmsPage?.sections || []) map[s.section_key] = s.payload || {}
    return map
  }, [cmsPage])

  const labsTitle = String(cmsByKey.labs_hero?.headline || 'Cyber Range Sandbox Environments')
  const labsSubtitle = String(
    cmsByKey.labs_hero?.subheadline ||
      'Access real-world simulated subnets, directory networks, and cloud targets. Execute attacks and tune your security monitoring consoles in isolated sandboxes.',
  )

  const upcomingCards = useMemo(() => {
    const items = cmsByKey.upcoming_cards?.items
    if (!Array.isArray(items) || items.length === 0) return UPCOMING
    const iconMap = { cloud: Cloud, ai: Brain, blockchain: Boxes, iot: Cpu } as const
    return items.slice(0, 8).map((item: Record<string, unknown>, i: number) => {
      const iconKey = String(item?.icon || '').toLowerCase() as keyof typeof iconMap
      return {
        icon: iconMap[iconKey] || UPCOMING[i % UPCOMING.length].icon,
        title: String(item?.title || `Upcoming ${i + 1}`),
        desc: String(item?.desc || 'Coming soon'),
      }
    })
  }, [cmsByKey])

  // Computed filtered labs list
  const filteredLabs = useMemo(() => {
    return labs.filter((lab) => {
      const matchesSearch =
        lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lab.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lab.category || '').toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return false

      if (selectedCategory === 'All') return true
      if (selectedCategory === 'Active Directory') {
        return (
          (lab.category || '').toLowerCase().includes('directory') || 
          (lab.category || '').toLowerCase().includes('ad') || 
          lab.title.toLowerCase().includes('active directory')
        )
      }
      if (selectedCategory === 'Web Security') {
        return (
          (lab.category || '').toLowerCase().includes('web') ||
          (lab.category || '').toLowerCase().includes('api') ||
          (lab.category || '').toLowerCase().includes('bola') ||
          (lab.category || '').toLowerCase().includes('auth') ||
          (lab.category || '').toLowerCase().includes('smuggling') ||
          (lab.category || '').toLowerCase().includes('pastejacking') ||
          lab.title.toLowerCase().includes('crapi') ||
          lab.title.toLowerCase().includes('clickfix')
        )
      }
      return (lab.category || '').toLowerCase().includes(selectedCategory.toLowerCase())
    })
  }, [labs, searchQuery, selectedCategory])

  return (
    <div className="min-h-screen bg-[#07080B] text-slate-100 flex flex-col relative selection:bg-emerald-500/30 overflow-x-hidden">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {/* Grid Overlay for Cybernetic look */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293706_1px,transparent_1px),linear-gradient(to_bottom,#1f293706_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Decorative backdrop glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-emerald-500/[0.04] to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-blue-500/[0.03] blur-[150px] pointer-events-none" />

      <Header active="labs" />

      <div className="container mx-auto px-4 py-16 max-w-5xl relative z-10">
        {/* Page Hero Header */}
        <div className="mb-12 text-center md:text-left relative">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 font-mono text-xs text-emerald-400 font-bold mb-4 shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]">
            <Shield className="w-3.5 h-3.5" /> Cyber Range Catalog
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            {labsTitle}
          </h1>
          <p className="text-base md:text-lg text-slate-400 font-light max-w-3xl leading-relaxed">
            {labsSubtitle}
          </p>
        </div>

        {/* Search & Dynamic Filters panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white/[0.01] border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-xl">
          {/* Search bar input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search labs by title, category, target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-11 w-full rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {/* Filter Categories */}
          <div className="flex flex-wrap gap-2 items-center">
            {['All', 'Active Directory', 'Web Security'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "h-10 px-4 rounded-xl text-xs font-bold transition-all duration-200 border",
                  selectedCategory === cat
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5"
                    : "border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loader State */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-12 text-center text-sm text-slate-400 backdrop-blur-sm">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            Loading cyber range catalog…
          </div>
        )}

        {/* Error Alert State */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300 backdrop-blur-sm shadow-lg">
            <div className="font-semibold mb-1 flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Service Communication Interrupt
            </div>
            {error}
          </div>
        )}

        {/* Empty Catalog State */}
        {!loading && !error && filteredLabs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-12 text-center text-sm text-slate-400 backdrop-blur-sm">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <div className="font-semibold text-white mb-1">No matching labs found</div>
            Try adjusting your search keywords or category filters.
          </div>
        )}

        {/* Active Cards Grid */}
        {!loading && !error && filteredLabs.length > 0 && (
          <div className="space-y-6">
            {filteredLabs.map((lab) => (
              <LabCatalogCard
                key={lab.id}
                lab={lab}
                expanded={expandedId === lab.id}
                onToggleExpand={() =>
                  setExpandedId((cur) => (cur === lab.id ? null : lab.id))
                }
                triggerBuy={buyTriggerId === lab.id}
                onBuyTriggered={() => setBuyTriggerId(null)}
              />
            ))}
          </div>
        )}

        {/* Upcoming Labs locked grid */}
        <div className="mt-20 relative">
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          <div className="pt-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase">
                Under Development / Planned Environments
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {upcomingCards.map((item) => (
                <div
                  key={item.title}
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.01] p-5 text-center transition-all duration-300 hover:bg-white/[0.02] hover:border-white/10"
                >
                  <div className="absolute top-3 right-3 text-[9px] uppercase font-mono text-slate-600 font-bold bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-md">
                    Locked
                  </div>
                  
                  <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-all">
                    <item.icon className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-300 mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-normal">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LabsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07080B] flex items-center justify-center text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
            <div className="text-xs font-mono tracking-widest text-slate-500 uppercase">Synchronizing Catalog…</div>
          </div>
        </div>
      }
    >
      <LabsPageContent />
    </Suspense>
  )
}
