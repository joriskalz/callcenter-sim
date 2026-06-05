import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { CallState, ReachabilityStatus } from "../types"

export function StatusBadge({
  value,
  className,
}: {
  value: CallState | ReachabilityStatus | string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusToneClass(value), className)}
    >
      {value}
    </Badge>
  )
}

export function statusToneClass(value: string): string {
  const normalized = value.toLowerCase().replace(/[\s_]+/g, "")

  if (successTones.has(normalized)) {
    return "border-success/35 bg-success/10 text-success"
  }
  if (warningTones.has(normalized)) {
    return "border-warning/35 bg-warning/10 text-warning"
  }
  if (destructiveTones.has(normalized)) {
    return "border-destructive/35 bg-destructive/10 text-destructive"
  }
  return "border-border bg-input/30 text-foreground"
}

const successTones = new Set([
  // call states
  "connected",
  "playing",
  "reachable",
  // proactive results / statuses
  "complete",
  "completed",
  "liveanswer",
  "delivered",
  "sent",
  "success",
])

const warningTones = new Set([
  // call states
  "answering",
  "waitingafterplay",
  "busy",
  "incoming",
  // proactive results / statuses
  "pending",
  "queued",
  "inprogress",
  "answeringmachine",
  "voicemail",
])

const destructiveTones = new Set([
  // call states
  "failed",
  "noanswer",
  "disabled",
  // proactive results / statuses
  "callfailed",
  "expired",
  "rejected",
  "error",
  "abandoned",
])