"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Trophy,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Activity,
  Layers,
  Settings,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  Users,
  FolderPlus,
  UserPlus,
  UserCheck,
  UsersRound,
  CalendarRange,
  Loader2,
  X,
  LayoutDashboard,
  CreditCard
} from "lucide-react"

import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { showToast } from "@/components/toast"
import { cn } from "@/lib/utils"
import { api, apiClient, AdminUser, setToken } from "@/lib/api"
import CTFLeaderboardView from "@/components/CTFLeaderboardView"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { getRoleHome } from "@/lib/role-home"

// Types
interface CTFChallenge {
  id: string
  title: string
  points: number
  difficulty: "Easy" | "Medium" | "Hard"
  category: string
  scenario: string
  instructions: string
  hints: string[]
  flag: string
  solutionText?: string
}

interface CTFLab {
  id: string
  title: string
  description: string
  difficulty: string
  durationLabel: string
  challenges: CTFChallenge[]
}

interface AuditLog {
  timestamp: string
  operator: string
  labTitle: string
  challengeTitle: string
  attemptedFlag: string
  status: "Correct" | "Incorrect"
}

export default function StandaloneAdminCTFControl() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }
    if (user?.role !== "sys_admin" && user?.role !== "course_admin") {
      router.replace(getRoleHome(user?.role))
    }
  }, [isLoading, isAuthenticated, user, router])

  const [labs, setLabs] = useState<CTFLab[]>([])
  const [selectedLabId, setSelectedLabId] = useState<string>("active-directory")
  const [searchQuery, setSearchQuery] = useState("")
  const [rosterSearchQuery, setRosterSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "scenarios" | "users" | "billing" | "leaderboard">("overview")
  
  // Deployment & operations state
  const [deploymentStatus, setDeploymentStatus] = useState<string>("")
  const [deploymentId, setDeploymentId] = useState<string>("")
  const [deploymentExpiry, setDeploymentExpiry] = useState<string>("")
  const [activeDeploymentCountdown, setActiveDeploymentCountdown] = useState<string>("")
  const [isPushing, setIsPushing] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [vpnCommand, setVpnCommand] = useState<string>("")
  const [showVpnModal, setShowVpnModal] = useState(false)

  // Modal states
  const [isEditing, setIsEditing] = useState(false)
  const [currentChallenge, setCurrentChallenge] = useState<Partial<CTFChallenge> & { labId?: string }>({})
  const [isCreatingLab, setIsCreatingLab] = useState(false)
  const [newLabData, setNewLabData] = useState<Partial<CTFLab>>({
    id: "",
    title: "",
    description: "",
    difficulty: "Medium",
    durationLabel: "4 Hours"
  })

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [mockLeaderboard, setMockLeaderboard] = useState<any[]>([])
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true)

  // Groups state
  interface StudentGroup {
    id: string
    name: string
    emails: string[]
  }
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const [fetchedEmails, setFetchedEmails] = useState<string[]>([])
  const [isFetchingEmails, setIsFetchingEmails] = useState(false)
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState("")
  const [selectedEmailForAssign, setSelectedEmailForAssign] = useState("")
  const [customEmailInput, setCustomEmailInput] = useState("")
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<"individual" | "group">("individual")

  // Onboarding & live deployment member states
  const [fetchedUsers, setFetchedUsers] = useState<AdminUser[]>([])
  const [onboardEmail, setOnboardEmail] = useState("")
  const [onboardName, setOnboardName] = useState("")
  const [onboardRole, setOnboardRole] = useState("participant")
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false)
  const [selectedGroupForDeployment, setSelectedGroupForDeployment] = useState("")
  const [activeDeploymentMembers, setActiveDeploymentMembers] = useState<any[]>([])
  const [selectedEmailForActiveDep, setSelectedEmailForActiveDep] = useState("")
  const [customEmailForActiveDep, setCustomEmailForActiveDep] = useState("")

  // Scheduling states
  interface ScheduledLab {
    id: string
    labId: string
    labTitle: string
    groupId: string
    groupName: string
    startTime: string // ISO string
    durationHours: number
    status: "scheduled" | "started" | "expired"
    deploymentId?: string
  }
  const [scheduledLabs, setScheduledLabs] = useState<ScheduledLab[]>([])
  const [scheduleStartTime, setScheduleStartTime] = useState("")
  const [scheduleDuration, setScheduleDuration] = useState("4")
  const [scheduleGroupId, setScheduleGroupId] = useState("")

  // Billing & Payment States
  const [payments, setPayments] = useState<any[]>([])
  const [isFetchingPayments, setIsFetchingPayments] = useState(false)
  const [selectedUserForPayment, setSelectedUserForPayment] = useState("")
  const [selectedLabForPayment, setSelectedLabForPayment] = useState("")
  const [isGrantingEntitlement, setIsGrantingEntitlement] = useState(false)

  // Lab Price States
  const [labPrice, setLabPrice] = useState<string>("")
  const [labCurrency, setLabCurrency] = useState<string>("INR")
  const [labPriceActive, setLabPriceActive] = useState<boolean>(true)
  const [isFetchingPrice, setIsFetchingPrice] = useState<boolean>(false)
  const [isSavingPrice, setIsSavingPrice] = useState<boolean>(false)

  const loadLabPrice = async (labId: string) => {
    if (!labId) return
    setIsFetchingPrice(true)
    try {
      const contentUuid = getUuidForId(labId)
      const res = await api.getCoursePrice(contentUuid)
      if (res && res.price) {
        setLabPrice((res.price.amount_minor / 100).toFixed(2))
        setLabCurrency(res.price.currency || "INR")
        setLabPriceActive(!!res.price.is_active)
      } else {
        setLabPrice("")
        setLabCurrency("INR")
        setLabPriceActive(true)
      }
    } catch (err: any) {
      console.warn("Failed to load lab price:", err)
      setLabPrice("")
      setLabCurrency("INR")
      setLabPriceActive(true)
    } finally {
      setIsFetchingPrice(false)
    }
  }

  const saveLabPrice = async () => {
    if (!selectedLabId) return
    const parsed = Number(labPrice)
    if (!labPrice.trim() || !Number.isFinite(parsed) || parsed < 0) {
      showToast("error", "Price must be a valid number greater than or equal to 0")
      return
    }
    const amount_minor = Math.round(parsed * 100)
    setIsSavingPrice(true)
    try {
      const contentUuid = getUuidForId(selectedLabId)
      await api.upsertCoursePrice(contentUuid, {
        amount_minor,
        currency: labCurrency.toUpperCase(),
        is_active: labPriceActive
      })
      showToast("success", "Lab price configuration saved successfully")
      await loadLabPrice(selectedLabId)
    } catch (err: any) {
      showToast("error", err?.message || "Failed to update lab pricing")
    } finally {
      setIsSavingPrice(false)
    }
  }

  // Load lab price whenever selectedLabId changes
  useEffect(() => {
    if (selectedLabId) {
      void loadLabPrice(selectedLabId)
    }
  }, [selectedLabId])

  const defaultMockPayments = [
    { payment_id: "pay_mock_1a2b3c", email: "student_dev@trustx.org", content_title: "Active Directory CyberRange", amount: 1500, currency: "INR", status: "captured", created_at: new Date(Date.now() - 3600000).toISOString() },
    { payment_id: "pay_mock_4d5e6f", email: "matrix_reborn@cyberspace.in", content_title: "crAPI Web API Security Arena", amount: 2000, currency: "INR", status: "captured", created_at: new Date(Date.now() - 7200000).toISOString() }
  ]

  // Auto Grouping states
  const [autoGroupSize, setAutoGroupSize] = useState("5")
  const [autoGroupCount, setAutoGroupCount] = useState("4")
  const [autoGroupType, setAutoGroupType] = useState<"size" | "count" | "all">("all")
  const [showAutoGroupPanel, setShowAutoGroupPanel] = useState(false)

  const getUuidForId = (rawId: string): string => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawId)) {
      return rawId;
    }
    if (rawId === "active-directory") return "b821e74f-5f35-5f4f-95d7-9ace45b12e18";
    if (rawId === "crapi") return "c8a985b8-fb23-5339-af9a-bc177906c104";
    if (rawId === "initial-access") return "81a81f3e-2327-57d9-815d-2271b5a572cf";
    if (rawId === "click-web-challenge") return "49676e62-5ad9-5ac0-800d-da0fb96a9ab2";
    
    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
      hash = (hash << 5) - hash + rawId.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex}-1111-4111-8111-${hex.repeat(2).substring(0, 12)}`;
  }

  const fetchDeploymentMembers = async (depId: string) => {
    if (!depId || !localStorage.getItem("cystar_token")) return
    try {
      apiClient.refreshToken()
      const res = await api.listMembers(depId)
      if (res && res.participants) {
        setActiveDeploymentMembers(res.participants)
      }
    } catch (err) {
      console.warn("Failed to fetch deployment members:", err)
    }
  }

  const checkDeploymentStatus = async () => {
    try {
      const activeLab = labs.find(l => l.id === selectedLabId)
      if (!activeLab) return

      apiClient.refreshToken()
      if (!localStorage.getItem("cystar_token")) return
      
      const res = await apiClient.get<any>("/labs/status")
      if (res.success) {
        const payload = res.data ?? res
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.deployments) ? payload.deployments : [])
        
        const stableUuid = getUuidForId(selectedLabId)
        const normalizedLabId = selectedLabId.toLowerCase().replace(/[^a-z0-9]/g, "")
        
        const deployment = list.find((d: any) => {
          if (d.status === 'expired' || d.status === 'terminated') return false
          const title = (d.lab_title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
          const type = (d.lab_type || "").toLowerCase().replace(/[^a-z0-9]/g, "")
          return title.includes(normalizedLabId) || type.includes(normalizedLabId) ||
                 (selectedLabId === "active-directory" && (type === "lab1" || title.includes("activedirectory"))) ||
                 (selectedLabId === "crapi" && (type === "lab2" || title.includes("crapi"))) ||
                 (d.deployment_id === stableUuid || d.content_id === stableUuid)
        })
        
        if (deployment) {
          setDeploymentStatus(deployment.status)
          setDeploymentId(deployment.deployment_id)
          if (deployment.expires_at) {
            setDeploymentExpiry(deployment.expires_at)
          } else {
            setDeploymentExpiry("")
          }
          fetchDeploymentMembers(deployment.deployment_id)
        } else {
          setDeploymentStatus("")
          setDeploymentId("")
          setDeploymentExpiry("")
          setActiveDeploymentMembers([])
        }
      }
    } catch (err) {
      console.error("Error checking deployment status:", err)
    }
  }

  // Poll deployment status
  useEffect(() => {
    checkDeploymentStatus()
    const interval = setInterval(checkDeploymentStatus, 5000)
    return () => clearInterval(interval)
  }, [selectedLabId, labs])

  // Live countdown timer for active running deployment
  useEffect(() => {
    const updateCountdown = () => {
      if (deploymentStatus !== "running" || !deploymentExpiry) {
        setActiveDeploymentCountdown("")
        return
      }

      const expiryTime = new Date(deploymentExpiry).getTime()
      const now = Date.now()
      const diff = expiryTime - now

      if (diff <= 0) {
        setActiveDeploymentCountdown("Expired / Terminating")
        return
      }

      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)

      const hrsStr = hrs.toString().padStart(2, "0")
      const minsStr = mins.toString().padStart(2, "0")
      const secsStr = secs.toString().padStart(2, "0")

      setActiveDeploymentCountdown(`${hrsStr}h ${minsStr}m ${secsStr}s`)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [deploymentStatus, deploymentExpiry])

  const fetchAdminLeaderboard = async () => {
    if (!isLiveMode) return
    try {
      apiClient.refreshToken()
      if (!localStorage.getItem("cystar_token")) return
      const stableUuid = getUuidForId(selectedLabId)
      const res = await apiClient.get<any>(`/quiz/${stableUuid}/leaderboard?limit=10`)
      const list = res?.data ?? res
      if (Array.isArray(list)) {
        setLeaderboard(list)
      } else {
        setLeaderboard([])
      }
    } catch (err) {
      console.warn("Failed to fetch admin leaderboard:", err)
      setLeaderboard([])
    }
  }

  // Poll admin leaderboard
  useEffect(() => {
    fetchAdminLeaderboard()
    const interval = setInterval(fetchAdminLeaderboard, 5000)
    return () => clearInterval(interval)
  }, [selectedLabId, isLiveMode])

  useEffect(() => {
    handleFetchEmails(true)
    const interval = setInterval(() => handleFetchEmails(true), 5000)
    return () => clearInterval(interval)
  }, [isLiveMode])

  const handlePushScenario = async () => {
    const activeLab = labs.find(l => l.id === selectedLabId)
    if (!activeLab) return
    setIsPushing(true)
    try {
      apiClient.refreshToken()
      if (!localStorage.getItem("cystar_token")) {
        showToast("error", "Not authenticated. Please log in first.")
        setIsPushing(false)
        return
      }
      
      const payload = {
        id: activeLab.id,
        title: activeLab.title,
        description: activeLab.description,
        difficulty: activeLab.difficulty,
        durationLabel: activeLab.durationLabel,
        challenges: activeLab.challenges.map(c => ({
          id: c.id,
          title: c.title,
          points: c.points,
          difficulty: c.difficulty,
          category: c.category,
          scenario: c.scenario,
          instructions: c.instructions,
          hints: c.hints,
          flag: c.flag,
          solutionText: c.solutionText || ""
        }))
      }

      const res = await apiClient.post<{ content_id: string }>("/quiz/admin/push", payload)
      if (res.success && res.data) {
        showToast("success", `Scenario successfully synchronized to backend server! (DB ID: ${res.data.content_id})`)
      } else {
        showToast("error", `Failed to push scenario: ${res.message || "Unknown error"}`)
      }
    } catch (err: any) {
      showToast("error", `Error pushing scenario: ${err.message || err}`)
    } finally {
      setIsPushing(false)
    }
  }

  const handleSpinChallenge = useCallback(async (labIdOverride?: string, groupIdOverride?: string) => {
    const targetLabId = labIdOverride || selectedLabId
    const targetGroupId = groupIdOverride !== undefined ? groupIdOverride : selectedGroupForDeployment

    const activeLab = labs.find(l => l.id === targetLabId)
    if (!activeLab) return
    setIsSpinning(true)
    try {
      if (!localStorage.getItem("cystar_token")) {
        showToast("info", "Offline Mode: Simulating lab deployment...")
        setDeploymentStatus("provisioning")
        setDeploymentId("mock-dep-1234")
        setDeploymentExpiry("")
        setTimeout(() => {
          setDeploymentStatus("running")
          setDeploymentExpiry(new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString())
          if (targetGroupId) {
            const targetGroupObj = groups.find(g => g.id === targetGroupId)
            if (targetGroupObj) {
              const mockMembers = targetGroupObj.emails.map(email => ({
                user_id: `user-${email}`,
                email: email,
                added_by: "admin",
                added_at: new Date().toISOString()
              }))
              setActiveDeploymentMembers(mockMembers)
              showToast("success", `Offline Mode: Assigned ${targetGroupObj.emails.length} students from group "${targetGroupObj.name}".`)
            }
          }
          showToast("success", "Offline Mode: Lab challenge is now RUNNING!")
        }, 2000)
        return "mock-dep-1234"
      }

      apiClient.refreshToken()
      const dbContentId = getUuidForId(activeLab.id)
      const expiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      const res = await apiClient.post<any>("/labs/deploy", {
        content_id: dbContentId,
        expires_at: expiry
      })

      if (res.success && res.data) {
        const depId = res.data.deployment_id
        setDeploymentId(depId)
        setDeploymentStatus("queued")
        showToast("success", `Lab challenge deployment initiated! ID: ${depId}`)

        // If target group is selected, add them as participants!
        if (targetGroupId) {
          const targetGroupObj = groups.find(g => g.id === targetGroupId)
          if (targetGroupObj && targetGroupObj.emails.length > 0) {
            showToast("info", `Assigning ${targetGroupObj.emails.length} students from group "${targetGroupObj.name}" to the deployment...`)
            let addedCount = 0
            for (const email of targetGroupObj.emails) {
              const matchingUser = fetchedUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
              if (matchingUser) {
                try {
                  await api.addDeploymentMember(depId, matchingUser.user_id)
                  addedCount++
                } catch (memberErr) {
                  console.warn(`Failed to add user ${email} to deployment:`, memberErr)
                }
              } else {
                console.warn(`User with email ${email} not found in database to add to deployment.`)
              }
            }
            showToast("success", `Added ${addedCount}/${targetGroupObj.emails.length} students as lab participants!`)
            fetchDeploymentMembers(depId)
          }
        }
        return depId
      } else {
        showToast("error", `Deployment failed: ${res.message || "Ensure the scenario is pushed first."}`)
      }
      return undefined
    } catch (err: any) {
      showToast("error", `Error deploying lab: ${err.message || err}`)
      return undefined
    } finally {
      setIsSpinning(false)
    }
  }, [selectedLabId, selectedGroupForDeployment, labs, groups, fetchedUsers, fetchDeploymentMembers])

  const handleStopChallenge = async () => {
    if (!deploymentId) return
    setIsSpinning(true)
    try {
      if (!localStorage.getItem("cystar_token") || deploymentId === "mock-dep-1234") {
        showToast("info", "Offline Mode: Simulating lab teardown...")
        setDeploymentStatus("terminating")
        setTimeout(() => {
          setDeploymentStatus("")
          setDeploymentId("")
          setActiveDeploymentMembers([])
          showToast("success", "Offline Mode: Lab challenge terminated successfully.")
        }, 1500)
        return
      }

      apiClient.refreshToken()
      const res = await apiClient.post<any>(`/labs/admin/deployments/${deploymentId}/terminate`)
      if (res.success) {
        showToast("success", "Lab infrastructure teardown initiated successfully!")
        setDeploymentStatus("terminating")
      } else {
        showToast("error", `Teardown failed: ${res.message || "Unknown error"}`)
      }
    } catch (err: any) {
      showToast("error", `Error stopping lab: ${err.message || err}`)
    } finally {
      setIsSpinning(false)
    }
  }

  const handleScheduleLab = (e: React.FormEvent) => {
    e.preventDefault()
    const activeLab = labs.find(l => l.id === selectedLabId)
    if (!activeLab) {
      showToast("error", "No lab selected.")
      return
    }
    if (!scheduleStartTime) {
      showToast("error", "Please specify a start time.")
      return
    }
    
    const startMs = new Date(scheduleStartTime).getTime()
    if (isNaN(startMs)) {
      showToast("error", "Invalid start time selected.")
      return
    }

    if (startMs < Date.now() - 60000) {
      showToast("error", "Start time must be in the future.")
      return
    }

    const isStudent = scheduleGroupId.startsWith("student-")
    let groupObj = null
    let groupName = "Individual / No Group"
    let groupId = scheduleGroupId

    if (isStudent) {
      const email = scheduleGroupId.replace("student-", "")
      groupName = `Student: ${email}`
      // Check if a group with this name already exists
      const existingGroup = groups.find(g => g.name === groupName)
      if (existingGroup) {
        groupId = existingGroup.id
      } else {
        const tempGroupId = `group-student-${Date.now()}`
        const newGroup = {
          id: tempGroupId,
          name: groupName,
          emails: [email],
          created_at: new Date().toISOString()
        }
        const token = localStorage.getItem("cystar_token")
        if (token) {
          api.saveCtfGroup(newGroup).catch(err => console.warn("Failed to save student group to backend:", err))
        }
        const updatedGroups = [...groups, newGroup]
        setGroups(updatedGroups)
        if (typeof window !== "undefined") {
          localStorage.setItem("admin_ctf_groups", JSON.stringify(updatedGroups))
        }
        groupId = tempGroupId
      }
    } else if (scheduleGroupId) {
      groupObj = groups.find(g => g.id === scheduleGroupId)
      groupName = groupObj ? groupObj.name : "Individual / No Group"
    }

    const duration = parseFloat(scheduleDuration)
    if (isNaN(duration) || duration <= 0) {
      showToast("error", "Please specify a valid duration in hours.")
      return
    }

    const newScheduledItem: ScheduledLab = {
      id: `scheduled-${Date.now()}`,
      labId: activeLab.id,
      labTitle: activeLab.title,
      groupId: groupId,
      groupName: groupName,
      startTime: new Date(scheduleStartTime).toISOString(),
      durationHours: duration,
      status: "scheduled"
    }

    const updated = [...scheduledLabs, newScheduledItem]
    saveScheduledToStorage(updated)
    setScheduleStartTime("")
    showToast("success", `Lab "${activeLab.title}" successfully scheduled for ${new Date(scheduleStartTime).toLocaleString()}!`)
  }

  const handleCancelSchedule = (id: string) => {
    const updated = scheduledLabs.filter(item => item.id !== id)
    saveScheduledToStorage(updated)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cystar_token")
      if (token) {
        api.deleteCtfSchedule(id).catch(err => console.warn("Failed to delete schedule from backend:", err))
      }
    }
    showToast("info", "Scheduled lab deployment cancelled.")
  }

  const handleStartScheduleImmediately = async (itemId: string) => {
    let depId: string | undefined = undefined
    const updated = await Promise.all(scheduledLabs.map(async item => {
      if (item.id === itemId) {
        showToast("info", `Starting lab: "${item.labTitle}" immediately...`)
        depId = await handleSpinChallenge(item.labId, item.groupId)
        return {
          ...item,
          startTime: new Date().toISOString(),
          status: "started" as const,
          deploymentId: depId
        }
      }
      return item
    }))
    saveScheduledToStorage(updated)
  }

  const handleStopScheduleImmediately = async (itemId: string) => {
    let deploymentToTerminate: string | undefined = undefined
    const updated = scheduledLabs.map(item => {
      if (item.id === itemId) {
        showToast("info", `Stopping lab: "${item.labTitle}" immediately...`)
        deploymentToTerminate = item.deploymentId
        return {
          ...item,
          status: "expired" as const
        }
      }
      return item
    })

    if (deploymentToTerminate) {
      try {
        if (!localStorage.getItem("cystar_token") || deploymentToTerminate === "mock-dep-1234") {
          showToast("success", "Offline Mode: Simulated teardown of scheduled lab.")
        } else {
          const res = await apiClient.post<any>(`/labs/admin/deployments/${deploymentToTerminate}/terminate`)
          if (res.success) {
            showToast("success", "Teardown of scheduled lab initiated successfully!")
          } else {
            showToast("error", `Teardown failed: ${res.message || "Unknown error"}`)
          }
        }
      } catch (err: any) {
        showToast("error", `Error stopping lab: ${err.message || err}`)
      }
    }

    saveScheduledToStorage(updated)
  }

  const handleToggleUserCtfVisibility = async () => {
    const activeLab = labs.find(l => l.id === selectedLabId) || labs[0]
    if (!activeLab) return

    const existingActive = scheduledLabs.find(item => item.labId === activeLab.id && item.status === "started")

    if (existingActive) {
      showToast("info", `Hiding lab "${activeLab.title}" from user CTF arena...`)
      await handleStopScheduleImmediately(existingActive.id)
      showToast("success", `Lab "${activeLab.title}" hidden from user CTF arena.`)
    } else {
      showToast("info", `Making lab "${activeLab.title}" visible in user CTF arena...`)
      
      const groupId = selectedGroupForDeployment || ""
      const groupName = groupId ? (groups.find(g => g.id === groupId)?.name || "Target Group") : "All Users"
      
      const newScheduledItem: ScheduledLab = {
        id: `schedule-${activeLab.id}-${Date.now()}`,
        labId: activeLab.id,
        labTitle: activeLab.title,
        groupId: groupId,
        groupName: groupName,
        startTime: new Date().toISOString(),
        durationHours: 24,
        status: "started"
      }

      const updated = [...scheduledLabs, newScheduledItem]
      saveScheduledToStorage(updated)
      showToast("success", `Lab "${activeLab.title}" is now visible in user CTF arena!`)
    }
  }

  // Periodic schedule checker
  useEffect(() => {
    const checkSchedules = async () => {
      const now = new Date()
      let updatedList = [...scheduledLabs]
      let listChanged = false

      for (let i = 0; i < updatedList.length; i++) {
        const item = updatedList[i]
        if (item.status === "scheduled") {
          const startTime = new Date(item.startTime)
          if (startTime <= now) {
            // Trigger the spin!
            showToast("info", `Triggering scheduled lab: "${item.labTitle}" for group "${item.groupName}"...`)
            const depId = await handleSpinChallenge(item.labId, item.groupId)
            
            // Mark as started
            updatedList[i] = {
              ...item,
              status: "started",
              deploymentId: depId
            }
            listChanged = true
          }
        } else if (item.status === "started") {
          const startTime = new Date(item.startTime)
          const durationMs = item.durationHours * 60 * 60 * 1000
          const endTime = new Date(startTime.getTime() + durationMs)
          if (now >= endTime) {
            // Terminate deployment if exists
            if (item.deploymentId) {
              try {
                showToast("info", `Teardown of scheduled lab: "${item.labTitle}" initiated...`)
                if (localStorage.getItem("cystar_token") && item.deploymentId !== "mock-dep-1234") {
                  await apiClient.post(`/labs/admin/deployments/${item.deploymentId}/terminate`)
                }
              } catch (err) {
                console.warn(`Failed to auto-terminate deployment ${item.deploymentId}:`, err)
              }
            }
            updatedList[i] = {
              ...item,
              status: "expired"
            }
            listChanged = true
            showToast("info", `Scheduled lab: "${item.labTitle}" session has ended (expired).`)
          }
        }
      }

      if (listChanged) {
        saveScheduledToStorage(updatedList)
      }
    }

    const interval = setInterval(checkSchedules, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [scheduledLabs, handleSpinChallenge])

  const handleJoinNetwork = async () => {
    if (!deploymentId) return
    try {
      apiClient.refreshToken()
      const res = await api.joinLab(deploymentId)
      if (res && res.command) {
        setVpnCommand(res.command)
        setShowVpnModal(true)
      } else {
        showToast("error", "Failed to retrieve VPN join command")
      }
    } catch (err: any) {
      showToast("error", `Error joining VPN network: ${err.message || err}`)
    }
  }

  // Default CTF Labs list data structure
  const defaultLabs: CTFLab[] = [
    {
      id: "click-web-challenge",
      title: "Challenge 1 - ClickFix Pastejacking",
      description: "Analyze the ClickFix pastejacking payload and retrieve the flag from the live target environment.",
      difficulty: "Easy",
      durationLabel: "1 Hour",
      challenges: [
        {
          id: "click-web-1",
          title: "ClickFix Pastejacking Analysis",
          points: 100,
          difficulty: "Easy",
          category: "Web / Pastejacking",
          scenario: "Access the target challenge site and inspect the social engineering payload designed to trick users into executing malicious PowerShell commands via clipboard hijacking.",
          instructions: "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Analyze the page and extract the flag.",
          hints: ["Visit the page and inspect the copy-to-clipboard functionality.", "Check how the script intercepts keypresses or click events to modify the clipboard content."],
          flag: "flag{cstar_clickfix_paste_success}",
          solutionText: "Visit the live challenge at https://click-web.cyberrange.kctf.cloud. Follow the steps to analyze the payload."
        }
      ]
    },
    {
      id: "active-directory",
      title: "Active Directory CyberRange",
      description: "Multi-forest AD environment designed for practicing initial access, privilege escalation, and lateral movement.",
      difficulty: "Medium",
      durationLabel: "4 Hours",
      challenges: [
        {
          id: "ad-1",
          title: "Reconnaissance & Initial Entry",
          points: 100,
          difficulty: "Easy",
          category: "Recon / Access",
          scenario: "You are connected to the internal LAN via VPN. Your first step is to scan the domain subnet, discover active hosts, and find an entry vector on the user workstation (WS01).",
          instructions: "Perform an Nmap scan on the workstation IP `10.10.10.50`. Locate the open HTTP service and find the developers secret token in the webpage metadata or source notes.\n\nFlag format: flag{secret_string}",
          hints: ["Check port 80/http on 10.10.10.50.", "Inspect the HTML comments in the developer staging page index source."],
          flag: "flag{cstar_ad_phish_access}",
          solutionText: "Use `nmap -sS -p80 10.10.10.50` to find the running web page. View-source:http://10.10.10.50/ and check the bottom comment block."
        },
        {
          id: "ad-2",
          title: "Local Privilege Escalation",
          points: 150,
          difficulty: "Medium",
          category: "PrivEsc",
          scenario: "You have compromised a low-privilege user session (`j.doe`) on the workstation `10.10.10.50`. You need to escalate privileges to local Administrator.",
          instructions: "Enumerate the system for misconfigurations. Check scheduled tasks. A poorly configured scheduled task executes a backup binary with high privileges. Replace the binary or hijack the execution path to retrieve the flag located in `C:\\Users\\Administrator\\Desktop\\flag.txt`.",
          hints: ["Run `schtasks /query /fo LIST /v` to inspect scheduled tasks.", "Check the folder write permissions on the BackupAgent executable path."],
          flag: "flag{cstar_ad_local_admin}",
          solutionText: "Run winPEAS or query scheduled tasks. Note that C:\\Program Files\\BackupAgent\\backup.exe is writeable by Authenticated Users. Overwrite it with a shell payload."
        }
      ]
    },
    {
      id: "crapi",
      title: "crAPI Web API Security Arena",
      description: "OWASP API Top 10 training environment focusing on vehicle portals, token exploits, mass assignment, and SSRF vulnerabilities.",
      difficulty: "Medium",
      durationLabel: "3 Hours",
      challenges: [
        {
          id: "crapi-1",
          title: "Broken Object Level Authorization (BOLA)",
          points: 100,
          difficulty: "Easy",
          category: "BOLA",
          scenario: "The crAPI application lets users view their own vehicle location coordinates. The REST endpoint checks coordinates based on vehicle ID UUIDs.",
          instructions: "Log in with your learner account and view your dashboard network calls. Identify the API endpoint `/identity/api/v1/vehicles/{id}/location`. Modify the request UUID to match another vehicle to leak coordinates and find the validation key flag.",
          hints: ["Check the Community forum posts. User profiles disclose vehicle UUID values in public payloads.", "Swap your vehicle ID in the Location request in Burp Suite or developer tools."],
          flag: "flag{cstar_crapi_bola_uuid}",
          solutionText: "Retrieve vehicle ID from public community posts, then GET /identity/api/v1/vehicles/OTHER_VEHICLE_UUID/location to extract coordinates containing flag."
        }
      ]
    },
    {
      id: "initial-access",
      title: "Initial Access Vectors & Smuggling",
      description: "Simulated initial access operations focusing on pastejacking (ClickFix), HTML smuggling, and malicious LNK delivery payloads.",
      difficulty: "Easy",
      durationLabel: "2 Hours",
      challenges: [
        {
          id: "ia-1",
          title: "HTML Smuggling Analysis",
          points: 100,
          difficulty: "Easy",
          category: "HTML Smuggling",
          scenario: "A target user was sent an HTML attachment which downloaded a malware payload locally without triggering perimeter gateway alarms.",
          instructions: "Analyze the provided smuggle script. The script uses Javascript Blob and URL.createObjectURL to compile a payload in the browser. Decode the base64 payload block in the script to find the hidden flag file content.",
          hints: ["Locate the base64-encoded string representing the file payload inside the HTML script tags.", "Decode it using cyberchef or terminal commands: `echo <base64> | base64 -d`."],
          flag: "flag{cstar_html_smuggle_blob}",
          solutionText: "Extract the base64 data array variable inside the HTML script block. Decode using command line base64 -d."
        },
        {
          id: "ia-2",
          title: "ClickFix Pastejacking Script",
          points: 120,
          difficulty: "Medium",
          category: "Pastejacking",
          scenario: "A social engineering vector tricks users into pressing Win+R, pasting a command from their clipboard, and pressing Enter to 'fix' a page error.",
          instructions: "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Follow the instructions to analyze the ClickFix pastejacking payload and retrieve the flag.",
          hints: ["Find the Base64 command inside the powershell argument `-enc` or `-EncodedCommand`.", "Decode the UTF-16LE / Unicode base64 bytes to get the plain text script."],
          flag: "flag{cstar_clickfix_cmd_exec}",
          solutionText: "Decode the powershell encoded payload block. Remember Windows powershell uses Unicode (UTF-16LE) base64 formatting."
        }
      ]
    }
  ]

  // Default simulated audit logs
  const defaultAuditLogs: AuditLog[] = [
    { timestamp: "2026-06-22 09:30:15", operator: "j.doe@academy.io", labTitle: "Active Directory CyberRange", challengeTitle: "Reconnaissance & Initial Entry", attemptedFlag: "flag{cstar_ad_phish_access}", status: "Correct" },
    { timestamp: "2026-06-22 09:28:44", operator: "guest_user@cystar.io", labTitle: "crAPI Web API Security Arena", challengeTitle: "Broken Object Level Authorization (BOLA)", attemptedFlag: "flag{bola_bypass_123}", status: "Incorrect" },
    { timestamp: "2026-06-22 09:25:12", operator: "admin_tester@cyberrange.in", labTitle: "Active Directory CyberRange", challengeTitle: "Local Privilege Escalation", attemptedFlag: "flag{cstar_ad_local_admin}", status: "Correct" }
  ]

  const defaultMockLeaderboard = [
    { name: "Matrix Reborn", email: "matrix_reborn@cyberspace.in", totalPoints: 400, totalTimeSpent: 1100, completedChallenges: 3 },
    { name: "Student Dev", email: "student_dev@trustx.org", totalPoints: 250, totalTimeSpent: 1400, completedChallenges: 2 },
    { name: "Pwn Master", email: "pwn_master@academy.local", totalPoints: 600, totalTimeSpent: 1600, completedChallenges: 4 },
    { name: "Guest User", email: "guest_user@cystar.io", totalPoints: 100, totalTimeSpent: 600, completedChallenges: 1 },
    { name: "John Doe", email: "j.doe@academy.io", totalPoints: 200, totalTimeSpent: 900, completedChallenges: 2 }
  ]

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedLabs = localStorage.getItem("admin_ctf_labs")
      const storedLogs = localStorage.getItem("admin_ctf_logs")
      const storedMockLeaderboard = localStorage.getItem("admin_ctf_mock_leaderboard")
      const storedGroups = localStorage.getItem("admin_ctf_groups")
      const token = localStorage.getItem("cystar_token")
      
      setIsLiveMode(!!token)
      if (typeof window !== "undefined" && !window.Razorpay) {
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.async = true
        document.body.appendChild(script)
      }
      if (token) {
        api.adminBillingPayments({ limit: 100 }).then(data => {
          if (data && data.rows) {
            setPayments(data.rows)
            localStorage.setItem("admin_ctf_payments", JSON.stringify(data.rows))
          }
        }).catch(err => console.warn("Failed to fetch payments on mount:", err))

        // Fetch live CTF groups
        api.listCtfGroups().then(groupList => {
          if (groupList && groupList.length > 0) {
            setGroups(groupList)
            setSelectedGroupForAssign(groupList[0].id)
            localStorage.setItem("admin_ctf_groups", JSON.stringify(groupList))
          }
        }).catch(err => console.warn("Failed to fetch ctf groups on mount:", err))

        // Fetch live CTF schedules
        api.listCtfSchedules().then(scheduleList => {
          if (scheduleList) {
            setScheduledLabs(scheduleList)
            localStorage.setItem("admin_ctf_scheduled_labs", JSON.stringify(scheduleList))
          }
        }).catch(err => console.warn("Failed to fetch ctf schedules on mount:", err))
      }

      if (storedLabs) {
        try {
          const parsed = JSON.parse(storedLabs)
          let updated = false
          if (!parsed.some((l: any) => l.id === "initial-access")) {
            const initialAccessLab = defaultLabs.find(l => l.id === "initial-access")
            if (initialAccessLab) {
              parsed.push(initialAccessLab)
              updated = true
            }
          }
          if (!parsed.some((l: any) => l.id === "click-web-challenge")) {
            const clickWebLab = defaultLabs.find(l => l.id === "click-web-challenge")
            if (clickWebLab) {
              parsed.unshift(clickWebLab)
              updated = true
            }
          }
          if (updated) {
            localStorage.setItem("admin_ctf_labs", JSON.stringify(parsed))
          }
          setLabs(parsed)
        } catch {
          setLabs(defaultLabs)
        }
      } else {
        setLabs(defaultLabs)
        localStorage.setItem("admin_ctf_labs", JSON.stringify(defaultLabs))
      }

      if (storedLogs) {
        try {
          setAuditLogs(JSON.parse(storedLogs))
        } catch {
          setAuditLogs(defaultAuditLogs)
        }
      } else {
        setAuditLogs(defaultAuditLogs)
        localStorage.setItem("admin_ctf_logs", JSON.stringify(defaultAuditLogs))
      }

      if (storedMockLeaderboard) {
        try {
          setMockLeaderboard(JSON.parse(storedMockLeaderboard))
        } catch {
          setMockLeaderboard(defaultMockLeaderboard)
        }
      } else {
        setMockLeaderboard(defaultMockLeaderboard)
        localStorage.setItem("admin_ctf_mock_leaderboard", JSON.stringify(defaultMockLeaderboard))
      }

      if (storedGroups) {
        try {
          const parsed = JSON.parse(storedGroups)
          setGroups(parsed)
          if (parsed.length > 0) {
            setSelectedGroupForAssign(parsed[0].id)
          }
        } catch {
          setGroups([])
        }
      }

      const storedScheduled = localStorage.getItem("admin_ctf_scheduled_labs")
      if (storedScheduled) {
        try {
          setScheduledLabs(JSON.parse(storedScheduled))
        } catch {
          setScheduledLabs([])
        }
      }

      const storedPayments = localStorage.getItem("admin_ctf_payments")
      if (storedPayments) {
        try {
          setPayments(JSON.parse(storedPayments))
        } catch {
          setPayments(defaultMockPayments)
        }
      } else {
        setPayments(defaultMockPayments)
        localStorage.setItem("admin_ctf_payments", JSON.stringify(defaultMockPayments))
      }
    }
  }, [])

  // Sync state helpers
  const savePaymentsToStorage = (updatedPayments: any[]) => {
    setPayments(updatedPayments)
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_ctf_payments", JSON.stringify(updatedPayments))
    }
  }

  const saveScheduledToStorage = (updatedScheduled: ScheduledLab[]) => {
    setScheduledLabs(updatedScheduled)
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_ctf_scheduled_labs", JSON.stringify(updatedScheduled))
      const token = localStorage.getItem("cystar_token")
      if (token) {
        updatedScheduled.forEach(s => {
          api.saveCtfSchedule(s).catch(err => console.warn("Failed to sync schedule:", err))
        })
      }
    }
  }

  const saveLabsToStorage = (updatedLabs: CTFLab[]) => {
    setLabs(updatedLabs)
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_ctf_labs", JSON.stringify(updatedLabs))
      // Also sync standard player catalog options if needed
    }
  }

  const saveLogsToStorage = (updatedLogs: AuditLog[]) => {
    setAuditLogs(updatedLogs)
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_ctf_logs", JSON.stringify(updatedLogs))
    }
  }

  const saveGroupsToStorage = (updatedGroups: StudentGroup[]) => {
    setGroups(updatedGroups)
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_ctf_groups", JSON.stringify(updatedGroups))
      const token = localStorage.getItem("cystar_token")
      if (token) {
        updatedGroups.forEach(g => {
          api.saveCtfGroup(g).catch(err => console.warn("Failed to sync group:", err))
        })
      }
    }
  }

  // Create Lab Scenario Handler
  const handleCreateLab = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabData.id || !newLabData.title) {
      showToast("error", "Lab ID and Title are required.")
      return
    }

    const updated = [
      ...labs,
      {
        id: newLabData.id,
        title: newLabData.title,
        description: newLabData.description || "",
        difficulty: newLabData.difficulty || "Medium",
        durationLabel: newLabData.durationLabel || "4 Hours",
        challenges: []
      }
    ]

    saveLabsToStorage(updated)
    setNewLabData({ id: "", title: "", description: "", difficulty: "Medium", durationLabel: "4 Hours" })
    setIsCreatingLab(false)
    showToast("success", "CTF Lab Scenario successfully created.")
  }

  // Add / Edit Challenge Handler
  const handleSaveChallenge = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentChallenge.title || !currentChallenge.flag || currentChallenge.points === undefined) {
      showToast("error", "Title, Points, and Flag are required.")
      return
    }

    const targetLabId = currentChallenge.labId || selectedLabId
    const updated = labs.map((lab) => {
      if (lab.id !== targetLabId) return lab

      const chalList = [...lab.challenges]
      if (currentChallenge.id) {
        // Edit existing
        const idx = chalList.findIndex(c => c.id === currentChallenge.id)
        if (idx !== -1) {
          chalList[idx] = {
            id: currentChallenge.id,
            title: currentChallenge.title || "",
            points: Number(currentChallenge.points) || 0,
            difficulty: currentChallenge.difficulty || "Medium",
            category: currentChallenge.category || "General",
            scenario: currentChallenge.scenario || "",
            instructions: currentChallenge.instructions || "",
            hints: currentChallenge.hints || [],
            flag: currentChallenge.flag || "",
            solutionText: currentChallenge.solutionText || ""
          }
        }
      } else {
        // Create new
        const newId = `${lab.id}-${Date.now()}`
        chalList.push({
          id: newId,
          title: currentChallenge.title || "",
          points: Number(currentChallenge.points) || 0,
          difficulty: currentChallenge.difficulty || "Medium",
          category: currentChallenge.category || "General",
          scenario: currentChallenge.scenario || "",
          instructions: currentChallenge.instructions || "",
          hints: currentChallenge.hints || [],
          flag: currentChallenge.flag || "",
          solutionText: currentChallenge.solutionText || ""
        })
      }
      return { ...lab, challenges: chalList }
    })

    saveLabsToStorage(updated)
    setIsEditing(false)
    setCurrentChallenge({})
    showToast("success", "Challenge settings successfully saved.")
  }

  // Delete Challenge Handler
  const handleDeleteChallenge = (labId: string, challengeId: string) => {
    const updated = labs.map((lab) => {
      if (lab.id !== labId) return lab
      return {
        ...lab,
        challenges: lab.challenges.filter(c => c.id !== challengeId)
      }
    })
    saveLabsToStorage(updated)
    showToast("success", "Challenge deleted.")
  }

  // Add hint helper
  const handleAddHintField = () => {
    setCurrentChallenge(prev => ({
      ...prev,
      hints: [...(prev.hints || []), ""]
    }))
  }

  // Edit hint value helper
  const handleHintChange = (idx: number, val: string) => {
    const updatedHints = [...(currentChallenge.hints || [])]
    updatedHints[idx] = val
    setCurrentChallenge(prev => ({ ...prev, hints: updatedHints }))
  }

  // Delete hint field helper
  const handleRemoveHintField = (idx: number) => {
    setCurrentChallenge(prev => ({
      ...prev,
      hints: (prev.hints || []).filter((_, i) => i !== idx)
    }))
  }

  // Trigger simulated player flag event log
  const handleSimulateEvent = () => {
    const ops = ["matrix_reborn@cyberspace.in", "student_dev@trustx.org", "pwn_master@academy.local", "guest_user@cystar.io", "j.doe@academy.io"]
    const flags = ["flag{incorrect_flag_attempt}", "flag{cstar_ad_phish_access}", "flag{cstar_crapi_bola_uuid}"]
    
    const randomOp = ops[Math.floor(Math.random() * ops.length)]
    const randomLab = labs[Math.floor(Math.random() * labs.length)]
    
    if (!randomLab || randomLab.challenges.length === 0) return

    const randomChal = randomLab.challenges[Math.floor(Math.random() * randomLab.challenges.length)]
    const isCorrect = Math.random() > 0.5
    const flagAttempt = isCorrect ? randomChal.flag : flags[Math.floor(Math.random() * flags.length)]
    
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    const newLog: AuditLog = {
      timestamp,
      operator: randomOp,
      labTitle: randomLab.title,
      challengeTitle: randomChal.title,
      attemptedFlag: flagAttempt,
      status: isCorrect ? "Correct" : "Incorrect"
    }

    const updatedLogs = [newLog, ...auditLogs].slice(0, 50)
    saveLogsToStorage(updatedLogs)

    // Update mock leaderboard if correct
    if (isCorrect && !isLiveMode) {
      const updatedMock = mockLeaderboard.map(student => {
        if (student.email.toLowerCase() === randomOp.toLowerCase()) {
          return {
            ...student,
            totalPoints: student.totalPoints + randomChal.points,
            totalTimeSpent: student.totalTimeSpent + Math.floor(Math.random() * 200) + 30,
            completedChallenges: (student.completedChallenges || 0) + 1
          }
        }
        return student
      })
      setMockLeaderboard(updatedMock)
      localStorage.setItem("admin_ctf_mock_leaderboard", JSON.stringify(updatedMock))
    }

    showToast(isCorrect ? "success" : "error", `Telemetry: Flag submission simulated from ${randomOp}`)
  }

  // Clear Audit Logs
  const handleClearLogs = () => {
    saveLogsToStorage([])
    showToast("success", "Audit telemetry log cleared.")
  }

  // Reset to Defaults
  const handleResetToDefaults = () => {
    saveLabsToStorage(defaultLabs)
    saveLogsToStorage(defaultAuditLogs)
    setMockLeaderboard(defaultMockLeaderboard)
    localStorage.setItem("admin_ctf_mock_leaderboard", JSON.stringify(defaultMockLeaderboard))
    saveGroupsToStorage([])
    showToast("success", "Default scenarios, challenges, mock leaderboard and groups restored.")
  }

  // Fetch payments list
  const fetchPayments = async () => {
    setIsFetchingPayments(true)
    try {
      if (!localStorage.getItem("cystar_token")) {
        // Offline / Sandbox Mode: Load from localStorage
        const stored = localStorage.getItem("admin_ctf_payments")
        if (stored) {
          setPayments(JSON.parse(stored))
        } else {
          setPayments(defaultMockPayments)
        }
        return
      }

      // Live Mode
      const data = await api.adminBillingPayments({ limit: 100 })
      if (data && data.rows) {
        setPayments(data.rows)
        localStorage.setItem("admin_ctf_payments", JSON.stringify(data.rows))
      }
    } catch (err: any) {
      console.warn("Failed to fetch admin billing payments:", err)
      // Fallback
      const stored = localStorage.getItem("admin_ctf_payments")
      if (stored) setPayments(JSON.parse(stored))
    } finally {
      setIsFetchingPayments(false)
    }
  }

  // Grant manual entitlement (process mock payment)
  const handleGrantEntitlement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserForPayment) {
      showToast("error", "Please select a student user.")
      return
    }
    if (!selectedLabForPayment) {
      showToast("error", "Please select a target lab.")
      return
    }

    const targetLabObj = labs.find(l => l.id === selectedLabForPayment)
    if (!targetLabObj) {
      showToast("error", "Target lab not found.")
      return
    }

    setIsGrantingEntitlement(true)
    try {
      if (!localStorage.getItem("cystar_token")) {
        // Offline / Sandbox mode
        const targetUserObj = fetchedUsers.find(u => u.user_id === selectedUserForPayment)
        const emailStr = targetUserObj ? targetUserObj.email : "manual_sandbox@cyberrange.in"
        const mockNewPayment = {
          payment_id: `pay_mock_${Date.now()}`,
          email: emailStr,
          content_title: targetLabObj.title,
          amount: 0,
          currency: "INR",
          status: "captured",
          created_at: new Date().toISOString()
        }

        const updated = [mockNewPayment, ...payments]
        savePaymentsToStorage(updated)
        showToast("success", `Lab entitlement manually processed! Student ${emailStr} now has active access.`)
        setSelectedUserForPayment("")
        setSelectedLabForPayment("")
        return
      }

      // Live mode
      const dbContentId = getUuidForId(targetLabObj.id)
      const res = await api.adminGrantEntitlement(selectedUserForPayment, dbContentId)
      if (res && res.status === "success") {
        showToast("success", `Manual billing entitlement granted successfully in database!`)
        setSelectedUserForPayment("")
        setSelectedLabForPayment("")
        fetchPayments()
      } else {
        showToast("error", "Failed to grant manual entitlement.")
      }
    } catch (err: any) {
      showToast("error", `Error processing entitlement: ${err.message || err}`)
    } finally {
      setIsGrantingEntitlement(false)
    }
  }

  // Initiate payment/checkout flow
  const handleInitiateCheckout = async () => {
    if (!selectedLabForPayment) {
      showToast("error", "Please select a target lab to checkout.")
      return
    }

    const targetLabObj = labs.find(l => l.id === selectedLabForPayment)
    if (!targetLabObj) {
      showToast("error", "Target lab not found.")
      return
    }

    const dbContentId = getUuidForId(targetLabObj.id)

    if (!localStorage.getItem("cystar_token")) {
      // Offline / Sandbox Mode: Simulate successful checkout instantly
      showToast("info", "Sandbox Mode: Simulating checkout payment...")
      const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 15)}`
      
      const targetUserObj = fetchedUsers.find(u => u.user_id === selectedUserForPayment)
      const emailStr = targetUserObj ? targetUserObj.email : "sandbox_purchaser@cyberrange.dev"

      const mockNewPayment = {
        payment_id: mockPaymentId,
        email: emailStr,
        content_title: targetLabObj.title,
        amount: 1500,
        currency: "INR",
        status: "captured",
        created_at: new Date().toISOString()
      }

      const updated = [mockNewPayment, ...payments]
      savePaymentsToStorage(updated)
      showToast("success", `Payment simulated successfully! Transaction ID: ${mockPaymentId}`)
      setSelectedUserForPayment("")
      setSelectedLabForPayment("")
      return
    }

    setIsGrantingEntitlement(true)
    try {
      showToast("info", "Generating Razorpay checkout order...")
      const res = (await apiClient.createCheckout(dbContentId, selectedUserForPayment)) as any
      if (res && res.success === false) {
        throw new Error(res.message || res.error || "Could not create order")
      }

      if (res.razorpay_order_id && res.razorpay_order_id.startsWith("order_mock_")) {
        // Mock gateway verify capture directly
        showToast("info", "Mock gateway detected. Verifying payment capture...")
        const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 15)}`
        await apiClient.verifyPayment(res.razorpay_order_id, mockPaymentId, "mock_signature", selectedUserForPayment)
        showToast("success", `Mock payment successful! Entitlement created.`)
        setSelectedUserForPayment("")
        setSelectedLabForPayment("")
        fetchPayments()
        return
      }

      if (!window.Razorpay) {
        showToast("error", "Razorpay SDK is not loaded. Please try again.")
        return
      }

      const targetUserObj = fetchedUsers.find(u => u.user_id === selectedUserForPayment)
      const prefillEmail = targetUserObj ? targetUserObj.email : undefined

      const options = {
        key: res.razorpay_key_id,
        amount: res.amount_minor,
        currency: res.currency,
        order_id: res.razorpay_order_id,
        name: "RangeOps Admin Portal",
        description: targetLabObj.title,
        prefill: prefillEmail ? { email: prefillEmail } : undefined,
        theme: { color: "#10b981" },
        handler: async (response: any) => {
          showToast("info", "Verifying payment capture...")
          try {
            await apiClient.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              selectedUserForPayment,
            )
            showToast("success", "Payment captured and verified successfully!")
            setSelectedUserForPayment("")
            setSelectedLabForPayment("")
            fetchPayments()
          } catch (err: any) {
            showToast("error", `Verification failed: ${err.message || err}`)
          }
        },
        modal: {
          ondismiss: () => {
            showToast("info", "Checkout dismissed by user.")
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err: any) {
      showToast("error", `Checkout generation failed: ${err.message || err}`)
    } finally {
      setIsGrantingEntitlement(false)
    }
  }

  // Group Management handlers
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) {
      showToast("error", "Group name cannot be empty.")
      return
    }
    const exists = groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())
    if (exists) {
      showToast("error", "A group with this name already exists.")
      return
    }
    const newGroup: StudentGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      emails: []
    }
    const updated = [...groups, newGroup]
    saveGroupsToStorage(updated)
    setNewGroupName("")
    if (!selectedGroupForAssign) {
      setSelectedGroupForAssign(newGroup.id)
    }
    showToast("success", `Group "${newGroup.name}" created successfully.`)
  }

  const handleDeleteGroup = (groupId: string) => {
    const updated = groups.filter(g => g.id !== groupId)
    saveGroupsToStorage(updated)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cystar_token")
      if (token) {
        api.deleteCtfGroup(groupId).catch(err => console.warn("Failed to delete group from backend:", err))
      }
    }
    showToast("success", "Group deleted successfully.")
  }

  const handleAssignStudent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroupForAssign) {
      showToast("error", "Please select a target group.")
      return
    }
    
    let targetEmail = selectedEmailForAssign
    if (customEmailInput.trim()) {
      targetEmail = customEmailInput.trim()
    }
    
    if (!targetEmail) {
      showToast("error", "Please select or type a student email.")
      return
    }
    
    if (!targetEmail.includes("@")) {
      showToast("error", "Please enter a valid email address.")
      return
    }

    const groupIndex = groups.findIndex(g => g.id === selectedGroupForAssign)
    if (groupIndex === -1) return
    
    const targetGroup = groups[groupIndex]
    if (targetGroup.emails.some(email => email.toLowerCase() === targetEmail.toLowerCase())) {
      showToast("error", "This student is already a member of the selected group.")
      return
    }

    const updated = groups.map((g) => {
      const filteredEmails = g.emails.filter(email => email.toLowerCase() !== targetEmail.toLowerCase())
      if (g.id === selectedGroupForAssign) {
        return {
          ...g,
          emails: [...filteredEmails, targetEmail]
        }
      }
      return {
        ...g,
        emails: filteredEmails
      }
    })

    saveGroupsToStorage(updated)
    setCustomEmailInput("")
    showToast("success", `Student ${targetEmail} assigned to "${targetGroup.name}".`)
  }

  const handleRemoveStudentFromGroup = (groupId: string, emailToRemove: string) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          emails: g.emails.filter(email => email !== emailToRemove)
        }
      }
      return g
    })
    saveGroupsToStorage(updated)
    showToast("success", `Removed ${emailToRemove} from group.`)
  }

  const handleAssignStudentDirectly = (groupId: string, email: string) => {
    if (!groupId) return
    const targetGroup = groups.find(g => g.id === groupId)
    if (!targetGroup) return

    // Remove student from any other group first to enforce clean 1-student-to-1-group assignment
    const updated = groups.map((g) => {
      const cleanedEmails = g.emails.filter(e => e.toLowerCase() !== email.toLowerCase())
      if (g.id === groupId) {
        return {
          ...g,
          emails: [...cleanedEmails, email]
        }
      }
      return {
        ...g,
        emails: cleanedEmails
      }
    })
    setGroups(updated)
    saveGroupsToStorage(updated)
    showToast("success", `Successfully added ${email} to group "${targetGroup.name}".`)
  }

  const handleRemoveStudentFromAllGroups = (email: string) => {
    const updated = groups.map((g) => ({
      ...g,
      emails: g.emails.filter(e => e.toLowerCase() !== email.toLowerCase())
    }))
    setGroups(updated)
    saveGroupsToStorage(updated)
    showToast("success", `Removed ${email} from all groups.`)
  }

  const handleFetchEmails = async (silent: any = false) => {
    setIsFetchingEmails(true)
    try {
      apiClient.refreshToken()
      if (!localStorage.getItem("cystar_token")) {
        const mockEmails = [
          "matrix_reborn@cyberspace.in",
          "student_dev@trustx.org",
          "pwn_master@academy.local",
          "guest_user@cystar.io",
          "j.doe@academy.io",
          "admin_tester@cyberrange.in",
          "cyber_ninja@trustx.org"
        ]
        setFetchedEmails(mockEmails)
        setFetchedUsers(mockEmails.map((email, idx) => ({
          user_id: `mock-user-id-${idx}`,
          email: email,
          role: "student",
          is_active: true,
          created_at: new Date().toISOString()
        })))
        if (silent !== true) {
          showToast("info", "Offline mode: Loaded sandbox student list.")
        }
        return
      }
      
      const res = await api.listUsers()
      if (res && res.users) {
        const emails = res.users.map(u => u.email)
        setFetchedEmails(emails)
        setFetchedUsers(res.users)
        if (silent !== true) {
          showToast("success", `Successfully fetched ${emails.length} student emails.`)
        }
      } else {
        throw new Error("No users returned")
      }
    } catch (err: any) {
      console.warn("Failed to list users from backend, using fallback list:", err)
      const mockEmails = [
        "matrix_reborn@cyberspace.in",
        "student_dev@trustx.org",
        "pwn_master@academy.local",
        "guest_user@cystar.io",
        "j.doe@academy.io",
        "admin_tester@cyberrange.in",
        "cyber_ninja@trustx.org"
      ]
      setFetchedEmails(mockEmails)
      setFetchedUsers(mockEmails.map((email, idx) => ({
        user_id: `mock-user-id-${idx}`,
        email: email,
        role: "student",
        is_active: true,
        created_at: new Date().toISOString()
      })))
      if (silent !== true) {
        showToast("info", "Backend offline: Loaded sandbox student list.")
      }
    } finally {
      setIsFetchingEmails(false)
    }
  }

  const handleOnboardStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailStr = onboardEmail.trim()
    if (!emailStr) return
    
    setIsOnboarding(true)
    try {
      if (isLiveMode) {
        apiClient.refreshToken()
        await api.devLoginParticipant(emailStr, onboardName.trim() || undefined, onboardRole, true)
        showToast("success", `Successfully registered student ${emailStr} as ${onboardRole} in system database.`)
        await handleFetchEmails()
      } else {
        if (!fetchedEmails.includes(emailStr)) {
          const updatedEmails = [...fetchedEmails, emailStr]
          setFetchedEmails(updatedEmails)
          
          const displayName = onboardName.trim() || emailStr.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          
          if (!mockLeaderboard.some(l => l.email.toLowerCase() === emailStr.toLowerCase())) {
            const newLeaderEntry = {
              name: displayName,
              email: emailStr,
              totalPoints: 0,
              totalTimeSpent: 0,
              completedChallenges: 0
            }
            const updatedLeaderboard = [...mockLeaderboard, newLeaderEntry]
            setMockLeaderboard(updatedLeaderboard)
            localStorage.setItem("admin_ctf_mock_leaderboard", JSON.stringify(updatedLeaderboard))
          }
        }
        showToast("success", `Sandbox: Registered student ${emailStr} in offline roster.`)
      }
      setOnboardEmail("")
      setOnboardName("")
      setOnboardRole("participant")
    } catch (err: any) {
      showToast("error", err.message || "Failed to onboard student.")
    } finally {
      setIsOnboarding(false)
    }
  }

  const handleDeleteRegisteredUser = (userId: string) => {
    const userToDelete = fetchedUsers.find(u => u.user_id === userId)
    if (!userToDelete) return
    
    setFetchedUsers(prev => prev.filter(u => u.user_id !== userId))
    setFetchedEmails(prev => prev.filter(email => email.toLowerCase() !== userToDelete.email.toLowerCase()))
    showToast("success", `Student ${userToDelete.email} removed from local active roster.`)
  }

  const handleImpersonateStudent = async (email: string) => {
    try {
      const user = fetchedUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
      const role = user?.role || "participant"
      const name = email.split("@")[0]
      
      showToast("info", `Impersonating user ${email}...`)
      
      if (!localStorage.getItem("cystar_token")) {
        // Offline / sandbox mode simulation
        localStorage.setItem("cystar_token", `mock-token-${email}`)
        apiClient.refreshToken()
        showToast("success", `Offline impersonation successful! Logged in as ${email}.`)
        window.location.href = "/ctf"
        return
      }

      // Online mode: Call endpoint
      const res = await api.devLoginParticipant(email, name, role)
      if (res && res.access_token) {
        setToken(res.access_token)
        showToast("success", `Successfully signed in as ${email}! Redirecting...`)
        window.location.href = "/ctf"
      } else {
        throw new Error("No token returned")
      }
    } catch (err: any) {
      showToast("error", `Failed to sign in as student: ${err.message || err}`)
    }
  }

  const handleAutoGroup = (type: "all" | "size" | "count") => {
    if (fetchedEmails.length === 0) {
      showToast("error", "No students available to group. Fetch emails or onboard students first.")
      return
    }

    let newGroupsList: StudentGroup[] = []

    if (type === "all") {
      const allGroup: StudentGroup = {
        id: `group-all-${Date.now()}`,
        name: "All Students (Total Roster)",
        emails: [...fetchedEmails]
      }
      newGroupsList = [allGroup]
      showToast("success", `Created group containing all ${fetchedEmails.length} students.`)
    } else if (type === "size") {
      const size = parseInt(autoGroupSize)
      if (isNaN(size) || size <= 0) {
        showToast("error", "Please enter a valid group size.")
        return
      }
      const shuffled = [...fetchedEmails]
      let chunkIdx = 0
      for (let i = 0; i < shuffled.length; i += size) {
        chunkIdx++
        const chunk = shuffled.slice(i, i + size)
        newGroupsList.push({
          id: `group-size-${Date.now()}-${chunkIdx}`,
          name: `Team ${chunkIdx} (Size ${size})`,
          emails: chunk
        })
      }
      showToast("success", `Auto-split students into ${newGroupsList.length} groups of size ${size}.`)
    } else if (type === "count") {
      const count = parseInt(autoGroupCount)
      if (isNaN(count) || count <= 0) {
        showToast("error", "Please enter a valid group count.")
        return
      }
      const shuffled = [...fetchedEmails]
      for (let g = 0; g < count; g++) {
        newGroupsList.push({
          id: `group-count-${Date.now()}-${g}`,
          name: `Alpha Squad ${g + 1}`,
          emails: []
        })
      }

      shuffled.forEach((email, idx) => {
        const groupIdx = idx % count
        newGroupsList[groupIdx].emails.push(email)
      })

      newGroupsList = newGroupsList.filter(g => g.emails.length > 0)
      showToast("success", `Auto-grouped all students into ${newGroupsList.length} teams.`)
    }

    const updated = [...groups, ...newGroupsList]
    saveGroupsToStorage(updated)
  }

  const handleAddGroupToActiveDep = async (groupId: string) => {
    if (!deploymentId) return
    const targetGroup = groups.find(g => g.id === groupId)
    if (!targetGroup || targetGroup.emails.length === 0) return

    showToast("info", `Adding group "${targetGroup.name}" members to running lab...`)
    
    if (isLiveMode) {
      let addedCount = 0
      for (const email of targetGroup.emails) {
        const userObj = fetchedUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
        if (userObj) {
          try {
            await api.addDeploymentMember(deploymentId, userObj.user_id)
            addedCount++
          } catch (err) {
            console.warn(`Failed to add user ${email} to deployment:`, err)
          }
        }
      }
      showToast("success", `Added ${addedCount}/${targetGroup.emails.length} students to running lab.`)
      fetchDeploymentMembers(deploymentId)
    } else {
      const mockMembers = [...activeDeploymentMembers]
      targetGroup.emails.forEach(email => {
        if (!mockMembers.some((m: any) => m.email.toLowerCase() === email.toLowerCase())) {
          mockMembers.push({
            user_id: `user-${email}`,
            email: email,
            added_by: "admin",
            added_at: new Date().toISOString()
          })
        }
      })
      setActiveDeploymentMembers(mockMembers)
      showToast("success", `Sandbox: Added group members to active lab.`)
    }
  }

  const handleAddIndividualToActiveDep = async () => {
    if (!deploymentId) return
    const targetEmail = selectedEmailForActiveDep || customEmailForActiveDep.trim()
    if (!targetEmail) {
      showToast("error", "Please select or type a student email.")
      return
    }

    if (isLiveMode) {
      const userObj = fetchedUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase())
      if (!userObj) {
        showToast("error", `Student with email ${targetEmail} is not onboarded. Please onboard them first.`)
        return
      }

      try {
        await api.addDeploymentMember(deploymentId, userObj.user_id)
        showToast("success", `Added student ${targetEmail} to running lab.`)
        setSelectedEmailForActiveDep("")
        setCustomEmailForActiveDep("")
        fetchDeploymentMembers(deploymentId)
      } catch (err: any) {
        showToast("error", err.message || "Failed to add student to lab.")
      }
    } else {
      if (!activeDeploymentMembers.some((m: any) => m.email.toLowerCase() === targetEmail.toLowerCase())) {
        const mockMembers = [
          ...activeDeploymentMembers,
          {
            user_id: `user-${targetEmail}`,
            email: targetEmail,
            added_by: "admin",
            added_at: new Date().toISOString()
          }
        ]
        setActiveDeploymentMembers(mockMembers)
      }
      setSelectedEmailForActiveDep("")
      setCustomEmailForActiveDep("")
      showToast("success", `Sandbox: Added student ${targetEmail} to active lab.`)
    }
  }

  const handleRemoveMemberFromActiveDep = async (userId: string) => {
    if (!deploymentId) return

    if (isLiveMode) {
      try {
        await api.removeDeploymentMember(deploymentId, userId)
        showToast("success", "Removed student from running lab.")
        fetchDeploymentMembers(deploymentId)
      } catch (err: any) {
        showToast("error", err.message || "Failed to remove student.")
      }
    } else {
      const updated = activeDeploymentMembers.filter((m: any) => m.user_id !== userId)
      setActiveDeploymentMembers(updated)
      showToast("success", "Sandbox: Removed student from active lab.")
    }
  }

  const getGroupLeaderboard = () => {
    const activeLeader = isLiveMode ? leaderboard : mockLeaderboard
    return groups.map(group => {
      const memberEntries = activeLeader.filter(entry => 
        group.emails.some(email => email.toLowerCase() === entry.email.toLowerCase())
      )
      const totalPoints = memberEntries.reduce((sum, entry) => sum + (entry.totalPoints || 0), 0)
      const totalTimeSpent = memberEntries.reduce((sum, entry) => sum + (entry.totalTimeSpent || 0), 0)
      const completedCount = memberEntries.reduce((sum, entry) => sum + (entry.completedChallenges || 0), 0)
      return {
        groupId: group.id,
        groupName: group.name,
        totalPoints,
        totalTimeSpent,
        memberCount: group.emails.length,
        completedCount
      }
    }).sort((a, b) => b.totalPoints - a.totalPoints || a.totalTimeSpent - b.totalTimeSpent)
  }

  const activeLab = labs.find(l => l.id === selectedLabId) || labs[0]

  const filteredChallenges = activeLab
    ? activeLab.challenges.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const totalScenarios = labs.length
  const totalChals = labs.reduce((sum, l) => sum + l.challenges.length, 0)
  const totalPoints = labs.reduce((sum, l) => sum + l.challenges.reduce((s, c) => s + c.points, 0), 0)
  const correctAttempts = auditLogs.filter(l => l.status === "Correct").length

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!user || (user.role !== "sys_admin" && user.role !== "course_admin")) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header active={undefined} />
      
      {/* Standalone Alert Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span><strong>CTF Control Deck Access:</strong> Authenticated as <strong className="text-foreground">{user.email}</strong> ({user.role === 'sys_admin' ? 'Super Admin' : 'CTF Admin'}).</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="h-7 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-[10px] font-bold rounded-lg px-3">
              <Link href={user.role === "sys_admin" ? "/sys-admin" : "/dashboard"}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Back to Workspace
              </Link>
            </Button>
            <Button asChild size="sm" className="h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg px-3 text-[10px]">
              <Link href="/ctf">
                View Player Arena <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full flex-1 p-6 flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="border border-border bg-card rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="space-y-1 py-2 px-1">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                CTF Control Deck
              </h1>
              <p className="text-muted-foreground text-[10px] font-light">Unrestricted sandbox admin console.</p>
            </div>

            <nav className="space-y-1">
              {[
                { id: "overview", label: "Overview & Control", sub: "Deployment & status", icon: LayoutDashboard },
                { id: "scenarios", label: "Scenarios & Flags", sub: "Challenges & pricing", icon: Layers },
                { id: "users", label: "Cohorts & Roster", sub: "Teams & onboarding", icon: Users },
                { id: "billing", label: "Payments & Access", sub: "Manual grants & logs", icon: CreditCard },
                { id: "leaderboard", label: "Leaderboard & Logs", sub: "Live solves & stream", icon: Trophy }
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any)
                      setSearchQuery("")
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border",
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-emerald-400" : "text-slate-500")} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{tab.label}</div>
                      <div className="text-[9px] text-slate-500 truncate">{tab.sub}</div>
                    </div>
                  </button>
                )
              })}
            </nav>
            
            <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
              <Button onClick={handleResetToDefaults} variant="outline" className="w-full border-white/10 bg-white/5 text-[10px] text-slate-300 hover:bg-white/10 rounded-xl h-8">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Default Data
              </Button>
              <Button onClick={() => setIsCreatingLab(true)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold rounded-xl h-8">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Lab Scenario
              </Button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          
          {/* TAB 1: OVERVIEW & CONTROL */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Banner Section */}
              <section className="relative overflow-hidden border border-border bg-gradient-to-br from-card via-card to-primary/5 py-6 px-6 rounded-2xl shadow-xs">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg">
                        <Link href="/ctf"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back CTF Arena</Link>
                      </Button>
                    </div>
                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
                      Administrative Control Deck
                    </h2>
                    <p className="text-muted-foreground text-xs font-light">Monitor, orchestrate, and schedule isolated user lab sandbox environments.</p>
                  </div>
                </div>
              </section>

              {/* KPI Grid */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-border bg-card rounded-xl shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Scenarios</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-foreground font-mono">{totalScenarios}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Active categories</p>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-xl shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Flags</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-foreground font-mono">{totalChals}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Configured challenges</p>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-xl shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Max Points Pool</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-primary font-mono">{totalPoints} <span className="text-xs text-muted-foreground">PTS</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Total score value</p>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-xl shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Solves Telemetry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-foreground font-mono">{correctAttempts} <span className="text-xs text-emerald-600 dark:text-emerald-400">Correct</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Active flags verified</p>
                  </CardContent>
                </Card>
              </section>

              {/* Deployment Console */}
              {activeLab && (
                <Card className="border border-border bg-card rounded-xl p-5 flex flex-col gap-4 shadow-xs relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-[50px] pointer-events-none" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Sync & Deployment Console:</span>
                        <select
                          value={selectedLabId}
                          onChange={(e) => setSelectedLabId(e.target.value)}
                          className="bg-background border border-border text-foreground rounded px-2.5 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          {labs.map((lab) => (
                            <option key={lab.id} value={lab.id}>
                              {lab.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          DB ID: {getUuidForId(activeLab.id)}
                        </span>
                        <div className="flex items-center gap-3 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Live Infrastructure:</span>
                            <span className={cn(
                              "font-bold uppercase tracking-wide px-2 py-0.5 rounded text-[9px]",
                              deploymentStatus === "running" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                              deploymentStatus === "provisioning" || deploymentStatus === "queued" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse" :
                              deploymentStatus === "terminating" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse" :
                              "bg-muted text-muted-foreground border border-border"
                            )}>
                              {deploymentStatus || "Not Deployed"}
                            </span>
                          </div>
                          {deploymentStatus === "running" && activeDeploymentCountdown && (
                            <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg font-mono font-bold text-[9px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                              <span>Time Left: {activeDeploymentCountdown}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 relative z-10">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handlePushScenario}
                        disabled={isPushing}
                        className="bg-primary text-primary-foreground text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs"
                      >
                        {isPushing ? "Pushing..." : "Push to Server"}
                      </Button>

                      {(() => {
                        const isCurrentlyVisible = scheduledLabs.some(item => item.labId === activeLab.id && item.status === "started")
                        return (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleToggleUserCtfVisibility}
                            className={cn(
                              "text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs transition-colors duration-200",
                              isCurrentlyVisible
                                ? "bg-rose-600 hover:bg-rose-700 text-white"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                          >
                            {isCurrentlyVisible ? "Hide in User CTF" : "Show in User CTF"}
                          </Button>
                        )
                      })()}
                      
                      {(!deploymentStatus || deploymentStatus === "terminated" || deploymentStatus === "expired" || deploymentStatus === "cleanup_failed") ? (
                        <>
                          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 h-8">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Assign Group:</span>
                            <select
                              value={selectedGroupForDeployment}
                              onChange={(e) => setSelectedGroupForDeployment(e.target.value)}
                              className="bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer w-28 md:w-32"
                            >
                              <option value="">-- None (Solo) --</option>
                              {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSpinChallenge()}
                            disabled={isSpinning || isPushing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs"
                          >
                            {isSpinning ? "Queuing..." : "Spin Challenge"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleStopChallenge}
                          disabled={isSpinning || deploymentStatus === "terminating"}
                          variant="destructive"
                          className="text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs"
                        >
                          {deploymentStatus === "terminating" ? "Teardown..." : "Stop Lab"}
                        </Button>
                      )}

                      {deploymentStatus === "running" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleJoinNetwork}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs"
                        >
                          Join VPN Network
                        </Button>
                      )}

                      {(activeLab.id === "click-web-challenge" || activeLab.id === "initial-access" || activeLab.title?.toLowerCase().includes("initial access") || activeLab.title?.toLowerCase().includes("clickfix")) && (
                        <Button
                          asChild
                          type="button"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs flex items-center gap-1.5"
                        >
                          <a href="https://click-web.cyberrange.kctf.cloud" target="_blank" rel="noopener noreferrer">
                            Challenge Link <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Live Deployment Participants Manager */}
                  {deploymentStatus === "running" && (
                    <div className="border-t border-border pt-3 space-y-3 relative z-10">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-primary" /> Active Lab Participants ({activeDeploymentMembers.length})
                        </h4>
                      </div>
                      
                      {activeDeploymentMembers.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">No participants added to this running deployment. Add members below so they can connect.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                          {activeDeploymentMembers.map((member: any) => (
                            <div key={member.user_id} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-mono">
                              <span>{member.email}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromActiveDep(member.user_id)}
                                className="text-muted-foreground hover:text-rose-500 transition-colors ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Member Controls */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1 h-8">
                          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Add Group:</span>
                          <select
                            onChange={async (e) => {
                              const val = e.target.value
                              if (!val) return
                              await handleAddGroupToActiveDep(val)
                              e.target.value = "" // Reset
                            }}
                            className="bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer w-28 md:w-32"
                          >
                            <option value="">-- Select Group --</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1 h-8">
                          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Add Student:</span>
                          <select
                            value={selectedEmailForActiveDep}
                            onChange={(e) => {
                              setSelectedEmailForActiveDep(e.target.value)
                              setCustomEmailForActiveDep("")
                            }}
                            className="bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer max-w-[150px]"
                          >
                            <option value="">-- Select Student --</option>
                            {fetchedEmails.map(email => (
                              <option key={email} value={email}>{email}</option>
                            ))}
                          </select>
                        </div>

                        <input
                          type="email"
                          placeholder="Or type student@example.com"
                          value={customEmailForActiveDep}
                          onChange={(e) => {
                            setCustomEmailForActiveDep(e.target.value)
                            setSelectedEmailForActiveDep("")
                          }}
                          className="bg-background border border-border rounded-lg px-3 py-1 h-8 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-44"
                        />

                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddIndividualToActiveDep}
                          className="bg-primary text-primary-foreground text-[10px] font-bold rounded-lg px-3 h-8 shadow-xs"
                        >
                          Add to Lab
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Schedule Deployment Form */}
              {activeLab && (
                <Card className="border border-border bg-card rounded-xl p-5 flex flex-col gap-4 shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CalendarRange className="w-4 h-4 text-primary" />
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Schedule Deployment for this Lab
                    </span>
                  </div>
                  <form onSubmit={handleScheduleLab} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[9px] text-muted-foreground uppercase font-semibold">Start Time (Local)</label>
                      <input
                        type="datetime-local"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-muted-foreground uppercase font-semibold">Duration (Hours)</label>
                      <select
                        value={scheduleDuration}
                        onChange={(e) => setScheduleDuration(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="1">1 Hour</option>
                        <option value="2">2 Hours</option>
                        <option value="4">4 Hours</option>
                        <option value="8">8 Hours</option>
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-muted-foreground uppercase font-semibold">Assign Target (Group or Student)</label>
                      <select
                        value={scheduleGroupId}
                        onChange={(e) => setScheduleGroupId(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="">-- None (Solo) --</option>
                        {groups.length > 0 && (
                          <optgroup label="Groups & Cohorts">
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>Group: {g.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {fetchedUsers.length > 0 && (
                          <optgroup label="Individual Students">
                            {fetchedUsers.map(u => (
                              <option key={`student-${u.email}`} value={`student-${u.email}`}>Student: {u.email}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-primary text-primary-foreground text-[10px] font-bold rounded-lg h-8 shadow-xs"
                    >
                      Schedule Launch
                    </Button>
                  </form>

                  {/* Scheduled list sub-panel */}
                  {scheduledLabs.length > 0 && (
                    <div className="border-t border-border pt-3 space-y-2">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Pending Scheduled Deployments
                      </h4>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                        {scheduledLabs.map((item) => {
                          const startsInMs = new Date(item.startTime).getTime() - Date.now()
                          let countdownText = ""
                          if (item.status === "started") {
                            const startTimeMs = new Date(item.startTime).getTime()
                            const durationMs = item.durationHours * 60 * 60 * 1000
                            const endTimeMs = startTimeMs + durationMs
                            const remainingMs = endTimeMs - Date.now()
                            if (remainingMs <= 0) {
                              countdownText = "Expired"
                            } else {
                              const mins = Math.floor(remainingMs / 60000)
                              const hrs = Math.floor(mins / 60)
                              countdownText = hrs > 0 ? `${hrs}h ${mins % 60}m left` : `${mins}m left`
                            }
                          } else if (startsInMs <= 0) {
                            countdownText = "Deploying..."
                          } else {
                            const mins = Math.floor(startsInMs / 60000)
                            const hrs = Math.floor(mins / 60)
                            if (hrs > 0) {
                              countdownText = `in ${hrs}h ${mins % 60}m`
                            } else {
                              countdownText = `in ${mins}m`
                            }
                          }

                          return (
                            <div key={item.id} className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">{item.labTitle}</span>
                                  <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold",
                                    item.status === "started" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                                    item.status === "expired" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                                    "bg-primary/10 text-primary"
                                  )}>
                                    {item.status.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Target Group: <span className="text-foreground font-medium">{item.groupName}</span> · Starts {new Date(item.startTime).toLocaleString()} ({item.durationHours}h duration)
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">{countdownText}</span>
                                <div className="flex items-center gap-2">
                                  {item.status === "scheduled" && (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleStartScheduleImmediately(item.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg px-2.5 h-7 shadow-xs transition-all duration-200"
                                      >
                                        Start Now
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCancelSchedule(item.id)}
                                        className="border-border text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 text-[10px] font-medium rounded-lg px-2.5 h-7 transition-all duration-200"
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {item.status === "started" && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleStopScheduleImmediately(item.id)}
                                      className="text-[10px] font-bold rounded-lg px-2.5 h-7 shadow-xs transition-all duration-200"
                                    >
                                      Stop
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: SCENARIOS & FLAGS */}
          {activeTab === "scenarios" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Scenario Select list */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" /> Active Scenarios
                  </h2>
                </div>
                
                <div className="space-y-2">
                  {labs.map((lab) => {
                    const isSelected = selectedLabId === lab.id
                    return (
                      <button
                        key={lab.id}
                        type="button"
                        onClick={() => {
                          setSelectedLabId(lab.id)
                          setSearchQuery("")
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border transition-all duration-200 block",
                          isSelected
                            ? "border-emerald-500/40 bg-emerald-500/[0.03] text-white"
                            : "border-white/5 bg-white/[0.01] text-slate-300 hover:border-white/15 hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">{lab.difficulty} · {lab.durationLabel}</span>
                            <span className="text-[9px] font-mono text-slate-500">{lab.challenges.length} Flags</span>
                          </div>
                          <h3 className="text-sm font-bold truncate">{lab.title}</h3>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{lab.description}</p>
                          {(lab.id === "click-web-challenge" || lab.id === "initial-access" || lab.title?.toLowerCase().includes("initial access") || lab.title?.toLowerCase().includes("clickfix")) && (
                            <div className="pt-2">
                              <a
                                href="https://click-web.cyberrange.kctf.cloud"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                              >
                                Access Challenge <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Telemetry Simulator widget */}
                <Card className="border border-border bg-card rounded-xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-primary animate-pulse" /> Telemetry Simulator
                    </span>
                    <Button size="sm" onClick={handleClearLogs} variant="outline" className="h-6 text-[9px] text-muted-foreground rounded-md px-2">
                      Clear Logs
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Simulate real-time student activity by spawning a random flag submission log in the audit pipeline feed.
                  </p>
                  <Button onClick={handleSimulateEvent} className="w-full h-8 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Inject Flag Attempt
                  </Button>
                </Card>
              </div>

              {/* Right Column: Pricing and Flags list */}
              <div className="lg:col-span-2 space-y-4">
                {activeLab && (
                  <Card className="border border-border bg-card rounded-xl p-4 flex flex-col gap-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Trophy className="w-4 h-4 text-primary" />
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Pricing & Access Configuration ({activeLab.title})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(activeLab.id === "click-web-challenge" || activeLab.id === "initial-access" || activeLab.title?.toLowerCase().includes("initial access") || activeLab.title?.toLowerCase().includes("clickfix")) && (
                          <Button
                            asChild
                            size="sm"
                            className="bg-primary text-primary-foreground text-[9px] font-bold rounded-lg h-6 px-2.5 flex items-center gap-1 shadow-xs"
                          >
                            <a href="https://click-web.cyberrange.kctf.cloud" target="_blank" rel="noopener noreferrer">
                              Access Challenge <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                        {isFetchingPrice && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">Price Amount (Major)</label>
                        <input
                          type="text"
                          placeholder="e.g. 1000.00"
                          value={labPrice}
                          onChange={(e) => setLabPrice(e.target.value)}
                          disabled={isFetchingPrice || isSavingPrice}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">Currency Code</label>
                        <input
                          type="text"
                          placeholder="INR"
                          value={labCurrency}
                          maxLength={3}
                          onChange={(e) => setLabCurrency(e.target.value.toUpperCase())}
                          disabled={isFetchingPrice || isSavingPrice}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-mono uppercase"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">Checkout Status</label>
                        <select
                          value={labPriceActive ? "active" : "inactive"}
                          onChange={(e) => setLabPriceActive(e.target.value === "active")}
                          disabled={isFetchingPrice || isSavingPrice}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                        >
                          <option value="active">Active (Purchasable)</option>
                          <option value="inactive">Inactive (Coming Soon)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                      <Button
                        type="button"
                        onClick={saveLabPrice}
                        disabled={isFetchingPrice || isSavingPrice}
                        className="bg-primary text-primary-foreground text-[10px] font-bold rounded-lg h-8 px-5 shadow-xs flex items-center gap-1.5"
                      >
                        {isSavingPrice ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                          </>
                        ) : (
                          "Save Price Settings"
                        )}
                      </Button>
                    </div>
                  </Card>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pt-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {activeLab?.title || "Scenario Challenges"} Flags
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Manage flags, writeups and hints for this scenario</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filter flags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs w-40 rounded-lg border-border bg-background text-foreground"
                      />
                    </div>
                    <Button onClick={() => {
                      setCurrentChallenge({ labId: selectedLabId, difficulty: "Medium", category: "Recon", hints: [""] })
                      setIsEditing(true)
                    }} className="bg-primary text-primary-foreground text-xs font-bold rounded-lg h-8">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Flag
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredChallenges.length === 0 ? (
                    <Card className="border border-dashed border-border bg-card p-8 text-center rounded-xl">
                      <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2 animate-pulse" />
                      <h3 className="text-xs font-bold text-foreground mb-1">No Flags Found</h3>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        No challenges mapped to this scenario query. Add a new flag or reset default database.
                      </p>
                    </Card>
                  ) : (
                    filteredChallenges.map((challenge) => (
                      <Card key={challenge.id} className="border border-border bg-card rounded-xl overflow-hidden shadow-xs">
                        <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase",
                                challenge.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                                challenge.difficulty === "Medium" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                                "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              )}>
                                {challenge.difficulty}
                              </span>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{challenge.category}</span>
                              <span className="text-[9px] text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded">+{challenge.points} PTS</span>
                            </div>
                            <h3 className="text-sm font-bold text-foreground">{challenge.title}</h3>
                            <div className="mt-2 pt-2 border-t border-border space-y-1.5 text-[11px]">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground font-mono font-semibold shrink-0">Flag Secret:</span>
                                <code className="text-primary select-all font-mono break-all font-bold">{challenge.flag}</code>
                              </div>
                              {challenge.hints && challenge.hints.length > 0 && (
                                <div className="flex gap-2 text-muted-foreground font-light">
                                  <span className="text-muted-foreground font-mono font-semibold shrink-0">Hints:</span>
                                  <span>{challenge.hints.length} registered hints</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCurrentChallenge({ ...challenge, labId: selectedLabId })
                                setIsEditing(true)
                              }}
                              className="rounded-lg h-7 px-3 text-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeleteChallenge(selectedLabId, challenge.id)}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg h-7 px-3 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}          {/* TAB 3: COHORTS & ROSTER */}
          {activeTab === "users" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-1.5">
                    Cohort & Group Management
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium">Create groups, register students, and assign them directly to teams.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleFetchEmails}
                    disabled={isFetchingEmails}
                    className="bg-primary text-primary-foreground font-bold text-xs rounded-lg px-4 h-9 flex items-center gap-1.5 shadow-xs"
                  >
                    <RotateCcw className={cn("w-3.5 h-3.5", isFetchingEmails && "animate-spin")} />
                    {isFetchingEmails ? "Syncing Directory..." : "Sync Directory"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* COLUMN 1: GROUPS & TEAMS (lg:col-span-4) */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Create New Group Card */}
                  <Card className="border border-border bg-card rounded-xl p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4 text-primary" /> Create Cohort / Group
                    </h3>
                    <form onSubmit={handleCreateGroup} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Alpha Team, Cohort B"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                      <Button type="submit" size="sm" className="bg-primary text-primary-foreground text-xs font-bold rounded-lg px-3">
                        Create
                      </Button>
                    </form>
                  </Card>

                  {/* Configured Groups / Rosters Card */}
                  <Card className="border border-border bg-card rounded-xl p-4 shadow-xs min-h-[300px] space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UsersRound className="w-4 h-4 text-primary" /> Configured Teams ({groups.length})
                      </h3>
                      <Button
                        type="button"
                        onClick={() => setShowAutoGroupPanel(!showAutoGroupPanel)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 rounded-md font-bold"
                      >
                        {showAutoGroupPanel ? "Hide Auto-Split" : "Auto-Split"}
                      </Button>
                    </div>

                    {showAutoGroupPanel && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2.5 transition-all text-xs">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">Auto-Split Options</h4>
                        <div className="flex bg-muted p-0.5 rounded-lg border border-border text-[9px]">
                          <button 
                            type="button" 
                            onClick={() => setAutoGroupType("all")} 
                            className={cn("flex-1 py-1 px-1 rounded-md font-bold transition-all", autoGroupType === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                          >
                            All in One
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setAutoGroupType("size")} 
                            className={cn("flex-1 py-1 px-1 rounded-md font-bold transition-all", autoGroupType === "size" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                          >
                            By Size
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setAutoGroupType("count")} 
                            className={cn("flex-1 py-1 px-1 rounded-md font-bold transition-all", autoGroupType === "count" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                          >
                            By Count
                          </button>
                        </div>

                        {autoGroupType === "all" && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground">Creates a single team containing all total students ({fetchedEmails.length || fetchedUsers.filter(u => u.role === "participant").length}).</p>
                            <Button 
                              type="button" 
                              onClick={() => handleAutoGroup("all")} 
                              className="w-full bg-primary text-primary-foreground text-xs font-bold rounded-lg py-1.5"
                            >
                              Group All Students
                            </Button>
                          </div>
                        )}

                        {autoGroupType === "size" && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground">Split roster into groups of max size:</p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="Group Size"
                                value={autoGroupSize}
                                onChange={(e) => setAutoGroupSize(e.target.value)}
                                className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                              />
                              <Button 
                                type="button" 
                                onClick={() => handleAutoGroup("size")} 
                                className="flex-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg py-1"
                              >
                                Auto Split
                              </Button>
                            </div>
                          </div>
                        )}

                        {autoGroupType === "count" && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground">Split roster evenly into fixed count of groups:</p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="Group Count"
                                value={autoGroupCount}
                                onChange={(e) => setAutoGroupCount(e.target.value)}
                                className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                              />
                              <Button 
                                type="button" 
                                onClick={() => handleAutoGroup("count")} 
                                className="flex-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg py-1"
                              >
                                Auto Split
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {groups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center space-y-2">
                        <Users className="w-8 h-8 opacity-20" />
                        <p className="text-xs max-w-[200px]">No teams configured yet. Use the card above to create a team.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {groups.map((group) => (
                          <div 
                            key={group.id} 
                            className="border border-border bg-background hover:border-primary/20 rounded-xl p-3.5 space-y-2.5 transition-all"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <h4 className="text-xs font-bold text-foreground truncate max-w-[130px]">{group.name}</h4>
                                <span className="text-[10px] text-muted-foreground font-mono">({group.emails.length})</span>
                              </div>
                              <Button
                                type="button"
                                onClick={() => handleDeleteGroup(group.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                              {group.emails.length === 0 ? (
                                <p className="text-[9px] text-muted-foreground italic">No members assigned.</p>
                              ) : (
                                group.emails.map((email) => (
                                  <div 
                                    key={email} 
                                    className="flex justify-between items-center bg-muted/40 border border-border px-2 py-1 rounded-md text-[9px] text-foreground font-mono"
                                  >
                                    <span className="truncate max-w-[160px]">{email}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStudentFromGroup(group.id, email)}
                                      className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded p-0.5 transition-colors"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                {/* COLUMN 2: REGISTERED STUDENT DIRECTORY (lg:col-span-8) */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Onboard New Student Card */}
                  <Card className="border border-border bg-card rounded-xl p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-amber-500" /> Onboard Student
                    </h3>
                    <form onSubmit={handleOnboardStudent} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Alice Smith"
                          value={onboardName}
                          onChange={(e) => setOnboardName(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">Email Address</label>
                        <input
                          type="email"
                          placeholder="student@example.com"
                          value={onboardEmail}
                          onChange={(e) => setOnboardEmail(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 transition-colors"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground uppercase font-semibold">System Role</label>
                        <select
                          value={onboardRole}
                          onChange={(e) => setOnboardRole(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500 transition-colors"
                        >
                          <option value="participant">Participant (Learner)</option>
                          <option value="course_admin">Course Admin (Instructor)</option>
                          <option value="sys_admin">System Admin</option>
                        </select>
                      </div>

                      <Button 
                        type="submit" 
                        disabled={isOnboarding}
                        size="sm" 
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg py-2"
                      >
                        {isOnboarding ? "Onboarding..." : "Register & Onboard"}
                      </Button>
                    </form>
                  </Card>

                  {/* Registered Users List Card */}
                  <Card className="border border-border bg-card rounded-xl p-4 shadow-xs space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Registered Students & Users Directory ({fetchedUsers.length})
                        </h3>
                      </div>
                      
                      {/* Search Roster Input */}
                      <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search users by email..."
                          value={rosterSearchQuery}
                          onChange={(e) => setRosterSearchQuery(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      {fetchedUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
                          <Users className="w-8 h-8 opacity-20" />
                          <p className="text-xs italic">No registered users in system database.</p>
                          <Button
                            type="button"
                            onClick={handleFetchEmails}
                            disabled={isFetchingEmails}
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg mt-1"
                          >
                            {isFetchingEmails ? "Syncing..." : "Sync Roster from DB"}
                          </Button>
                        </div>
                      ) : (
                        (() => {
                          const filtered = fetchedUsers.filter(u => 
                            u.email.toLowerCase().includes(rosterSearchQuery.toLowerCase())
                          )
                          
                          if (filtered.length === 0) {
                            return (
                              <div className="text-center text-xs text-muted-foreground py-12 italic">
                                No users match your search query.
                              </div>
                            )
                          }

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
                              {filtered.map((user) => {
                                // Find current group of the user
                                const currentGroupId = groups.find(g => 
                                  g.emails.some(e => e.toLowerCase() === user.email.toLowerCase())
                                )?.id || ""

                                return (
                                  <div
                                    key={user.user_id}
                                    className="flex justify-between items-center border border-border bg-background hover:border-primary/20 rounded-xl p-3 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                                        {(user.email || "S").charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs text-foreground font-semibold truncate leading-tight">
                                          {user.email}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground font-mono scale-95 origin-left">
                                            {user.role}
                                          </span>
                                          {user.is_active && (
                                            <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider scale-90">
                                              Active
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Simplified select to assign or change group */}
                                      <select
                                        value={currentGroupId}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          if (val === "") {
                                            handleRemoveStudentFromAllGroups(user.email)
                                          } else {
                                            handleAssignStudentDirectly(val, user.email)
                                          }
                                        }}
                                        className="h-7 bg-background border border-border rounded-lg text-[10px] text-primary font-bold focus:outline-none focus:border-primary transition-colors px-2 cursor-pointer"
                                      >
                                        <option value="">No Group</option>
                                        {groups.map(g => (
                                          <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                      </select>
                                      
                                      <Button
                                        type="button"
                                        onClick={() => handleImpersonateStudent(user.email)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2.5 text-[10px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors font-bold"
                                      >
                                        Sign In
                                      </Button>
                                      
                                      <Button
                                        type="button"
                                        onClick={() => handleDeleteRegisteredUser(user.user_id)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BILLING & ACCESS */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-1.5">
                    Billing & Lab Entitlements
                  </h2>
                  <p className="text-xs text-muted-foreground">Grant manual system permissions and audit payment history.</p>
                </div>
                <Button
                  type="button"
                  onClick={fetchPayments}
                  disabled={isFetchingPayments}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-[10px] text-primary hover:bg-primary/10 rounded-md font-mono"
                >
                  {isFetchingPayments ? "Refreshing..." : "Refresh Payments"}
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Grant Entitlement Panel */}
                <div className="lg:col-span-1">
                  <Card className="border border-border bg-card rounded-xl p-5 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5 text-primary" /> Manual Payment / Access Grant
                    </h3>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Grant direct lab permissions and simulate a successful mock payment checkout for manually registered students.
                    </p>
                    <form onSubmit={handleGrantEntitlement} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Select Student</label>
                        <select
                          value={selectedUserForPayment}
                          onChange={(e) => setSelectedUserForPayment(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                          required
                        >
                          <option value="">-- Choose Student --</option>
                          {fetchedUsers.map(u => (
                            <option key={u.user_id} value={u.user_id}>
                              {u.email}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Select Target Lab</label>
                        <select
                          value={selectedLabForPayment}
                          onChange={(e) => setSelectedLabForPayment(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                          required
                        >
                          <option value="">-- Choose Lab --</option>
                          {labs.map(l => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2 mt-2">
                        <Button
                          type="submit"
                          disabled={isGrantingEntitlement}
                          className="w-full bg-primary text-primary-foreground text-xs font-bold rounded-lg py-2"
                        >
                          {isGrantingEntitlement ? "Processing..." : "Grant Lab Entitlement"}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleInitiateCheckout}
                          disabled={isGrantingEntitlement}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg py-2"
                        >
                          {isGrantingEntitlement ? "Opening Checkout..." : "Initiate Checkout Flow"}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </div>

                {/* Payments History Table */}
                <div className="lg:col-span-2">
                  <Card className="border border-border bg-card rounded-xl overflow-hidden min-h-[220px] shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="py-3 px-4 font-bold text-muted-foreground">Transaction ID</th>
                            <th className="py-3 px-4 font-bold text-muted-foreground">Payer Roster Email</th>
                            <th className="py-3 px-4 font-bold text-muted-foreground">Purchased Lab Title</th>
                            <th className="py-3 px-4 font-bold text-muted-foreground">Amount</th>
                            <th className="py-3 px-4 font-bold text-muted-foreground">Payment Status</th>
                            <th className="py-3 px-4 font-bold text-muted-foreground">Date Issued</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 px-4 text-center text-muted-foreground italic">
                                No payment transactions found. Grant manual entitlements or check out labs on the public catalog to populate logs.
                              </td>
                            </tr>
                          ) : (
                            payments.map((p, idx) => (
                              <tr key={p.payment_id || idx} className="hover:bg-muted/30 transition-all">
                                <td className="py-3 px-4 font-mono text-muted-foreground text-[10px]">
                                  {p.payment_id.startsWith("pay_") ? p.payment_id : p.payment_id.substring(0, 12) + "..."}
                                </td>
                                <td className="py-3 px-4 font-semibold text-foreground font-mono">{p.email}</td>
                                <td className="py-3 px-4 text-foreground font-bold">{p.content_title || "Premium Range Package"}</td>
                                <td className="py-3 px-4 text-primary font-bold font-mono">
                                  {p.amount > 0 ? `${p.currency} ${p.amount}` : "FREE (Manual Grant)"}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={cn(
                                    "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                    p.status === "captured" || p.status === "paid"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : p.status === "pending"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  )}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground font-mono text-[10px]">
                                  {new Date(p.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LEADERBOARD & LOGS */}
          {activeTab === "leaderboard" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-1.5">
                    Solves & Live Leaderboard
                  </h2>
                  <p className="text-xs text-muted-foreground">Track and monitor live solver metrics and flag submissions stream.</p>
                </div>
              </div>

              {/* High-fidelity CTF Leaderboard */}
              <div className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-4 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" /> Administrative Leaderboard Overview
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLiveMode(!isLiveMode);
                      showToast("info", `Leaderboard source switched to ${!isLiveMode ? "Server / Connected Mode" : "Sandbox / Offline Mode"}`);
                    }}
                    className={cn(
                      "text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors",
                      isLiveMode 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                    )}
                  >
                    {isLiveMode ? "Server Mode" : "Sandbox Mode"}
                  </button>
                </div>
                <CTFLeaderboardView 
                  entries={isLiveMode ? leaderboard : mockLeaderboard} 
                  isLiveMode={isLiveMode} 
                />
              </div>

              {/* Audit telemetries (Full Width) */}
              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                  <Activity className="w-4 h-4 text-primary" /> Active Flag Submission Telemetry Stream
                </h2>
                
                <Card className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="py-3 px-4 font-bold text-muted-foreground">Timestamp</th>
                          <th className="py-3 px-4 font-bold text-muted-foreground">Student Email</th>
                          <th className="py-3 px-4 font-bold text-muted-foreground">Lab Scenario</th>
                          <th className="py-3 px-4 font-bold text-muted-foreground">Challenge</th>
                          <th className="py-3 px-4 font-bold text-muted-foreground">Flag Payload</th>
                          <th className="py-3 px-4 font-bold text-muted-foreground text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                              Telemetry log is currently empty. Simulating player interactions or solving flags will spawn events here.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log, idx) => (
                            <tr key={idx} className="hover:bg-muted/30 transition-all">
                              <td className="py-3 px-4 font-mono text-muted-foreground">{log.timestamp}</td>
                              <td className="py-3 px-4 font-semibold text-foreground">{log.operator}</td>
                              <td className="py-3 px-4 text-muted-foreground">{log.labTitle}</td>
                              <td className="py-3 px-4 text-foreground font-bold">{log.challengeTitle}</td>
                              <td className="py-3 px-4 font-mono text-muted-foreground max-w-[150px] truncate" title={log.attemptedFlag}>{log.attemptedFlag}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  log.status === "Correct"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                )}>
                                  <CheckCircle className="w-3 h-3" />
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Editor Challenge Dialog Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-xl w-full border-white/10 bg-[#0E0E12]/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-y-auto max-h-[85vh]">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-emerald-400" /> {currentChallenge.id ? "Edit Challenge Settings" : "Configure New CTF Flag"}
              </CardTitle>
              <CardDescription>Setup challenge guidelines, category tags, validation hashes, and hint solutions.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveChallenge} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Challenge Title</label>
                  <Input
                    required
                    value={currentChallenge.title || ""}
                    onChange={(e) => setCurrentChallenge(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Local privilege escalation root key"
                    className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Category Tag</label>
                  <Input
                    value={currentChallenge.category || ""}
                    onChange={(e) => setCurrentChallenge(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g. Active Directory, SQLi, BOLA"
                    className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Difficulty</label>
                  <select
                    value={currentChallenge.difficulty || "Medium"}
                    onChange={(e) => setCurrentChallenge(prev => ({ ...prev, difficulty: e.target.value as any }))}
                    className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Easy" className="bg-[#0A0A0B]">Easy</option>
                    <option value="Medium" className="bg-[#0A0A0B]">Medium</option>
                    <option value="Hard" className="bg-[#0A0A0B]">Hard</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Score Reward (Points)</label>
                  <Input
                    required
                    type="number"
                    value={currentChallenge.points ?? 100}
                    onChange={(e) => setCurrentChallenge(prev => ({ ...prev, points: Number(e.target.value) }))}
                    className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Validation Flag</label>
                  <Input
                    required
                    value={currentChallenge.flag || ""}
                    onChange={(e) => setCurrentChallenge(prev => ({ ...prev, flag: e.target.value }))}
                    placeholder="flag{xxxxxxxxxxxxxxxxxxxxxxxx}"
                    className="border-white/10 bg-white/5 text-emerald-400 rounded-xl focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Mission Story Context</label>
                <textarea
                  rows={3}
                  value={currentChallenge.scenario || ""}
                  onChange={(e) => setCurrentChallenge(prev => ({ ...prev, scenario: e.target.value }))}
                  placeholder="Set the narrative context for the student..."
                  className="w-full border border-white/10 bg-white/5 text-white rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Challenge Instructions</label>
                <textarea
                  rows={3}
                  value={currentChallenge.instructions || ""}
                  onChange={(e) => setCurrentChallenge(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Explain exactly what the user should query or target to recover the flag key..."
                  className="w-full border border-white/10 bg-white/5 text-white rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Intel Hints (Optional)</label>
                  <Button type="button" size="sm" onClick={handleAddHintField} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded px-2 h-6 text-[10px]">
                    + Add Hint
                  </Button>
                </div>
                <div className="space-y-2">
                  {currentChallenge.hints?.map((hint, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={hint}
                        onChange={(e) => handleHintChange(idx, e.target.value)}
                        placeholder={`Hint #${idx + 1} text`}
                        className="border-white/10 bg-white/5 text-white rounded-xl text-xs flex-1"
                      />
                      <Button type="button" size="icon" onClick={() => handleRemoveHintField(idx)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl h-10 w-10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Solution Methodology Writeup</label>
                <textarea
                  rows={3}
                  value={currentChallenge.solutionText || ""}
                  onChange={(e) => setCurrentChallenge(prev => ({ ...prev, solutionText: e.target.value }))}
                  placeholder="Enter step-by-step documentation detailing how to solve the challenge..."
                  className="w-full border border-white/10 bg-white/5 text-white rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold flex-1 rounded-xl">
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditing(false)
                  setCurrentChallenge({})
                }} className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 flex-1 rounded-xl">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create Lab Scenario Modal */}
      {isCreatingLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full border-white/10 bg-[#0E0E12]/95 backdrop-blur-xl shadow-2xl rounded-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg flex items-center gap-1.5">
                <Layers className="w-5 h-5 text-emerald-400" /> Create Lab Scenario Category
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateLab} className="p-6 space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Scenario Unique ID</label>
                <Input
                  required
                  value={newLabData.id || ""}
                  onChange={(e) => setNewLabData(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  placeholder="e.g. active-directory, owasp-top-10"
                  className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Scenario Title</label>
                <Input
                  required
                  value={newLabData.title || ""}
                  onChange={(e) => setNewLabData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Active Directory Enterprise Range"
                  className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Difficulty</label>
                <Input
                  value={newLabData.difficulty || "Medium"}
                  onChange={(e) => setNewLabData(prev => ({ ...prev, difficulty: e.target.value }))}
                  placeholder="e.g. Easy, Medium, Hard"
                  className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Estimated Duration</label>
                <Input
                  value={newLabData.durationLabel || "4 Hours"}
                  onChange={(e) => setNewLabData(prev => ({ ...prev, durationLabel: e.target.value }))}
                  placeholder="e.g. 3 Hours, 2 Days"
                  className="border-white/10 bg-white/5 text-white rounded-xl focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Description</label>
                <textarea
                  rows={3}
                  value={newLabData.description || ""}
                  onChange={(e) => setNewLabData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Write a brief overview of the learning goals..."
                  className="w-full border border-white/10 bg-white/5 text-white rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold flex-1 rounded-xl">
                  Create Scenario
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreatingLab(false)} className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 flex-1 rounded-xl">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* VPN Access Command Modal */}
      {showVpnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="max-w-xl w-full border-white/10 bg-[#0E0E12]/95 backdrop-blur-xl shadow-2xl rounded-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg flex items-center gap-1.5 font-bold">
                <Trophy className="w-5 h-5 text-amber-500 animate-bounce" /> Join Live VPN Network
              </CardTitle>
            </CardHeader>
            <div className="p-6 space-y-4 text-sm">
              <p className="text-slate-400 text-xs leading-relaxed">
                Connect your local workstation directly to the isolated lab subnet via Tailscale. Copy and run the following command in your terminal:
              </p>
              
              <div className="bg-black/80 rounded-xl p-4 border border-white/10 font-mono text-[10px] text-emerald-400 select-all break-all whitespace-pre-wrap relative group">
                {vpnCommand}
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(vpnCommand)
                    showToast("success", "VPN join command copied to clipboard!")
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold flex-1 rounded-xl h-10"
                >
                  Copy Command
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowVpnModal(false)}
                  className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 flex-1 rounded-xl h-10"
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-card text-center mt-auto transition-colors duration-300">
        <p className="text-[10px] text-muted-foreground">
          RangeOps Administrator Control Deck · Unrestricted Frontend Testing Console
        </p>
      </footer>
    </div>
  )
}
