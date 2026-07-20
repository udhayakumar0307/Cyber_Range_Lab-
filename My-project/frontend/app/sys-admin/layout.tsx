"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  Server,
  BookOpen,
  FileText,
  ShieldCheck,
  UserCog,
  Users2,
  CreditCard,
  BellRing,
  LogOut,
  Loader2,
  Trophy,
  Sun,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getRoleHome } from "@/lib/role-home"

const NAV = [
  { href: "/sys-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/sys-admin/ops/individual", label: "Individual Ops", icon: Users },
  { href: "/sys-admin/ops/workshop", label: "Workshop Ops", icon: Users2 },
  { href: "/sys-admin/ops/feed", label: "Operations Feed", icon: BellRing },
  { href: "/sys-admin/users", label: "Accounts", icon: Users },
  { href: "/sys-admin/courses", label: "Courses", icon: BookOpen },
  { href: "/sys-admin/content", label: "Content Studio", icon: FileText },
  { href: "/sys-admin/course-admins", label: "Course Admins", icon: UserCog },
  { href: "/sys-admin/guardrails", label: "Guardrails", icon: ShieldCheck },
  { href: "/sys-admin/participants", label: "Participants", icon: Users2 },
  { href: "/admin-ctf", label: "Admin CTF Hub", icon: Trophy },
  { href: "/sys-admin/deployments", label: "Lab Deployments", icon: Server },
  { href: "/sys-admin/billing", label: "Billing Snapshot", icon: CreditCard },
  { href: "/sys-admin/billing/payments", label: "Billing Payments", icon: CreditCard },
] as const

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeHref = useMemo(() => {
    const matches = NAV.filter((item) => {
      if (item.href === "/sys-admin") return pathname === "/sys-admin"
      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    }).sort((a, b) => b.href.length - a.href.length)
    return matches[0]?.href ?? "/sys-admin"
  }, [pathname])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }
    if (user?.role !== "sys_admin") {
      router.replace(getRoleHome(user?.role))
    }
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || user.role !== "sys_admin") return null

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl">
        <div className="flex h-auto min-h-16 flex-col justify-center gap-0.5 border-b border-sidebar-border px-6 py-3">
          <Link href="/" className="font-extrabold tracking-wider leading-tight text-foreground flex items-center gap-1.5">
            RangeOps{" "}
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary">
              Admin
            </span>
          </Link>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            by DeepTrustxAI Academy
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto custom-scrollbar">
          {NAV.map((item) => {
            const active = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs transition-all font-semibold",
                  active
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="border-t border-sidebar-border p-4 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[130px]" title={user.email}>
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle Light / Dark Theme"
              className="h-7 w-7 rounded-lg"
            >
              {mounted && theme === "dark" ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9"
            onClick={() => {
              logout()
              router.push("/login")
            }}
          >
            <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-8">{children}</div>
      </div>
    </div>
  )
}
