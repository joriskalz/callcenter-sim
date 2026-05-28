import { Popover } from "@base-ui/react/popover"
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  XCircleIcon,
} from "lucide-react"
import * as React from "react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { AppStatus } from "../types"
import { Section } from "./section"

export function StatusSummaryPopover({
  status,
  isLoading,
}: {
  status: AppStatus | undefined
  isLoading: boolean
}) {
  const health = statusHealth(status, isLoading)

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Open system status details"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "justify-start"
        )}
      >
        <StatusIcon ok={health.tone === "success"} warning={health.tone === "warning"} />
        <span>{health.label}</span>
        {status ? (
          <Badge variant="outline" className="ml-0.5 h-5 px-1.5 text-[11px]">
            {status.active_call_count}
          </Badge>
        ) : null}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup className="w-[min(28rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl bg-popover p-3 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Popover.Title className="text-sm font-semibold">
              System status
            </Popover.Title>
            <Popover.Description className="mt-1 text-xs text-muted-foreground">
              Current simulator, integration, and callback state.
            </Popover.Description>
            <StatusPopoverContent status={status} isLoading={isLoading} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function StatusOverview({
  status,
  isLoading,
}: {
  status: AppStatus | undefined
  isLoading: boolean
}) {
  if (isLoading && !status) {
    return (
      <Section title="Status" meta="Loading">
        <div className="p-4 text-sm text-muted-foreground">Fetching status</div>
      </Section>
    )
  }

  if (!status) {
    return (
      <Section title="Status" meta="Unavailable">
        <div className="p-4 text-sm text-muted-foreground">No status data</div>
      </Section>
    )
  }

  const callbackOk = status.config.callback_url_valid
  const callbackText = callbackOk
    ? status.config.callback_url
    : (status.config.callback_url_problem ?? "Callback URL invalid")

  return (
    <Section
      title="Status"
      meta={
        status.config.monitor_auth_configured
          ? "Monitor auth active"
          : "Monitor auth not set"
      }
    >
      <div className="grid gap-0 divide-y lg:grid-cols-[1.2fr_1fr_1.6fr] lg:divide-x lg:divide-y-0">
        <div className="grid grid-cols-3 divide-x">
          <Metric
            label="App"
            value={status.status}
            icon={<CheckCircle2Icon />}
            tone="success"
          />
          <Metric
            label="Version"
            value={status.version}
            icon={<ActivityIcon />}
          />
          <Metric
            label="Active Calls"
            value={String(status.active_call_count)}
            icon={<ActivityIcon />}
          />
        </div>

        <div className="grid gap-2 p-4">
          <ServiceStatus
            label="ACS"
            ok={status.config.acs_configured}
            okText="configured"
            badText="missing"
          />
          <ServiceStatus
            label="TTS"
            ok={status.config.tts_configured}
            okText="configured"
            badText="missing"
          />
          <ServiceStatus
            label="Dataverse"
            ok={status.config.dataverse_configured}
            okText="configured"
            badText="sample data"
            sampleOk
          />
        </div>

        <div className="flex min-w-0 items-start gap-3 p-4">
          <StatusIcon ok={callbackOk} />
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              Callback URL
            </div>
            {callbackOk ? (
              <CallbackUrlCopy url={status.config.callback_url} />
            ) : (
              <div className="mt-1 text-sm leading-snug font-semibold break-words text-warning">
                {callbackText}
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

function StatusPopoverContent({
  status,
  isLoading,
}: {
  status: AppStatus | undefined
  isLoading: boolean
}) {
  if (isLoading && !status) {
    return (
      <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Fetching status
      </div>
    )
  }

  if (!status) {
    return (
      <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        No status data available
      </div>
    )
  }

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid grid-cols-3 divide-x rounded-lg border">
        <CompactMetric label="App" value={status.status} />
        <CompactMetric label="Version" value={status.version} />
        <CompactMetric label="Calls" value={String(status.active_call_count)} />
      </div>

      <div className="grid gap-2">
        <ServiceStatus
          label="ACS"
          ok={status.config.acs_configured}
          okText="configured"
          badText="missing"
        />
        <ServiceStatus
          label="TTS"
          ok={status.config.tts_configured}
          okText="configured"
          badText="missing"
        />
        <ServiceStatus
          label="Dataverse"
          ok={status.config.dataverse_configured}
          okText="configured"
          badText="sample data"
          sampleOk
        />
        <ServiceStatus
          label="Monitor auth"
          ok={status.config.monitor_auth_configured}
          okText="active"
          badText="not set"
        />
        <ServiceStatus
          label="Webhook secret"
          ok={status.config.webhook_secret_configured}
          okText="configured"
          badText="not set"
          sampleOk
        />
      </div>

      <div className="grid gap-2 rounded-lg border p-3">
        <DetailRow label="Scenarios" value={String(status.config.scenario_count)} />
        <DetailRow label="Public base URL" value={status.config.public_base_url} />
        <DetailRow
          label="Deliveries"
          value={
            status.delivery_error ??
            `${status.delivery_timelines.length} recent timeline rows`
          }
          tone={status.delivery_error ? "warning" : "neutral"}
        />
        <DetailRow
          label="Recent errors"
          value={String(status.recent_errors.length)}
          tone={status.recent_errors.length ? "warning" : "neutral"}
        />
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-1 flex items-center gap-2">
          <StatusIcon
            ok={status.config.callback_url_valid}
            warning={!status.config.callback_url_valid}
          />
          <div className="text-xs font-medium text-muted-foreground uppercase">
            Callback URL
          </div>
        </div>
        {status.config.callback_url_valid ? (
          <CallbackUrlCopy url={status.config.callback_url} />
        ) : (
          <div className="text-sm leading-snug font-semibold break-words text-warning">
            {status.config.callback_url_problem ?? "Callback URL invalid"}
          </div>
        )}
      </div>
    </div>
  )
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-3">
      <div className="text-[11px] font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "warning"
}) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
      <div className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "min-w-0 break-words font-medium",
          tone === "warning" && "text-warning"
        )}
      >
        {value || "-"}
      </div>
    </div>
  )
}

function CallbackUrlCopy({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false)
  const [showFullUrl, setShowFullUrl] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const copyCallbackUrl = async () => {
    await copyText(url)
    setCopied(true)
  }

  if (copied) {
    return <CallbackUrlCopiedBadge />
  }

  return (
    <div className="mt-1 flex min-w-0 items-start gap-1.5">
      <button
        type="button"
        className="min-w-0 rounded-sm text-left text-sm leading-snug font-semibold break-words outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        title="Copy callback URL"
        aria-label="Copy callback URL"
        onClick={() => void copyCallbackUrl()}
      >
        {showFullUrl ? url : maskCallbackUrl(url)}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="mt-0.5 text-muted-foreground hover:text-foreground"
        aria-label={showFullUrl ? "Hide callback URL" : "Show callback URL"}
        title={showFullUrl ? "Hide callback URL" : "Show callback URL"}
        onClick={() => setShowFullUrl((visible) => !visible)}
      >
        {showFullUrl ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  )
}

function CallbackUrlCopiedBadge() {
  return (
    <Badge
      variant="outline"
      className="mt-1 border-success/35 bg-success/10 text-success"
    >
      <CheckCircle2Icon className="size-3" />
      Copied
    </Badge>
  )
}

function Metric({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string
  value: string
  icon: ReactNode
  tone?: "neutral" | "success" | "warning" | "destructive"
}) {
  return (
    <div className="min-h-24 p-4">
      <div
        className={cn(
          "mb-3 inline-flex size-7 items-center justify-center rounded-full",
          toneClass(tone)
        )}
      >
        <span className="[&_svg]:size-4">{icon}</span>
      </div>
      <div className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-xl leading-tight font-semibold break-words">
        {value}
      </div>
    </div>
  )
}

function ServiceStatus({
  label,
  ok,
  okText,
  badText,
  sampleOk = false,
}: {
  label: string
  ok: boolean
  okText: string
  badText: string
  sampleOk?: boolean
}) {
  const tone = ok ? "success" : sampleOk ? "warning" : "destructive"
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusIcon ok={ok} warning={!ok && sampleOk} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={cn("text-xs font-semibold", textToneClass(tone))}>
        {ok ? okText : badText}
      </span>
    </div>
  )
}

function StatusIcon({
  ok,
  warning = false,
}: {
  ok: boolean
  warning?: boolean
}) {
  if (ok) return <CheckCircle2Icon className="size-4 text-success" />
  if (warning) return <AlertTriangleIcon className="size-4 text-warning" />
  return <XCircleIcon className="size-4 text-destructive" />
}

function toneClass(tone: "neutral" | "success" | "warning" | "destructive") {
  if (tone === "success") return "bg-success/10 text-success"
  if (tone === "warning") return "bg-warning/10 text-warning"
  if (tone === "destructive") return "bg-destructive/10 text-destructive"
  return "bg-muted text-muted-foreground"
}

function textToneClass(tone: "success" | "warning" | "destructive") {
  if (tone === "success") return "text-success"
  if (tone === "warning") return "text-warning"
  return "text-destructive"
}

function statusHealth(
  status: AppStatus | undefined,
  isLoading: boolean
): { label: string; tone: "success" | "warning" | "destructive" } {
  if (isLoading && !status) return { label: "Status", tone: "warning" }
  if (!status) return { label: "Status", tone: "destructive" }
  if (status.config.config_issues.length || status.delivery_error) {
    return { label: "Status", tone: "warning" }
  }
  if (status.recent_errors.length) return { label: "Status", tone: "warning" }
  return { label: "Status", tone: "success" }
}

function maskCallbackUrl(value: string): string {
  try {
    const url = new URL(value)
    const [firstLabel, ...restLabels] = url.hostname.split(".")
    if (!firstLabel || !restLabels.length) return value

    const maskedHost = [`${"*".repeat(firstLabel.length)}`, ...restLabels].join(
      "."
    )
    return `${url.protocol}//${maskedHost}${url.port ? `:${url.port}` : ""}${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
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
