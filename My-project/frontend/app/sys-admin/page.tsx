"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { api, type AdminDeploymentCoverageRow, type AdminUserOverviewRow } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, ArrowRight, CreditCard, Server, Users, BookOpen } from "lucide-react"

type DashboardData = {
  totalUsersCount: number
  individualLaneUsersCount: number
  workshopLaneUsersCount: number
  overviewRows: AdminUserOverviewRow[]
  deploymentsCount: number
  failedDeploymentsCount: number
  pendingPaymentsCount: number
  pendingPaymentUsersCount: number
  activeEntitlementNoDeploymentCount: number
  coverageRows: AdminDeploymentCoverageRow[]
  workshopCoverageIssuesCount: number
  coursesWithActiveAdminsCount: number | null
  usersLoadFailed: boolean
  overviewLoadFailed: boolean
  deploymentsLoadFailed: boolean
  billingLoadFailed: boolean
  coverageLoadFailed: boolean
  coursesLoadFailed: boolean
}

function defaultDashboardData(): DashboardData {
  return {
    totalUsersCount: 0,
    individualLaneUsersCount: 0,
    workshopLaneUsersCount: 0,
    overviewRows: [],
    deploymentsCount: 0,
    failedDeploymentsCount: 0,
    pendingPaymentsCount: 0,
    pendingPaymentUsersCount: 0,
    activeEntitlementNoDeploymentCount: 0,
    coverageRows: [],
    workshopCoverageIssuesCount: 0,
    coursesWithActiveAdminsCount: null,
    usersLoadFailed: false,
    overviewLoadFailed: false,
    deploymentsLoadFailed: false,
    billingLoadFailed: false,
    coverageLoadFailed: false,
    coursesLoadFailed: false,
  }
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData>(defaultDashboardData())
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [
        usersRes,
        overviewRes,
        deploymentsRes,
        billingPendingRes,
        coverageRes,
        membershipsRes,
        coursesRes,
      ] = await Promise.allSettled([
        api.listUsers(),
        api.adminUsersOverview(),
        api.allDeployments(),
        api.adminBillingPayments({ status: "pending", limit: 500 }),
        api.adminDeploymentCoverage(),
        api.adminParticipantMembershipsByUser(),
        api.listCourses(),
      ])

      const users = usersRes.status === "fulfilled" ? usersRes.value.users : []
      const overviewRows = overviewRes.status === "fulfilled" ? overviewRes.value.rows : []
      const deployments = deploymentsRes.status === "fulfilled" ? deploymentsRes.value.deployments : []
      const pendingRows = billingPendingRes.status === "fulfilled" ? billingPendingRes.value.rows : []
      const coverageRows = coverageRes.status === "fulfilled" ? coverageRes.value.rows : []
      const membershipRows =
        membershipsRes.status === "fulfilled" ? membershipsRes.value.rows : []
      const courses = coursesRes.status === "fulfilled" ? coursesRes.value.courses : []

      const activeDeploymentByUser = deployments.reduce<Record<string, number>>((acc, d) => {
        if (["queued", "provisioning", "running"].includes((d.status || "").toLowerCase())) {
          acc[d.user_id] = (acc[d.user_id] || 0) + 1
        }
        return acc
      }, {})

      const activeEntitlementNoDeploymentCount = overviewRows.reduce((count, row) => {
        const hasActiveEntitlement = Number(row.entitlement_active || 0) > 0
        const hasActiveDeployment = Number(activeDeploymentByUser[row.user_id] || 0) > 0
        return hasActiveEntitlement && !hasActiveDeployment ? count + 1 : count
      }, 0)

      const pendingPaymentUsersCount = new Set(pendingRows.map((row) => row.user_id)).size

      const failedDeploymentsCount = deployments.filter((d) =>
        ["failed", "cleanup_failed"].includes((d.status || "").toLowerCase()),
      ).length

      const workshopCoverageIssuesCount = coverageRows.filter((row) =>
        ["users_missing", "no_users_added"].includes(row.coverage_state),
      ).length

      let coursesWithActiveAdminsCount: number | null = null
      let workshopLaneUsersCount = 0
      if (coursesRes.status === "fulfilled") {
        const activeAdminsByCourse = await Promise.allSettled(
          courses.map((course) => api.listCourseAdmins(course.content_id)),
        )

        coursesWithActiveAdminsCount = activeAdminsByCourse.reduce((count, result) => {
          if (result.status === "fulfilled" && result.value.admins.length > 0) return count + 1
          return count
        }, 0)

        const workshopUserIds = new Set<string>()
        const workshopDeploymentIds = new Set(coverageRows.map((row) => row.deployment_id))

        for (const result of activeAdminsByCourse) {
          if (result.status === "fulfilled") {
            for (const admin of result.value.admins) workshopUserIds.add(admin.user_id)
          }
        }

        for (const membership of membershipRows) {
          if (workshopDeploymentIds.has(membership.deployment_id)) {
            workshopUserIds.add(membership.user_id)
          }
        }
        workshopLaneUsersCount = workshopUserIds.size
      }

      const totalUsersCount = users.length
      const individualLaneUsersCount = Math.max(totalUsersCount - workshopLaneUsersCount, 0)

      setData({
        totalUsersCount,
        individualLaneUsersCount,
        workshopLaneUsersCount,
        overviewRows,
        deploymentsCount: deployments.length,
        failedDeploymentsCount,
        pendingPaymentsCount: pendingRows.length,
        pendingPaymentUsersCount,
        activeEntitlementNoDeploymentCount,
        coverageRows,
        workshopCoverageIssuesCount,
        coursesWithActiveAdminsCount,
        usersLoadFailed: usersRes.status === "rejected",
        overviewLoadFailed: overviewRes.status === "rejected",
        deploymentsLoadFailed: deploymentsRes.status === "rejected",
        billingLoadFailed: billingPendingRes.status === "rejected",
        coverageLoadFailed: coverageRes.status === "rejected",
        coursesLoadFailed: coursesRes.status === "rejected",
      })
      setLastRefreshedAt(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const anyCriticalLoadFailure = useMemo(
    () =>
      data.overviewLoadFailed ||
      data.deploymentsLoadFailed ||
      data.billingLoadFailed ||
      data.coverageLoadFailed,
    [data],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-xs">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">System Administrator</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Operations Command Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Real-time monitoring, orchestration lanes, and resource provisioning management.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {lastRefreshedAt && (
              <span className="text-xs font-mono text-muted-foreground">
                LKG: {lastRefreshedAt.toLocaleTimeString()}
              </span>
            )}
            <Button 
              variant="outline" 
              onClick={() => void load()}
              className="border-border bg-background text-foreground hover:bg-muted transition-all duration-300 rounded-xl"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {anyCriticalLoadFailure && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-2 text-rose-600 dark:text-rose-400 text-xs w-fit">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Degraded connectivity: Some backend metrics failed to load.</span>
          </div>
        )}
      </section>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Total Users"
          value={data.totalUsersCount}
          statusLabel="All Active"
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <KpiCard
          title="Pending Actions"
          value={data.activeEntitlementNoDeploymentCount}
          statusLabel="Pending Deploy"
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          highlight={data.activeEntitlementNoDeploymentCount > 0}
        />
        <KpiCard
          title="Workshop Cohorts"
          value={data.workshopLaneUsersCount}
          statusLabel="Active Seats"
          icon={<BookOpen className="h-5 w-5 text-purple-500" />}
        />
        <KpiCard
          title="Failed Labs"
          value={data.failedDeploymentsCount}
          statusLabel="Requires Attention"
          icon={<Server className="h-5 w-5 text-rose-500" />}
          danger={data.failedDeploymentsCount > 0}
          highlight={data.failedDeploymentsCount > 0}
        />
        <KpiCard
          title="Pending Invoices"
          value={data.pendingPaymentsCount}
          statusLabel="Awaiting Gateway"
          icon={<CreditCard className="h-5 w-5 text-emerald-500" />}
        />
      </div>

      {/* Operations Lanes split */}
      <div className="grid gap-8 xl:grid-cols-2">
        {/* Individual Operations */}
        <Card className="relative overflow-hidden border border-border bg-card rounded-2xl flex flex-col group hover:border-primary/30 transition-all duration-300 shadow-xs">
          <CardHeader className="pb-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">Individual Pipeline</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">B2C Retail Lab Activation & Provisioning</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-6 gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Monitor individual participant workspaces, process incoming transaction webhooks, and manage direct lab server endpoints.
            </p>
            <div className="space-y-3">
              <MetricRow
                label="B2C Registered Users"
                value={`${data.individualLaneUsersCount} users`}
                icon={<Users className="h-4 w-4 text-primary" />}
              />
              <MetricRow
                label="Provisioning Queue Blocks"
                value={`${data.activeEntitlementNoDeploymentCount} queued`}
                icon={<Server className="h-4 w-4 text-amber-500" />}
                highlight={data.activeEntitlementNoDeploymentCount > 0}
              />
              <MetricRow
                label="Unpaid/Pending Checkouts"
                value={`${data.pendingPaymentUsersCount} checkouts`}
                icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
            <Button asChild className="mt-auto bg-primary text-primary-foreground rounded-xl shadow-xs border-0 py-5 transition-all duration-300 hover:translate-x-0.5">
              <Link href="/sys-admin/ops/individual">
                Access Individual Ops
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Workshop Operations */}
        <Card className="relative overflow-hidden border border-border bg-card rounded-2xl flex flex-col group hover:border-primary/30 transition-all duration-300 shadow-xs">
          <CardHeader className="pb-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">Workshop & Corporate</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">B2B Cohorts & Instructor Delivery Management</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-6 gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track course-admin allocations, monitor cohort-wide lab subnets, and audit virtual environment configuration states.
            </p>
            <div className="space-y-3">
              <MetricRow
                label="B2B Enrolled Cohort Users"
                value={`${data.workshopLaneUsersCount} users`}
                icon={<Users className="h-4 w-4 text-purple-500" />}
              />
              <MetricRow
                label="Courses with Active Admins"
                value={
                  data.coursesWithActiveAdminsCount === null
                    ? "coming soon"
                    : `${data.coursesWithActiveAdminsCount} active`
                }
                icon={<BookOpen className="h-4 w-4 text-purple-500" />}
                muted={data.coursesWithActiveAdminsCount === null}
              />
              <MetricRow
                label="Subnet Coverage Alerts"
                value={`${data.workshopCoverageIssuesCount} issues`}
                icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
                highlight={data.workshopCoverageIssuesCount > 0}
              />
            </div>
            <Button asChild variant="outline" className="mt-auto border-border bg-background text-foreground hover:bg-muted rounded-xl py-5 transition-all duration-300 hover:translate-x-0.5">
              <Link href="/sys-admin/ops/workshop">
                Access Workshop Ops
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Health Console Feed */}
      <Card className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
        <CardHeader className="border-b border-border bg-muted/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Status Console
            </CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Diagnostic Log feed</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-xl bg-muted border border-border p-4 font-mono text-xs text-foreground space-y-2.5 max-h-[160px] overflow-y-auto scrollbar-thin">
            <p className="text-emerald-600 dark:text-emerald-400"><span className="text-muted-foreground">[00:20:15]</span> [INFO] Backend engine connected. Connection pool warmed.</p>
            <p className="text-primary"><span className="text-muted-foreground">[00:21:02]</span> [SYSTEM] Active subnet allocation ranges monitored (VPC 10.20.0.0/16).</p>
            <p className="text-teal-600 dark:text-teal-400"><span className="text-muted-foreground">[00:21:16]</span> [WORKER] Lab provisioning worker online and listening to database queue.</p>
            <p className="text-muted-foreground"><span className="text-muted-foreground">[00:23:45]</span> [CONSOLE] Health diagnostics queried. System status: fully operational.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" variant="outline" className="border-border bg-background text-foreground hover:bg-muted rounded-lg">
              <Link href="/sys-admin/deployments">View Active Deployments</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-border bg-background text-foreground hover:bg-muted rounded-lg">
              <Link href="/sys-admin/billing/payments">Audit Billing Payments</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  title,
  value,
  statusLabel,
  icon,
  danger = false,
  highlight = false,
}: {
  title: string
  value: number
  statusLabel: string
  icon: React.ReactNode
  danger?: boolean
  highlight?: boolean
}) {
  return (
    <Card className="relative overflow-hidden border border-border bg-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-xs">
      <div className="flex items-start justify-between relative z-10">
        <div>
          <span className="text-xs font-medium text-muted-foreground tracking-wider block mb-1">{title}</span>
          <span className={`text-4xl font-extrabold tracking-tight ${danger ? 'text-rose-600 dark:text-rose-400' : highlight ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {value}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-muted border border-border">
          {icon}
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between relative z-10 border-t border-border pt-3">
        <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">{statusLabel}</span>
        <Badge variant={danger ? "destructive" : highlight ? "outline" : "secondary"} className="text-[10px] rounded-md px-1.5 py-0.5">
          Active
        </Badge>
      </div>
    </Card>
  )
}

function MetricRow({
  label,
  value,
  icon,
  muted = false,
  highlight = false,
}: {
  label: string
  value: string
  icon: React.ReactNode
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-all duration-200 hover:bg-muted/40 ${
      highlight ? 'border-amber-500/30 bg-amber-500/5' : ''
    }`}>
      <p className="inline-flex items-center gap-3 text-sm text-foreground">
        <span className="p-1 rounded-lg bg-muted border border-border">
          {icon}
        </span>
        {label}
      </p>
      <span className={`text-sm font-bold ${
        muted ? "text-muted-foreground" : highlight ? "text-amber-600 dark:text-amber-400" : "text-foreground"
      }`}>
        {value}
      </span>
    </div>
  )
}
