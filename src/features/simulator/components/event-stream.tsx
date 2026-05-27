import { StatusBadge } from "./status-badge"
import { Section } from "./section"
import type { CallEvent } from "../types"

export function EventStream({ events }: { events: CallEvent[] }) {
  return (
    <Section title="Event Stream" meta={`${events.length} events`}>
      <div className="divide-y">
        {events.length ? (
          events.slice(0, 40).map((event, index) => (
            <div
              key={`${event.occurred_at}-${event.event_type}-${index}`}
              className="grid gap-2 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)_220px]"
            >
              <div>
                <StatusBadge
                  value={event.error ? "failed" : event.event_type}
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm break-words">{event.message}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {[event.scenario_name, event.to_number]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              </div>
              <div className="text-sm text-muted-foreground md:text-right">
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
