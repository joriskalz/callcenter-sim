import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ExternalLinkIcon,
  GaugeIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  RadioIcon,
} from "lucide-react"
import * as React from "react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { AppStatus, CallEvent, DeliveryTimeline } from "../types"
import { Section } from "./section"
import { SensitiveValue } from "./sensitive-value"
import { StatusBadge } from "./status-badge"

type StageState = "complete" | "active" | "waiting" | "failed"

type GraphMode = "proportional" | "even"

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
  /** Drawn position 0-100 after spacing/distribution. */
  left: number
  /** Purely time-proportional position 0-100. */
  rawLeft: number
  epoch: number
  /** Seconds since first graphed event of the attempt. */
  offsetSeconds: number
  /** Seconds since the previous graphed event. */
  gapSeconds: number
  failed: boolean
}

/** Result of grouping a timeline's raw events into a single call attempt. */
type CallAttempt = {
  /** operation_context (or fallback key) that identifies this attempt. */
  contextKey: string
  events: CallEvent[]
}

const storageKey = "callcenter-sim:delivery-timelines"
const graphModeStorageKey = "callcenter-sim:timeline-graph-mode"
const maxStoredTimelines = 50

/** Minimum horizontal spacing (% of track) between markers in proportional mode. */
const minMarkerSpacing = 11

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
  const [graphMode, setGraphMode] = React.useState<GraphMode>("proportional")

  React.useEffect(() => {
    const stored = window.localStorage.getItem(graphModeStorageKey)
    if (stored === "proportional" || stored === "even") setGraphMode(stored)
  }, [])

  const handleGraphModeChange = (mode: GraphMode) => {
    setGraphMode(mode)
    window.localStorage.setItem(graphModeStorageKey, mode)
  }

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

  React.useEffect(() => {
    if (!timelineDebugEnabled()) return

    console.groupCollapsed(
      `%c[DeliveryTimeline] board snapshot · ${timelines.length} timelines (${visibleTimelines.length} visible)`,
      "color:#6366f1;font-weight:600"
    )
    console.log("delivery_error:", status?.delivery_error ?? null)
    console.log("live timelines from status:", liveTimelines.length)
    console.log("stored (localStorage) timelines:", storedTimelines.length)
    console.table(
      timelines.map((timeline) => {
        const attempt = dominantAttempt(timeline)
        return {
          id: timeline.id,
          correlation: timeline.correlation,
          status: timeline.delivery.status,
          result: timeline.delivery.result,
          totalEvents: timeline.simulator_events.length,
          attemptEvents: attempt.events.length,
          attemptContext: attempt.contextKey,
          hasCall: Boolean(timeline.simulator_call),
        }
      })
    )
    console.groupEnd()
  }, [
    liveTimelines.length,
    status?.delivery_error,
    storedTimelines.length,
    timelines,
    visibleTimelines.length,
  ])

  return (
    <Section
      title="Delivery Timeline"
      meta={
        status?.delivery_error ? (
          "Dataverse delivery query failed"
        ) : (
          <div className="flex items-center gap-3">
            <GraphModeToggle mode={graphMode} onChange={handleGraphModeChange} />
            <span>{timelines.length} recent deliveries</span>
          </div>
        )
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
              graphMode={graphMode}
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

function GraphModeToggle({
  mode,
  onChange,
}: {
  mode: GraphMode
  onChange: (mode: GraphMode) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Event graph layout"
      className="inline-flex items-center rounded-full border bg-input/30 p-0.5"
    >
      <ModeButton
        active={mode === "proportional"}
        label="Time"
        title="Position markers proportionally to elapsed time"
        icon={<GaugeIcon className="size-3.5" />}
        onClick={() => onChange("proportional")}
      />
      <ModeButton
        active={mode === "even"}
        label="Even"
        title="Space markers evenly in order, ignoring elapsed time"
        icon={<ListOrderedIcon className="size-3.5" />}
        onClick={() => onChange("even")}
      />
    </div>
  )
}

function ModeButton({
  active,
  label,
  title,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  title: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
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
    stored.map((event) => [eventDedupeKey(event), event])
  )
  for (const event of fresh) {
    byKey.set(eventDedupeKey(event), event)
  }
  return Array.from(byKey.values()).sort(
    (left, right) =>
      Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
  )
}

function eventDedupeKey(event: CallEvent): string {
  return `${event.occurred_at}:${event.event_type}:${event.operation_context ?? ""}`
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

/* -------------------------------------------------------------------------- */
/* Attempt grouping — the core fix for cross-call event contamination.        */
/* -------------------------------------------------------------------------- */

/**
 * Phone-number correlation can attach events from earlier, unrelated call
 * attempts (different operation_context) to a timeline. Those stray events
 * massively inflate the time span and corrupt the graph.
 *
 * We group events by `operation_context` (falling back to call_connection_id),
 * then pick the "dominant" attempt: the one with the most events, breaking
 * ties by the most recent activity. Events whose context is null are folded
 * into the nearest attempt in time so callbacks (which sometimes lack context)
 * stay attached.
 */
function dominantAttempt(timeline: DeliveryTimeline): CallAttempt {
  const events = timeline.simulator_events
  if (events.length <= 1) {
    return { contextKey: events[0]?.operation_context ?? "", events: [...events] }
  }

  const groups = new Map<string, CallEvent[]>()
  const contextless: CallEvent[] = []

  for (const event of events) {
    const key = attemptKey(event)
    if (!key) {
      contextless.push(event)
      continue
    }
    const group = groups.get(key)
    if (group) group.push(event)
    else groups.set(key, [event])
  }

  if (!groups.size) {
    return { contextKey: "", events: [...events] }
  }

  // Choose the dominant group: most events, then latest activity.
  let best: { key: string; events: CallEvent[] } | null = null
  for (const [key, groupEvents] of groups) {
    if (
      !best ||
      groupEvents.length > best.events.length ||
      (groupEvents.length === best.events.length &&
        lastEpoch(groupEvents) > lastEpoch(best.events))
    ) {
      best = { key, events: groupEvents }
    }
  }

  const chosen = best as { key: string; events: CallEvent[] }
  const start = firstEpoch(chosen.events)
  const end = lastEpoch(chosen.events)

  // Attach context-less callbacks (e.g. ParticipantsUpdated) that fall within
  // the chosen attempt's window so the lifecycle stays complete.
  const adopted = contextless.filter((event) => {
    const epoch = Date.parse(event.occurred_at)
    return Number.isFinite(epoch) && epoch >= start - 2000 && epoch <= end + 2000
  })

  const merged = [...chosen.events, ...adopted].sort(
    (left, right) =>
      Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
  )

  return { contextKey: chosen.key, events: merged }
}

function attemptKey(event: CallEvent): string | null {
  return event.operation_context ?? event.call_connection_id ?? null
}

function firstEpoch(events: CallEvent[]): number {
  return Math.min(...events.map((event) => Date.parse(event.occurred_at)))
}

function lastEpoch(events: CallEvent[]): number {
  return Math.max(...events.map((event) => Date.parse(event.occurred_at)))
}

function attemptCount(timeline: DeliveryTimeline): number {
  const keys = new Set<string>()
  for (const event of timeline.simulator_events) {
    const key = attemptKey(event)
    if (key) keys.add(key)
  }
  return keys.size
}

/* -------------------------------------------------------------------------- */

function TimelineRow({
  timeline,
  graphMode,
  revealSensitive,
}: {
  timeline: DeliveryTimeline
  graphMode: GraphMode
  revealSensitive: boolean
}) {
  const attempt = React.useMemo(() => dominantAttempt(timeline), [timeline])
  const stages = React.useMemo(
    () => stagesForTimeline(timeline, attempt),
    [timeline, attempt]
  )
  const droppedCount = timeline.simulator_events.length - attempt.events.length
  const totalAttempts = attemptCount(timeline)

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
            {totalAttempts > 1 ? (
              <Badge
                variant="outline"
                className="border-warning/35 text-warning"
                title={`${totalAttempts} call attempts share this number; showing the dominant one`}
              >
                {totalAttempts} attempts
              </Badge>
            ) : null}
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
                      {formatTime(stage.time)}
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
          {attempt.events.length ? (
            <div className="space-y-2">
              {attempt.events.slice(-4).map((event, index) => (
                <div
                  key={`${event.occurred_at}-${event.event_type}-${index}`}
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

      {droppedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-1.5 text-xs text-warning">
          <AlertTriangleIcon className="size-3.5 shrink-0" />
          <span>
            {droppedCount} event{droppedCount === 1 ? "" : "s"} from other call
            attempts on this number were excluded from the graph to keep the
            timing accurate.
          </span>
        </div>
      ) : null}

      <EventGraph
        attempt={attempt}
        graphMode={graphMode}
        timeline={timeline}
        revealSensitive={revealSensitive}
      />
    </div>
  )
}

function EventGraph({
  attempt,
  graphMode,
  timeline,
  revealSensitive,
}: {
  attempt: CallAttempt
  graphMode: GraphMode
  timeline: DeliveryTimeline
  revealSensitive: boolean
}) {
  const proportionalEvents = React.useMemo(
    () => graphEventsForAttempt(attempt, "proportional"),
    [attempt]
  )
  const evenEvents = React.useMemo(
    () => graphEventsForAttempt(attempt, "even"),
    [attempt]
  )
  const graphEvents =
    graphMode === "proportional" ? proportionalEvents : evenEvents

  const trackWidth = Math.min(960, Math.max(672, graphEvents.length * 148))
  const startTime = graphEvents[0]?.time ?? null
  const endTime = graphEvents[graphEvents.length - 1]?.time ?? null
  const totalDuration =
    graphEvents.length > 1
      ? graphEvents[graphEvents.length - 1].offsetSeconds
      : 0

  React.useEffect(() => {
    if (!timelineDebugEnabled()) return
    logTimelineDiagnostics(timeline, attempt, proportionalEvents)
  }, [attempt, proportionalEvents, timeline])

  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          Event Graph
          <Badge variant="outline" className="h-4 px-1 text-[10px] normal-case">
            {graphMode === "proportional" ? "time-scaled" : "evenly spaced"}
          </Badge>
        </div>
        {graphEvents.length ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatTime(startTime)} - {formatTime(endTime)}
            </span>
            {totalDuration > 0 ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                {formatDuration(totalDuration)} total
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {graphEvents.length ? (
        <div className="overflow-x-auto pb-1">
          <div
            className="relative mx-auto h-44 min-w-[42rem]"
            style={{ width: `${trackWidth}px` }}
          >
            <div className="absolute inset-x-3 bottom-8 h-0.5 rounded-full bg-border" />
            <TrackEndpoint align="start" label="Start" time={startTime} />
            <TrackEndpoint align="end" label="End" time={endTime} />

            <div className="absolute inset-x-3 top-0 bottom-0">
              {graphEvents.map((event, index) => {
                const anchor = graphAnchor(event.left)
                const previous = graphEvents[index - 1]

                return (
                  <div
                    key={event.key}
                    className={cn("absolute top-0 h-full w-40", anchor.wrapper)}
                    style={{ left: `${event.left}%` }}
                  >
                    <div
                      className={cn(
                        "rounded-md border bg-card px-2.5 py-2 shadow-xs",
                        event.failed && "border-destructive/35 bg-destructive/10"
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
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] font-medium"
                        >
                          +{formatDuration(event.offsetSeconds)}
                        </Badge>
                        {index > 0 && event.gapSeconds > 0 ? (
                          <span className="text-[10px] text-muted-foreground">
                            Δ {formatDuration(event.gapSeconds)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        <SensitiveValue
                          value={event.detail}
                          reveal={revealSensitive}
                          kind="text"
                        />
                      </div>
                    </div>

                    {index > 0 && graphMode === "proportional" ? (
                      <SegmentLabel
                        leftPercent={event.left}
                        previousLeftPercent={previous.left}
                        gapSeconds={event.gapSeconds}
                      />
                    ) : null}

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

function SegmentLabel({
  leftPercent,
  previousLeftPercent,
  gapSeconds,
}: {
  leftPercent: number
  previousLeftPercent: number
  gapSeconds: number
}) {
  if (gapSeconds <= 0) return null

  const halfStep = (leftPercent - previousLeftPercent) / 2

  return (
    <span
      className="absolute bottom-[2.6rem] -translate-x-1/2 rounded-full bg-background px-1 text-[10px] whitespace-nowrap text-muted-foreground"
      style={{ left: `-${halfStep}%` }}
    >
      {formatDuration(gapSeconds)}
    </span>
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

function graphEventsForAttempt(
  attempt: CallAttempt,
  mode: GraphMode
): GraphEvent[] {
  const events = attempt.events
    .map((event, index) => {
      const time = Date.parse(event.occurred_at)
      if (!Number.isFinite(time)) return null
      return { event, index, time }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.time - right.time)

  if (!events.length) return []

  const firstTime = events[0].time
  const lastTime = events[events.length - 1].time
  const span = Math.max(1, lastTime - firstTime)

  const rawLefts = events.map(({ time }) =>
    events.length === 1 ? 50 : ((time - firstTime) / span) * 100
  )

  // In "even" mode, ignore time entirely: distribute by ordinal index.
  // In "proportional" mode, keep time but enforce a readable minimum spacing.
  const drawnLefts =
    mode === "even"
      ? events.map((_, index) =>
          events.length === 1 ? 50 : (index / (events.length - 1)) * 100
        )
      : distributeOffsets(rawLefts, minMarkerSpacing)

  let previousEpoch = firstTime

  return events.map(({ event, index, time }, position) => {
    const gapSeconds = (time - previousEpoch) / 1000
    previousEpoch = time

    return {
      key: `${event.occurred_at}-${event.event_type}-${index}`,
      label: compactEventType(event.event_type),
      detail: event.error ?? event.message,
      time: event.occurred_at,
      left: drawnLefts[position],
      rawLeft: rawLefts[position],
      epoch: time,
      offsetSeconds: (time - firstTime) / 1000,
      gapSeconds,
      failed: Boolean(event.error),
    }
  })
}

function distributeOffsets(positions: number[], minGap: number): number[] {
  if (positions.length <= 1) return positions.slice()

  const result = positions.slice()

  for (let index = 1; index < result.length; index += 1) {
    const minAllowed = result[index - 1] + minGap
    if (result[index] < minAllowed) result[index] = minAllowed
  }

  const overflow = result[result.length - 1] - 100
  if (overflow > 0) {
    result[result.length - 1] = 100
    for (let index = result.length - 2; index >= 0; index -= 1) {
      const maxAllowed = result[index + 1] - minGap
      if (result[index] > maxAllowed) result[index] = maxAllowed
    }
    result[0] = Math.max(0, result[0])
  }

  return result.map((value) => Math.min(100, Math.max(0, value)))
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

function stagesForTimeline(
  timeline: DeliveryTimeline,
  attempt: CallAttempt
): Stage[] {
  const delivery = timeline.delivery
  const call = timeline.simulator_call
  const events = attempt.events

  const incomingTime =
    call?.incoming_call_time ?? eventTime(events, "IncomingCall")
  const connectedTime =
    call?.call_connected_time ?? eventTime(events, "CallConnected")
  const playStartedTime =
    call?.play_started_time ?? eventTime(events, "PlayStarted")
  const playCompletedTime =
    call?.play_completed_time ??
    call?.call_disconnected_time ??
    eventTime(events, "PlayCompleted") ??
    eventTime(events, "CallDisconnected")

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
      state:
        call || incomingTime || connectedTime ? "complete" : "waiting",
      detail: call?.state ?? (connectedTime ? "connected" : "waiting for ACS"),
      time: incomingTime ?? connectedTime,
      icon: <PhoneIncomingIcon className="size-3.5" />,
    },
    {
      label: "Playback",
      state: playbackStageState(timeline, attempt),
      detail: playbackDetail(timeline, attempt),
      time: playCompletedTime ?? playStartedTime,
      icon: playbackIcon(playbackStageState(timeline, attempt)),
    },
  ]
}

function deliveryStageState(
  status: string | null,
  result: string | null
): StageState {
  const value = `${status ?? ""} ${result ?? ""}`.toLowerCase()
  if (/(fail|error|reject|busy|abandon|no.?answer|expired)/.test(value)) {
    return "failed"
  }
  if (/(complete|success|sent|delivered|finished|liveanswer)/.test(value)) {
    return "complete"
  }
  return "active"
}

function playbackStageState(
  timeline: DeliveryTimeline,
  attempt: CallAttempt
): StageState {
  const call = timeline.simulator_call
  const events = attempt.events
  if (call?.error || events.some((event) => event.error)) return "failed"
  if (call?.play_completed_time || hasEvent(events, "PlayCompleted")) {
    return "complete"
  }
  if (call?.state === "playing" || call?.state === "waiting_after_play") {
    return "active"
  }
  if (call && ["busy", "disabled", "failed", "no_answer"].includes(call.state)) {
    return "failed"
  }
  // Event-derived completion when no simulator_call is attached.
  if (hasEvent(events, "CallDisconnected") && hasEvent(events, "PlayStarted")) {
    return "complete"
  }
  if (hasEvent(events, "PlayStarted")) return "active"
  if (call?.call_disconnected_time) return "complete"
  return "waiting"
}

function playbackDetail(
  timeline: DeliveryTimeline,
  attempt: CallAttempt
): string {
  const call = timeline.simulator_call
  const events = attempt.events
  if (call?.error) return call.error
  const failed = events.find((event) => event.error)
  if (failed?.error) return failed.error
  if (call?.play_completed_time || hasEvent(events, "PlayCompleted")) {
    return "TTS completed"
  }
  if (call?.state === "playing" || hasEvent(events, "PlayStarted")) {
    return hasEvent(events, "CallDisconnected") ? "TTS played" : "TTS playing"
  }
  if (!call && !events.length) return "waiting for answer"
  return call?.result ?? call?.current_action ?? call?.state ?? "completed"
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

function hasEvent(events: CallEvent[], type: string) {
  return events.some((event) => event.event_type === type)
}

function eventTime(events: CallEvent[], type: string): string | null {
  return events.find((event) => event.event_type === type)?.occurred_at ?? null
}

/* -------------------------------------------------------------------------- */
/* Diagnostics                                                                */
/* -------------------------------------------------------------------------- */

function timelineDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).has("debugTimeline")
  } catch {
    return false
  }
}

function logTimelineDiagnostics(
  timeline: DeliveryTimeline,
  attempt: CallAttempt,
  graphEvents: GraphEvent[]
): void {
  const delivery = timeline.delivery
  const droppedCount = timeline.simulator_events.length - attempt.events.length

  console.groupCollapsed(
    `%c[DeliveryTimeline] ${timeline.id} · ${graphEvents.length}/${timeline.simulator_events.length} events graphed · ${timeline.correlation}`,
    "color:#0ea5e9;font-weight:600"
  )

  console.log("Summary", {
    id: timeline.id,
    correlation: timeline.correlation,
    to_number: timeline.to_number,
    contact_id: timeline.contact_id,
    chosen_attempt_context: attempt.contextKey,
    total_attempts: attemptCount(timeline),
    dropped_events: droppedCount,
    graph_event_count: graphEvents.length,
    total_duration_seconds:
      graphEvents.length > 1
        ? graphEvents[graphEvents.length - 1].offsetSeconds
        : 0,
  })

  console.log("Delivery timestamps", {
    status: delivery.status,
    state: delivery.state,
    result: delivery.result,
    dial_mode_type: delivery.dial_mode_type,
    created_on: delivery.created_on,
    start_date: delivery.start_date,
    end_date: delivery.end_date,
    result_date: delivery.result_date,
    modified_on: delivery.modified_on,
  })

  if (droppedCount > 0) {
    const chosenKeys = new Set(attempt.events.map((event) => event.occurred_at))
    console.log(
      "Dropped events (other attempts / outliers)",
      timeline.simulator_events
        .filter((event) => !chosenKeys.has(event.occurred_at))
        .map((event) => ({
          event_type: event.event_type,
          occurred_at: event.occurred_at,
          operation_context: event.operation_context,
        }))
    )
  }

  console.log("Derived stages")
  console.table(
    stagesForTimeline(timeline, attempt).map((stage) => ({
      label: stage.label,
      state: stage.state,
      detail: stage.detail,
      time: stage.time,
    }))
  )

  if (graphEvents.length) {
    console.log("Graph events (chronological, proportional positions)")
    console.table(
      graphEvents.map((event) => ({
        label: event.label,
        time: event.time,
        "offset (s)": round(event.offsetSeconds),
        "gap (s)": round(event.gapSeconds),
        "raw left (%)": round(event.rawLeft),
        "drawn left (%)": round(event.left),
        failed: event.failed,
        detail: event.detail,
      }))
    )
  }

  console.log("Chosen attempt events (raw)", attempt.events)
  console.groupEnd()
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : ""
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s"
  if (seconds < 60) {
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`
}
