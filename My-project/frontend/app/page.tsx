'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Header from '@/components/Header'
import { FeaturedLabsGrid } from '@/components/home/FeaturedLabsGrid'
import { ArrowRight, Target, Server, Crosshair, ShieldCheck, LayoutGrid, LogIn, MousePointerClick, BarChart3, Cloud, Brain, Boxes, Cpu } from 'lucide-react'
import Link from "next/link"
import { useAuth } from '@/lib/auth'
import { api, type PublicContentPage } from '@/lib/api'

const platformFeatures = [
  {
    icon: Server,
    title: "Real Environments",
    description: "Fully configured systems including Active Directory, SIEM, and attacker machines."
  },
  {
    icon: Crosshair,
    title: "End-to-End Scenarios",
    description: "Execute attacks and analyze detection within the same isolated environment."
  },
  {
    icon: ShieldCheck,
    title: "Isolated Execution",
    description: "Each session runs securely in a controlled environment with zero external impact."
  },
  {
    icon: LayoutGrid,
    title: "Structured Lab Design",
    description: "Labs are meticulously designed with clear objectives and realistic attack paths."
  }
]

const steps = [
  { icon: LogIn, title: "Authenticate", description: "Secure SSO login" },
  { icon: MousePointerClick, title: "Select Lab", description: "Choose environment" },
  { icon: Target, title: "Execute Scenarios", description: "Perform attacks" },
  { icon: BarChart3, title: "Analyze & Learn", description: "Review logs & outcomes" }
]

export default function LandingPage() {
  const { user } = useAuth()
  const [cmsPage, setCmsPage] = useState<PublicContentPage | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    const loadCms = async () => {
      try {
        const page = await api.publicContentPageBySlug("home")
        setCmsPage(page)
      } catch {
        setCmsPage(null)
      }
    }
    void loadCms()
  }, [])

  const cmsByType = useMemo(() => {
    const sections = cmsPage?.sections || []
    return {
      firstHero: sections.find((s) => s.section_type === "hero") || null,
      firstText: sections.find((s) => s.section_type === "rich_text") || null,
      firstCta: sections.find((s) => s.section_type === "cta") || null,
      firstMedia: sections.find((s) => s.section_type === "media") || null,
    }
  }, [cmsPage])

  const heroHeadline = String(cmsByType.firstHero?.payload?.headline || "Master Cyber Defense with Real-World Scenarios")
  const heroSubheadline = String(
    cmsByType.firstHero?.payload?.subheadline ||
      "Experience RangeOps by DeepTrustxAI Academy. Immerse yourself in fully configured, isolated environments crafted for advanced attack and defense simulations."
  )
  const heroPrimaryCtaText = String(cmsByType.firstHero?.payload?.ctaText || "Get Started Today")
  const heroPrimaryCtaLink = String(cmsByType.firstHero?.payload?.ctaLink || (user ? "/labs" : "/login"))
  const heroSecondaryCtaText = String(cmsByType.firstHero?.payload?.secondaryCtaText || "Explore Curriculum")
  const heroSecondaryCtaLink = String(cmsByType.firstHero?.payload?.secondaryCtaLink || "/labs")
  
  const provideTitle = String(cmsByType.firstText?.payload?.title || "Platform Capabilities")
  const provideBody = String(cmsByType.firstText?.payload?.body || "Explore our advanced defense and attack simulation capabilities below.")

  const upcomingTitle = String(cmsByType.firstMedia?.payload?.title || "Upcoming Environments")
  const upcomingSubtitle = String(cmsByType.firstMedia?.payload?.subtitle || "Next-generation training arenas currently in development.")
  const defaultUpcomingItems = [
    { title: "Cloud Native", desc: "AWS / Azure multi-cloud exploitation" },
    { title: "AI Security", desc: "Adversarial testing & prompt injection" },
    { title: "Web3 & Smart Contracts", desc: "DeFi vulnerability labs" },
    { title: "IoT / ICS", desc: "SCADA & device-level hardware attacks" },
  ]
  const upcomingItems = Array.isArray(cmsByType.firstMedia?.payload?.items) 
    ? cmsByType.firstMedia.payload.items 
    : defaultUpcomingItems

  const ctaTitle = String(cmsByType.firstCta?.payload?.title || "Ready to upgrade your skills?")
  const ctaBody = String(cmsByType.firstCta?.payload?.body || "Join thousands of professionals mastering advanced defense techniques.")
  const ctaBtnText = String(cmsByType.firstCta?.payload?.ctaText || "Access the Range")
  const ctaBtnLink = String(cmsByType.firstCta?.payload?.ctaLink || (user ? "/labs" : "/login"))

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 transition-colors duration-300">
      <Header active="home" />

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex flex-col justify-center items-center overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        </div>

        <div className="container relative z-10 mx-auto px-6 pt-16 pb-24 text-center">
          <Badge className="mb-8 px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-medium tracking-wide uppercase text-xs backdrop-blur-sm">
            Real Infrastructure. No Simulations.
          </Badge>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-foreground mb-8 max-w-5xl mx-auto leading-[1.1]">
            {heroHeadline}
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            {heroSubheadline}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="group relative overflow-hidden bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-lg font-bold rounded-2xl transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/20"
              asChild
            >
              <Link href={heroPrimaryCtaLink}>
                <span className="relative z-10 flex items-center gap-2">
                  {heroPrimaryCtaText}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="group border border-border bg-card text-foreground hover:bg-muted px-10 py-7 text-lg font-semibold rounded-2xl transition-all duration-300"
              asChild
            >
              <Link href={heroSecondaryCtaLink}>
                {heroSecondaryCtaText}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Bento Grid: What This Platform Provides */}
      <section className="py-24 relative z-10 bg-muted/40 border-y border-border">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">{provideTitle}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-light mb-6">{provideBody}</p>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {platformFeatures.map((feature, i) => (
              <div
                key={feature.title}
                className={`group relative rounded-3xl border border-border bg-card p-8 hover:border-primary/40 transition-all duration-300 hover:-translate-y-2 shadow-xs hover:shadow-xl ${i === 0 || i === 3 ? 'lg:col-span-2' : ''}`}
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-base">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Flow */}
      <section className="py-24 relative z-10 bg-background">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">Workflow</h2>
            <p className="text-muted-foreground text-lg">From zero to full attack execution in minutes.</p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative">
            {steps.map((step, index) => (
              <div key={index} className="flex-1 text-center group relative w-full">
                <div className="w-20 h-20 rounded-3xl bg-card border border-border flex items-center justify-center mx-auto mb-6 relative z-10 group-hover:border-primary/50 shadow-sm transition-all duration-300 group-hover:-translate-y-1">
                  <step.icon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                  
                  {/* Step number badge */}
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shadow-md">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm max-w-[200px] mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-muted/40 border-t border-border">
        <FeaturedLabsGrid />
      </div>

      {/* Upcoming Environments */}
      <section className="py-24 relative z-10 bg-background border-t border-border overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">{upcomingTitle}</h2>
              <p className="text-muted-foreground text-lg">{upcomingSubtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {upcomingItems.map((item, idx) => {
              const icons = [Cloud, Brain, Boxes, Cpu]
              const IconComp = icons[idx % icons.length]
              return (
                <div
                  key={idx}
                  className="group rounded-3xl border border-border bg-card p-7 hover:border-primary/30 transition-all shadow-xs relative overflow-hidden"
                >
                  <IconComp className="w-9 h-9 text-muted-foreground mb-5 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{item.desc}</p>
                  <div className="inline-flex">
                    <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-medium text-[11px]">
                      In Development
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative z-10 bg-primary/5 border-t border-border">
        <div className="container mx-auto px-6 max-w-4xl text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 tracking-tight">
            {ctaTitle}
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            {ctaBody}
          </p>
          <Button
            size="lg"
            className="group bg-primary text-primary-foreground hover:bg-primary/90 px-10 py-7 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all duration-300"
            asChild
          >
            <Link href={ctaBtnLink}>
              <span className="flex items-center gap-3">
                {ctaBtnText}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </span>
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
