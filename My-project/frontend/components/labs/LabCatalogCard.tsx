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
    <article className="border border-border bg-card hover:border-primary/30 transition-all duration-300 rounded-2xl p-6 backdrop-blur-xl shadow-xs group">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        {/* Main Header Information */}
        <div className="flex gap-5 flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="shrink-0">
            {catalogThumb ? (
              <div className="relative w-[104px] h-[66px] sm:w-[120px] sm:h-[72px] rounded-xl overflow-hidden border border-border bg-muted group-hover:border-primary/20 transition-all duration-300">
                <Image
                  src={catalogThumb}
                  alt=""
                  fill
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  sizes="120px"
                />
              </div>
            ) : (
              <div className="relative w-[104px] h-[66px] sm:w-[120px] sm:h-[72px] rounded-xl overflow-hidden border border-border bg-primary/10 flex items-center justify-center group-hover:border-primary/20 transition-all duration-300">
                <Shield className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </div>
            )}
          </div>

          {/* Info details */}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-200">{lab.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {lab.description || "Hands-on cybersecurity lab environment."}
            </p>
            
            {/* Badges metadata info */}
            <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${diffClass}`}>
                <BarChart2 className="w-3.5 h-3.5" />
                {lab.difficulty}
              </span>
              
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-muted text-muted-foreground font-semibold">
                <Clock className="w-3.5 h-3.5" />
                {lab.durationLabel}
              </span>
              
              {lab.category && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/10 text-primary font-semibold">
                  <Layers className="w-3.5 h-3.5" />
                  {lab.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action right sidebar block */}
        <div className="flex md:flex-col md:items-end items-center justify-between md:justify-start gap-4 md:min-w-[140px] shrink-0 border-t md:border-t-0 border-border pt-4 md:pt-0">
          {priceLabel ? (
            <div className="text-2xl font-extrabold text-foreground tracking-tight whitespace-nowrap">
              {priceLabel}
            </div>
          ) : (
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
              Coming soon
            </span>
          )}
          
          <Button
            type="button"
            variant="outline"
            className="border-border bg-background text-foreground hover:bg-muted rounded-xl h-10 px-4 transition-all duration-200"
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
        <div className="mt-6 pt-6 border-t border-border space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {lab.description && (
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> About this lab
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {lab.description}
              </p>
            </div>
          )}

          {lab.featureChips.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3 px-1">
                Environment includes
              </h3>
              <ul className="flex flex-wrap gap-2">
                {lab.featureChips.map((chip) => (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3.5 py-1.5 text-xs text-foreground hover:border-primary/30 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Checkout Action Panel */}
          <div className="flex flex-col gap-4 pt-4 border-t border-border">
            {purchased || entitled ? (
              <Button
                className="w-fit bg-primary text-primary-foreground font-bold px-6 py-5 rounded-xl shadow-md transition-all hover:scale-[1.02]"
                asChild
              >
                <Link href={`/quiz/${urlId}`}>Access lab</Link>
              </Button>
            ) : lab.isPurchasable ? (
              <>
                {!user ? (
                  <Button
                    className="w-fit bg-primary text-primary-foreground font-bold px-6 py-5 rounded-xl shadow-md transition-all hover:scale-[1.02]"
                    asChild
                  >
                    <Link href={`/login?return=${encodeURIComponent("/labs")}`}>
                      Sign in to buy
                    </Link>
                  </Button>
                ) : (
                  <>
                    <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer max-w-lg select-none bg-muted/30 border border-border rounded-xl p-3 hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                      />
                      <span>
                        I agree to the{" "}
                        <Link href="/terms" className="text-primary hover:underline font-semibold">
                          Terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-primary hover:underline font-semibold">
                          Privacy Policy
                        </Link>
                        . 30-day full access. Includes dedicated target range sandbox instances.
                      </span>
                    </label>
                    
                    <Button
                      type="button"
                      disabled={busy || !agreed}
                      className="w-fit bg-primary text-primary-foreground font-bold px-6 py-5 rounded-xl shadow-md transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      onClick={() => void buyLab()}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                className="w-fit bg-muted text-muted-foreground border border-border cursor-not-allowed rounded-xl"
              >
                Coming soon
              </Button>
            )}
            {errorMessage && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center justify-between max-w-lg">
                <span>{errorMessage}</span>
                <button type="button" className="underline font-bold text-xs" onClick={clearError}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
