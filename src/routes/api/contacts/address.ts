import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { randomizeAllAddresses } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/contacts/address")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await randomizeAllAddresses())
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
