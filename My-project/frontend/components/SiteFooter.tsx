import Link from "next/link"
import { Mail } from "lucide-react"

const SUPPORT_EMAIL = "support@deeptrustxai.academy"
const YEAR = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-muted-foreground transition-colors duration-300">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              RangeOps
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hands-on cyber range training by DeepTrustxAI Academy.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Platform
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-primary"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/labs"
                  className="transition-colors hover:text-primary"
                >
                  Labs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Support
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-sm transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              For billing, access, or technical issues, email us and include
              your account email and a short description.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-primary"
                >
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-primary"
                >
                  Terms of service
                </Link>
              </li>
              <li>
                <Link
                  href="/refund"
                  className="transition-colors hover:text-primary"
                >
                  Refunds (coming soon)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {YEAR} DeepTrustxAI Academy. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground text-muted-foreground"
            >
              Privacy
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground text-muted-foreground"
            >
              Terms
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link
              href="/refund"
              className="transition-colors hover:text-foreground text-muted-foreground"
            >
              Refunds (soon)
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
