import { createFileRoute } from "@tanstack/react-router"

import { requireMonitorAccess } from "@/server/simulator/security.server"
import { patchConsent, removeConsent } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/contacts/$contactId/consent")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(
            await patchConsent(params.contactId, await request.json())
          )
        } catch (error) {
          return jsonError(error)
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          requireMonitorAccess(request)
          return Response.json(await removeConsent(params.contactId))
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
