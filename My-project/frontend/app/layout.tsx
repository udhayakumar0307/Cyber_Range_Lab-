import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/lib/auth"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastContainer } from "@/components/toast"
import { ClientOnly } from "@/components/client-only"
import { SiteFooterGate } from "@/components/SiteFooterGate"

export const metadata: Metadata = {
  title: "RangeOps by DeepTrustxAI Academy",
  description:
    "Hands-on cyber range labs on RangeOps — real attack and defense scenarios by DeepTrustxAI Academy.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <SiteFooterGate />
            <ClientOnly>
              <ToastContainer />
            </ClientOnly>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
