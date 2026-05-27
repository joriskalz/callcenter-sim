import { createFileRoute } from "@tanstack/react-router"

import { requireWebhookAccess } from "@/server/simulator/security.server"
import { handleIncomingCallPayload } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/incomingCall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireWebhookAccess(request)
          return handleIncomingCallPayload(await request.json())
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
