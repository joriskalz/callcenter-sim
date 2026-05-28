import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { randomizeAddress } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/contacts/$contactId/address")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await randomizeAddress(params.contactId))
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
