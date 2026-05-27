import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import type { AppStatus } from "../types"
import { Section } from "./section"

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
            <div
              className={cn(
                "mt-1 text-sm leading-snug font-semibold break-words",
                callbackOk ? "text-foreground" : "text-warning"
              )}
            >
              {callbackText}
            </div>
          </div>
        </div>
      </div>
    </Section>
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
