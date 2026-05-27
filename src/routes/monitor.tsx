import { createFileRoute } from "@tanstack/react-router"

import { MonitorShell } from "@/features/simulator/components/monitor-shell"

export const Route = createFileRoute("/monitor")({
  component: MonitorShell,
})
