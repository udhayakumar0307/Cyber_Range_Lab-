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

  const cmsByKey = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const sec of cmsPage?.sections || []) {
      if (sec.section_key && sec.payload) {
        map.set(sec.section_key, sec.payload as Record<string, unknown>)
      }
    }
    return map
  }, [cmsPage])

  const labsTitle = String(cmsByKey.get('hero')?.headline || 'Cyber Range Sandbox Environments')
  const labsSubtitle = String(
    cmsByKey.get('hero')?.subheadline ||
      'Access real-world simulated subnets, directory networks, and cloud targets. Execute attacks and tune your security monitoring consoles in isolated sandboxes.'
  )

  const upcomingDisplay = useMemo(() => {
    const media = cmsByKey.get('upcoming')
    const items = Array.isArray(media?.items) ? media.items : null
    if (!items || items.length === 0) return UPCOMING

    const iconMap: Record<string, typeof Cloud> = {
      cloud: Cloud,
      brain: Brain,
      boxes: Boxes,
      cpu: Cpu,
    }

    return items.map((item: Record<string, unknown>, i: number) => {
      const iconKey = String(item?.icon || '').toLowerCase()
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

  useEffect(() => {
    if (!buyParam || labs.length === 0) return
    const match = labs.find((l) => labUrlId(l) === buyParam || l.id === buyParam)
    if (match) {
      setExpandedId(match.id)
      setBuyTriggerId(match.id)
    }
  }, [buyParam, labs])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-primary/20 overflow-x-hidden transition-colors duration-300">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {/* Decorative backdrop glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-primary/5 to-transparent blur-[120px] pointer-events-none" />

      <Header active="labs" />

      <div className="container mx-auto px-4 py-16 max-w-5xl relative z-10">
        {/* Page Hero Header */}
        <div className="mb-12 text-center md:text-left relative">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 font-mono text-xs text-primary font-bold mb-4">
            <Shield className="w-3.5 h-3.5" /> Cyber Range Catalog
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight leading-tight">
            {labsTitle}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground font-light max-w-3xl leading-relaxed">
            {labsSubtitle}
          </p>
        </div>

        {/* Search & Dynamic Filters panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-card border border-border rounded-2xl p-4 backdrop-blur-md shadow-xs">
          {/* Search bar input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search labs by title, category, target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-11 w-full rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {['All', 'Active Directory', 'Web Security'].map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                      : "bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted"
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Labs List / Catalog Cards */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 border border-border rounded-2xl bg-card">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground font-mono animate-pulse">Initializing Cyber Range Scenarios...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive text-sm text-center">
            {error}
          </div>
        ) : filteredLabs.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card">
            <Layers className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground mb-1">No matching labs found</h3>
            <p className="text-xs text-muted-foreground">Try adjusting your search keywords or category filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLabs.map((lab) => (
              <LabCatalogCard
                key={lab.id}
                lab={lab}
                expanded={expandedId === lab.id}
                onToggleExpand={() => setExpandedId((prev) => (prev === lab.id ? null : lab.id))}
                triggerBuy={buyTriggerId === lab.id}
                onBuyTriggered={() => setBuyTriggerId(null)}
              />
            ))}
          </div>
        )}

        {/* Upcoming Under-Development Scenarios */}
        <div className="mt-20 pt-12 border-t border-border">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <h2 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
              Under Development / Planned Environments
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {upcomingDisplay.map((item) => (
              <div
                key={item.title}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all text-center relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                <span className="inline-block mt-3 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                  Locked
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LabsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center text-xs font-mono text-muted-foreground">
        Loading Range Scenarios...
      </div>
    }>
      <LabsPageContent />
    </Suspense>
  )
}
