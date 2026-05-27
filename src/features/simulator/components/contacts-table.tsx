import {
  AlertTriangleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { usePatchContactStatusMutation } from "../queries"
import type { Contact, ContactStatusPatch, ReachabilityStatus } from "../types"
import { ReachabilityStatusPopover } from "./reachability-status-popover"
import { ScenarioPopover } from "./scenario-popover"
import type { ScenarioOption } from "./scenario-popover"
import { Section } from "./section"

export function ContactsTable({
  contacts,
  scenarioOptions,
  statusFilter,
  search,
  apiKey,
  isLoading,
}: {
  contacts: Contact[]
  scenarioOptions: ScenarioOption[]
  statusFilter: ReachabilityStatus | "all"
  search: string
  apiKey: string
  isLoading: boolean
}) {
  const [showPhoneNumbers, setShowPhoneNumbers] = React.useState(false)
  const filteredContacts = contacts.filter((contact) => {
    if (
      statusFilter !== "all" &&
      contact.new_ccsim_reachabilitystatus !== statusFilter
    )
      return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [contact.fullname, contact.telephone1, contact.new_ccsim_scenario]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  return (
    <Section title="Contacts" meta={`${filteredContacts.length} visible`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <span>Business Phone</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={
                    showPhoneNumbers
                      ? "Hide full phone numbers"
                      : "Show full phone numbers"
                  }
                  title={
                    showPhoneNumbers
                      ? "Hide full phone numbers"
                      : "Show full phone numbers"
                  }
                  onClick={() => setShowPhoneNumbers((visible) => !visible)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showPhoneNumbers ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            </TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>Last Call</TableHead>
            <TableHead className="w-28"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !contacts.length ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Loading contacts
              </TableCell>
            </TableRow>
          ) : filteredContacts.length ? (
            filteredContacts.map((contact) => (
              <ContactRow
                key={contact.contactid}
                contact={contact}
                scenarioOptions={scenarioOptions}
                apiKey={apiKey}
                showPhoneNumber={showPhoneNumbers}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No contacts match the current filters
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Section>
  )
}

function ContactRow({
  contact,
  scenarioOptions,
  apiKey,
  showPhoneNumber,
}: {
  contact: Contact
  scenarioOptions: ScenarioOption[]
  apiKey: string
  showPhoneNumber: boolean
}) {
  const [enabled, setEnabled] = React.useState(contact.new_ccsim_enabled)
  const [status, setStatus] = React.useState<ReachabilityStatus>(
    contact.new_ccsim_reachabilitystatus
  )
  const [scenario, setScenario] = React.useState(
    scenarioValue(contact.new_ccsim_scenario, scenarioOptions)
  )
  const mutation = usePatchContactStatusMutation(apiKey)

  React.useEffect(() => {
    setEnabled(contact.new_ccsim_enabled)
    setStatus(contact.new_ccsim_reachabilitystatus)
    setScenario(scenarioValue(contact.new_ccsim_scenario, scenarioOptions))
  }, [contact, scenarioOptions])

  const savePatch = (patch: ContactStatusPatch) => {
    mutation.mutate({
      contactId: contact.contactid,
      patch,
    })
  }

  const handleEnabledChange = (nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    savePatch({ new_ccsim_enabled: nextEnabled })
  }

  const handleStatusChange = (nextStatus: ReachabilityStatus | null) => {
    if (!nextStatus) return
    setStatus(nextStatus)
    savePatch({ new_ccsim_reachabilitystatus: nextStatus })
  }

  const handleScenarioChange = (nextScenario: string | null) => {
    if (!nextScenario) return
    setScenario(nextScenario)
    savePatch({ new_ccsim_scenario: nextScenario })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{contact.fullname}</TableCell>
      <TableCell className="font-mono text-sm">
        {showPhoneNumber
          ? contact.telephone1
          : maskPhoneNumber(contact.telephone1)}
      </TableCell>
      <TableCell>
        <Switch
          checked={enabled}
          onCheckedChange={handleEnabledChange}
          size="sm"
        />
      </TableCell>
      <TableCell>
        <ReachabilityStatusPopover
          value={status}
          onValueChange={handleStatusChange}
        />
      </TableCell>
      <TableCell>
        <ScenarioPopover
          value={scenario}
          options={scenarioOptions}
          onValueChange={handleScenarioChange}
        />
      </TableCell>
      <TableCell>{contact.new_ccsim_lastcallresult}</TableCell>
      <TableCell className="text-right">
        <AutosaveState
          isPending={mutation.isPending}
          isError={mutation.isError}
          isSuccess={mutation.isSuccess}
        />
      </TableCell>
    </TableRow>
  )
}

function AutosaveState({
  isPending,
  isError,
  isSuccess,
}: {
  isPending: boolean
  isError: boolean
  isSuccess: boolean
}) {
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        Saving
      </span>
    )
  }

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangleIcon className="size-3.5" />
        Error
      </span>
    )
  }

  if (isSuccess) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckIcon className="size-3.5" />
        Saved
      </span>
    )
  }

  return <span className="text-xs text-muted-foreground">Auto-save</span>
}

function maskPhoneNumber(phoneNumber: string | null): string {
  if (!phoneNumber) return ""
  if (phoneNumber.length <= 5) return phoneNumber
  return `${phoneNumber.slice(0, 3)}${"•".repeat(
    Math.max(2, phoneNumber.length - 5)
  )}${phoneNumber.slice(-2)}`
}

function scenarioValue(
  current: string | null,
  scenarioOptions: ScenarioOption[]
) {
  return current || scenarioOptions.at(0)?.name || ""
}
