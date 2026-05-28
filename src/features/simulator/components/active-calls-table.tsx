import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ActiveCall } from "../types"
import { Section } from "./section"
import { SensitiveValue } from "./sensitive-value"
import { StatusBadge } from "./status-badge"

export function ActiveCallsTable({
  calls,
  revealSensitive,
}: {
  calls: ActiveCall[]
  revealSensitive: boolean
}) {
  return (
    <Section title="Active Calls" meta={`${calls.length} active`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Call Connection</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.length ? (
            calls.map((call) => (
              <TableRow key={call.operation_context}>
                <TableCell>
                  <StatusBadge value={call.state} />
                </TableCell>
                <TableCell>{call.scenario_name}</TableCell>
                <TableCell>
                  <SensitiveValue
                    value={call.to_number}
                    reveal={revealSensitive}
                    kind="phone"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <SensitiveValue
                    value={call.call_connection_id}
                    reveal={revealSensitive}
                    kind="guid"
                  />
                </TableCell>
                <TableCell>{call.current_action}</TableCell>
                <TableCell>{formatDate(call.incoming_call_time)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No active calls
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Section>
  )
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : ""
}
