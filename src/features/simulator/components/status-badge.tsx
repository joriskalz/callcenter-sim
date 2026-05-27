import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { CallState, ReachabilityStatus } from "../types"

export function StatusBadge({
  value,
}: {
  value: CallState | ReachabilityStatus | string
}) {
  return (
    <Badge variant="outline" className={cn("capitalize", toneClass(value))}>
      {value}
    </Badge>
  )
}

function toneClass(value: string): string {
  if (["connected", "playing", "reachable"].includes(value)) {
    return "border-success/35 bg-success/10 text-success"
  }
  if (["answering", "waiting_after_play", "busy", "incoming"].includes(value)) {
    return "border-warning/35 bg-warning/10 text-warning"
  }
  if (["failed", "no_answer", "disabled"].includes(value)) {
    return "border-destructive/35 bg-destructive/10 text-destructive"
  }
  return "border-border bg-input/30 text-foreground"
}
