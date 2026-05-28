import {
  AlertTriangleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  MapPinIcon,
  ShuffleIcon,
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

import {
  usePatchContactStatusMutation,
  useRandomizeAllContactAddressesMutation,
  useRandomizeContactAddressMutation,
} from "../queries"
import type { Contact, ContactStatusPatch, ReachabilityStatus } from "../types"
import { ConsentPopover } from "./consent-popover"
import { ReachabilityStatusPopover } from "./reachability-status-popover"
import { ScenarioPopover } from "./scenario-popover"
import type { ScenarioOption } from "./scenario-popover"
import { Section } from "./section"
import { SensitiveCopy } from "./sensitive-value"

export function ContactsTable({
  contacts,
  scenarioOptions,
  statusFilter,
  search,
  apiKey,
  isLoading,
  revealSensitive,
  onRevealSensitiveChange,
}: {
  contacts: Contact[]
  scenarioOptions: ScenarioOption[]
  statusFilter: ReachabilityStatus | "all"
  search: string
  apiKey: string
  isLoading: boolean
  revealSensitive: boolean
  onRevealSensitiveChange: (value: boolean) => void
}) {
  const randomizeAllMutation = useRandomizeAllContactAddressesMutation(apiKey)
  const filteredContacts = [...contacts]
    .sort(compareContactsByName)
    .filter((contact) => {
      if (
        statusFilter !== "all" &&
        contact.new_ccsim_reachabilitystatus !== statusFilter
      )
        return false
      const query = search.trim().toLowerCase()
      if (!query) return true
      return [
        contact.fullname,
        contact.telephone1,
        contact.address1_line1,
        contact.address1_city,
        contact.address1_postalcode,
        contact.address1_country,
        contact.new_ccsim_scenario,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })

  return (
    <Section
      title="Contacts"
      meta={
        <div className="flex items-center gap-3">
          <span>{filteredContacts.length} visible</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!contacts.length || randomizeAllMutation.isPending}
            onClick={() => randomizeAllMutation.mutate()}
          >
            {randomizeAllMutation.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <ShuffleIcon />
            )}
            Randomize all
          </Button>
        </div>
      }
    >
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
                    revealSensitive
                      ? "Hide full phone numbers"
                      : "Show full phone numbers"
                  }
                  title={
                    revealSensitive
                      ? "Hide full phone numbers"
                      : "Show full phone numbers"
                  }
                  onClick={() => onRevealSensitiveChange(!revealSensitive)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {revealSensitive ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            </TableHead>
            <TableHead className="min-w-56">Address</TableHead>
            <TableHead>Consent</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>Last Call</TableHead>
            <TableHead className="w-40"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !contacts.length ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
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
                revealSensitive={revealSensitive}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
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
  revealSensitive,
}: {
  contact: Contact
  scenarioOptions: ScenarioOption[]
  apiKey: string
  revealSensitive: boolean
}) {
  const [enabled, setEnabled] = React.useState(contact.new_ccsim_enabled)
  const [status, setStatus] = React.useState<ReachabilityStatus>(
    contact.new_ccsim_reachabilitystatus
  )
  const [scenario, setScenario] = React.useState(
    scenarioValue(contact.new_ccsim_scenario, scenarioOptions)
  )
  const statusMutation = usePatchContactStatusMutation(apiKey)
  const addressMutation = useRandomizeContactAddressMutation(apiKey)

  React.useEffect(() => {
    setEnabled(contact.new_ccsim_enabled)
    setStatus(contact.new_ccsim_reachabilitystatus)
    setScenario(scenarioValue(contact.new_ccsim_scenario, scenarioOptions))
  }, [contact, scenarioOptions])

  const savePatch = (patch: ContactStatusPatch) => {
    statusMutation.mutate({
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
      <TableCell>
        <PhoneNumberCopy
          phoneNumber={contact.telephone1}
          revealSensitive={revealSensitive}
        />
      </TableCell>
      <TableCell className="whitespace-normal">
        <AddressSummary contact={contact} />
      </TableCell>
      <TableCell>
        <ConsentPopover
          contactId={contact.contactid}
          phoneNumber={contact.telephone1}
          consent={contact.consent}
          apiKey={apiKey}
        />
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
        <div className="flex flex-col items-end gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={addressMutation.isPending}
            onClick={() =>
              addressMutation.mutate({ contactId: contact.contactid })
            }
          >
            {addressMutation.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <ShuffleIcon />
            )}
            Address
          </Button>
          <RowMutationState
            statusPending={statusMutation.isPending}
            statusError={statusMutation.isError}
            statusSuccess={statusMutation.isSuccess}
            addressPending={addressMutation.isPending}
            addressError={addressMutation.isError}
            addressSuccess={addressMutation.isSuccess}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

function AddressSummary({ contact }: { contact: Contact }) {
  const address = [
    contact.address1_line1,
    [contact.address1_postalcode, contact.address1_city]
      .filter(Boolean)
      .join(" "),
    contact.address1_country,
  ]
    .filter(Boolean)
    .join(", ")

  if (!address) {
    return <span className="text-sm text-muted-foreground">No address</span>
  }

  return (
    <div className="flex max-w-72 items-start gap-2 text-sm">
      <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 leading-5">{address}</span>
    </div>
  )
}

function RowMutationState({
  statusPending,
  statusError,
  statusSuccess,
  addressPending,
  addressError,
  addressSuccess,
}: {
  statusPending: boolean
  statusError: boolean
  statusSuccess: boolean
  addressPending: boolean
  addressError: boolean
  addressSuccess: boolean
}) {
  if (addressPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        Changing
      </span>
    )
  }

  if (statusPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        Saving
      </span>
    )
  }

  if (addressError || statusError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangleIcon className="size-3.5" />
        Error
      </span>
    )
  }

  if (addressSuccess) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckIcon className="size-3.5" />
        Changed
      </span>
    )
  }

  if (statusSuccess) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckIcon className="size-3.5" />
        Saved
      </span>
    )
  }

  return <span className="text-xs text-muted-foreground">Auto-save</span>
}

function PhoneNumberCopy({
  phoneNumber,
  revealSensitive,
}: {
  phoneNumber: string | null
  revealSensitive: boolean
}) {
  return (
    <SensitiveCopy
      value={phoneNumber}
      reveal={revealSensitive}
      kind="phone"
      label="phone number"
    />
  )
}

function scenarioValue(
  current: string | null,
  scenarioOptions: ScenarioOption[]
) {
  return current || scenarioOptions.at(0)?.name || ""
}

function compareContactsByName(left: Contact, right: Contact): number {
  return left.fullname.localeCompare(right.fullname, undefined, {
    sensitivity: "base",
    numeric: true,
  })
}
