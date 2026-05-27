import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  appStatus,
  contacts,
  handleCallbackPayload,
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

  it("rejects busy contacts instead of answering them", async () => {
    const response = await handleIncomingCallPayload([
      {
        id: `incoming-busy-${Date.now()}`,
        eventType: "Microsoft.Communication.IncomingCall",
        data: {
          incomingCallContext: "context",
          serverCallId: "server-busy",
          from: { phoneNumber: { value: "+491111111111" } },
          to: { phoneNumber: { value: "+491234000002" } },
        },
      },
    ])

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: 1 })

    await vi.waitFor(() => {
      expect(appStatus().recent_events[0]).toMatchObject({
        event_type: "Reject.Busy",
        message: "rejectCall was invoked with Busy.",
        to_number: "+491234000002",
      })
    })
    expect(appStatus().recent_events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "Answer",
          to_number: "+491234000002",
        }),
      ])
    )
  })

  it("rejects disabled contacts as forbidden", async () => {
    useSampleContacts([
      {
        contactid: "disabled-contact",
        fullname: "Disabled Contact",
        telephone1: "+491234999001",
        new_ccsim_enabled: false,
        new_ccsim_reachabilitystatus: "disabled",
        new_ccsim_scenario: "instant-answer",
      },
    ])

    const response = await handleIncomingCallPayload([
      {
        id: `incoming-disabled-${Date.now()}`,
        eventType: "Microsoft.Communication.IncomingCall",
        data: {
          incomingCallContext: "context",
          serverCallId: "server-disabled",
          from: { phoneNumber: { value: "+491111111111" } },
          to: { phoneNumber: { value: "+491234999001" } },
        },
      },
    ])

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: 1 })

    await vi.waitFor(() => {
      expect(appStatus().recent_events[0]).toMatchObject({
        event_type: "Reject.Forbidden",
        message: "rejectCall was invoked with Forbidden.",
        to_number: "+491234999001",
      })
    })
  })

  it("uses no-answer status even when the selected scenario would answer", async () => {
    useSampleContacts([
      {
        contactid: "no-answer-contact",
        fullname: "No Answer Contact",
        telephone1: "+491234999002",
        new_ccsim_enabled: true,
        new_ccsim_reachabilitystatus: "no_answer",
        new_ccsim_scenario: "instant-answer",
      },
    ])

    const response = await handleIncomingCallPayload([
      {
        id: `incoming-status-no-answer-${Date.now()}`,
        eventType: "Microsoft.Communication.IncomingCall",
        data: {
          incomingCallContext: "context",
          serverCallId: "server-no-answer",
          from: { phoneNumber: { value: "+491111111111" } },
          to: { phoneNumber: { value: "+491234999002" } },
        },
      },
    ])

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: 1 })
    expect(appStatus().recent_events[0]).toMatchObject({
      event_type: "Status.NoAnswer",
      message: "Contact status is configured not to answer this call.",
      to_number: "+491234999002",
    })
    expect(appStatus().recent_events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "Answer",
          to_number: "+491234999002",
        }),
      ])
    )
  })

  it("uses the voicemail scenario when contact status is voicemail", async () => {
    useSampleContacts([
      {
        contactid: "voicemail-contact",
        fullname: "Voicemail Contact",
        telephone1: "+491234999003",
        new_ccsim_enabled: true,
        new_ccsim_reachabilitystatus: "voicemail",
        new_ccsim_scenario: "instant-answer",
      },
    ])

    const response = await handleIncomingCallPayload([
      {
        id: `incoming-voicemail-${Date.now()}`,
        eventType: "Microsoft.Communication.IncomingCall",
        data: {
          serverCallId: "server-voicemail",
          from: { phoneNumber: { value: "+491111111111" } },
          to: { phoneNumber: { value: "+491234999003" } },
        },
      },
    ])

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: 1 })
    expect(appStatus().recent_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "IncomingCall",
          scenario_name: "voicemail",
          to_number: "+491234999003",
        }),
      ])
    )
  })

  it("does not mark successful ACS callback result information as failed", async () => {
    const response = await handleCallbackPayload([
      {
        id: `callback-success-${Date.now()}`,
        eventType: "Microsoft.Communication.PlayStarted",
        data: {
          resultInformation: {
            code: 200,
            subCode: 0,
            message: "Action completed successfully.",
          },
        },
      },
    ])

    expect(response.status).toBe(202)
    const event = appStatus().recent_events[0]
    expect(event.event_type).toBe("PlayStarted")
    expect(event.error).toBeNull()
  })

  it("marks failed ACS callback result information as failed", async () => {
    const response = await handleCallbackPayload([
      {
        id: `callback-failed-${Date.now()}`,
        eventType: "Microsoft.Communication.PlayFailed",
        data: {
          resultInformation: {
            code: 500,
            subCode: 8531,
            message: "Play failed.",
          },
        },
      },
    ])

    expect(response.status).toBe(202)
    const event = appStatus().recent_events[0]
    expect(event.event_type).toBe("PlayFailed")
    expect(event.error).toBe("500: Play failed.")
  })
})

function useSampleContacts(contactRows: Array<Record<string, unknown>>) {
  const directory = mkdtempSync(join(tmpdir(), "ccsim-contacts-"))
  const path = join(directory, "contacts.json")
  writeFileSync(path, JSON.stringify(contactRows), "utf8")
  vi.stubEnv("SAMPLE_CONTACTS_PATH", path)
}
