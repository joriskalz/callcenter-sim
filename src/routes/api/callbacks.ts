import { createFileRoute } from "@tanstack/react-router"

import { requireWebhookAccess } from "@/server/simulator/security.server"
import { handleCallbackPayload } from "@/server/simulator/service.server"
import { jsonError } from "@/server/simulator/web-response.server"

export const Route = createFileRoute("/api/callbacks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireWebhookAccess(request)
          return handleCallbackPayload(await request.json())
        } catch (error) {
          return jsonError(error)
        }
      },
    },
  },
})
