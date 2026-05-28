import { StatusBadge } from "./status-badge"
import { Section } from "./section"
import type { CallEvent } from "../types"
import { SensitiveValue } from "./sensitive-value"

export function EventStream({
  events,
  revealSensitive,
}: {
  events: CallEvent[]
  revealSensitive: boolean
}) {
  return (
    <Section title="Event Stream" meta={`${events.length} events`}>
      <div className="divide-y">
        {events.length ? (
          events.slice(0, 40).map((event, index) => (
            <div
              key={`${event.occurred_at}-${event.event_type}-${index}`}
              className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_max-content] md:items-center"
            >
              <div className="min-w-0">
                <StatusBadge
                  value={event.error ? "failed" : event.event_type}
                  className="max-w-full justify-start truncate normal-case"
                />
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
              <div className="text-sm whitespace-nowrap text-muted-foreground md:text-right">
                {formatDate(event.occurred_at)}
              </div>
            </div>
          ))
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
