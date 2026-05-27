import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { scenarios } from "@/server/simulator/service.server"
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
    },
  },
})
