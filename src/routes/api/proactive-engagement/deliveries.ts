import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import {
  deleteProactiveDeliveries,
  proactiveDeliveries,
  startProactiveExperiment,
} from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/proactive-engagement/deliveries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await proactiveDeliveries())
        } catch (error) {
          return jsonError(error)
        }
      },
      POST: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(
            await startProactiveExperiment(await request.json())
          )
        } catch (error) {
          return jsonError(error)
        }
      },
      DELETE: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await deleteProactiveDeliveries())
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
