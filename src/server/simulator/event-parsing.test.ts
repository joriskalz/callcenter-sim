import { describe, expect, it } from "vitest"

import {
  asEventList,
  extractPhone,
  validationCode,
} from "./event-parsing.server"

describe("event parsing", () => {
  it("reads Event Grid validation codes", () => {
    const payload = [
      {
        eventType: "Microsoft.EventGrid.SubscriptionValidationEvent",
        data: { validationCode: "abc123" },
      },
    ]

    expect(validationCode(asEventList(payload))).toBe("abc123")
  })

  it("extracts phone numbers from ACS identifier payloads", () => {
    expect(extractPhone({ phoneNumber: { value: "+491234000001" } })).toBe(
      "+491234000001"
    )
  })
})
