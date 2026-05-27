import { SaveIcon } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { usePatchContactStatusMutation } from "../queries"
import { reachabilityStatuses } from "../types"
import type { Contact, ReachabilityStatus } from "../types"
import { Section } from "./section"
import { StatusBadge } from "./status-badge"

export function ContactsTable({
  contacts,
  statusFilter,
  search,
  apiKey,
  isLoading,
}: {
  contacts: Contact[]
  statusFilter: ReachabilityStatus | "all"
  search: string
  apiKey: string
  isLoading: boolean
}) {
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
            <TableHead>Business Phone</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>Last Call</TableHead>
            <TableHead className="w-24"></TableHead>
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
                apiKey={apiKey}
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

function ContactRow({ contact, apiKey }: { contact: Contact; apiKey: string }) {
  const [enabled, setEnabled] = React.useState(contact.new_ccsim_enabled)
  const [status, setStatus] = React.useState<ReachabilityStatus>(
    contact.new_ccsim_reachabilitystatus
  )
  const [scenario, setScenario] = React.useState(
    contact.new_ccsim_scenario ?? ""
  )
  const mutation = usePatchContactStatusMutation(apiKey)

  React.useEffect(() => {
    setEnabled(contact.new_ccsim_enabled)
    setStatus(contact.new_ccsim_reachabilitystatus)
    setScenario(contact.new_ccsim_scenario ?? "")
  }, [contact])

  const save = () => {
    mutation.mutate({
      contactId: contact.contactid,
      patch: {
        new_ccsim_enabled: enabled,
        new_ccsim_reachabilitystatus: status,
        new_ccsim_scenario: scenario.trim() || null,
      },
    })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{contact.fullname}</TableCell>
      <TableCell>{contact.telephone1}</TableCell>
      <TableCell>
        <Switch checked={enabled} onCheckedChange={setEnabled} size="sm" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <StatusBadge value={status} />
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ReachabilityStatus)}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reachabilityStatuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
          className="min-w-44"
        />
      </TableCell>
      <TableCell>{contact.new_ccsim_lastcallresult}</TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={mutation.isPending}
        >
          <SaveIcon />
          Save
        </Button>
      </TableCell>
    </TableRow>
  )
}
