"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { showToast } from "@/components/toast"
import Header from "@/components/Header"
import { UserCog, Users, Mail, User, ShieldAlert } from "lucide-react"
import { getRoleHome } from "@/lib/role-home"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, user, devLoginParticipant } = useAuth()
  
  const [busy, setBusy] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<"ctf_admin" | "student">("student")
  
  // Custom inputs for each role type
  const [ctfAdminEmail, setCtfAdminEmail] = useState("")
  const [studentEmail, setStudentEmail] = useState("")

  const [ctfAdminName, setCtfAdminName] = useState("")
  const [studentName, setStudentName] = useState("")

  useEffect(() => {
    if (isAuthenticated && user) {
      const ret =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("return") || ""
          : ""
      const safe =
        ret.startsWith("/") && !ret.startsWith("//") ? ret : ""
      router.replace(safe || getRoleHome(user.role))
    }
  }, [isAuthenticated, user, router])

  if (isAuthenticated && user) return null

  const handleCtfAdminLogin = async () => {
    const email = ctfAdminEmail.trim()
    const name = ctfAdminName.trim()
    if (!email) {
      showToast("error", "Please enter your email ID.")
      return
    }
    if (email.toLowerCase() !== "anandadmin@academy.io") {
      showToast("error", "Access Denied: Invalid CTF Admin credentials.")
      return
    }
    if (!name) {
      showToast("error", "Please enter your name.")
      return
    }
    if (name.toLowerCase() !== "anand") {
      showToast("error", "Access Denied: Invalid CTF Admin name credentials.")
      return
    }
    setBusy("ctf_admin")
    try {
      const role = await devLoginParticipant(email, name, "course_admin", true)
      showToast("success", `Logged in as CTF Admin (${email})`)
      const ret =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("return") || ""
          : ""
      const safe = ret.startsWith("/") && !ret.startsWith("//") ? ret : ""
      router.push(safe || getRoleHome(role))
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Dev login failed — is the backend running?",
      )
    } finally {
      setBusy(null)
    }
  }

  const handleStudentLogin = async () => {
    const email = studentEmail.trim()
    const name = studentName.trim()
    if (!email) {
      showToast("error", "Please enter your email ID.")
      return
    }
    if (!name) {
      showToast("error", "Please enter your name.")
      return
    }
    setBusy("student")
    try {
      const role = await devLoginParticipant(email, name, "participant", true)
      showToast("success", `Logged in as Student (${email})`)
      const ret =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("return") || ""
          : ""
      const safe = ret.startsWith("/") && !ret.startsWith("//") ? ret : ""
      router.push(safe || getRoleHome(role))
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Dev login failed — is the backend running?",
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-blue-500/30">
      <Header active="home" />

      <main className="flex-1 flex items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

        <Card className="w-full max-w-lg border-border bg-card/80 backdrop-blur-2xl shadow-2xl rounded-3xl p-5 relative z-10">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shadow-sm">
              {activeRole === "ctf_admin" && <UserCog className="h-7 w-7 text-purple-600 dark:text-violet-400 animate-pulse" />}
              {activeRole === "student" && <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />}
            </div>
            <CardTitle className="text-2xl font-black text-foreground">Sign in to RangeOps</CardTitle>
            <CardDescription className="space-y-1 text-muted-foreground font-light mt-1 text-xs">
              <span>Choose your role profile to access the sandbox environments</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Custom Segmented Tabs (Student / User & CTF Admin) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setActiveRole("student")}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 border",
                  activeRole === "student"
                    ? "bg-background border-primary/30 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80 border-transparent"
                )}
              >
                <Users className="w-4 h-4" />
                <span>Student / User</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveRole("ctf_admin")}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 border",
                  activeRole === "ctf_admin"
                    ? "bg-background border-purple-500/30 text-purple-600 dark:text-violet-400 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80 border-transparent"
                )}
              >
                <UserCog className="w-4 h-4" />
                <span>CTF Admin</span>
              </button>
            </div>

            {/* TAB CONTENT: STUDENT / USER */}
            {activeRole === "student" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                  
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Participant Name"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleStudentLogin}
                  disabled={busy !== null}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-md text-sm transition-all duration-300"
                >
                  {busy === "student" ? "Signing in as Student..." : "Login as Student"}
                </Button>
              </div>
            )}

            {/* TAB CONTENT: CTF ADMIN */}
            {activeRole === "ctf_admin" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="anandadmin@academy.io"
                      value={ctfAdminEmail}
                      onChange={(e) => setCtfAdminEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                  
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="CTF Coordinator Name"
                      value={ctfAdminName}
                      onChange={(e) => setCtfAdminName(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCtfAdminLogin}
                  disabled={busy !== null}
                  className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md text-sm transition-all duration-300"
                >
                  {busy === "ctf_admin" ? "Signing in as CTF Admin..." : "Login as CTF Admin"}
                </Button>
              </div>
            )}

            {/* SSO / Divider */}
            <div className="space-y-4 pt-2 border-t border-border">
              <Button variant="outline" className="w-full h-11 rounded-xl text-xs text-muted-foreground cursor-not-allowed" disabled>
                Continue with Google Single Sign-On (Google SSO coming soon)
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-light leading-relaxed text-center">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Dev login bypass is active for training and evaluation.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
