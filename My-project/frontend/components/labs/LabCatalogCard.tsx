"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Shield,
  Layers,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { labUrlId, type Lab } from "@/lib/labs"
import { useLabCheckout } from "@/lib/use-lab-checkout"

type LabCatalogCardProps = {
  lab: Lab
  expanded: boolean
  onToggleExpand: () => void
  triggerBuy?: boolean
  onBuyTriggered?: () => void
}

export function LabCatalogCard({
  lab,
  expanded,
  onToggleExpand,
  triggerBuy,
  onBuyTriggered,
}: LabCatalogCardProps) {
  const { user, isLabPurchased, isLabEntitled } = useAuth()
  const [agreed, setAgreed] = useState(false)
  const purchased = isLabPurchased(lab.id)
  const entitled = isLabEntitled(lab.id)
  const urlId = labUrlId(lab)

  const buyOnceRef = useRef(false)
  const { buyLab, busy, errorMessage, clearError } = useLabCheckout({
    lab,
    userEmail: user?.email,
  })

  const priceLabel =
    lab.priceMajor != null ? `₹${lab.priceMajor.toLocaleString()}` : null
  const catalogThumb =
    lab.image && lab.image !== "/placeholder.svg" ? lab.image : null

  useEffect(() => {
    if (!triggerBuy || buyOnceRef.current) return
    if (!expanded || !user || !lab.isPurchasable || entitled) return
    buyOnceRef.current = true
    setAgreed(true)
    void buyLab().finally(() => onBuyTriggered?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link
  }, [triggerBuy, expanded, user, lab.isPurchasable, entitled])

  // Custom difficulty class logic
  const diffLower = (lab.difficulty || "").toLowerCase()
  const diffClass = diffLower.includes("easy")
    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    : diffLower.includes("hard")
    ? "bg-red-500/10 text-red-400 border border-red-500/20"
    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"

  return (
    <article className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5">
      <div className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="flex gap-5 flex-1 min-w-0">
            {/* Thumbnail */}
            <div className="shrink-0">
              {catalogThumb ? (
                <div className="relative w-[104px] h-[66px] sm:w-[120px] sm:h-[72px] rounded-xl overflow-hidden border border-white/10 bg-black/40 group-hover:border-emerald-500/20 transition-all duration-300">
                  <Image
                    src={catalogThumb}
                    alt=""
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    sizes="120px"
                  />
                </div>
              ) : (
                <div className="relative w-[104px] h-[66px] sm:w-[120px] sm:h-[72px] rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-blue-500/10 flex items-center justify-center group-hover:border-emerald-500/20 transition-all duration-300">
                  <Shield className="w-5 h-5 text-emerald-400/50 group-hover:text-emerald-400/70 transition-colors" />
                </div>
              )}
            </div>

            {/* Info details */}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg md:text-xl font-bold text-white mb-1.5 group-hover:text-emerald-400 transition-colors duration-200">{lab.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">
                {lab.description || "Hands-on cybersecurity lab environment."}
              </p>
              
              {/* Badges metadata info */}
              <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${diffClass}`}>
                  <BarChart2 className="w-3.5 h-3.5" />
                  {lab.difficulty}
                </span>
                
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/5 bg-white/5 text-slate-300 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {lab.durationLabel}
                </span>
                
                {lab.category && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-500/10 bg-blue-500/5 text-blue-400 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-blue-400/80" />
                    {lab.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action right sidebar block */}
          <div className="flex md:flex-col md:items-end items-center justify-between md:justify-start gap-4 md:min-w-[140px] shrink-0 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
            {priceLabel ? (
              <div className="text-2xl font-extrabold text-white tracking-tight whitespace-nowrap">
                {priceLabel}
              </div>
            ) : (
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-md">
                Coming soon
              </span>
            )}
            
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl h-10 px-4 transition-all duration-200"
              onClick={onToggleExpand}
            >
              {expanded ? (
                <>
                  Show less
                  <ChevronUp className="ml-1.5 h-4 w-4" />
                </>
              ) : (
                <>
                  Show more
                  <ChevronDown className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Collapsible content section */}
        {expanded && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {lab.description && (
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> About this lab
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {lab.description}
                </p>
              </div>
            )}

            {lab.featureChips.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 px-1">
                  Environment includes
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {lab.featureChips.map((chip) => (
                    <li
                      key={chip}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-xs text-slate-300 hover:border-emerald-500/20 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bottom Checkout Action Panel */}
            <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
              {purchased || entitled ? (
                <Button
                  className="w-fit bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold px-6 py-5 rounded-xl shadow-lg shadow-emerald-500/10 border border-emerald-400/20 transition-all hover:scale-[1.02]"
                  asChild
                >
                  <Link href={`/quiz/${urlId}`}>Access lab</Link>
                </Button>
              ) : lab.isPurchasable ? (
                <>
                  {!user ? (
                    <Button
                      className="w-fit bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold px-6 py-5 rounded-xl shadow-lg shadow-emerald-500/10 border border-emerald-400/20 transition-all hover:scale-[1.02]"
                      asChild
                    >
                      <Link href={`/login?return=${encodeURIComponent("/labs")}`}>
                        Sign in to buy
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer max-w-lg select-none bg-white/[0.01] border border-white/5 rounded-xl p-3 hover:bg-white/[0.02] transition-colors">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 rounded border-white/20 text-emerald-500 focus:ring-emerald-500/30 bg-transparent"
                        />
                        <span>
                          I agree to the{" "}
                          <Link href="/terms" className="text-emerald-400 hover:underline">
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" className="text-emerald-400 hover:underline">
                            Privacy Policy
                          </Link>
                          . 30-day full access. Includes dedicated target range sandbox instances.
                        </span>
                      </label>
                      
                      <Button
                        type="button"
                        disabled={busy || !agreed}
                        className="w-fit bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold px-6 py-5 rounded-xl shadow-lg shadow-emerald-500/10 border border-emerald-400/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        onClick={() => void buyLab()}
                      >
                        {busy ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-950" />
                            Processing Checkout…
                          </>
                        ) : (
                          <>Buy lab{priceLabel ? ` — ${priceLabel}` : ""}</>
                        )}
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button
                  disabled
                  className="w-fit bg-white/[0.02] text-slate-500 border border-white/5 cursor-not-allowed rounded-xl"
                >
                  Coming soon
                </Button>
              )}
              {errorMessage && (
                <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center justify-between max-w-lg">
                  <span>{errorMessage}</span>
                  <button type="button" className="underline font-bold text-xs" onClick={clearError}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
