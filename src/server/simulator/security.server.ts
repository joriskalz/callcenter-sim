import { getRequestHeader } from "@tanstack/react-start/server"

import { getSettings } from "./config.server"

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export function requireMonitorAccess(request: Request): void {
  const settings = getSettings()
  if (!settings.monitorApiKey) return

  const authorization = request.headers.get("authorization")
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null
  const monitorHeader = request.headers.get("x-monitor-api-key")

  if (
    matchesToken(monitorHeader, settings.monitorApiKey) ||
    matchesToken(bearerToken, settings.monitorApiKey)
  ) {
    return
  }

  throw new HttpError(401, "Monitor access requires a valid API key.")
}

export function requireMonitorAccessFromServerFn(
  apiKey: string | undefined
): void {
  const settings = getSettings()
  if (!settings.monitorApiKey) return

  const authorization = getRequestHeader("authorization")
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null
  const monitorHeader = getRequestHeader("x-monitor-api-key")

  if (
    matchesToken(apiKey, settings.monitorApiKey) ||
    matchesToken(monitorHeader, settings.monitorApiKey) ||
    matchesToken(bearerToken, settings.monitorApiKey)
  ) {
    return
  }

  throw new Error("Monitor access requires a valid API key.")
}

export function requireWebhookAccess(request: Request): void {
  const settings = getSettings()
  if (!settings.webhookSharedSecret) return
  if (
    matchesToken(
      request.headers.get("x-webhook-secret"),
      settings.webhookSharedSecret
    )
  )
    return
  throw new HttpError(401, "Webhook access requires a valid shared secret.")
}

function matchesToken(
  provided: string | null | undefined,
  expected: string | null
): boolean {
  return Boolean(expected && provided && provided === expected)
}
