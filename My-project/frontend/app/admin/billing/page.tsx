"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  CreditCard,
  Receipt,
  BadgeCheck,
  Activity,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Terminal,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { api, type UserBillingSummaryRow, type BillingSnapshot } from "@/lib/api"
import logger from "@/lib/logger"

type FilterState = "all" | "attention" | "clear" | "no_activity"

function needsAttention(r: UserBillingSummaryRow): boolean {
  if (r.pending_payment_count > 0 && r.entitlement_active === 0) return true
  if (r.entitlement_revoked > 0) return true
  return false
}

function isClear(r: UserBillingSummaryRow): boolean {
  if (needsAttention(r)) return false
  if (r.purchase_count === 0 && r.pending_payment_count === 0 && r.entitlement_active === 0) return false
  return r.entitlement_active > 0 || r.purchase_count > 0
}

function isNoActivity(r: UserBillingSummaryRow): boolean {
  return r.purchase_count === 0 && r.pending_payment_count === 0 && r.entitlement_active === 0
}

function paymentStateBadge(r: UserBillingSummaryRow) {
  if (needsAttention(r)) {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
        Attention Required
      </Badge>
    )
  }
  if (isClear(r)) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
        Account Clear
      </Badge>
    )
  }
  return (
    <Badge className="bg-muted border border-border text-muted-foreground text-[10px]">
      No Activity
    </Badge>
  )
}

function paymentStateReason(r: UserBillingSummaryRow): string {
  const parts: string[] = []
  if (r.pending_payment_count > 0) {
    parts.push(`${r.pending_payment_count} pending payment(s)`)
  }
  if (r.entitlement_revoked > 0) {
    parts.push(`${r.entitlement_revoked} revoked entitlement(s)`)
  }
  if (r.entitlement_active > 0) {
    parts.push(`${r.entitlement_active} active access key(s)`)
  }
  if (parts.length === 0) return "No transactions or entitlements on record."
  return parts.join(" · ")
}

export default function AdminBillingPage() {
  const [snapshot, setSnapshot] = useState<BillingSnapshot>({
    usersWithPurchases: 0,
    totalPurchases: 0,
    pendingPayments: 0,
    activeEntitlements: 0,
  })
  const [rows, setRows] = useState<UserBillingSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [emailByUser, setEmailByUser] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterState>("all")

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [snapData, listData] = await Promise.all([
          api.adminBillingSnapshot().catch(() => ({
            usersWithPurchases: 0,
            totalPurchases: 0,
            pendingPayments: 0,
            activeEntitlements: 0,
          })),
          api.adminUserBillingSummary().catch(() => []),
        ])
        if (cancelled) return
        setSnapshot(snapData)
        setRows(listData)

        try {
          const ures = await api.adminUsers()
          if (!cancelled && ures.users) {
            const map: Record<string, string> = {}
            for (const u of ures.users) {
              map[u.user_id] = u.email
            }
            setEmailByUser(map)
          }
        } catch {
          // ignore
        }
      } catch (err) {
        logger.error("Failed to load billing admin data", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "attention") return needsAttention(r)
      if (filter === "clear") return isClear(r)
      if (filter === "no_activity") return isNoActivity(r)
      return true
    })
  }, [rows, filter])

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* Top Banner Header */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-xs">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none animate-pulse" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 font-mono text-xs text-primary font-bold">
                <Receipt className="w-3.5 h-3.5" /> Billing Console
              </span>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5">Billing Admin</Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Billing Snapshot</h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed font-light font-sans">
              Operational visibility into the platform's purchase and payment lifecycle. Data is synced in real-time with payment gateways and localized database aggregates.
            </p>
          </div>
        </div>
      </section>

      {/* Snapshot Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 px-6">
        <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Purchased Users</p>
            <p className="text-3xl font-black text-foreground">{snapshot.usersWithPurchases}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
            <CreditCard className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Total Purchases</p>
            <p className="text-3xl font-black text-foreground">{snapshot.totalPurchases}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
            <Receipt className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-rose-500/30 transition-all duration-300 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Pending Attempts</p>
            <p className="text-3xl font-black text-foreground">{snapshot.pendingPayments}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-rose-500/10 group-hover:border-rose-500/30 transition-all duration-300">
            <Activity className="h-6 w-6 text-muted-foreground group-hover:text-rose-500 transition-colors" />
          </div>
        </div>

        <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Active Entitlements</p>
            <p className="text-3xl font-black text-foreground">{snapshot.activeEntitlements}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
            <BadgeCheck className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="px-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
          
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" /> Per-User Billing Ledger
              </h2>
              <p className="text-xs text-muted-foreground font-light mt-0.5">Showing {filteredRows.length} filtered customer billing accounts</p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-xl border border-border">
              {(["all", "attention", "clear", "no_activity"] as const).map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    filter === opt
                      ? "bg-primary text-primary-foreground font-extrabold shadow-xs"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                  onClick={() => setFilter(opt)}
                >
                  {opt === "all" ? "All Accounts" : opt === "attention" ? "Attention" : opt === "clear" ? "Clear" : "No Activity"}
                </Button>
              ))}
            </div>
          </div>

          {/* Table Content */}
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4">User Identity</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-center">Completed Purchases</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-center">Pending Attempts</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-center">Active Entitlements</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-center">Expired</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-center">Revoked</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4">Status State</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4">System Message</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filteredRows.map((r) => (
                    <TableRow key={r.user_id} className="hover:bg-muted/30 transition-colors group/row">
                      <TableCell className="font-mono text-xs text-foreground py-3.5">
                        {emailByUser[r.user_id] || r.user_id}
                      </TableCell>
                      <TableCell className="text-center font-bold text-foreground">{r.purchase_count}</TableCell>
                      <TableCell className="text-center font-semibold text-foreground">
                        {r.pending_payment_count > 0 ? (
                          <span className="text-rose-500 font-extrabold">{r.pending_payment_count}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">{r.entitlement_active}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{r.entitlement_expired}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {r.entitlement_revoked > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">{r.entitlement_revoked}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">{paymentStateBadge(r)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-light py-3.5 max-w-[200px] truncate">
                        {paymentStateReason(r)}
                      </TableCell>
                      <TableCell className="text-right py-3.5">
                        <div className="flex justify-end gap-1.5 transition-opacity">
                          <Button asChild variant="ghost" size="sm" className="h-8 text-xs hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg">
                            <Link href={`/admin/billing/payments?user_id=${encodeURIComponent(r.user_id)}&status=pending`}>
                              Payments <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-8 text-xs hover:bg-primary/10 text-primary hover:text-primary rounded-lg">
                            <Link href={`/admin/users?focus_user=${encodeURIComponent(r.user_id)}`}>
                              Open Account <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center text-sm text-muted-foreground font-light">
                        No billing accounts match the selected state filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
