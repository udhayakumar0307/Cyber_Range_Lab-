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
import { Shield, Mail, User, ShieldAlert, Lock } from "lucide-react"
import { getRoleHome } from "@/lib/role-home"

export default function SysAdminLoginPage() {
  const router = useRouter()
  const { isAuthenticated, user, devLogin } = useAuth()
  
  const [busy, setBusy] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminName, setAdminName] = useState("")

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

  const handleAdminLogin = async () => {
    const email = adminEmail.trim()
    const name = adminName.trim()
    if (!email) {
      showToast("error", "Please enter your System Admin email ID.")
      return
    }
    if (email.toLowerCase() !== "anand@academy.io") {
      showToast("error", "Access Denied: Invalid System Admin credentials.")
      return
    }
    if (!name) {
      showToast("error", "Please enter your name.")
      return
    }
    if (name.toLowerCase() !== "anand") {
      showToast("error", "Access Denied: Invalid System Admin name credentials.")
      return
    }
    setBusy(true)
    try {
      const role = await devLogin()
      showToast("success", "Logged in as System Administrator")
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
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-emerald-500/30">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

        <Card className="w-full max-w-lg border-emerald-500/30 bg-card/90 backdrop-blur-2xl shadow-2xl rounded-3xl p-6 relative z-10 space-y-2">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner">
              <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mx-auto">
              <Lock className="w-3 h-3" />
              <span>Restricted System Portal</span>
            </div>
            <CardTitle className="text-2xl font-black text-foreground">System Admin Login</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Authorized System Operator Authentication Area
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAdminLogin()
              }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">Operator Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">Operator Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 text-sm transition-all duration-300"
              >
                {busy ? "Authenticating Operator..." : "Authenticate as System Admin"}
              </Button>
            </form>

            <div className="pt-2 border-t border-border flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-light text-center">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
              <span>Restricted system log. Unauthorized authentication attempts are logged.</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
