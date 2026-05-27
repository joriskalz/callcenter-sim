import { describe, expect, it } from "vitest"

import type { ConsentPurpose } from "./dataverse.server"
import { chooseConsentPurpose } from "./dataverse.server"

describe("Dataverse consent purpose selection", () => {
  it("prefers the configured purpose name when it supports voice consent", () => {
    expect(
      chooseConsentPurpose(
        [
          purpose({
            id: "transactional",
            name: "Transactional",
            type: 534120001,
            voiceEnforcementModel: 534120000,
          }),
          purpose({
            id: "commercial",
            name: "Commercial",
            type: 534120000,
            voiceEnforcementModel: 534120000,
          }),
        ],
        "Commercial"
      )?.id
    ).toBe("commercial")
  })

  it("falls back to the commercial purpose type when the preferred name is absent", () => {
    expect(
      chooseConsentPurpose(
        [
          purpose({
            id: "transactional",
            name: "Transactional",
            type: 534120001,
            voiceEnforcementModel: 534120000,
          }),
          purpose({
            id: "commercial-by-type",
            name: "Marketing",
            type: 534120000,
            voiceEnforcementModel: 534120001,
          }),
        ],
        "Commercial"
      )?.id
    ).toBe("commercial-by-type")
  })
})

function purpose(overrides: Partial<ConsentPurpose>): ConsentPurpose {
  return {
    id: "purpose-id",
    name: null,
    type: null,
    enforcementModel: null,
    smsEnforcementModel: null,
    voiceEnforcementModel: null,
    ...overrides,
  }
}
