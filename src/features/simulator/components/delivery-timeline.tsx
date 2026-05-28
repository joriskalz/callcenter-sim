import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ExternalLinkIcon,
  MessageSquareTextIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  RadioIcon,
} from "lucide-react"
import * as React from "react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { AppStatus, DeliveryTimeline } from "../types"
import { Section } from "./section"
import { SensitiveValue } from "./sensitive-value"
import { StatusBadge } from "./status-badge"

type StageState = "complete" | "active" | "waiting" | "failed"

type Stage = {
  label: string
  state: StageState
  detail: string
  time: string | null
  icon: ReactNode
}

type GraphEvent = {
  key: string
  label: string
  detail: string
  time: string
  left: number
  failed: boolean
}

const storageKey = "callcenter-sim:delivery-timelines"
const maxStoredTimelines = 50

export function DeliveryTimelineBoard({
  status,
  revealSensitive,
}: {
  status: AppStatus | undefined
  revealSensitive: boolean
}) {
  const liveTimelines = status?.delivery_timelines ?? []
  const [storedTimelines, setStoredTimelines] = React.useState<
    DeliveryTimeline[]
  >([])

  React.useEffect(() => {
    try {
      const payload = window.localStorage.getItem(storageKey)
      if (!payload) return
      const parsed = JSON.parse(payload) as unknown
      if (Array.isArray(parsed)) {
        setStoredTimelines(parsed.filter(isDeliveryTimeline))
      }
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [])

  React.useEffect(() => {
    if (!liveTimelines.length) return

    setStoredTimelines((current) => {
      const merged = mergeTimelines(liveTimelines, current)
      window.localStorage.setItem(storageKey, JSON.stringify(merged))
      return merged
    })
  }, [liveTimelines])

  const timelines = liveTimelines.length
    ? mergeTimelines(liveTimelines, storedTimelines)
    : storedTimelines
  const visibleTimelines = timelines.slice(0, 8)

  return (
    <Section
      title="Delivery Timeline"
      meta={
        status?.delivery_error
          ? "Dataverse delivery query failed"
          : `${timelines.length} recent deliveries`
      }
    >
      {status?.delivery_error ? (
        <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{status.delivery_error}</span>
        </div>
      ) : null}

      {visibleTimelines.length ? (
        <div className="divide-y">
          {visibleTimelines.map((timeline) => (
            <TimelineRow
              key={timeline.id}
              timeline={timeline}
              revealSensitive={revealSensitive}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          No recent proactive deliveries
        </div>
      )}
    </Section>
  )
}

function mergeTimelines(
  fresh: DeliveryTimeline[],
  stored: DeliveryTimeline[]
): DeliveryTimeline[] {
  const byId = new Map<string, DeliveryTimeline>()
  for (const timeline of stored) byId.set(timeline.id, timeline)
  for (const timeline of fresh) {
    const existing = byId.get(timeline.id)
    byId.set(
      timeline.id,
      existing ? mergeTimeline(timeline, existing) : timeline
    )
  }
  return Array.from(byId.values())
    .sort(
      (left, right) =>
        timelineTime(right.delivery) - timelineTime(left.delivery)
    )
    .slice(0, maxStoredTimelines)
}

function mergeTimeline(
  fresh: DeliveryTimeline,
  stored: DeliveryTimeline
): DeliveryTimeline {
  return {
    ...stored,
    ...fresh,
    simulator_events: mergeEvents(
      fresh.simulator_events,
      stored.simulator_events
    ),
  }
}

function mergeEvents(
  fresh: DeliveryTimeline["simulator_events"],
  stored: DeliveryTimeline["simulator_events"]
) {
  const byKey = new Map(
    stored.map((event) => [
      `${event.occurred_at}:${event.event_type}:${event.operation_context ?? ""}`,
      event,
    ])
  )
  for (const event of fresh) {
    byKey.set(
      `${event.occurred_at}:${event.event_type}:${event.operation_context ?? ""}`,
      event
    )
  }
  return Array.from(byKey.values()).sort(
    (left, right) =>
      Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
  )
}

function timelineTime(delivery: DeliveryTimeline["delivery"]): number {
  const parsed = Date.parse(
    delivery.modified_on ??
      delivery.result_date ??
      delivery.end_date ??
      delivery.start_date ??
      delivery.created_on ??
      ""
  )
  return Number.isFinite(parsed) ? parsed : 0
}

function isDeliveryTimeline(value: unknown): value is DeliveryTimeline {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    "delivery" in value &&
    "simulator_events" in value
  )
}

function TimelineRow({
  timeline,
  revealSensitive,
}: {
  timeline: DeliveryTimeline
  revealSensitive: boolean
}) {
  const stages = stagesForTimeline(timeline)

  return (
    <div className="grid gap-4 px-4 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(15rem,0.9fr)_minmax(0,1.8fr)_minmax(16rem,0.9fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              value={timeline.delivery.status ?? "delivery"}
              className="normal-case"
            />
            {timeline.delivery.result ? (
              <StatusBadge
                value={timeline.delivery.result}
                className="normal-case"
              />
            ) : null}
            <Badge variant="outline" className="capitalize">
              {timeline.correlation}
            </Badge>
          </div>
          <div className="truncate text-sm font-medium">
            {timeline.to_number ? (
              <SensitiveValue
                value={timeline.to_number}
                reveal={revealSensitive}
                kind="phone"
              />
            ) : (
              "Unknown number"
            )}
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
            <SensitiveValue
              value={timeline.delivery.delivery_id || timeline.delivery.id}
              reveal={revealSensitive}
              kind="guid"
            />
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            <Detail label="Dial" value={timeline.delivery.dial_mode_type} />
            <RecordDetail
              label="Call"
              id={timeline.delivery.call_id}
              record={timeline.delivery.call_record}
              revealSensitive={revealSensitive}
            />
            <RecordDetail
              label="Contact"
              id={timeline.contact_id}
              record={timeline.delivery.contact_record}
              revealSensitive={revealSensitive}
            />
          </div>
        </div>

        <ol className="grid gap-3 md:grid-cols-4">
          {stages.map((stage) => (
            <li key={stage.label} className="min-w-0">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                    stageTone(stage.state)
                  )}
                >
                  {stage.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {stage.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {stage.detail}
                  </span>
                  {stage.time ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatDate(stage.time)}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <div className="min-w-0">
          <div className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Simulator Events
          </div>
          {timeline.simulator_events.length ? (
            <div className="space-y-2">
              {timeline.simulator_events.slice(-4).map((event) => (
                <div
                  key={`${event.occurred_at}-${event.event_type}`}
                  className="min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">
                      {event.event_type}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(event.occurred_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {event.message}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No simulator match yet
            </div>
          )}
        </div>
      </div>

      <EventGraph timeline={timeline} revealSensitive={revealSensitive} />
    </div>
  )
}

function EventGraph({
  timeline,
  revealSensitive,
}: {
  timeline: DeliveryTimeline
  revealSensitive: boolean
}) {
  const graphEvents = graphEventsForTimeline(timeline)
  const trackWidth = Math.min(960, Math.max(672, graphEvents.length * 148))
  const startTime = graphEvents[0]?.time ?? null
  const endTime = graphEvents[graphEvents.length - 1]?.time ?? null

  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          Event Graph
        </div>
        {graphEvents.length ? (
          <div className="text-xs text-muted-foreground">
            {formatTime(startTime)} - {formatTime(endTime)}
          </div>
        ) : null}
      </div>

      {graphEvents.length ? (
        <div className="overflow-x-auto pb-1">
          <div
            className="relative mx-auto h-40 min-w-[42rem]"
            style={{ width: `${trackWidth}px` }}
          >
            <div className="absolute inset-x-3 bottom-8 h-0.5 rounded-full bg-border" />
            <TrackEndpoint
              align="start"
              label="Start"
              time={startTime}
            />
            <TrackEndpoint align="end" label="End" time={endTime} />

            <div className="absolute inset-x-3 top-0 bottom-0">
              {graphEvents.map((event) => {
                const anchor = graphAnchor(event.left)

                return (
                  <div
                    key={event.key}
                    className={cn("absolute top-0 h-full w-40", anchor.wrapper)}
                    style={{ left: `${event.left}%` }}
                  >
                    <div
                      className={cn(
                        "rounded-md border bg-card px-2.5 py-2 shadow-xs",
                        event.failed &&
                          "border-destructive/35 bg-destructive/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">
                          {event.label}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTime(event.time)}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        <SensitiveValue
                          value={event.detail}
                          reveal={revealSensitive}
                          kind="text"
                        />
                      </div>
                    </div>
                    <div
                      className={cn(
                        "absolute bottom-8 h-5 w-px bg-border",
                        anchor.marker
                      )}
                    />
                    <div
                      className={cn(
                        "absolute bottom-[1.4375rem] size-3 rounded-full border-2 bg-background",
                        anchor.marker,
                        event.failed
                          ? "border-destructive"
                          : "border-primary ring-4 ring-primary/10"
                      )}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-16 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No simulator events to graph yet
        </div>
      )}
    </div>
  )
}

function TrackEndpoint({
  align,
  label,
  time,
}: {
  align: "start" | "end"
  label: string
  time: string | null
}) {
  return (
    <div
      className={cn(
        "absolute bottom-2 grid gap-1 text-[11px] text-muted-foreground",
        align === "start" ? "left-3 text-left" : "right-3 text-right"
      )}
    >
      <span
        className={cn(
          "h-6 w-px bg-foreground/50",
          align === "end" && "justify-self-end"
        )}
      />
      <span className="font-medium text-foreground">{label}</span>
      <span>{formatTime(time)}</span>
    </div>
  )
}

function graphAnchor(left: number): { wrapper: string; marker: string } {
  if (left <= 8) {
    return { wrapper: "translate-x-0", marker: "left-0" }
  }
  if (left >= 92) {
    return { wrapper: "-translate-x-full", marker: "right-0" }
  }
  return {
    wrapper: "-translate-x-1/2",
    marker: "left-1/2 -translate-x-1/2",
  }
}

function graphEventsForTimeline(timeline: DeliveryTimeline): GraphEvent[] {
  const events = timeline.simulator_events
    .map((event, index) => {
      const time = Date.parse(event.occurred_at)
      if (!Number.isFinite(time)) return null

      return {
        event,
        index,
        time,
      }
    })
    .filter((event) => event !== null)
    .sort((left, right) => left.time - right.time)

  if (!events.length) return []

  const firstTime = events[0].time
  const lastTime = events[events.length - 1].time
  const span = Math.max(1, lastTime - firstTime)

  return events.map(({ event, index, time }) => ({
    key: `${event.occurred_at}-${event.event_type}-${index}`,
    label: compactEventType(event.event_type),
    detail: event.error ?? event.message,
    time: event.occurred_at,
    left: events.length === 1 ? 50 : ((time - firstTime) / span) * 100,
    failed: Boolean(event.error),
  }))
}

function compactEventType(value: string): string {
  const stripped = value
    .replace(/^Microsoft\.Communication\./, "")
    .replace(/^Microsoft\.EventGrid\./, "")
  const segments = stripped.split(".").filter(Boolean)
  return segments.at(-1) ?? value
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null

  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
      <span>{label}</span>
      <span className="truncate font-mono" title={value}>
        {value}
      </span>
    </div>
  )
}

function RecordDetail({
  label,
  id,
  record,
  revealSensitive,
}: {
  label: string
  id: string | null
  record: DeliveryTimeline["delivery"]["contact_record"]
  revealSensitive: boolean
}) {
  if (!id && !record) return null

  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
      <span>{label}</span>
      <span className="min-w-0">
        {record ? (
          <a
            href={record.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="truncate">{record.display_name}</span>
            <ExternalLinkIcon className="size-3 shrink-0" />
          </a>
        ) : null}
        {id ? (
          <span className={record ? "mt-0.5 block" : "block"}>
            <SensitiveValue
              value={id}
              reveal={revealSensitive}
              kind="guid"
              className="truncate text-muted-foreground"
            />
          </span>
        ) : null}
      </span>
    </div>
  )
}

function stagesForTimeline(timeline: DeliveryTimeline): Stage[] {
  const delivery = timeline.delivery
  const call = timeline.simulator_call
  const events = timeline.simulator_events

  return [
    {
      label: "Delivery",
      state: deliveryStageState(delivery.status, delivery.result),
      detail:
        [delivery.status, delivery.result].filter(Boolean).join(" / ") || "-",
      time: delivery.modified_on ?? delivery.created_on,
      icon: <PhoneOutgoingIcon className="size-3.5" />,
    },
    {
      label: "Dialer",
      state: delivery.end_date || delivery.result ? "complete" : "active",
      detail: delivery.dial_mode_type ?? delivery.channel ?? "queued",
      time: delivery.start_date ?? delivery.created_on,
      icon: <RadioIcon className="size-3.5" />,
    },
    {
      label: "Incoming",
      state: call || hasEvent(events, "IncomingCall") ? "complete" : "waiting",
      detail: call?.state ?? "waiting for ACS",
      time: call?.incoming_call_time ?? eventTime(events, "IncomingCall"),
      icon: <PhoneIncomingIcon className="size-3.5" />,
    },
    {
      label: "Playback",
      state: playbackStageState(timeline),
      detail: playbackDetail(timeline),
      time:
        call?.play_completed_time ??
        call?.call_disconnected_time ??
        eventTime(events, "PlayCompleted"),
      icon: playbackIcon(playbackStageState(timeline)),
    },
  ]
}

function deliveryStageState(
  status: string | null,
  result: string | null
): StageState {
  const value = `${status ?? ""} ${result ?? ""}`.toLowerCase()
  if (/(fail|error|reject|busy|abandon|no.?answer)/.test(value)) {
    return "failed"
  }
  if (/(complete|success|sent|delivered|finished)/.test(value)) {
    return "complete"
  }
  return "active"
}

function playbackStageState(timeline: DeliveryTimeline): StageState {
  const call = timeline.simulator_call
  const events = timeline.simulator_events
  if (call?.error || events.some((event) => event.error)) return "failed"
  if (call?.play_completed_time || hasEvent(events, "PlayCompleted")) {
    return "complete"
  }
  if (call?.state === "playing" || call?.state === "waiting_after_play") {
    return "active"
  }
  if (
    call &&
    ["busy", "disabled", "failed", "no_answer"].includes(call.state)
  ) {
    return "failed"
  }
  if (call?.call_disconnected_time) return "complete"
  return "waiting"
}

function playbackDetail(timeline: DeliveryTimeline): string {
  const call = timeline.simulator_call
  if (!call) return "waiting for answer"
  if (call.error) return call.error
  if (call.play_completed_time) return "TTS completed"
  if (call.state === "playing") return "TTS playing"
  return call.result ?? call.current_action ?? call.state
}

function playbackIcon(state: StageState) {
  if (state === "complete") return <CheckCircle2Icon className="size-3.5" />
  if (state === "failed") return <AlertTriangleIcon className="size-3.5" />
  if (state === "active") return <MessageSquareTextIcon className="size-3.5" />
  return <CircleDashedIcon className="size-3.5" />
}

function stageTone(state: StageState): string {
  if (state === "complete") {
    return "border-success/35 bg-success/10 text-success"
  }
  if (state === "failed") {
    return "border-destructive/35 bg-destructive/10 text-destructive"
  }
  if (state === "active") {
    return "border-warning/35 bg-warning/10 text-warning"
  }
  return "border-border bg-input/30 text-muted-foreground"
}

function hasEvent(events: DeliveryTimeline["simulator_events"], type: string) {
  return events.some((event) => event.event_type === type)
}

function eventTime(
  events: DeliveryTimeline["simulator_events"],
  type: string
): string | null {
  return events.find((event) => event.event_type === type)?.occurred_at ?? null
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : ""
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : ""
}
