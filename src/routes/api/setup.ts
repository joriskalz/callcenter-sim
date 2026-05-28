import { createFileRoute } from "@tanstack/react-router"

import { setupStatus } from "@/server/simulator/service.server"

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      GET: async () => Response.json(setupStatus()),
    },
  },
})
