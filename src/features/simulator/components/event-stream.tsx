import * as React from "react"

import { cn } from "@/lib/utils"

import type { CallEvent } from "../types"
import { Section } from "./section"
import { SensitiveValue } from "./sensitive-value"
import { StatusBadge } from "./status-badge"

export function EventStream({
  events,
  revealSensitive,
}: {
  events: CallEvent[]
  revealSensitive: boolean
}) {
  const visible = React.useMemo(() => events.slice(0, 40), [events])
  const newestEpoch = React.useMemo(() => {
    const times = events
      .map((event) => Date.parse(event.occurred_at))
      .filter((time) => Number.isFinite(time))
    return times.length ? Math.max(...times) : null
  }, [events])

  return (
    <Section title="Event Stream" meta={`${events.length} events`}>
      <div className="divide-y">
        {visible.length ? (
          visible.map((event, index) => {
            const previous = visible[index - 1]
            const isDuplicateType =
              previous?.event_type === event.event_type &&
              previous?.operation_context === event.operation_context

            return (
              <div
                key={`${event.occurred_at}-${event.event_type}-${index}`}
                className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_max-content] md:items-center"
              >
                <div className="min-w-0">
                  <StatusBadge
                    value={event.error ? "failed" : event.event_type}
                    className="max-w-full justify-start truncate normal-case"
                  />
                  {isDuplicateType ? (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      callback
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="text-sm break-words">{event.message}</div>
                  <div className="mt-1 flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
                    {event.scenario_name ? (
                      <span>{event.scenario_name}</span>
                    ) : null}
                    <SensitiveValue
                      value={event.to_number}
                      reveal={revealSensitive}
                      kind="phone"
                      className="truncate"
                    />
                    <SensitiveValue
                      value={event.call_connection_id}
                      reveal={revealSensitive}
                      kind="guid"
                      className="truncate"
                    />
                  </div>
                </div>
                <div className="text-right text-sm whitespace-nowrap text-muted-foreground">
                  <div>{formatDate(event.occurred_at)}</div>
                  <div
                    className={cn(
                      "text-xs",
                      event.error ? "text-destructive" : "text-muted-foreground/70"
                    )}
                  >
                    {formatRelative(event.occurred_at, newestEpoch)}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No events
          </div>
        )}
      </div>
    </Section>
  )
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : ""
}

function formatRelative(value: string | null, newestEpoch: number | null) {
  if (!value || newestEpoch == null) return ""
  const epoch = Date.parse(value)
  if (!Number.isFinite(epoch)) return ""

  const deltaSeconds = Math.round((newestEpoch - epoch) / 1000)
  if (deltaSeconds <= 0) return "just now"
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`
  const minutes = Math.floor(deltaSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}