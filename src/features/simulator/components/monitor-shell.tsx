import {
  ActivityIcon,
  AlertTriangleIcon,
  BookOpenTextIcon,
  PhoneCallIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
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
  useDeleteProactiveDeliveriesMutation,
  useProactiveDeliveriesQuery,
  useProactiveEngagementConfigsQuery,
  useSaveScenariosMutation,
  useSetupStatusQuery,
  useStartProactiveExperimentMutation,
} from "../queries"
import { reachabilityStatuses } from "../types"
import type {
  ConfigIssue,
  ReachabilityStatus,
  Scenario,
  StartProactiveExperimentResult,
} from "../types"
import { ActiveCallsTable } from "./active-calls-table"
import { ConfigHelpPanel } from "./config-help-panel"
import { ContactsTable } from "./contacts-table"
import { DeliveryTimelineBoard } from "./delivery-timeline"
import { EventStream } from "./event-stream"
import { ProactiveExperimentTab } from "./proactive-experiment-tab"
import { ScenarioEditor } from "./scenario-editor"
import { StatusOverview, StatusSummaryPopover } from "./status-overview"

const monitorApiKeyStorageKey = "callcenter-sim:monitor-api-key"

type MonitorTab = "contacts" | "proactive" | "activity" | "scenarios"

export function MonitorShell() {
  const [apiKey, setApiKey] = React.useState("")
  const [apiKeyLoaded, setApiKeyLoaded] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<
    ReachabilityStatus | "all"
  >("all")
  const [search, setSearch] = React.useState("")
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [revealSensitive, setRevealSensitive] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<MonitorTab>("contacts")
  const [lastRefresh, setLastRefresh] = React.useState<string | null>(null)
  const [lastProactiveResult, setLastProactiveResult] =
    React.useState<StartProactiveExperimentResult | null>(null)
  const hasMonitorKey = Boolean(apiKey)

  const statusQuery = useMonitorStatusQuery(apiKey, autoRefresh)
  const contactsQuery = useMonitorContactsQuery(apiKey, autoRefresh)
  const scenariosQuery = useMonitorScenariosQuery(apiKey)
  const proactiveConfigsQuery = useProactiveEngagementConfigsQuery(apiKey)
  const proactiveDeliveriesQuery = useProactiveDeliveriesQuery(
    apiKey,
    autoRefresh
  )
  const saveScenariosMutation = useSaveScenariosMutation(apiKey)
  const startProactiveExperimentMutation =
    useStartProactiveExperimentMutation(apiKey)
  const deleteProactiveDeliveriesMutation =
    useDeleteProactiveDeliveriesMutation(apiKey)
  const setupQuery = useSetupStatusQuery()

  React.useEffect(() => {
    setApiKey(window.localStorage.getItem(monitorApiKeyStorageKey) ?? "")
    setApiKeyLoaded(true)
  }, [])

  React.useEffect(() => {
    if (!apiKeyLoaded) return

    if (!apiKey) {
      window.localStorage.removeItem(monitorApiKeyStorageKey)
      return
    }

    window.localStorage.setItem(monitorApiKeyStorageKey, apiKey)
  }, [apiKey, apiKeyLoaded])

  React.useEffect(() => {
    if (statusQuery.data && contactsQuery.data) {
      setLastRefresh(new Date().toLocaleTimeString())
    }
  }, [contactsQuery.data, statusQuery.data])

  const refresh = async () => {
    if (!hasMonitorKey) return

    await Promise.all([
      statusQuery.refetch(),
      contactsQuery.refetch(),
      scenariosQuery.refetch(),
      proactiveConfigsQuery.refetch(),
      proactiveDeliveriesQuery.refetch(),
    ])
    setLastRefresh(new Date().toLocaleTimeString())
  }

  const startProactiveExperiment = (input: {
    configId: string
    contactIds: string[]
  }) => {
    startProactiveExperimentMutation.mutate(input, {
      onSuccess: (result) => setLastProactiveResult(result),
    })
  }

  const deleteProactiveDeliveries = () => {
    const confirmed = window.confirm(
      "Delete all proactive delivery rows from Dataverse?"
    )
    if (!confirmed) return

    deleteProactiveDeliveriesMutation.mutate()
  }

  const configIssues = React.useMemo(
    () =>
      hasMonitorKey
        ? (statusQuery.data?.config.config_issues ?? [])
        : [
            monitorKeyIssue(setupQuery.data?.monitor_auth_configured ?? true),
            ...(setupQuery.data?.config_issues ?? []),
          ],
    [
      hasMonitorKey,
      setupQuery.data?.config_issues,
      setupQuery.data?.monitor_auth_configured,
      statusQuery.data?.config.config_issues,
    ]
  )
  const contactsConfigError = statusQuery.data ? contactsQuery.error : null
  const showSetupMode =
    !hasMonitorKey || configIssues.length > 0 || Boolean(contactsConfigError)
  const error =
    statusQuery.error ??
    (showSetupMode ? null : contactsQuery.error) ??
    scenariosQuery.error
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
            <Button
              type="button"
              variant="outline"
              className="lg:ml-auto"
              onClick={refresh}
              disabled={
                !hasMonitorKey ||
                statusQuery.isFetching ||
                contactsQuery.isFetching
              }
            >
              <RefreshCwIcon />
              Refresh
            </Button>
            {showSetupMode ? null : (
              <StatusSummaryPopover
                status={statusQuery.data}
                isLoading={statusQuery.isPending}
              />
            )}
            <label className="flex h-9 items-center gap-2 rounded-4xl border border-input bg-input/30 px-3 text-sm">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                size="sm"
              />
              Auto
            </label>
            <label className="flex h-9 items-center gap-2 rounded-4xl border border-input bg-input/30 px-3 text-sm">
              <ShieldIcon className="size-4 text-muted-foreground" />
              <Switch
                checked={revealSensitive}
                onCheckedChange={setRevealSensitive}
                size="sm"
              />
              Reveal
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
        {showSetupMode ? (
          <StatusOverview
            status={statusQuery.data}
            isLoading={hasMonitorKey && statusQuery.isPending}
          />
        ) : null}
        {showSetupMode ? (
          <ConfigHelpPanel
            issues={configIssues}
            contactsError={contactsConfigError}
          />
        ) : (
          <div className="grid gap-4">
            <MonitorTabs
              activeTab={activeTab}
              contactsCount={contactsQuery.data?.length ?? 0}
              activeCallsCount={statusQuery.data?.active_calls.length ?? 0}
              eventCount={statusQuery.data?.recent_events.length ?? 0}
              timelineCount={statusQuery.data?.delivery_timelines.length ?? 0}
              scenarioCount={scenarioOptions.length}
              proactiveConfigCount={proactiveConfigsQuery.data?.length ?? 0}
              onChange={setActiveTab}
            />

            <div
              role="tabpanel"
              id="monitor-tabpanel-contacts"
              aria-labelledby="monitor-tab-contacts"
              hidden={activeTab !== "contacts"}
              className="grid gap-4"
            >
              <ContactsTabControls
                statusFilter={statusFilter}
                search={search}
                onStatusFilterChange={setStatusFilter}
                onSearchChange={setSearch}
              />
              <ContactsTable
                contacts={contactsQuery.data ?? []}
                scenarioOptions={scenarioOptions}
                statusFilter={statusFilter}
                search={search}
                apiKey={apiKey}
                isLoading={contactsQuery.isPending}
                revealSensitive={revealSensitive}
                onRevealSensitiveChange={setRevealSensitive}
              />
            </div>

            <div
              role="tabpanel"
              id="monitor-tabpanel-proactive"
              aria-labelledby="monitor-tab-proactive"
              hidden={activeTab !== "proactive"}
              className="grid gap-4"
            >
              <ProactiveExperimentTab
                configs={proactiveConfigsQuery.data ?? []}
                contacts={contactsQuery.data ?? []}
                deliveries={proactiveDeliveriesQuery.data ?? []}
                activeCalls={statusQuery.data?.active_calls ?? []}
                events={statusQuery.data?.recent_events ?? []}
                isConfigsLoading={proactiveConfigsQuery.isPending}
                isContactsLoading={contactsQuery.isPending}
                isDeliveriesLoading={proactiveDeliveriesQuery.isPending}
                isStarting={startProactiveExperimentMutation.isPending}
                isDeleting={deleteProactiveDeliveriesMutation.isPending}
                startError={startProactiveExperimentMutation.error}
                deleteError={deleteProactiveDeliveriesMutation.error}
                lastResult={lastProactiveResult}
                revealSensitive={revealSensitive}
                onStart={startProactiveExperiment}
                onRefreshDeliveries={() =>
                  void proactiveDeliveriesQuery.refetch()
                }
                onDeleteDeliveries={deleteProactiveDeliveries}
              />
            </div>

            <div
              role="tabpanel"
              id="monitor-tabpanel-activity"
              aria-labelledby="monitor-tab-activity"
              hidden={activeTab !== "activity"}
              className="grid gap-4"
            >
              <ActiveCallsTable
                calls={statusQuery.data?.active_calls ?? []}
                revealSensitive={revealSensitive}
              />
              <DeliveryTimelineBoard
                status={statusQuery.data}
                revealSensitive={revealSensitive}
              />
              <EventStream
                events={statusQuery.data?.recent_events ?? []}
                revealSensitive={revealSensitive}
              />
            </div>

            <div
              role="tabpanel"
              id="monitor-tabpanel-scenarios"
              aria-labelledby="monitor-tab-scenarios"
              hidden={activeTab !== "scenarios"}
              className="grid gap-4"
            >
              <ScenarioEditor
                scenarios={scenariosQuery.data ?? {}}
                isLoading={scenariosQuery.isPending}
                isSaving={saveScenariosMutation.isPending}
                saveError={saveScenariosMutation.error}
                onSave={(nextScenarios) =>
                  saveScenariosMutation.mutate(nextScenarios)
                }
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function MonitorTabs({
  activeTab,
  contactsCount,
  timelineCount,
  activeCallsCount,
  eventCount,
  scenarioCount,
  proactiveConfigCount,
  onChange,
}: {
  activeTab: MonitorTab
  contactsCount: number
  timelineCount: number
  activeCallsCount: number
  eventCount: number
  scenarioCount: number
  proactiveConfigCount: number
  onChange: (tab: MonitorTab) => void
}) {
  const tabs: Array<{
    id: MonitorTab
    label: string
    meta: string
    icon: React.ReactNode
  }> = [
    {
      id: "contacts",
      label: "Contacts",
      meta: `${contactsCount} rows`,
      icon: <UsersIcon />,
    },
    {
      id: "proactive",
      label: "Proactive",
      meta: `${proactiveConfigCount} configs`,
      icon: <PhoneCallIcon />,
    },
    {
      id: "activity",
      label: "Timeline",
      meta: `${timelineCount} deliveries / ${activeCallsCount} calls / ${eventCount} events`,
      icon: <ActivityIcon />,
    },
    {
      id: "scenarios",
      label: "Scenarios",
      meta: `${scenarioCount} editable`,
      icon: <BookOpenTextIcon />,
    },
  ]

  return (
    <div
      role="tablist"
      aria-label="Monitor sections"
      className="grid gap-2 rounded-lg border bg-card p-1 md:grid-cols-4"
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`monitor-tab-${tab.id}`}
            aria-controls={`monitor-tabpanel-${tab.id}`}
            aria-selected={selected}
            className={[
              "flex min-h-14 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            ].join(" ")}
            onClick={() => onChange(tab.id)}
          >
            <span className="[&_svg]:size-4">{tab.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{tab.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {tab.meta}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ContactsTabControls({
  statusFilter,
  search,
  onStatusFilterChange,
  onSearchChange,
}: {
  statusFilter: ReachabilityStatus | "all"
  search: string
  onStatusFilterChange: (value: ReachabilityStatus | "all") => void
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <Select
        value={statusFilter}
        onValueChange={(value) =>
          onStatusFilterChange(value as ReachabilityStatus | "all")
        }
      >
        <SelectTrigger>
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
      <div className="relative min-w-0">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search number, name, scenario"
          className="pl-9"
        />
      </div>
    </div>
  )
}

function monitorKeyIssue(monitorAuthConfigured: boolean): ConfigIssue {
  return {
    area: "Monitor",
    title: monitorAuthConfigured
      ? "Monitor API key required"
      : "Monitor API key is not configured",
    description: monitorAuthConfigured
      ? "Enter the monitor API key from MONITOR_API_KEY in the password field above."
      : "Add MONITOR_API_KEY to your local .env so the monitor can be protected, then let the dev server reload.",
    envVars: ["MONITOR_API_KEY"],
  }
}

function scenarioOptionsFromMap(scenarios: Record<string, Scenario>) {
  return Array.from(
    new Map(
      Object.values(scenarios).map((scenario) => [scenario.name, scenario])
    ).values()
  ).sort((first, second) => first.name.localeCompare(second.name))
}
