import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { contacts } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/contacts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await contacts())
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
