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
import { StatusBadge } from "./status-badge"

export function ActiveCallsTable({ calls }: { calls: ActiveCall[] }) {
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
                <TableCell>{call.to_number}</TableCell>
                <TableCell className="font-mono text-xs">
                  {call.call_connection_id}
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
