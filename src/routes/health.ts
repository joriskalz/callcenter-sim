import { createFileRoute } from "@tanstack/react-router"

import { healthStatus } from "@/server/simulator/service.server"

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => Response.json(healthStatus()),
    },
  },
})
