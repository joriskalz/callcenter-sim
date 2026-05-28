import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import {
  saveScenarioDefinitions,
  scenarios,
} from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/scenarios")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(scenarios())
        } catch (error) {
          return jsonError(error)
        }
      },
      PUT: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          const payload = (await request.json()) as unknown
          if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload)
          ) {
            throw new Error("Scenario payload must be an object.")
          }
          return Response.json(
            saveScenarioDefinitions(payload as Record<string, unknown>)
          )
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
