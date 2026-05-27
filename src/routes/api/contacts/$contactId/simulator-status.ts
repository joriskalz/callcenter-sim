import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { patchStatus } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute(
  "/api/contacts/$contactId/simulator-status"
)({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(
            await patchStatus(params.contactId, await request.json())
          )
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
