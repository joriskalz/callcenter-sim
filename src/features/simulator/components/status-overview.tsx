import type { AppStatus } from "../types"
import { Section } from "./section"

export function StatusOverview({
  status,
  isLoading,
}: {
  status: AppStatus | undefined
  isLoading: boolean
}) {
  const metrics = status
    ? [
        ["App", status.status],
        ["Version", status.version],
        ["Active Calls", String(status.active_call_count)],
        ["ACS", status.config.acs_configured ? "configured" : "not configured"],
        ["TTS", status.config.tts_configured ? "configured" : "not configured"],
        [
          "Dataverse",
          status.config.dataverse_configured ? "configured" : "sample data",
        ],
        [
          "Callback URL",
          status.config.callback_url_valid
            ? status.config.callback_url
            : (status.config.callback_url_problem ?? ""),
        ],
      ]
    : []

  return (
    <Section
      title="Status"
      meta={
        status?.config.monitor_auth_configured
          ? "Monitor auth active"
          : "Monitor auth not set"
      }
    >
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-7">
        {isLoading && metrics.length === 0 ? (
          <Metric label="Loading" value="Fetching status" />
        ) : (
          metrics.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))
        )}
      </div>
    </Section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-24 p-4">
      <div className="text-xs font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-lg leading-tight font-semibold break-words">
        {value}
      </div>
    </div>
  )
}
