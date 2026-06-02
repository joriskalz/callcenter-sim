import {
  CheckIcon,
  ChevronsUpDownIcon,
  PhoneCallIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type {
  ActiveCall,
  CallEvent,
  Contact,
  ProactiveDelivery,
  ProactiveEngagementConfig,
  StartProactiveExperimentResult,
} from "../types"
import { ActiveCallsTable } from "./active-calls-table"
import { EventStream } from "./event-stream"
import { Section } from "./section"
import { SensitiveValue } from "./sensitive-value"
import { StatusBadge } from "./status-badge"

export function ProactiveExperimentTab({
  configs,
  contacts,
  deliveries,
  activeCalls,
  events,
  isConfigsLoading,
  isContactsLoading,
  isDeliveriesLoading,
  isStarting,
  isDeleting,
  startError,
  deleteError,
  lastResult,
  revealSensitive,
  onStart,
  onRefreshDeliveries,
  onDeleteDeliveries,
}: {
  configs: ProactiveEngagementConfig[]
  contacts: Contact[]
  deliveries: ProactiveDelivery[]
  activeCalls: ActiveCall[]
  events: CallEvent[]
  isConfigsLoading: boolean
  isContactsLoading: boolean
  isDeliveriesLoading: boolean
  isStarting: boolean
  isDeleting: boolean
  startError: unknown
  deleteError: unknown
  lastResult: StartProactiveExperimentResult | null
  revealSensitive: boolean
  onStart: (input: { configId: string; contactIds: string[] }) => void
  onRefreshDeliveries: () => void
  onDeleteDeliveries: () => void
}) {
  const [configId, setConfigId] = React.useState("")
  const [selectedContactIds, setSelectedContactIds] = React.useState<string[]>(
    []
  )

  React.useEffect(() => {
    if (!configId && configs[0]) setConfigId(configs[0].id)
  }, [configId, configs])

  React.useEffect(() => {
    setSelectedContactIds((current) =>
      current.filter((contactId) =>
        contacts.some((contact) => contact.contactid === contactId)
      )
    )
  }, [contacts])

  const selectedContacts = contacts.filter((contact) =>
    selectedContactIds.includes(contact.contactid)
  )
  const selectedCallableContacts = selectedContacts.filter(
    (contact) => contact.telephone1
  )
  const canStart =
    Boolean(configId) && selectedCallableContacts.length > 0 && !isStarting

  const start = () => {
    if (!canStart) return
    onStart({
      configId,
      contactIds: selectedCallableContacts.map((c) => c.contactid),
    })
  }

  return (
    <div className="grid gap-4">
      <Section
        title="Proactive Engagement Experiment"
        meta={`${selectedCallableContacts.length} selected`}
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)]">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Config
              </label>
              <Select
                value={configId}
                onValueChange={(value) => {
                  if (value) setConfigId(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedConfigName(configs, configId, isConfigsLoading)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {configs.length ? (
                    configs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {isConfigsLoading ? "Loading configs" : "No configs"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Contacts
              </label>
              <ContactMultiSelect
                contacts={contacts}
                selectedIds={selectedContactIds}
                disabled={isContactsLoading}
                revealSensitive={revealSensitive}
                onChange={setSelectedContactIds}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <ExperimentResult result={lastResult} />
            <Button
              type="button"
              onClick={start}
              disabled={!canStart}
              className="sm:ml-auto"
            >
              <PhoneCallIcon />
              {isStarting ? "Starting" : "Start experiment"}
            </Button>
          </div>

          {startError ? <InlineError error={startError} /> : null}
        </div>
      </Section>

      <DeliveryTable
        deliveries={deliveries}
        isLoading={isDeliveriesLoading}
        isDeleting={isDeleting}
        deleteError={deleteError}
        revealSensitive={revealSensitive}
        onRefresh={onRefreshDeliveries}
        onDeleteAll={onDeleteDeliveries}
      />

      <ActiveCallsTable calls={activeCalls} revealSensitive={revealSensitive} />
      <EventStream events={events} revealSensitive={revealSensitive} />
    </div>
  )
}

function ContactMultiSelect({
  contacts,
  selectedIds,
  disabled,
  revealSensitive,
  onChange,
}: {
  contacts: Contact[]
  selectedIds: string[]
  disabled: boolean
  revealSensitive: boolean
  onChange: (selectedIds: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => document.removeEventListener("mousedown", closeOnOutsideClick)
  }, [open])

  const selectedContacts = contacts.filter((contact) =>
    selectedIds.includes(contact.contactid)
  )
  const filteredContacts = contacts.filter((contact) => {
    const text = [
      contact.fullname,
      contact.telephone1,
      contact.new_ccsim_scenario,
      contact.new_ccsim_reachabilitystatus,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return text.includes(query.trim().toLowerCase())
  })

  const toggle = (contact: Contact) => {
    if (!contact.telephone1) return
    onChange(
      selectedIds.includes(contact.contactid)
        ? selectedIds.filter((id) => id !== contact.contactid)
        : [...selectedIds, contact.contactid]
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-2xl border border-input bg-input/30 px-3 py-2 text-left text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedContacts.length ? (
            selectedContacts.slice(0, 4).map((contact) => (
              <Badge key={contact.contactid} variant="outline">
                <span className="max-w-40 truncate">{contact.fullname}</span>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">Select contacts</span>
          )}
          {selectedContacts.length > 4 ? (
            <Badge variant="secondary">+{selectedContacts.length - 4}</Badge>
          ) : null}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5">
          <div className="relative border-b p-2">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts"
              className="pl-9"
            />
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            className="max-h-80 overflow-y-auto p-1.5"
          >
            {filteredContacts.length ? (
              filteredContacts.map((contact) => {
                const selected = selectedIds.includes(contact.contactid)
                const callable = Boolean(contact.telephone1)

                return (
                  <button
                    key={contact.contactid}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!callable}
                    className={cn(
                      "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm outline-none",
                      "hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    )}
                    onClick={() => toggle(contact)}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background"
                      )}
                    >
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {contact.fullname}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <SensitiveValue
                          value={contact.telephone1}
                          reveal={revealSensitive}
                          kind="phone"
                        />
                      </span>
                    </span>
                    <StatusBadge
                      value={
                        callable
                          ? contact.new_ccsim_reachabilitystatus
                          : "no phone"
                      }
                      className="normal-case"
                    />
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching contacts
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() =>
                  onChange(
                    contacts
                      .filter((contact) => contact.telephone1)
                      .map((contact) => contact.contactid)
                  )
                }
              >
                All
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => onChange([])}
              >
                None
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DeliveryTable({
  deliveries,
  isLoading,
  isDeleting,
  deleteError,
  revealSensitive,
  onRefresh,
  onDeleteAll,
}: {
  deliveries: ProactiveDelivery[]
  isLoading: boolean
  isDeleting: boolean
  deleteError: unknown
  revealSensitive: boolean
  onRefresh: () => void
  onDeleteAll: () => void
}) {
  return (
    <Section
      title="Delivery Table"
      meta={
        <div className="flex items-center gap-2">
          <span>{deliveries.length} rows</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="Refresh deliveries"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCwIcon />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="destructive"
            title="Delete all deliveries"
            onClick={onDeleteAll}
            disabled={!deliveries.length || isDeleting}
          >
            <Trash2Icon />
          </Button>
        </div>
      }
    >
      {deleteError ? <InlineError error={deleteError} /> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.length ? (
            deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>
                  <StatusBadge
                    value={delivery.status ?? "unknown"}
                    className="normal-case"
                  />
                </TableCell>
                <TableCell>
                  {delivery.result ? (
                    <StatusBadge
                      value={delivery.result}
                      className="normal-case"
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <SensitiveValue
                    value={delivery.to_address}
                    reveal={revealSensitive}
                    kind="phone"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <SensitiveValue
                    value={delivery.delivery_id || delivery.id}
                    reveal={revealSensitive}
                    kind="guid"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <SensitiveValue
                    value={delivery.contact_id}
                    reveal={revealSensitive}
                    kind="guid"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <SensitiveValue
                    value={delivery.call_id}
                    reveal={revealSensitive}
                    kind="guid"
                  />
                </TableCell>
                <TableCell>{formatDate(delivery.created_on)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                {isLoading ? "Loading deliveries" : "No deliveries"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Section>
  )
}

function ExperimentResult({
  result,
}: {
  result: StartProactiveExperimentResult | null
}) {
  if (!result) {
    return (
      <div className="text-sm text-muted-foreground">
        Ready to create proactive voice deliveries.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="outline">{result.requested} requested</Badge>
      <Badge className="bg-success text-success-foreground">
        {result.created.length} created
      </Badge>
      {result.failed.length ? (
        <Badge variant="destructive">{result.failed.length} failed</Badge>
      ) : null}
    </div>
  )
}

function InlineError({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

function selectedConfigName(
  configs: ProactiveEngagementConfig[],
  configId: string,
  isLoading: boolean
) {
  return (
    configs.find((config) => config.id === configId)?.name ??
    (isLoading ? "Loading configs" : "Select config")
  )
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : ""
}
