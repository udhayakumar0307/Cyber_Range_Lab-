'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpenCheck,
  Server,
  Clock,
  ArrowRight,
  Copy,
  RefreshCcw,
  Terminal,
  Activity,
  AlertCircle,
  CornerDownRight,
  ShieldCheck,
  ExternalLink,
  Info,
  Loader2,
  Trophy
} from 'lucide-react'

import { cn } from '@/lib/utils'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AwsCodeEntry from '@/components/AwsCodeEntry'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { api, apiClient, type CourseResource, type DeploymentAccessDetails, type Entitlement } from '@/lib/api'
import { toLab, type Lab } from '@/lib/labs'
import { contentIdsEqual } from '@/lib/content-id'
import logger from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

type DeploymentStatus =
  | 'pending'
  | 'provisioning'
  | 'running'
  | 'failed'
  | 'expired'
  | 'terminated'
  | string

interface Deployment {
  deployment_id: string
  status: DeploymentStatus
  is_owner: boolean
  public_ip?: string | null
  private_ip?: string | null
  error?: string | null
  lab_title: string
  created_at?: string
  expires_at?: string
  can_join?: boolean
}

interface JoinInfo {
  command: string
  expires_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function displayLabTitle(title: string): string {
  const t = (title || '').toLowerCase()
  if (t.includes('active directory')) return 'Active Directory Environment'
  if (t.startsWith('crapi')) return 'CRAPI API Security Environment'
  return title || 'Lab'
}

function daysBetween(nowMs: number, iso?: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - nowMs) / (1000 * 60 * 60 * 24))
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function runtimeRowMeta(status: DeploymentStatus): {
  label: string
  chipClass: string
  helper: string
} {
  const s = (status || '').toLowerCase()
  if (s === 'running') {
    return {
      label: 'RUNNING',
      chipClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs',
      helper: 'Environment is online and ready',
    }
  }
  if (s === 'queued' || s === 'provisioning' || s === 'terminating') {
    return {
      label: s.toUpperCase(),
      chipClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse',
      helper: 'Provisioning infrastructure',
    }
  }
  if (s === 'failed' || s === 'cleanup_failed') {
    return {
      label: 'NEEDS ATTENTION',
      chipClass: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
      helper: 'Orchestration failure detected',
    }
  }
  if (s === 'expired' || s === 'terminated') {
    return {
      label: 'EXPIRED',
      chipClass: 'bg-muted border-border text-muted-foreground',
      helper: 'Session lease ended',
    }
  }
  return {
    label: s.toUpperCase() || 'UNKNOWN',
    chipClass: 'bg-muted border-border text-muted-foreground',
    helper: 'State unknown',
  }
}

function deploymentPriority(status: DeploymentStatus): number {
  const s = (status || '').toLowerCase()
  if (s === 'running') return 0
  if (s === 'queued' || s === 'provisioning' || s === 'terminating') return 1
  if (s === 'failed' || s === 'cleanup_failed') return 2
  if (s === 'expired' || s === 'terminated') return 3
  return 4
}

function deploymentTimeScore(dep: Deployment): number {
  return new Date(dep.created_at || 0).getTime()
}

function deploymentGroupKey(dep: Deployment): string {
  return displayLabTitle(dep.lab_title || 'Lab').toLowerCase().trim()
}

function findLabForContentId(
  catalog: Lab[],
  contentId: string,
): Lab | undefined {
  return catalog.find((l) => contentIdsEqual(l.id, contentId))
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { user, entitlements, refreshUser, isLoading: authLoading } = useAuth()

  const [catalog, setCatalog] = useState<Lab[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [deploymentsLoading, setDeploymentsLoading] = useState(true)
  const [accessDetailsByDeployment, setAccessDetailsByDeployment] = useState<Record<string, DeploymentAccessDetails>>({})
  const [accessDetailsLoading, setAccessDetailsLoading] = useState<Record<string, boolean>>({})
  const [accessDetailsError, setAccessDetailsError] = useState<Record<string, string>>({})
  const [joinInfo, setJoinInfo] = useState<Record<string, JoinInfo>>({})
  const [joinLoading, setJoinLoading] = useState<Record<string, boolean>>({})
  const [joinError, setJoinError] = useState<Record<string, string>>({})
  const [resourcesByContentId, setResourcesByContentId] = useState<Record<string, CourseResource[]>>({})
  const [expandedDeploymentId, setExpandedDeploymentId] = useState<string | null>(null)

  const loadDeployments = useCallback(async () => {
    setDeploymentsLoading(true)
    try {
      const res = await apiClient.get<{ deployments: Deployment[] }>('/labs/status')
      const maybeEnvelope = res as { success?: boolean; data?: { deployments?: Deployment[] } }
      if (maybeEnvelope.success === false) {
        setDeployments([])
        return
      }
      const payload = maybeEnvelope.data ?? (res as unknown as { deployments?: Deployment[] })
      const list = Array.isArray(payload?.deployments) ? payload.deployments : []
      setDeployments(list)
    } catch (err) {
      logger.error('Failed to load deployments:', err)
      setDeployments([])
    } finally {
      setDeploymentsLoading(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    try {
      const rows = await api.catalogLabs()
      setCatalog(rows.map(toLab))
    } catch (err) {
      logger.error('Failed to load lab catalog:', err)
      setCatalog([])
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const userId = user?.id ?? null
  const bootstrappedForUserRef = useRef<string | null>(null)
  useEffect(() => {
    if (authLoading || !userId) return
    if (bootstrappedForUserRef.current === userId) return
    bootstrappedForUserRef.current = userId
    refreshUser()
    loadCatalog()
    loadDeployments()
  }, [authLoading, userId])

  const handleCopy = useCallback((text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        /* ignore */
      })
    }
  }, [])

  const handleGetVpnJoinCommand = useCallback(async (deploymentId: string) => {
    setJoinError((prev) => ({ ...prev, [deploymentId]: '' }))
    setJoinLoading((prev) => ({ ...prev, [deploymentId]: true }))
    try {
      const res = await api.joinLab(deploymentId)
      setJoinInfo((prev) => ({
        ...prev,
        [deploymentId]: { command: res.command, expires_at: res.expires_at },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load VPN join command.'
      setJoinError((prev) => ({ ...prev, [deploymentId]: msg }))
    } finally {
      setJoinLoading((prev) => ({ ...prev, [deploymentId]: false }))
    }
  }, [])

  const handleOpenAccessDetails = useCallback(async (deploymentId: string) => {
    setExpandedDeploymentId((current) => (current === deploymentId ? null : deploymentId))
    if (accessDetailsByDeployment[deploymentId] || accessDetailsLoading[deploymentId]) {
      return
    }
    setAccessDetailsError((prev) => ({ ...prev, [deploymentId]: '' }))
    setAccessDetailsLoading((prev) => ({ ...prev, [deploymentId]: true }))
    try {
      const details = await api.deploymentAccessDetails(deploymentId)
      setAccessDetailsByDeployment((prev) => ({ ...prev, [deploymentId]: details }))
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('Not Found')
        ? 'Access details are not available yet. Please refresh in a moment.'
        : err instanceof Error
          ? err.message
          : 'Failed to load access details'
      setAccessDetailsError((prev) => ({ ...prev, [deploymentId]: msg }))
    } finally {
      setAccessDetailsLoading((prev) => ({ ...prev, [deploymentId]: false }))
    }
  }, [accessDetailsByDeployment, accessDetailsLoading])

  const handleRefresh = useCallback(async () => {
    bootstrappedForUserRef.current = null
    await Promise.all([refreshUser(), loadCatalog(), loadDeployments()])
    bootstrappedForUserRef.current = userId
  }, [refreshUser, loadCatalog, loadDeployments, userId])

  useEffect(() => {
    const loadResources = async () => {
      const active = entitlements.filter((e) => e.status === 'active')
      if (active.length === 0) {
        setResourcesByContentId({})
        return
      }
      try {
        const pairs = await Promise.all(
          active.map(async (ent) => {
            try {
              const res = await api.myVisibleCourseResources(ent.content_id)
              return [ent.content_id, res.resources || []] as [string, CourseResource[]]
            } catch {
              return [ent.content_id, []] as [string, CourseResource[]]
            }
          }),
        )
        const next: Record<string, CourseResource[]> = {}
        for (const [contentId, rows] of pairs) next[contentId] = rows
        setResourcesByContentId(next)
      } catch {
        setResourcesByContentId({})
      }
    }
    void loadResources()
  }, [entitlements])

  // Derived
  const now = Date.now()
  const activeEntitlements: Entitlement[] = entitlements.filter(
    (e) => e.status === 'active',
  )
  const expiringSoon = activeEntitlements.filter((e) => {
    const d = daysBetween(now, e.valid_until)
    return d !== null && d >= 0 && d <= 7
  }).length
  const activeDeploymentCount = deployments.filter(
    (d) => ['running', 'queued', 'provisioning', 'terminating'].includes((d.status || '').toLowerCase()),
  ).length
  const latestByLabKey = new Map<string, Deployment>()
  for (const dep of deployments) {
    const key = deploymentGroupKey(dep)
    const existing = latestByLabKey.get(key)
    if (!existing) {
      latestByLabKey.set(key, dep)
      continue
    }
    const depPriority = deploymentPriority(dep.status)
    const existingPriority = deploymentPriority(existing.status)
    if (depPriority < existingPriority) {
      latestByLabKey.set(key, dep)
      continue
    }
    if (depPriority === existingPriority && deploymentTimeScore(dep) > deploymentTimeScore(existing)) {
      latestByLabKey.set(key, dep)
    }
  }
  const effectiveDeployments = Array.from(latestByLabKey.values()).sort(
    (a, b) => deploymentTimeScore(b) - deploymentTimeScore(a),
  )

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-muted-foreground text-sm animate-pulse">Initializing participant dashboard…</div>
        </div>
      </div>
    )
  }

  const welcomeName =
    (user as { name?: string }).name?.trim()?.split(/\s+/)[0] ||
    user.email?.split('@')[0] ||
    'there'

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 pb-16 transition-colors duration-300">
      <Header active="dashboard" />

      {/* Top Glassmorphic Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-xs m-6 mb-0">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none animate-pulse" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 font-mono text-xs text-primary font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Cyber Range Console
              </span>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 capitalize">{user.role}</Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Welcome back, {welcomeName}.</h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed font-light font-sans">
              {user.email} {user.created_at ? ` · Member since ${formatDate(user.created_at)}` : ''}
            </p>
          </div>
          <Button asChild className="bg-primary text-primary-foreground font-bold px-6 py-5 rounded-xl shadow-xs flex items-center gap-2 transition-all shrink-0">
            <Link href="/ctf">
              <Trophy className="w-4 h-4" /> Enter CTF Arena <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="px-6 mt-8 space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Stat Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Labs Purchased</p>
              <p className="text-3xl font-black text-foreground">{activeEntitlements.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-light">
                {activeEntitlements.length === 0
                  ? 'Browse the catalog to get started'
                  : 'Active entitlements'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
              <BookOpenCheck className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>

          <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Active Deployments</p>
              <p className="text-3xl font-black text-foreground">{deploymentsLoading ? '—' : activeDeploymentCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-light">
                {deployments.length === 0
                  ? 'No environments provisioned'
                  : `of ${deployments.length} total deployments`}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
              <Server className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>

          <div className="group relative rounded-2xl border border-border bg-card p-5 hover:border-amber-500/30 transition-all duration-300 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">Expiring in 7 days</p>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{expiringSoon}</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-light">
                {expiringSoon === 0
                  ? 'Nothing needs renewal yet'
                  : 'Renew to preserve lease'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted border border-border group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all duration-300">
              <Clock className="h-6 w-6 text-muted-foreground group-hover:text-amber-500 transition-colors" />
            </div>
          </div>
        </div>

        {/* AWS Labs Verification & Access */}
        <AwsCodeEntry labId="aws-security-labs" userEmail={user.email} />

        {/* My Labs Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-primary" /> My Labs Catalogue
              </h2>
              <p className="text-xs text-muted-foreground font-light mt-0.5">Labs unlocked under your current active entitlements.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border bg-card text-foreground hover:bg-muted font-semibold px-4 text-xs"
              onClick={handleRefresh}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-2" />
              Refresh
            </Button>
          </div>

          {activeEntitlements.length === 0 ? (
            <EmptyState
              title="No active labs"
              description="Browse our hands-on sandbox labs catalogue to begin deployment."
              actionLabel="Browse Catalogue"
              actionHref="/labs"
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="max-h-[350px] overflow-auto">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border">
                    <TableRow>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Lab Sandbox Scenario</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Difficulty & Duration</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Entitlement State</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Access Expires</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Resources Available</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-xs py-3.5 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {activeEntitlements.map((ent) => {
                      const lab = findLabForContentId(catalog, ent.content_id)
                      const resources = resourcesByContentId[ent.content_id] || []
                      return (
                        <TableRow key={ent.content_id} className="hover:bg-muted/30 transition-colors group/row">
                          <TableCell className="py-3.5">
                            <p className="font-bold text-foreground text-sm">{displayLabTitle(lab?.title || 'Lab')}</p>
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-muted-foreground">
                            {lab?.difficulty || 'Standard'} · {lab?.durationLabel || 'Self-paced'}
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-semibold">
                              Active
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-muted-foreground">{formatDate(ent.valid_until)}</TableCell>
                          <TableCell className="py-3.5 text-xs text-muted-foreground">
                            {resources.length} study module{resources.length === 1 ? '' : 's'}
                          </TableCell>
                          <TableCell className="py-3.5 text-right">
                            <Button asChild size="sm" className="h-8 bg-primary text-primary-foreground font-bold px-4 rounded-lg shadow-xs transition-all">
                              <Link href={`/labs?buy=${lab?.slug || lab?.id}`}>View Resources</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>

        {/* Active Lab Environments Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" /> Active Range Environments
              </h2>
              <p className="text-xs text-muted-foreground font-light mt-0.5">Interact with your active cloud instances and network gateways.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border bg-card text-foreground hover:bg-muted font-semibold px-4 text-xs"
              onClick={loadDeployments}
              disabled={deploymentsLoading}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-2" />
              {deploymentsLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {deploymentsLoading ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground font-light shadow-xs">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
              Loading active environments…
            </div>
          ) : effectiveDeployments.length === 0 ? (
            <EmptyState
              title="No active deployments"
              description="Deploy a scenario from your Catalogue page to initiate standard sandboxes."
              actionLabel="Browse Catalogue"
              actionHref="/labs"
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow>
                    <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Environment Scenario</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Provisioning Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Orchestration Time</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-3.5">Expires At</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs py-3.5 text-right">Access Guide</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {effectiveDeployments.map((dep) => {
                    const meta = runtimeRowMeta(dep.status)
                    const status = (dep.status || '').toLowerCase()
                    const expanded = expandedDeploymentId === dep.deployment_id
                    const canJoin = status === 'running' && (dep.is_owner || dep.can_join)
                    const details = accessDetailsByDeployment[dep.deployment_id]
                    const isTailScaleFlow = details?.access_model === 'tailscale'
                    return (
                      <Fragment key={dep.deployment_id}>
                        <TableRow className="hover:bg-muted/30 transition-colors group/row">
                          <TableCell className="py-3.5">
                            <p className="font-bold text-foreground text-sm">{displayLabTitle(dep.lab_title)}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Deployment ID: {dep.deployment_id.slice(0, 16)}…</p>
                          </TableCell>
                          <TableCell className="py-3.5">
                            <span className={cn("inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold", meta.chipClass)}>
                              {meta.label}
                            </span>
                            <p className="mt-1 text-[10px] text-muted-foreground">{meta.helper}</p>
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-muted-foreground">{dep.created_at ? formatDate(dep.created_at) : '—'}</TableCell>
                          <TableCell className="py-3.5 text-xs text-muted-foreground">{formatDate(dep.expires_at)}</TableCell>
                          <TableCell className="py-3.5 text-right">
                            {status === 'running' ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenAccessDetails(dep.deployment_id)}
                                disabled={!canJoin}
                                className="h-8 bg-primary text-primary-foreground font-bold px-4 rounded-lg shadow-xs transition-all text-xs"
                              >
                                {expanded ? 'Hide Guide' : 'Open Guide'}
                              </Button>
                            ) : status === 'queued' || status === 'provisioning' || status === 'terminating' ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" disabled className="h-8 text-xs font-semibold rounded-lg bg-muted border border-border text-muted-foreground">Preparing...</Button>
                                <Button size="sm" variant="outline" className="h-8 border-border bg-card text-xs text-foreground hover:bg-muted rounded-lg" onClick={loadDeployments}>
                                  Refresh
                                </Button>
                              </div>
                            ) : (
                              <Button asChild size="sm" className="h-8 bg-primary text-primary-foreground font-bold px-4 rounded-lg shadow-xs text-xs">
                                <Link href="/labs">Open Labs</Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={5} className="py-4 px-6 border-b border-border">
                              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
                                {(status === 'queued' || status === 'provisioning' || status === 'terminating') && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 font-light flex items-center gap-1.5 animate-pulse">
                                    <Activity className="w-4 h-4" /> Your lab environment is currently provisioning. Please standby.
                                  </p>
                                )}
                                {status === 'running' && (
                                  <div className="space-y-4">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                                      <Terminal className="w-4 h-4" /> Lab Environment Online and Verified
                                    </p>
                                    
                                    {accessDetailsError[dep.deployment_id] ? (
                                      <p className="text-xs text-rose-500 font-light">{accessDetailsError[dep.deployment_id]}</p>
                                    ) : null}
                                    {accessDetailsLoading[dep.deployment_id] ? (
                                      <p className="text-xs text-muted-foreground font-light flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Fetching secure gateway coordinates…
                                      </p>
                                    ) : null}

                                    {/* Step 1: Connect to VPN */}
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                                      <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                                        <CornerDownRight className="w-4 h-4" /> Step 1: Connect to Lab VPN Network
                                      </h4>
                                      <p className="text-xs text-muted-foreground font-light leading-relaxed">
                                        All lab virtual machines are located on isolated private subnets. You must connect your workspace client before attempting machine routing.
                                      </p>
                                      {isTailScaleFlow ? (
                                        <div className="mt-3 grid md:grid-cols-2 gap-4">
                                          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                                            <p className="text-xs font-semibold text-foreground">Install Tailscale VPN Client</p>
                                            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted-foreground font-light leading-relaxed">
                                              <li>Download the Tailscale client application.</li>
                                              <li>Launch your terminal shell application.</li>
                                              <li>Keep your workspace prepared for authentication.</li>
                                            </ol>
                                          </div>
                                          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                                            <p className="text-xs font-semibold text-foreground">Authorize Connection</p>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                onClick={() => handleGetVpnJoinCommand(dep.deployment_id)}
                                                disabled={joinLoading[dep.deployment_id]}
                                                className="h-8 bg-primary text-primary-foreground font-bold text-[11px]"
                                              >
                                                {joinLoading[dep.deployment_id] ? 'Retrieving Token…' : 'Get VPN Join Command'}
                                              </Button>
                                            </div>
                                            {joinError[dep.deployment_id] && (
                                              <p className="text-[11px] text-rose-500 font-light mt-1">{joinError[dep.deployment_id]}</p>
                                            )}
                                            {joinInfo[dep.deployment_id]?.command && (
                                              <div className="relative mt-2">
                                                <pre className="overflow-x-auto rounded-lg bg-muted border border-border p-3 pr-12 text-[10px] text-primary font-mono leading-relaxed max-w-full">
                                                  {joinInfo[dep.deployment_id].command}
                                                </pre>
                                                <button
                                                  type="button"
                                                  onClick={() => handleCopy(joinInfo[dep.deployment_id].command)}
                                                  className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground hover:bg-muted"
                                                >
                                                  <Copy className="w-3 h-3" />
                                                  Copy
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground font-light flex items-center gap-2">
                                          <Info className="w-4 h-4 text-muted-foreground" /> VPN gateway authorization not required. Machines can be accessed directly using standard interfaces below.
                                        </p>
                                      )}
                                    </div>

                                    {/* Step 2: Machine Details */}
                                    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <CornerDownRight className="w-4 h-4" /> Step 2: Target Range Targets
                                      </h4>
                                      <p className="text-xs text-muted-foreground font-light leading-relaxed">
                                        Locate target server machines on the range subnet. Target private routing coordinates using the credentials specified below.
                                      </p>
                                      {!accessDetailsLoading[dep.deployment_id] && details?.machines?.length ? (
                                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                          <Table>
                                            <TableHeader className="bg-muted/50 border-b border-border">
                                              <TableRow>
                                                <TableHead className="text-muted-foreground font-semibold text-[10px] py-2">Machine Label</TableHead>
                                                <TableHead className="text-muted-foreground font-semibold text-[10px] py-2">Private IP address</TableHead>
                                                <TableHead className="text-muted-foreground font-semibold text-[10px] py-2">Service Port</TableHead>
                                                <TableHead className="text-muted-foreground font-semibold text-[10px] py-2">Protocol</TableHead>
                                                <TableHead className="text-muted-foreground font-semibold text-[10px] py-2">Default Credentials</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {details.machines.map((m) => (
                                                <TableRow key={`${dep.deployment_id}-${m.role}`} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                                                  <TableCell className="py-2 font-bold text-foreground text-xs">{m.label}</TableCell>
                                                  <TableCell className="py-2 font-mono text-xs text-primary">{m.private_ip || m.host || 'Pending'}</TableCell>
                                                  <TableCell className="py-2 text-xs text-muted-foreground">{m.port || '—'}</TableCell>
                                                  <TableCell className="py-2 text-xs text-muted-foreground"><span className="uppercase">{m.protocol}</span></TableCell>
                                                  <TableCell className="py-2 text-xs font-mono text-muted-foreground">{m.credential_label || 'Refer to Scenario guide'}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-xs">
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed font-light">{description}</p>
      <Button
        asChild
        className="bg-primary text-primary-foreground font-bold px-6 py-5 rounded-xl shadow-xs transition-all"
      >
        <Link href={actionHref}>
          {actionLabel}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
      </Button>
    </div>
  )
}
