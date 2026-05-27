import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  contacts,
  handleIncomingCallPayload,
  healthStatus,
} from "./service.server"

describe("simulator service", () => {
  beforeEach(() => {
    vi.stubEnv("ACS_CONNECTION_STRING", "")
    vi.stubEnv("COGNITIVE_SERVICES_ENDPOINT", "")
    vi.stubEnv("DATAVERSE_URL", "")
    vi.stubEnv("DATAVERSE_TENANT_ID", "")
    vi.stubEnv("DATAVERSE_CLIENT_ID", "")
    vi.stubEnv("DATAVERSE_CLIENT_SECRET", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns health configuration without secrets", () => {
    expect(healthStatus()).toMatchObject({
      status: "ok",
      version: "0.1.0",
      acsConfigured: false,
      dataverseConfigured: false,
    })
  })

  it("loads sample contacts when Dataverse is not configured", async () => {
    await expect(contacts()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ telephone1: "+491234000001" }),
      ])
    )
  })

  it("answers Event Grid validation requests", async () => {
    const response = await handleIncomingCallPayload([
      {
        eventType: "Microsoft.EventGrid.SubscriptionValidationEvent",
        data: { validationCode: "validate-me" },
      },
    ])

    await expect(response.json()).resolves.toEqual({
      validationResponse: "validate-me",
    })
  })

  it("accepts no-answer scenarios without ACS configuration", async () => {
    const response = await handleIncomingCallPayload([
      {
        id: `incoming-no-answer-${Date.now()}`,
        eventType: "Microsoft.Communication.IncomingCall",
        data: {
          incomingCallContext: "context",
          serverCallId: "server-1",
          from: { phoneNumber: { value: "+491111111111" } },
          to: { phoneNumber: { value: "+491234000003" } },
        },
      },
    ])

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: 1 })
  })
})
