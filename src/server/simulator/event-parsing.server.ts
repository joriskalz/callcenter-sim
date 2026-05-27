export function asEventList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }
  return isRecord(payload) ? [payload] : []
}

export function eventType(event: Record<string, unknown>): string {
  return String(event.eventType ?? event.type ?? "")
}

export function eventData(
  event: Record<string, unknown>
): Record<string, unknown> {
  return isRecord(event.data) ? event.data : {}
}

export function extractPhone(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  if (!isRecord(value)) return String(value)

  const phoneNumber = value.phoneNumber
  if (isRecord(phoneNumber)) {
    return stringOrNull(phoneNumber.value) ?? stringOrNull(phoneNumber.id)
  }
  if (typeof phoneNumber === "string") return phoneNumber

  if (value.communicationIdentifier) {
    return extractPhone(value.communicationIdentifier)
  }

  return (
    stringOrNull(value.rawId) ??
    stringOrNull(value.rawIdentifier) ??
    stringOrNull(value.value)
  )
}

export function validationCode(
  events: Array<Record<string, unknown>>
): string | null {
  for (const event of events) {
    if (
      eventType(event) === "Microsoft.EventGrid.SubscriptionValidationEvent"
    ) {
      const code = eventData(event).validationCode
      return code ? String(code) : null
    }
  }
  return null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}
