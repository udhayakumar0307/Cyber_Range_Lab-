"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Script from "next/script"
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Send,
  Shield,
  Terminal,
  Trophy,
  Activity,
  ChevronDown,
  Info,
  BookOpen,
  Globe,
  Wifi,
  WifiOff,
  Copy,
  Settings,
  Loader2,
  Cloud
} from "lucide-react"

import Header from "@/components/Header"
import AwsCodeEntry from "@/components/AwsCodeEntry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { showToast } from "@/components/toast"
import { cn } from "@/lib/utils"
import { apiClient, api } from "@/lib/api"
import { QuizAPI, type QuizData, type QuizChallenge, type QuizProgress, type LeaderboardEntry } from "@/lib/quizApi"
import { useAuth } from "@/lib/auth"
import { useLabCheckout } from "@/lib/use-lab-checkout"
import CTFLeaderboardView from "@/components/CTFLeaderboardView"

// ── Types ──────────────────────────────────────────────────────────────────

interface CTFChallenge {
  id: string
  title: string
  points: number
  difficulty: "Easy" | "Medium" | "Hard"
  category: string
  scenario: string
  instructions: string
  hints: string[]
  flag: string // client-validated for standalone page
  solutionText?: string
}

interface CTFLab {
  id: string
  title: string
  description: string
  difficulty: string
  durationLabel: string
  machines: { label: string; ip: string; ports: string[]; creds?: string }[]
  challenges: CTFChallenge[]
}

// ── Static CTF Content Data ────────────────────────────────────────────────

const STATIC_LABS: CTFLab[] = [
  {
    id: "click-web-challenge",
    title: "Challenge 1 - ClickFix Pastejacking",
    description: "Analyze the ClickFix pastejacking payload and retrieve the flag from the live target environment.",
    difficulty: "Easy",
    durationLabel: "1 Hour",
    machines: [
      { label: "ClickFix Live Web Target", ip: "click-web.cyberrange.kctf.cloud", ports: ["443"] }
    ],
    challenges: [
      {
        id: "click-web-1",
        title: "ClickFix Pastejacking Analysis",
        points: 100,
        difficulty: "Easy",
        category: "Web / Pastejacking",
        scenario: "Access the target challenge site and inspect the social engineering payload designed to trick users into executing malicious PowerShell commands via clipboard hijacking.",
        instructions: "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Analyze the page and extract the flag.",
        hints: [
          "Visit the page and inspect the copy-to-clipboard functionality.",
          "Check how the script intercepts keypresses or click events to modify the clipboard content."
        ],
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
    machines: [
      { label: "Internal Gateway Router", ip: "10.10.10.1", ports: ["80", "22", "443"] },
      { label: "Primary Domain Controller (DC01)", ip: "10.10.10.100", ports: ["389", "445", "88", "3389"], creds: "Administrator:P@ssword123!" },
      { label: "SQL Database Server (SQL01)", ip: "10.10.10.120", ports: ["1433", "445", "5985"], creds: "sql_svc:RoastMePls!" },
      { label: "User Workstation (WS01)", ip: "10.10.10.50", ports: ["445", "3389", "5985"], creds: "j.doe:Welcome2026!" }
    ],
    challenges: [
      {
        id: "ad-1",
        title: "Reconnaissance & Initial Entry",
        points: 100,
        difficulty: "Easy",
        category: "Recon / Access",
        scenario: "You are connected to the internal LAN via VPN. Your first step is to scan the domain subnet, discover active hosts, and find an entry vector on the user workstation (WS01).",
        instructions: "Perform an Nmap scan on the workstation IP `10.10.10.50`. Locate the open HTTP service and find the developers secret token in the webpage metadata or source notes.\n\nFlag format: flag{secret_string}",
        hints: [
          "Check port 80/http on 10.10.10.50.",
          "Inspect the HTML comments in the developer staging page index source."
        ],
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
        instructions: "Enumerate the system for misconfigurations. Check running tasks, services, or registry key paths. A poorly configured scheduled task executes a backup binary with high privileges. Replace the binary or hijack the execution path to retrieve the flag located in `C:\\Users\\Administrator\\Desktop\\flag.txt`.",
        hints: [
          "Run `schtasks /query /fo LIST /v` to inspect scheduled tasks.",
          "Check the folder write permissions on the BackupAgent executable path."
        ],
        flag: "flag{cstar_ad_local_admin}",
        solutionText: "Run winPEAS or query scheduled tasks. Note that C:\\Program Files\\BackupAgent\\backup.exe is writeable by Authenticated Users. Overwrite it with a shell payload to read flag.txt."
      },
      {
        id: "ad-3",
        title: "Kerberoasting Service Accounts",
        points: 200,
        difficulty: "Medium",
        category: "Active Directory",
        scenario: "Now that you are local administrator on WS01, you have access to LSASS and AD tools. You need to extract active Kerberos service tickets (SPNs) and attempt to crack them offline.",
        instructions: "Request a service ticket for the SQL server service account (`sql_svc`) using Rubeus or native powershell commands. Extract the ticket hash, crack it locally using Hashcat with rockyou.txt, and submit the cracked password as the flag.",
        hints: [
          "Use Rubeus: `Rubeus.exe kerberoast /simple` to request SPNs.",
          "The cracked password follows the format flag{cracked_password}."
        ],
        flag: "flag{cstar_ad_kerberoast_hash}",
        solutionText: "Execute `Rubeus.exe kerberoast` to get the Kerberos TGS hash. Run hashcat format 13100 to reveal the password 'RoastMePls!'."
      },
      {
        id: "ad-4",
        title: "Domain Admin Controller Takeover",
        points: 300,
        difficulty: "Hard",
        category: "Active Directory",
        scenario: "Using the compromised SQL service account credentials, target the Domain Controller `DC01` to gain full enterprise domain administrator rights.",
        instructions: "Inspect Active Directory access control lists. The SQL service account has generic write privileges over the DC01 computer account. Perform a Resource-Based Constrained Delegation (RBCD) attack or run bloodhound to find the path. Abuse this delegation to spoof a Domain Admin ticket and read the crown jewel flag from the Domain Controller's file share.",
        hints: [
          "Configure delegation settings using PowerView or Impacket's rbcd.py.",
          "Request a ticket for Administrator using S4U2self/S4U2proxy."
        ],
        flag: "flag{cstar_ad_golden_ticket}",
        solutionText: "Abuse generic write permissions on DC01 computer object to set msDS-AllowedToActOnBehalfOfOtherIdentity. Obtain a domain administrator TGT using sql_svc permissions."
      }
    ]
  },
  {
    id: "crapi",
    title: "crAPI Web API Security Arena",
    description: "OWASP API Top 10 training environment focusing on vehicle portals, token exploits, mass assignment, and SSRF vulnerabilities.",
    difficulty: "Medium",
    durationLabel: "3 Hours",
    machines: [
      { label: "crAPI Front End Webapp", ip: "10.20.20.10", ports: ["80", "8080"] },
      { label: "Identity Provider Auth Service", ip: "10.20.20.20", ports: ["8025", "8080"] },
      { label: "Community & Forum microservice", ip: "10.20.20.30", ports: ["9090"] }
    ],
    challenges: [
      {
        id: "crapi-1",
        title: "Broken Object Level Authorization (BOLA)",
        points: 100,
        difficulty: "Easy",
        category: "BOLA",
        scenario: "The crAPI application lets users view their own vehicle location coordinates. The REST endpoint checks coordinates based on vehicle ID UUIDs.",
        instructions: "Log in with your learner account and view your dashboard network calls. Identify the API endpoint `/identity/api/v1/vehicles/{id}/location`. Modify the request UUID to match another vehicle (e.g., query standard parameters or check community posts for targets) to leak coordinates and find the validation key flag.",
        hints: [
          "Check the Community forum posts. User profiles disclose vehicle UUID values in public payloads.",
          "Swap your vehicle ID in the Location request in Burp Suite or developer tools."
        ],
        flag: "flag{cstar_crapi_bola_uuid}",
        solutionText: "Retrieve vehicle ID from public community posts, then GET /identity/api/v1/vehicles/OTHER_VEHICLE_UUID/location to extract coordinates containing flag."
      },
      {
        id: "crapi-2",
        title: "Broken User Auth (JWT alg None)",
        points: 150,
        difficulty: "Medium",
        category: "Broken Auth",
        scenario: "The platform's microservices rely on JSON Web Tokens (JWT) for authentication checks. The gateway verifies credentials but is poorly configured for cryptographic checks.",
        instructions: "Extract your authentication JWT token from headers. Decode it and modify the algorithm header parameter to `none` (or `None`). Set the user email payload field to `admin@crapi.local` to spoof an admin session, submit the request to `/identity/api/v1/admin/status`, and retrieve the response flag.",
        hints: [
          "Set `alg` to `none` in the JWT header block.",
          "Ensure you remove the signature part of the JWT (leave the trailing period: header.payload.)."
        ],
        flag: "flag{cstar_crapi_jwt_alg_none}",
        solutionText: "Convert token header to {'alg': 'none', 'typ': 'JWT'}, payload to {'email': 'admin@crapi.local'}, encode in base64, remove signature block, and make request."
      },
      {
        id: "crapi-3",
        title: "Mass Assignment Exploitation",
        points: 200,
        difficulty: "Medium",
        category: "Mass Assignment",
        scenario: "The vehicle dashboard permits ordered parts catalog checkouts. A backend structure deserializes body parameters directly into database fields.",
        instructions: "Attempt to order a spare part. The request POSTs JSON data containing part details. Inject an unauthorized parameter (e.g., `\"status\": \"delivered\"` or `\"free_delivery\": true`) into the POST request body. Successfully bypass the checkout paywall, complete the transaction, and view the receipt flag.",
        hints: [
          "Inspect parameters returned in GET /api/v1/orders/.",
          "Add the key `\"status\": \"delivered\"` or `\"discount\": 100` to your POST body when creating an order."
        ],
        flag: "flag{cstar_crapi_mass_assign}",
        solutionText: "Intercept POST /api/v1/orders, inject the mass assignment payload parameter 'status': 'delivered' to auto-approve purchase order without credit deduction."
      }
    ]
  },
  {
    id: "initial-access",
    title: "Initial Access Vectors & Smuggling",
    description: "Simulated initial access operations focusing on pastejacking (ClickFix), HTML smuggling, and malicious LNK delivery payloads.",
    difficulty: "Easy",
    durationLabel: "2 Hours",
    machines: [
      { label: "ClickFix Live Web Target", ip: "click-web.cyberrange.kctf.cloud", ports: ["443"] },
      { label: "Phishing Server Gateway", ip: "10.30.30.15", ports: ["80", "443"] }
    ],
    challenges: [
      {
        id: "ia-1",
        title: "HTML Smuggling Analysis",
        points: 100,
        difficulty: "Easy",
        category: "HTML Smuggling",
        scenario: "A target user was sent an HTML attachment which downloaded a malware payload locally without triggering perimeter gateway alarms.",
        instructions: "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Analyze the provided smuggle script. The script uses Javascript Blob and URL.createObjectURL to compile a payload in the browser. Decode the base64 payload block in the script to find the hidden flag file content.",
        hints: [
          "Locate the base64-encoded string representing the file payload inside the HTML script tags.",
          "Decode it using cyberchef or terminal commands: `echo <base64> | base64 -d`."
        ],
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
        instructions: "Access the live challenge at https://click-web.cyberrange.kctf.cloud. Examine the clickfix template command. It copies a PowerShell command payload to the user's clipboard. Decode the nested powershell command arguments (e.g. check for -enc base64 payload parameters) to reveal the command server IP and flag.",
        hints: [
          "Find the Base64 command inside the powershell argument `-enc` or `-EncodedCommand`.",
          "Decode the UTF-16LE / Unicode base64 bytes to get the plain text script."
        ],
        flag: "flag{cstar_clickfix_cmd_exec}",
        solutionText: "Decode the powershell encoded payload block. Remember Windows powershell uses Unicode (UTF-16LE) base64 formatting."
      }
    ]
  },
  {
    id: "demo-lab",
    title: "Demo Lab Scenario",
    description: "A lightweight demo CTF scenario to test live connections, mock payments, and flag submissions.",
    difficulty: "Easy",
    durationLabel: "1 Hour",
    machines: [
      { label: "Demo Sandbox Gateway", ip: "10.99.99.1", ports: ["80", "22"] },
      { label: "Vulnerable Apache Web Server", ip: "10.99.99.10", ports: ["80", "8080"], creds: "guest:guest" }
    ],
    challenges: [
      {
        id: "demo-1",
        title: "The Entryway Flag",
        points: 50,
        difficulty: "Easy",
        category: "Web",
        scenario: "Locate the entry point on the target machine and look for a simple hidden flag.",
        instructions: "Scan target 10.99.99.10 and view the index page headers or root path. The flag is flag{cstar_demo_entry_success}.",
        hints: [
          "Check the HTTP headers returned by the index server."
        ],
        flag: "flag{cstar_demo_entry_success}",
        solutionText: "Run curl -I http://10.99.99.10 to view the headers."
      },
      {
        id: "demo-2",
        title: "Local SSH Flag",
        points: 100,
        difficulty: "Easy",
        category: "System",
        scenario: "Access the vulnerable server via SSH using the guest credentials and retrieve the secret file.",
        instructions: "Use ssh guest@10.99.99.10 with password guest. Find the secret flag file in the home directory. Flag format: flag{cstar_demo_ssh_compromise}.",
        hints: [
          "Run ls -la in the home directory."
        ],
        flag: "flag{cstar_demo_ssh_compromise}",
        solutionText: "Run ssh guest@10.99.99.10, enter password 'guest', then run cat ~/flag.txt."
      }
    ]
  }
]

export default function StandaloneCTFPlayground() {
  // Client-only state management
  const [selectedLabId, setSelectedLabId] = useState<string>("click-web-challenge")
  const [selectedChallengeIdx, setSelectedChallengeIdx] = useState<number>(0)
  
  // Progress state persisted in localstorage
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])
  const [score, setScore] = useState<number>(0)
  const [unlockedHints, setUnlockedHints] = useState<Record<string, number>>({}) // challengeId -> hint count unlocked
  
  // Interactive form states
  const [flagInput, setFlagInput] = useState("")
  const [activeTab, setActiveTab] = useState<"arena" | "scoreboard" | "writeups" | "sync" | "aws">("arena")
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState<number>(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Live Sync state management
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false)
  const [liveLabData, setLiveLabData] = useState<QuizData | null>(null)
  const [liveProgress, setLiveProgress] = useState<QuizProgress | null>(null)
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isConnectingModalOpen, setIsConnectingModalOpen] = useState<boolean>(false)
  const [serverUrl, setServerUrl] = useState<string>("")
  const [liveLabId, setLiveLabId] = useState<string>("click-web-challenge")
  const [liveToken, setLiveToken] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [originalBaseUrl, setOriginalBaseUrl] = useState<string>("")

  const [allocatedLabIds, setAllocatedLabIds] = useState<string[]>([])
  const [liveDeployment, setLiveDeployment] = useState<any | null>(null)
  const [vpnCommand, setVpnCommand] = useState<string>("")
  const [isFetchingVpn, setIsFetchingVpn] = useState(false)
  const [activeDeploymentCountdown, setActiveDeploymentCountdown] = useState<string>("")
  const [deploymentExpiry, setDeploymentExpiry] = useState<string>("")
  const [catalogLabs, setCatalogLabs] = useState<any[]>([])
  const [myAllocations, setMyAllocations] = useState<any[]>([])
  const [remainingScheduleSeconds, setRemainingScheduleSeconds] = useState<number | null>(null)

  const matchingCatalogLab = catalogLabs.find((l: any) => 
    l.slug === selectedLabId || 
    l.id === selectedLabId ||
    l.title.toLowerCase().replace(/[^a-z0-9]/g, "").includes(selectedLabId.toLowerCase().replace(/[^a-z0-9]/g, ""))
  ) || (selectedLabId === "demo-lab" ? {
    id: "demo-lab-uuid-1111-2222-3333",
    title: "Demo Lab Scenario",
    slug: "demo-lab",
    price_amount: 99.00,
    price_currency: "INR",
    is_active: true
  } : undefined)

  // ── Deployment & Live Details Synchronizer ─────────────────────────────────
  const [isDeployingLab, setIsDeployingLab] = useState(false)

  const fetchLiveDeploymentStatus = useCallback(async (labId: string) => {
    try {
      const res: any = await apiClient.get<any>('/labs/status')
      const payload = res?.data ?? res?.deployments ?? res
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.deployments) ? payload.deployments : [])
      
      const normalizedLabId = labId.toLowerCase().replace(/[^a-z0-9]/g, "")
      const matching = list.find((d: any) => {
        const title = (d.lab_title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
        const type = (d.lab_type || "").toLowerCase().replace(/[^a-z0-9]/g, "")
        return title.includes(normalizedLabId) || type.includes(normalizedLabId) ||
               (labId === "active-directory" && (type === "lab1" || title.includes("activedirectory"))) ||
               (labId === "crapi" && (type === "lab2" || title.includes("crapi")))
      })
      
      setLiveDeployment(matching || null)
      if (matching) {
        if (matching.expires_at) {
          setDeploymentExpiry(matching.expires_at)
        } else {
          setDeploymentExpiry("")
        }
      } else {
        setVpnCommand("")
        setDeploymentExpiry("")
      }
    } catch (err) {
      console.warn("Failed to fetch live deployment status:", err)
    }
  }, [])

  const loadLiveLabDetails = useCallback(async (labId: string) => {
    try {
      const labData = await QuizAPI.getQuizData(labId)
      
      let progressData = null
      try {
        progressData = await QuizAPI.getProgress(labId)
      } catch (err) {
        console.warn("Could not fetch live progress:", err)
      }

      let leaderboardData: LeaderboardEntry[] = []
      try {
        leaderboardData = await QuizAPI.getLeaderboard(labId)
      } catch (err) {
        console.warn("Could not fetch live leaderboard:", err)
      }

      setLiveLabData(labData)
      setLiveProgress(progressData)
      setLiveLeaderboard(leaderboardData)
      setIsLiveMode(true)
      setSelectedLabId(labId)
      fetchLiveDeploymentStatus(labId)
    } catch (err) {
      console.error("Failed to load live lab details:", err)
    }
  }, [fetchLiveDeploymentStatus])

  const handleDeployLab = async () => {
    const targetLab = matchingCatalogLab || (selectedLabId === "demo-lab" ? { id: "demo-lab-uuid-1111-2222-3333" } : null)
    if (!targetLab) {
      showToast("error", "Lab catalog details not found.")
      return
    }

    setIsDeployingLab(true)
    showToast("info", "Initiating secure cloud lab deployment...")
    try {
      const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      await api.sysDeployLab({
        content_id: targetLab.id,
        expires_at: expiresAt
      })
      showToast("success", "Lab environment deployment queued successfully!")
      fetchLiveDeploymentStatus(selectedLabId)
    } catch (err: any) {
      showToast("error", `Deployment failed: ${err.message || err}`)
    } finally {
      setIsDeployingLab(false)
    }
  }

  // Fetch initial base URL, token, and lab catalog
  useEffect(() => {
    let tok = ""
    if (typeof window !== "undefined") {
      setServerUrl(apiClient.baseURL || "http://localhost:8000")
      setOriginalBaseUrl(apiClient.baseURL || "http://localhost:8000")
      tok = localStorage.getItem("cystar_token") || ""
      setLiveToken(tok)
    }

    const fetchCatalog = async () => {
      try {
        const rows = await api.catalogLabs()
        setCatalogLabs(rows || [])
        if (tok) {
          setIsLiveMode(true)
          
          // Fetch student allocations
          api.getMyCtfAllocations().then(res => {
            if (res && res.allocations && res.allocations.length > 0) {
              setMyAllocations(res.allocations)
              const allocatedIds = res.allocations.map((a: any) => a.lab_id)
              setAllocatedLabIds(allocatedIds)
              setSelectedLabId(allocatedIds[0])
              loadLiveLabDetails(allocatedIds[0])
            } else {
              setMyAllocations([])
              setAllocatedLabIds([])
              loadLiveLabDetails("click-web-challenge")
            }
          }).catch(err => {
            console.warn("Failed to fetch ctf allocations:", err)
            setMyAllocations([])
            loadLiveLabDetails("click-web-challenge")
          })
        }
      } catch (err) {
        console.warn("Failed to fetch catalog labs:", err)
      }
    }
    fetchCatalog()
  }, [loadLiveLabDetails])

  const currentLab = isLiveMode && liveLabData ? {
    id: liveLabData.labId,
    title: liveLabData.title,
    description: liveLabData.description,
    difficulty: "Medium",
    durationLabel: `${liveLabData.estimatedDuration || 3} Hours`,
    machines: STATIC_LABS.find((l) => l.id === liveLabData.labId)?.machines || [],
    challenges: liveLabData.challenges.map(ch => ({
      id: String(ch.id),
      title: ch.title,
      points: ch.points,
      difficulty: ch.difficulty,
      category: ch.category,
      scenario: ch.scenario,
      instructions: ch.instructions,
      hints: ch.hints,
      flag: "", // Server validated
      solutionText: "Solutions are hidden in live server mode."
    }))
  } : STATIC_LABS.find((l) => l.id === selectedLabId) || STATIC_LABS[0]

  const currentChallenge = currentLab.challenges[selectedChallengeIdx] || currentLab.challenges[0]

  const { user, isLabEntitled } = useAuth()
  const isEntitled = true // Pricing/payment locks removed per instruction

  const currentLabObj = {
    id: matchingCatalogLab ? matchingCatalogLab.id : selectedLabId,
    title: matchingCatalogLab ? matchingCatalogLab.title : currentLab.title,
    isPurchasable: true
  } as any

  const { buyLab, busy: isCheckingOut, errorMessage: checkoutError, clearError: clearCheckoutError } = useLabCheckout({
    lab: currentLabObj,
    userEmail: user?.email
  })

  const [isPayingDirect, setIsPayingDirect] = useState(false)
  const [directPayError, setDirectPayError] = useState<string | null>(null)

  const handleDirectPay = async () => {
    if (!matchingCatalogLab) {
      setDirectPayError("Selected lab could not be matched in the catalog.")
      showToast("error", "Lab not found in catalog.")
      return
    }

    setIsPayingDirect(true)
    setDirectPayError(null)

    try {
      showToast("info", "Initiating Razorpay checkout order...")
      let order: any
      try {
        const res = await apiClient.post<any>("/billing/orders", {
          content_id: matchingCatalogLab.id
        })
        order = res?.data ?? res
        if (!order || !order.razorpay_order_id) {
          throw new Error(res?.message || "Failed to create checkout order.")
        }
      } catch (apiErr) {
        console.warn("Failed to create order on server, falling back to local sandbox checkout:", apiErr)
        if (selectedLabId === "demo-lab" || apiClient.baseURL?.includes("localhost") || apiClient.baseURL?.includes("127.0.0.1")) {
          order = {
            razorpay_order_id: `order_mock_${Math.random().toString(36).substring(2, 15)}`,
            amount_minor: 9900,
            currency: "INR",
            razorpay_key_id: "rzp_test_mockkey",
            internal_payment_id: `pay_mock_internal_${Date.now()}`
          }
        } else {
          throw apiErr
        }
      }

      if (order.razorpay_order_id.startsWith("order_mock_")) {
        // Mock payment captured callback directly for sandbox developer flow
        showToast("info", "Processing sandbox mockup transaction...")
        const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 15)}`
        try {
          await apiClient.post("/billing/verify-capture", {
            razorpay_order_id: order.razorpay_order_id,
            razorpay_payment_id: mockPaymentId
          })
          showToast("success", "Sandbox checkout successful! Lab access unlocked.")
          fetchLiveDeploymentStatus(selectedLabId)
        } catch (err: any) {
          console.warn("Mock verify-capture failed:", err)
          showToast("warning", "Fulfillment delayed, please refresh status.")
        }
        setIsPayingDirect(false)
        return
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK is not loaded. Please try again.")
      }

      const options = {
        key: order.razorpay_key_id,
        amount: order.amount_minor,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: "RangeOps",
        description: `CTF Unlock: ${matchingCatalogLab.title}`,
        prefill: user?.email ? { email: user.email } : undefined,
        theme: { color: "#10b981" },
        handler: async (response: any) => {
          showToast("info", "Verifying payment...")
          try {
            await apiClient.post("/billing/verify-capture", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })
            showToast("success", "Payment verified! Premium access unlocked.")
            fetchLiveDeploymentStatus(selectedLabId)
          } catch (err: any) {
            console.warn("verify-capture failed:", err)
            showToast("warning", "Fulfillment verifying, please refresh in a moment.")
          }
        },
        modal: {
          ondismiss: () => {
            showToast("info", "Checkout dismissed.")
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on("payment.failed", (resp: any) => {
        setDirectPayError(resp?.error?.description || "Payment failed.")
        showToast("error", "Razorpay checkout failed.")
      })
      rzp.open()
    } catch (err: any) {
      console.error(err)
      setDirectPayError(err?.message || "Could not start Razorpay checkout.")
      showToast("error", err?.message || "Could not start checkout.")
    } finally {
      setIsPayingDirect(false)
    }
  }

  // Timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Allocation-based countdown timer loop
  useEffect(() => {
    if (!isLiveMode || myAllocations.length === 0) {
      setRemainingScheduleSeconds(null)
      return
    }

    const updateRemaining = () => {
      const allocation = myAllocations.find(a => a.lab_id === selectedLabId)
      if (!allocation || !allocation.start_time) {
        setRemainingScheduleSeconds(null)
        return
      }

      const startTimeMs = new Date(allocation.start_time).getTime()
      const durationMs = allocation.duration_hours * 60 * 60 * 1000
      const endTimeMs = startTimeMs + durationMs
      const remainingSecs = Math.max(0, Math.floor((endTimeMs - Date.now()) / 1000))
      
      setRemainingScheduleSeconds(remainingSecs)
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 1000)
    return () => clearInterval(interval)
  }, [isLiveMode, myAllocations, selectedLabId])

  // Load progress from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCompleted = localStorage.getItem("ctf_completed")
      const storedUnlockedHints = localStorage.getItem("ctf_hints")
      
      if (storedCompleted) {
        try {
          const parsed = JSON.parse(storedCompleted) as string[]
          setCompletedChallenges(parsed)
          
          // Recompute score
          let totalScore = 0
          for (const lab of STATIC_LABS) {
            for (const ch of lab.challenges) {
              if (parsed.includes(ch.id)) {
                totalScore += ch.points
              }
            }
          }
          setScore(totalScore)
        } catch {}
      }
      
      if (storedUnlockedHints) {
        try {
          setUnlockedHints(JSON.parse(storedUnlockedHints))
        } catch {}
      }
    }
  }, [])

  // Mock leaderboard dynamic updates based on current user score (only active in offline mode)
  useEffect(() => {
    if (isLiveMode) return;

    const defaultLeaderboard: LeaderboardEntry[] = [
      { rank: 1, name: "CyberStar_Lead", email: "lead@cyberstar.io", totalPoints: 750, totalTimeSpent: 1200, completedChallenges: 6, completionDate: "" },
      { rank: 2, name: "PwnMachine", email: "pwn@academy.local", totalPoints: 500, totalTimeSpent: 1800, completedChallenges: 4, completionDate: "" },
      { rank: 3, name: "NetRunner", email: "runner@cystar.io", totalPoints: 400, totalTimeSpent: 2200, completedChallenges: 3, completionDate: "" },
      { rank: 4, name: "Operator01", email: "test_op@academy.io", totalPoints: 100, totalTimeSpent: 800, completedChallenges: 1, completionDate: "" }
    ]

    // Insert current score dynamically
    const currentName = user?.name || "You (Local Operator)"
    const myEntry: LeaderboardEntry = {
      rank: 0,
      name: currentName,
      email: user?.email || "you@local.ctf",
      totalPoints: score,
      totalTimeSpent: timeElapsed,
      completedChallenges: completedChallenges.length,
      completionDate: ""
    }

    const merged = [...defaultLeaderboard, myEntry]
    merged.sort((a, b) => b.totalPoints - a.totalPoints || a.totalTimeSpent - b.totalTimeSpent)
    
    // Assign ranks
    const ranked = merged.map((e, idx) => ({ ...e, rank: idx + 1 }))
    setLeaderboard(ranked)
  }, [score, completedChallenges, timeElapsed, isLiveMode, user])

  const handleSelectLab = (labId: string) => {
    setSelectedLabId(labId)
    setSelectedChallengeIdx(0)
    setFlagInput("")
    setActiveTab("instructions")
    if (isLiveMode) {
      loadLiveLabDetails(labId)
    }
  }

  const handleSelectChallenge = (index: number) => {
    setSelectedChallengeIdx(index)
    setFlagInput("")
    setActiveTab("instructions")
  }

  const handleUnlockHint = async (challengeId: string) => {
    if (isLiveMode) {
      try {
        const challengeIdNum = Number(challengeId)
        
        // Map current hintsUsed and set this challenge to true
        const hintsUsedCopy = { ...(liveProgress?.hintsUsed || {}) }
        hintsUsedCopy[challengeIdNum] = true

        await QuizAPI.updateProgress(selectedLabId, {
          hintsUsed: hintsUsedCopy
        })

        // Refresh progress
        const nextProgress = await QuizAPI.getProgress(selectedLabId)
        setLiveProgress(nextProgress)
        showToast("info", "Hint unlocked on server!")
      } catch (err: any) {
        console.error(err)
        showToast("error", "Failed to unlock hint on server.")
      }
    } else {
      const currentUnlocked = unlockedHints[challengeId] || 0
      const nextCount = currentUnlocked + 1
      const updated = { ...unlockedHints, [challengeId]: nextCount }
      
      setUnlockedHints(updated)
      if (typeof window !== "undefined") {
        localStorage.setItem("ctf_hints", JSON.stringify(updated))
      }
      showToast("info", "Hint unlocked successfully!")
    }
  }

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentChallenge || !flagInput.trim()) return

    const input = flagInput.trim()

    if (isLiveMode) {
      try {
        const challengeIdNum = Number(currentChallenge.id)
        const response = await QuizAPI.submitFlag(selectedLabId, challengeIdNum, input, timeElapsed)

        if (response.isCorrect) {
          showToast("success", `Excellent hack! Flag verified: Correct!`)
          setFlagInput("")
          
          // Refresh progress and leaderboard from server
          try {
            const nextProgress = await QuizAPI.getProgress(selectedLabId)
            setLiveProgress(nextProgress)
            
            const nextLeaderboard = await QuizAPI.getLeaderboard(selectedLabId)
            setLiveLeaderboard(nextLeaderboard)
          } catch (err) {
            console.warn("Could not refresh progress/leaderboard:", err)
          }
          
          // Auto-advance
          if (selectedChallengeIdx < currentLab.challenges.length - 1) {
            setSelectedChallengeIdx(prev => prev + 1)
          }
        } else {
          showToast("error", "Invalid flag. Enumerate harder and retry!")
        }
      } catch (err: any) {
        console.error(err)
        showToast("error", err?.message || "Failed to submit flag to server.")
      }
    } else {
      if (input === currentChallenge.flag) {
        if (completedChallenges.includes(currentChallenge.id)) {
          showToast("info", "Flag already solved!")
          setFlagInput("")
          return
        }

        const nextCompleted = [...completedChallenges, currentChallenge.id]
        setCompletedChallenges(nextCompleted)
        
        const newScore = score + currentChallenge.points
        setScore(newScore)
        
        if (typeof window !== "undefined") {
          localStorage.setItem("ctf_completed", JSON.stringify(nextCompleted))
        }
        
        showToast("success", `Excellent hack! Flag verified: +${currentChallenge.points} pts.`)
        setFlagInput("")
        
        // Auto-advance
        if (selectedChallengeIdx < currentLab.challenges.length - 1) {
          setSelectedChallengeIdx(prev => prev + 1)
        }
      } else {
        showToast("error", "Invalid flag. Enumerate harder and retry!")
      }
    }
  }

  const handleResetProgress = () => {
    setCompletedChallenges([])
    setScore(0)
    setUnlockedHints({})
    setTimeElapsed(0)
    if (typeof window !== "undefined") {
      localStorage.removeItem("ctf_completed")
      localStorage.removeItem("ctf_hints")
    }
    showToast("success", "CTF progress wiped clean.")
    setShowConfirmReset(false)
  }

  const handleConnectLive = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsConnecting(true)
    setSyncError(null)

    try {
      if (serverUrl) {
        apiClient.baseURL = serverUrl
      }
      
      if (liveToken) {
        localStorage.setItem("cystar_token", liveToken)
        apiClient.refreshToken()
      }

      await loadLiveLabDetails(liveLabId)
      setSelectedChallengeIdx(0)
      setIsConnectingModalOpen(false)
      showToast("success", "Connected dynamically to Live Range")
    } catch (err: any) {
      console.error(err)
      setSyncError(err?.message || "Failed to establish server connection. Verify server URL & Lab ID.")
      // Revert base URL
      apiClient.baseURL = originalBaseUrl || apiClient.baseURL
      apiClient.refreshToken()
      showToast("error", "Sync connection failed.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnectLive = () => {
    if (originalBaseUrl) {
      apiClient.baseURL = originalBaseUrl
      apiClient.refreshToken()
    }
    setIsLiveMode(false)
    setLiveLabData(null)
    setLiveProgress(null)
    setLiveLeaderboard([])
    setLiveDeployment(null)
    setVpnCommand("")
    showToast("info", "Disconnected from Live Server. Reverted to Standalone Sandbox.")
  }



  // Live countdown timer for active running deployment on user side
  useEffect(() => {
    const updateCountdown = () => {
      const isRunning = liveDeployment && liveDeployment.status === "running"
      if (!isRunning || !deploymentExpiry) {
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
  }, [liveDeployment, deploymentExpiry])

  const handleJoinLiveVpn = async () => {
    if (!liveDeployment) return
    setIsFetchingVpn(true)
    try {
      const res = await apiClient.post<any>(`/labs/join/${liveDeployment.deployment_id}`)
      const payload = res?.data ?? res
      if (payload && payload.command) {
        setVpnCommand(payload.command)
        showToast("success", "VPN join credentials generated!")
      } else {
        showToast("error", "Failed to retrieve VPN key. Invalid server response.")
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to retrieve VPN key.")
    } finally {
      setIsFetchingVpn(false)
    }
  }

  useEffect(() => {
    if (isLiveMode) {
      fetchLiveDeploymentStatus(selectedLabId)
    } else {
      setLiveDeployment(null)
      setVpnCommand("")
    }
  }, [isLiveMode, selectedLabId])

  // Calculate metrics based on mode
  const activeCompletedChallenges = isLiveMode
    ? (liveProgress?.completedChallenges || []).map(id => String(id))
    : completedChallenges

  const activeScore = isLiveMode ? (liveProgress?.totalPoints || 0) : score

  const totalLabChallenges = currentLab.challenges.length
  const solvedLabChallenges = currentLab.challenges.filter(c => activeCompletedChallenges.includes(c.id)).length
  const totalAvailablePoints = isLiveMode && liveLabData ? (liveLabData.totalPoints || 0) : STATIC_LABS.reduce((sum, lab) => sum + lab.challenges.reduce((s, c) => s + c.points, 0), 0)
  const scorePct = totalAvailablePoints > 0 ? Math.round((activeScore / totalAvailablePoints) * 100) : 0
  const visibleLabs = isLiveMode ? STATIC_LABS.filter(lab => {
    const isAllocated = allocatedLabIds.includes(lab.id)
    if (!isAllocated) return false
    const alloc = myAllocations.find(a => a.lab_id === lab.id)
    if (alloc && alloc.start_time) {
      const endTime = new Date(alloc.start_time).getTime() + alloc.duration_hours * 3600 * 1000
      if (Date.now() > endTime) return false
    }
    return true
  }) : STATIC_LABS

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const isChallengeCompleted = activeCompletedChallenges.includes(currentChallenge.id)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 font-sans transition-colors duration-300">
      <Header active="ctf" />
      
      {/* Top Status Header/Banner */}
      <section className="relative overflow-hidden border-b border-border bg-card py-6 px-6 backdrop-blur-xl shadow-xs">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground rounded-lg">
                <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back Dashboard</Link>
              </Button>
              {user?.role === "sys_admin" && (
                <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-primary hover:bg-primary/10 rounded-lg border border-primary/20">
                  <Link href="/admin-ctf">
                    <Settings className="w-4 h-4 mr-1.5 text-primary" /> Admin Control Deck
                  </Link>
                </Button>
              )}
              {isLiveMode ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" /> Live Synced Range
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  <Shield className="w-3.5 h-3.5 text-amber-500" /> Offline Sandbox
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">CTF Flag Capture Hub</h1>
            <p className="text-muted-foreground text-xs font-light">
              {isLiveMode ? "Live synchronization mode active. Track points and verify flags directly on the remote server." : "Standalone client-side training grounds. Hack the challenges and verify keys locally."}
            </p>
          </div>
          
          {/* Progress Indicators */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-lg min-w-[200px] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Capture Score</span>
                <span className="text-emerald-400 font-bold font-mono">{activeScore} / {totalAvailablePoints} pts</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-all duration-500 rounded-full"
                  style={{ width: `${scorePct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>{solvedLabChallenges} Solved</span>
                <span>{scorePct}% Solved</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-lg flex flex-col justify-center items-center min-w-[120px] h-[78px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Session Time
              </span>
              <span className="text-xl font-extrabold text-white font-mono mt-1">
                {remainingScheduleSeconds !== null ? formatTimer(remainingScheduleSeconds) : formatTimer(timeElapsed)}
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-lg flex flex-col justify-center items-center min-w-[180px] h-[78px] relative overflow-hidden group">
              {isLiveMode ? (
                <>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Connected Competition
                  </span>
                  <span className="text-[11px] font-bold text-white font-mono truncate max-w-[150px] mt-1" title={serverUrl}>
                    {serverUrl.replace(/https?:\/\//, '')}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleDisconnectLive}
                    className="h-6 mt-1 text-[9px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 rounded-lg font-bold"
                  >
                    Leave Competition
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-slate-500" /> Offline Mode
                  </span>
                  <Button 
                    size="sm" 
                    onClick={() => setActiveTab("sync")}
                    className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] h-7 px-3 rounded-lg shadow-lg shadow-emerald-500/10 transition-all hover:scale-105"
                  >
                    Join Live Competition
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <div className="max-w-[1600px] mx-auto w-full flex-1 p-6 flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="border border-white/10 bg-slate-950/40 backdrop-blur-xl rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="space-y-1 py-2 px-1">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                Hacking Dashboard
              </h2>
              <p className="text-slate-400 text-[10px] font-light">CyberRange training hub & flags.</p>
            </div>

            <nav className="space-y-1">
              {[
                { id: "arena", label: "Hacking Arena", sub: "Challenge Guide & VMs", icon: Terminal },
                { id: "scoreboard", label: "CTF Scoreboard", sub: "Global Solver Rankings", icon: Trophy },
                { id: "writeups", label: "Walkthrough Writeups", sub: "Solution Methodology", icon: BookOpen },
                { id: "sync", label: "Server Sync", sub: "Join Live Competitions", icon: Wifi },
                { id: "aws", label: "AWS Cloud Labs", sub: "Cloud Range Access", icon: Cloud }
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any)
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
            
            <div className="pt-3 border-t border-white/5">
              {isLiveMode ? (
                <div className="rounded-xl bg-white/5 p-3 text-center border border-white/5">
                  <p className="text-[9px] text-slate-500 italic">Progress syncs live with Range Server.</p>
                </div>
              ) : showConfirmReset ? (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] text-rose-300 leading-normal">Wipe all completed CTF flags and reset score?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleResetProgress} className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs py-1 flex-1">
                      Reset
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowConfirmReset(false)} className="border-white/10 bg-white/5 text-xs py-1 flex-1 text-slate-300">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  className="w-full bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 rounded-xl text-[10px] py-2 h-9"
                >
                  Reset Progress
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          
          {/* TAB 1: HACKING ARENA */}
          {activeTab === "arena" && (
            isLiveMode && visibleLabs.length === 0 ? (
              <div className="border border-white/10 bg-slate-950/40 backdrop-blur-xl rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-6 shadow-xl my-10 w-full col-span-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">CTF Range Locked</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                    There are no scheduled or active CTF challenges allocated to your student group at this time.
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Once your instructor or administrator schedules a lab deployment for your group, it will automatically unlock and appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                
                {/* Challenges Selector column */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      {isLiveMode ? "Active Live Scenario" : "Select Scenario"}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedLabId}
                        onChange={(e) => handleSelectLab(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/20 backdrop-blur-xl shadow-lg appearance-none cursor-pointer"
                      >
                        {visibleLabs.map((lab) => (
                          <option key={lab.id} value={lab.id} className="bg-[#0A0A0B] text-white">
                            {lab.title} ({lab.difficulty})
                          </option>
                        ))}
                      </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1 pt-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" /> Scenario Flags
                    </h3>
                    <span className="text-[9px] font-mono text-slate-500">{solvedLabChallenges} / {totalLabChallenges}</span>
                  </div>
                  
                  <div className="space-y-2">
                    {currentLab.challenges.map((challenge, idx) => {
                      const isSolved = activeCompletedChallenges.includes(challenge.id)
                      const isSelected = selectedChallengeIdx === idx
                      
                      return (
                        <button
                          key={challenge.id}
                          type="button"
                          onClick={() => handleSelectChallenge(idx)}
                          className={cn(
                            "w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 group relative overflow-hidden",
                            isSelected
                              ? "border-emerald-500/40 bg-emerald-500/[0.03] text-white"
                              : "border-white/5 bg-white/[0.01] text-slate-300 hover:border-white/15 hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="space-y-1 relative z-10 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn(
                                "text-[7px] font-bold px-1 py-0.2 rounded uppercase font-mono",
                                challenge.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                challenge.difficulty === "Medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              )}>
                                {challenge.difficulty}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold truncate group-hover:text-emerald-400 transition-colors">{challenge.title}</h4>
                            <p className="text-[9px] text-slate-500 font-mono">{challenge.points} PTS · {challenge.category}</p>
                          </div>
                          
                          <div className="relative z-10 shrink-0 mt-0.5 flex items-center gap-1.5">
                            {(() => {
                              const hasClickWeb = currentLab.id === "click-web-challenge" || currentLab.id === "initial-access" || challenge.instructions.includes("click-web");
                              const url = hasClickWeb ? "https://click-web.cyberrange.kctf.cloud" : challenge.instructions.match(/https?:\/\/[^\s]+/)?.[0];
                              if (!url) return null;
                              const cleanUrl = url.replace(/[\.,]+$/, '');
                              return (
                                <a
                                  href={cleanUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-emerald-400 p-1 rounded hover:bg-white/5 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open challenge target"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              );
                            })()}
                            {isSolved ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-white/10 bg-black/40 flex items-center justify-center text-[8px] font-mono text-slate-500">
                                {idx + 1}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Active Challenge Guide Column */}
              <div className="lg:col-span-6 space-y-4">
                <Card className="border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl p-5 min-h-[500px] flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-4">
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white tracking-tight leading-snug">{currentChallenge.title}</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Category: {currentChallenge.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(() => {
                          const hasClickWeb = currentLab.id === "click-web-challenge" || currentLab.id === "initial-access" || currentChallenge.instructions.includes("click-web");
                          const url = hasClickWeb ? "https://click-web.cyberrange.kctf.cloud" : (() => {
                            const match = currentChallenge.instructions.match(/https?:\/\/[^\s]+/);
                            return match ? match[0].replace(/[\.,]+$/, '') : null;
                          })();
                          
                          if (!url) return null;
                          return (
                            <Button
                              asChild
                              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl px-3 py-1 h-8 text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Open Challenge
                              </a>
                            </Button>
                          );
                        })()}
                        <span className="text-xs font-extrabold text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1.5">
                          {currentChallenge.points} PTS
                        </span>
                      </div>
                    </div>

                    {/* Mission Context */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-1.5">
                      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mission Narrative Context</h3>
                      <p className="text-xs text-slate-300 leading-relaxed font-light whitespace-pre-wrap">{currentChallenge.scenario}</p>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-1.5">
                      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hacking Instructions</h3>
                      <div className="text-xs text-slate-300 leading-relaxed font-light whitespace-pre-wrap bg-black/40 border border-white/5 rounded-xl p-4 font-mono">
                        {currentChallenge.instructions.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                          if (part.match(/^https?:\/\//)) {
                            return (
                              <a
                                key={i}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 underline font-bold"
                              >
                                {part}
                              </a>
                            )
                          }
                          return part;
                        })}
                      </div>
                    </div>

                    {/* Hints Section */}
                    {currentChallenge.hints && currentChallenge.hints.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Available Intel Hints</h3>
                        <div className="space-y-2">
                          {currentChallenge.hints.map((hint, idx) => {
                            const isUnlocked = isLiveMode 
                              ? !!liveProgress?.hintsUsed[Number(currentChallenge.id)]
                              : (unlockedHints[currentChallenge.id] || 0) > idx
                            
                            return (
                              <div key={idx} className="rounded-xl border border-white/5 bg-slate-950/40 p-3.5">
                                {isUnlocked ? (
                                  <div className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-light">{hint}</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5 text-slate-600" /> Locked Hint #{idx + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleUnlockHint(currentChallenge.id)}
                                      className="h-7 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-[10px] px-2.5"
                                    >
                                      Unlock Hint
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submission Box */}
                  <div className="pt-4 border-t border-white/5 mt-6">
                    {isChallengeCompleted ? (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Flag Correct & Submitted!</p>
                          <p className="text-[10px] text-emerald-400/90 font-light">Successfully captured. +{currentChallenge.points} points credited to your session scoreboard.</p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitFlag} className="space-y-2">
                        <label htmlFor="flag-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Submit Captured Flag
                        </label>
                        <div className="flex gap-2">
                          <Input
                            id="flag-input"
                            placeholder="flag{xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx}"
                            value={flagInput}
                            onChange={(e) => setFlagInput(e.target.value)}
                            autoComplete="off"
                            className="h-10 rounded-xl border border-white/10 bg-white/[0.02] text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 shadow-md font-mono"
                          />
                          <Button
                            type="submit"
                            disabled={!flagInput.trim()}
                            className="h-10 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 rounded-xl shadow-md text-xs shrink-0"
                          >
                            Submit <Send className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </Card>
              </div>

              {/* Right Column: Targets Scope / Active VMs */}
              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                  <Terminal className="w-4 h-4 text-emerald-400" /> Target Lab Sandbox Scope
                </h3>
                
                <Card className="border border-white/10 bg-slate-950/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg">
                  <CardHeader className="pb-3 border-b border-white/5 bg-slate-950/20 p-4">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <CardTitle className="text-xs font-bold text-white truncate">{currentLab.title}</CardTitle>
                    </div>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">Difficulty: {currentLab.difficulty} · Est: {currentLab.durationLabel}</p>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 text-xs">
                    
                    {/* Machines Scope list */}
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-400" /> Virtual IP Targets
                      </p>
                      <div className="space-y-2">
                        {currentLab.machines.map((machine, index) => {
                          const isWebLink = machine.ip.includes("kctf.cloud") || machine.ip.startsWith("http") || (machine.ports && (machine.ports.includes("443") || machine.ports.includes("80")));
                          const cleanIp = machine.ip.replace(/[\.,]+$/, '');
                          const webUrl = cleanIp.startsWith("http") ? cleanIp : `https://${cleanIp}`;
                          return (
                            <div key={index} className="bg-white/5 border border-white/5 p-2.5 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-200 truncate max-w-[120px]">{machine.label}</span>
                                <span className="font-mono text-[9px] text-emerald-400">{machine.ip}</span>
                              </div>
                              
                              {machine.ports && machine.ports.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {machine.ports.map((p, pi) => (
                                    <span key={pi} className="text-[7.5px] font-mono bg-white/5 px-1 py-0.2 rounded text-slate-400">
                                      P{p}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {isWebLink && (
                                <div className="mt-2 pt-1 border-t border-white/5">
                                  <Button
                                    asChild
                                    size="sm"
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold rounded-lg h-7 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                                  >
                                    <a href={webUrl} target="_blank" rel="noopener noreferrer">
                                      Access Challenge <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </Button>
                                </div>
                              )}
                              
                              {machine.creds && (
                                <div className="mt-1.5 pt-1.5 border-t border-white/5 space-y-0.5 text-[9px]">
                                  <span className="text-slate-500 font-semibold">Credentials:</span>
                                  <code className="block font-mono bg-black/20 p-1 rounded text-slate-400 break-all text-[8px]">
                                    {machine.creds}
                                  </code>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Infrastructure Deployment controller */}
                    <div className="border-t border-white/5 pt-3">
                      {isLiveMode ? (
                        <>
                          {liveDeployment ? (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="text-[9px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> Live VM: {liveDeployment.status.toUpperCase()}
                                </p>
                                <Button 
                                  onClick={() => fetchLiveDeploymentStatus(selectedLabId)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-white/5 rounded"
                                >
                                  <RefreshCw className="w-3 h-3 text-slate-450" />
                                </Button>
                              </div>

                              {liveDeployment.status === 'running' && activeDeploymentCountdown && (
                                <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-[9px] font-bold w-fit">
                                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping mr-1" />
                                  <span>Time Left: {activeDeploymentCountdown}</span>
                                </div>
                              )}
                              
                              {liveDeployment.status === 'running' ? (
                                <div className="space-y-2">
                                  <p className="text-[9px] text-slate-400 leading-normal">VM Targets are active. Copy connection key to hook VPN routing.</p>
                                  
                                  {vpnCommand ? (
                                    <div className="space-y-1 mt-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[8px] uppercase font-bold text-slate-500">VPN command</span>
                                        <button
                                          onClick={() => {
                                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                              navigator.clipboard.writeText(vpnCommand)
                                              showToast("success", "Copied join key!")
                                            }
                                          }}
                                          className="text-emerald-400 hover:underline text-[9px] font-bold"
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <pre className="overflow-x-auto rounded bg-black/60 border border-white/10 p-2 text-[8px] text-emerald-400 font-mono max-h-[80px] select-all break-all whitespace-pre-wrap">
                                        {vpnCommand}
                                      </pre>
                                    </div>
                                  ) : (
                                    <Button 
                                      onClick={handleJoinLiveVpn}
                                      disabled={isFetchingVpn}
                                      className="w-full bg-[#1F2937] hover:bg-slate-700 text-white rounded-lg h-7 text-[10px] font-bold border border-white/10"
                                    >
                                      {isFetchingVpn ? "Getting VPN key..." : "Join VPN Network"}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[9px] text-slate-450 italic">Container state: {liveDeployment.status}. Please wait...</p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl space-y-2">
                              <p className="text-[9px] uppercase font-bold text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-500" /> Remote Lab Off
                              </p>
                              <p className="text-[9px] text-slate-450 leading-normal">
                                No active cloud infrastructure instances found. Click below to provision your VMs.
                              </p>
                              <Button
                                onClick={handleDeployLab}
                                disabled={isDeployingLab}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg h-8 text-[11px] font-bold"
                              >
                                {isDeployingLab ? "Deploying..." : "Provision Lab Targets"}
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl space-y-1.5">
                          <p className="text-[9px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" /> Sandbox Preview
                          </p>
                          <p className="text-[9px] text-slate-400 leading-normal">
                            Using local simulation playground. Connect VPN or start lab from live deployments.
                          </p>
                          <Button asChild className="w-full bg-white/5 hover:bg-white/10 text-white rounded-lg h-8 text-[10px] mt-1 border border-white/10">
                            <Link href="/dashboard">
                              Launch Live VM targets <ExternalLink className="w-3 h-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              </div>
            )
          )}

          {/* TAB 2: SCOREBOARD */}
          {activeTab === "scoreboard" && (
            <div className="space-y-4">
              <div className="border border-white/10 bg-white/[0.01] backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500 animate-bounce" /> Live Solver Rankings Scoreboard ({currentLab.title})
                  </h2>
                  <div className="text-[9px] font-mono font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-400 uppercase">
                    {isLiveMode ? "Server / Connected" : "Sandbox / Offline Cache"}
                  </div>
                </div>
                
                <CTFLeaderboardView 
                  entries={isLiveMode ? liveLeaderboard : leaderboard} 
                  isLiveMode={isLiveMode} 
                />
              </div>
            </div>
          )}

          {/* TAB 3: WRITEUPS & SOLUTIONS */}
          {activeTab === "writeups" && (
            <div className="space-y-6">
              <div className="border border-white/10 bg-white/[0.01] backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-base font-bold text-white">Vulnerability Walkthrough Guide & Writeups</h2>
                    <p className="text-xs text-slate-500">Methodology walkthrough scripts for all {currentLab.title} flags</p>
                  </div>
                </div>

                <div className="space-y-5 pt-2">
                  {currentLab.challenges.map((ch, idx) => (
                    <div key={ch.id} className="bg-white/5 border border-white/5 p-4.5 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-white">{ch.title}</h4>
                        </div>
                        <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-400 font-mono">+{ch.points} PTS · {ch.category}</span>
                      </div>
                      
                      <div className="bg-black/60 rounded p-4 font-mono text-[11px] text-emerald-400/90 leading-relaxed border border-white/5 whitespace-pre-wrap">
                        {isLiveMode ? (
                          "Solution writeups are locked during Live Server Mode to ensure CTF competition integrity. Please solve the challenges dynamically!"
                        ) : (
                          ch.solutionText || "No solution methodology registered for this challenge yet."
                        )}
                      </div>

                      {!isLiveMode && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg text-[10px]">
                          <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <p className="text-slate-400 leading-normal">
                            Verification Hash: <code className="text-emerald-400 select-all font-mono font-bold">{ch.flag}</code>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SERVER SYNC */}
          {activeTab === "sync" && (
            <div className="max-w-xl mx-auto space-y-6">
              <Card className="border border-white/10 bg-white/[0.01] backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-emerald-400" /> Join Live Range Competition
                    </h3>
                    <p className="text-xs text-slate-400 font-light mt-1">
                      Authenticate with a remote server endpoint to load real-time challenges, synchronize solver progress, and secure leaderboard ranking.
                    </p>
                  </div>

                  {syncError && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-450 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{syncError}</span>
                    </div>
                  )}

                  <form onSubmit={handleConnectLive} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Server API Endpoint URL</label>
                      <Input 
                        type="url"
                        required
                        placeholder="http://localhost:8000"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        className="h-10 border-white/10 bg-white/5 rounded-xl text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Lab ID / Slug Selection</label>
                      <div className="relative">
                        <select
                          value={liveLabId}
                          onChange={(e) => setLiveLabId(e.target.value)}
                          className="w-full h-10 rounded-xl border border-white/10 bg-[#0E0E12] px-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer"
                        >
                          <option value="click-web-challenge">click-web-challenge (ClickFix Pastejacking)</option>
                          <option value="active-directory">active-directory (Active Directory)</option>
                          <option value="crapi">crapi (OWASP API Arena)</option>
                          <option value="initial-access">initial-access (Phishing/Smuggling)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SSO Access Token Bearer Key (Optional)</label>
                      <Input 
                        type="password"
                        placeholder="Paste SSO Token Key..."
                        value={liveToken}
                        onChange={(e) => setLiveToken(e.target.value)}
                        className="h-10 border-white/10 bg-white/5 rounded-xl text-xs text-white"
                      />
                      <p className="text-[9px] text-slate-500 italic">Defaults to active session cookies if left blank.</p>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-white/5">
                      {isLiveMode ? (
                        <Button
                          type="button"
                          onClick={handleDisconnectLive}
                          variant="destructive"
                          className="flex-1 h-10 font-bold rounded-xl text-xs shadow-md"
                        >
                          Disconnect & Leave Competition
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={isConnecting}
                          className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Connecting...
                            </>
                          ) : (
                            "Establish Server Connection"
                          )}
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: AWS CLOUD LABS */}
          {activeTab === "aws" && (
            <div className="max-w-xl mx-auto space-y-6">
              <AwsCodeEntry labId="aws-security-labs" userEmail={user.email} />
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 bg-slate-950/40 text-center mt-auto">
        <p className="text-[10px] text-slate-600">
          All local submissions are checked in browser state. Refreshing will retain progress using localStorage cache settings.
        </p>
      </footer>
    </div>
  )
}
