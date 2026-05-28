import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { configIssues, loadScenarios, saveScenarios } from "./config.server"
import type { Settings } from "./config.server"

describe("simulator configuration issues", () => {
  it("reports missing and malformed integration settings", () => {
    expect(
      configIssues({
        ...validSettings,
        acsConnectionString: "not-a-connection-string",
        cognitiveServicesEndpoint: "http://speech.local",
        dataverseUrl: "not-a-url",
        dataverseClientSecret: null,
      }).map((issue) => issue.area)
    ).toEqual(["ACS", "TTS", "Dataverse"])
  })

  it("reports no issues when required integration settings are valid", () => {
    expect(configIssues(validSettings)).toEqual([])
  })

  it("loads connected sample scenarios with at least 45 seconds of pauses", () => {
    const scenarios = loadScenarios({
      ...validSettings,
      scenariosPath: "config/scenarios.sample.json",
    })

    const connectedScenarios = Object.values(scenarios).filter(
      (scenario) => scenario.answer
    )

    expect(connectedScenarios.length).toBeGreaterThan(0)
    expect(
      connectedScenarios.every((scenario) => scenario.messages.length > 1)
    ).toBe(true)
    expect(
      connectedScenarios.every(
        (scenario) => totalPauseSeconds(scenario.messages) >= 45
      )
    ).toBe(true)
  })

  it("keeps legacy single-message scenarios but pads playback to 45 seconds", () => {
    const scenariosPath = temporaryScenarioFile({
      "+491234999999": {
        name: "legacy-answer",
        answer: true,
        message: "Hallo, ich bin ein altes Szenario.",
      },
    })

    const scenario = loadScenarios({
      ...validSettings,
      scenariosPath,
    })["+491234999999"]

    expect(scenario.messages).toEqual([
      {
        text: "Hallo, ich bin ein altes Szenario.",
        pauseAfterSeconds: 45,
      },
    ])
  })

  it("saves editable scenarios as event-based server config", () => {
    const scenariosPath = temporaryScenarioPath()

    const scenarios = saveScenarios(
      {
        "+491234999998": {
          name: "editable-answer",
          answer: true,
          language: "en",
          events: [
            { type: "tts", text: "Hello from the editor." },
            { type: "pause", seconds: 45 },
          ],
        },
      },
      {
        ...validSettings,
        scenariosPath,
      }
    )

    const stored = JSON.parse(readFileSync(scenariosPath, "utf8")) as Record<
      string,
      { events?: unknown[]; language?: string; locale?: string }
    >

    expect(scenarios["+491234999998"]).toMatchObject({
      language: "en",
      locale: "en-US",
      voiceName: "en-US-JennyNeural",
    })
    expect(stored["+491234999998"].language).toBe("en")
    expect(stored["+491234999998"].events).toEqual([
      { type: "tts", text: "Hello from the editor." },
      { type: "pause", seconds: 45 },
    ])
  })
})

function totalPauseSeconds(
  messages: Array<{ pauseAfterSeconds: number }>
): number {
  return messages.reduce(
    (total, message) => total + message.pauseAfterSeconds,
    0
  )
}

function temporaryScenarioFile(payload: unknown): string {
  const path = temporaryScenarioPath()
  writeFileSync(path, JSON.stringify(payload), "utf8")
  return path
}

function temporaryScenarioPath(): string {
  const directory = mkdtempSync(join(tmpdir(), "ccsim-scenarios-"))
  return join(directory, "scenarios.json")
}

const validSettings: Settings = {
  appVersion: "0.1.0",
  publicBaseUrl: "https://example.ngrok-free.app",
  callbackPath: "/api/callbacks",
  acsConnectionString: "endpoint=https://acs.example.com/;accesskey=secret",
  cognitiveServicesEndpoint: "https://speech.example.com",
  defaultLocale: "de-DE",
  defaultVoiceName: "de-DE-KatjaNeural",
  scenariosPath: "config/scenarios.sample.json",
  sampleContactsPath: "config/contacts.sample.json",
  monitorApiKey: "4711",
  webhookSharedSecret: "secret",
  recentEventLimit: 100,
  dataverseUrl: "https://org.crm4.dynamics.com",
  dataverseTenantId: "tenant-id",
  dataverseClientId: "client-id",
  dataverseClientSecret: "client-secret",
  dataverseContactFieldPrefix: "new",
  dataverseConsentPurposeId: null,
  dataverseConsentPurposeName: null,
  dataverseConsentReason: "Managed from tests",
  dataverseConsentSource: 534120000,
}
