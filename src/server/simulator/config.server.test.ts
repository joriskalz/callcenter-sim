import { describe, expect, it } from "vitest"

import { configIssues } from "./config.server"
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
})

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
