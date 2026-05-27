import {
  ActivityIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import {
  useMonitorContactsQuery,
  useMonitorScenariosQuery,
  useMonitorStatusQuery,
} from "../queries"
import { reachabilityStatuses } from "../types"
import type { ReachabilityStatus, Scenario } from "../types"
import { ActiveCallsTable } from "./active-calls-table"
import { ContactsTable } from "./contacts-table"
import { EventStream } from "./event-stream"
import { StatusOverview } from "./status-overview"

export function MonitorShell() {
  const [apiKey, setApiKey] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    ReachabilityStatus | "all"
  >("all")
  const [search, setSearch] = React.useState("")
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [lastRefresh, setLastRefresh] = React.useState<string | null>(null)

  const statusQuery = useMonitorStatusQuery(apiKey, autoRefresh)
  const contactsQuery = useMonitorContactsQuery(apiKey, autoRefresh)
  const scenariosQuery = useMonitorScenariosQuery(apiKey)

  React.useEffect(() => {
    if (statusQuery.data && contactsQuery.data) {
      setLastRefresh(new Date().toLocaleTimeString())
    }
  }, [contactsQuery.data, statusQuery.data])

  const refresh = async () => {
    await Promise.all([
      statusQuery.refetch(),
      contactsQuery.refetch(),
      scenariosQuery.refetch(),
    ])
    setLastRefresh(new Date().toLocaleTimeString())
  }

  const error = statusQuery.error ?? contactsQuery.error ?? scenariosQuery.error
  const scenarioOptions = React.useMemo(
    () => scenarioOptionsFromMap(scenariosQuery.data ?? {}),
    [scenariosQuery.data]
  )

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <ActivityIcon className="size-3.5" />
                Dynamics 365 Contact Center
              </div>
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                Outbound Customer Simulator
              </h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {lastRefresh
                ? `Last refresh ${lastRefresh}`
                : "Waiting for first refresh"}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Monitor API key"
              className="lg:max-w-64"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ReachabilityStatus | "all")
              }
            >
              <SelectTrigger className="w-full lg:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {reachabilityStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search number, name, scenario"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={refresh}
              disabled={statusQuery.isFetching || contactsQuery.isFetching}
            >
              <RefreshCwIcon />
              Refresh
            </Button>
            <label className="flex h-9 items-center gap-2 rounded-4xl border border-input bg-input/30 px-3 text-sm">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                size="sm"
              />
              Auto
            </label>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                {error instanceof Error
                  ? error.message
                  : "Monitor data could not be loaded."}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <StatusOverview
          status={statusQuery.data}
          isLoading={statusQuery.isPending}
        />
        <ContactsTable
          contacts={contactsQuery.data ?? []}
          scenarioOptions={scenarioOptions}
          statusFilter={statusFilter}
          search={search}
          apiKey={apiKey}
          isLoading={contactsQuery.isPending}
        />
        <ActiveCallsTable calls={statusQuery.data?.active_calls ?? []} />
        <EventStream events={statusQuery.data?.recent_events ?? []} />
      </div>
    </main>
  )
}

function scenarioOptionsFromMap(scenarios: Record<string, Scenario>) {
  return Array.from(
    new Map(
      Object.values(scenarios).map((scenario) => [scenario.name, scenario])
    ).values()
  ).sort((first, second) => first.name.localeCompare(second.name))
}
