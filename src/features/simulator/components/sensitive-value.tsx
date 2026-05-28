import { CheckIcon } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type SensitiveKind = "phone" | "guid" | "url" | "text"

export function SensitiveValue({
  value,
  reveal,
  kind = "text",
  className,
  mono = true,
}: {
  value: string | null | undefined
  reveal: boolean
  kind?: SensitiveKind
  className?: string
  mono?: boolean
}) {
  if (!value) return null

  return (
    <span
      className={cn(mono && "font-mono", className)}
      title={reveal ? value : undefined}
    >
      {reveal ? value : maskSensitive(value, kind)}
    </span>
  )
}

export function SensitiveCopy({
  value,
  reveal,
  kind = "text",
  label,
  className,
}: {
  value: string | null | undefined
  reveal: boolean
  kind?: SensitiveKind
  label: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  if (!value) return null

  const copyValue = async () => {
    await copyText(value)
    setCopied(true)
  }

  if (copied) {
    return (
      <Badge
        variant="outline"
        className="border-success/35 bg-success/10 font-mono text-success"
      >
        <CheckIcon className="size-3" />
        Copied
      </Badge>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "rounded-sm font-mono text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      title={reveal ? `Copy ${label}` : `Copy hidden ${label}`}
      aria-label={`Copy ${label}`}
      onClick={() => void copyValue()}
    >
      {reveal ? value : maskSensitive(value, kind)}
    </button>
  )
}

export function maskSensitive(value: string, kind: SensitiveKind): string {
  if (kind === "phone") return maskPhoneNumber(value)
  if (kind === "guid") return maskGuid(value)
  if (kind === "url") return maskUrl(value)
  return maskText(value)
}

function maskPhoneNumber(value: string): string {
  if (value.length <= 5) return value
  return `${value.slice(0, 3)}${"•".repeat(Math.max(2, value.length - 5))}${value.slice(-2)}`
}

function maskGuid(value: string): string {
  const clean = value.replace(/[{}]/g, "")
  if (clean.length < 12) return maskText(value)
  return `${clean.slice(0, 4)}••••-${clean.slice(-4)}`
}

function maskUrl(value: string): string {
  try {
    const url = new URL(value)
    const [firstLabel, ...restLabels] = url.hostname.split(".")
    const maskedHost = [`${"*".repeat(firstLabel.length)}`, ...restLabels].join(
      "."
    )
    return `${url.protocol}//${maskedHost}${url.pathname}`
  } catch {
    return maskText(value)
  }
}

function maskText(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length)
  return `${value.slice(0, 2)}${"•".repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    // Fall back for browsers or contexts where the async clipboard API is blocked.
  }

  const textArea = document.createElement("textarea")
  textArea.value = value
  textArea.setAttribute("readonly", "")
  textArea.style.position = "fixed"
  textArea.style.opacity = "0"
  document.body.append(textArea)
  textArea.select()

  try {
    document.execCommand("copy")
  } finally {
    textArea.remove()
  }
}
