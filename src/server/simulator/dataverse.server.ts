import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type {
  Contact,
  ContactStatusPatch,
  PatchStatusResult,
  ReachabilityStatus,
} from "@/features/simulator/types"

import {
  dataverseConfigured,
  getSettings,
  normalizePhone,
} from "./config.server"
import type { Settings } from "./config.server"

type TokenCache = {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

export async function listContacts(): Promise<Contact[]> {
  const settings = getSettings()
  if (!dataverseConfigured(settings)) return sampleContacts(settings)

  const prefix = settings.dataverseContactFieldPrefix
  const fields = [
    "contactid",
    "fullname",
    "telephone1",
    `${prefix}_ccsim_enabled`,
    `${prefix}_ccsim_reachabilitystatus`,
    `${prefix}_ccsim_scenario`,
    `${prefix}_ccsim_lastcallresult`,
    `${prefix}_ccsim_lastcallat`,
  ]
  const select = fields.join(",")
  const filter = `${prefix}_ccsim_enabled ne null`
  const response = await requestDataverse<{
    value?: Array<Record<string, unknown>>
  }>(
    "GET",
    `/api/data/v9.2/contacts?$select=${select}&$filter=${encodeURIComponent(filter)}`
  )
  return (response.value ?? []).map((item) =>
    contactFromDataverse(item, settings)
  )
}

export async function contactByPhoneNumber(
  phoneNumber: string | null | undefined
): Promise<Contact | null> {
  const normalizedPhone = normalizePhone(phoneNumber)
  if (!normalizedPhone) return null

  const contacts = await listContacts()
  return (
    contacts.find(
      (contact) => normalizePhone(contact.telephone1) === normalizedPhone
    ) ?? null
  )
}

export async function patchContactStatus(
  contactId: string,
  patch: ContactStatusPatch
): Promise<PatchStatusResult> {
  const settings = getSettings()
  if (
    patch.new_ccsim_enabled == null &&
    patch.new_ccsim_reachabilitystatus == null &&
    patch.new_ccsim_scenario === undefined
  ) {
    throw new Error("At least one simulator status field is required.")
  }

  if (!dataverseConfigured(settings)) {
    return {
      contactid: contactId,
      updated: statusPayloadFromPatch(patch),
    }
  }

  const prefix = settings.dataverseContactFieldPrefix
  const payload = statusPayloadFromPatch(patch, prefix)

  await requestDataverse(
    "PATCH",
    `/api/data/v9.2/contacts(${contactId})`,
    payload
  )
  return { contactid: contactId, updated: payload }
}

async function requestDataverse<T>(
  method: string,
  path: string,
  jsonPayload?: Record<string, unknown>
): Promise<T> {
  const settings = getSettings()
  const baseUrl = settings.dataverseUrl?.replace(/\/+$/, "")
  if (!baseUrl) throw new Error("Dataverse URL is not configured.")

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      ...(jsonPayload ? { "Content-Type": "application/json" } : {}),
    },
    body: jsonPayload ? JSON.stringify(jsonPayload) : undefined,
  })

  if (!response.ok) {
    throw new Error(
      `Dataverse request failed: ${response.status} ${response.statusText}`
    )
  }
  if (response.status === 204) return {} as T
  return (await response.json()) as T
}

async function token(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000)
    return tokenCache.token

  const settings = getSettings()
  const tokenUrl = `https://login.microsoftonline.com/${settings.dataverseTenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: settings.dataverseClientId ?? "",
    client_secret: settings.dataverseClientSecret ?? "",
    grant_type: "client_credentials",
    scope: `${settings.dataverseUrl?.replace(/\/+$/, "")}/.default`,
  })

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!response.ok) {
    throw new Error(
      `Dataverse token request failed: ${response.status} ${response.statusText}`
    )
  }

  const payload = (await response.json()) as {
    access_token: string
    expires_in?: number
  }
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  return tokenCache.token
}

function sampleContacts(settings: Settings): Contact[] {
  try {
    const payload = JSON.parse(
      readFileSync(resolve(settings.sampleContactsPath ?? ""), "utf8")
    )
    return Array.isArray(payload)
      ? payload.map(normalizeContact)
      : [fallbackContact()]
  } catch {
    return [fallbackContact()]
  }
}

function normalizeContact(value: unknown): Contact {
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    contactid: String(input.contactid ?? "sample-001"),
    fullname: String(input.fullname ?? ""),
    telephone1: stringOrNull(input.telephone1),
    new_ccsim_enabled: Boolean(input.new_ccsim_enabled),
    new_ccsim_reachabilitystatus: reachabilityOrUnknown(
      input.new_ccsim_reachabilitystatus
    ),
    new_ccsim_scenario: stringOrNull(input.new_ccsim_scenario),
    new_ccsim_lastcallresult: stringOrNull(input.new_ccsim_lastcallresult),
    new_ccsim_lastcallat: stringOrNull(input.new_ccsim_lastcallat),
  }
}

function contactFromDataverse(
  item: Record<string, unknown>,
  settings: Settings
): Contact {
  const prefix = settings.dataverseContactFieldPrefix
  return {
    contactid: String(item.contactid ?? ""),
    fullname: String(item.fullname ?? ""),
    telephone1: stringOrNull(item.telephone1),
    new_ccsim_enabled: Boolean(item[`${prefix}_ccsim_enabled`]),
    new_ccsim_reachabilitystatus: reachabilityOrUnknown(
      item[`${prefix}_ccsim_reachabilitystatus`]
    ),
    new_ccsim_scenario: stringOrNull(item[`${prefix}_ccsim_scenario`]),
    new_ccsim_lastcallresult: stringOrNull(
      item[`${prefix}_ccsim_lastcallresult`]
    ),
    new_ccsim_lastcallat: stringOrNull(item[`${prefix}_ccsim_lastcallat`]),
  }
}

function fallbackContact(): Contact {
  return {
    contactid: "sample-001",
    fullname: "Test Customer 001",
    telephone1: "+491234000001",
    new_ccsim_enabled: true,
    new_ccsim_reachabilitystatus: "reachable",
    new_ccsim_scenario: "instant-answer",
    new_ccsim_lastcallresult: null,
    new_ccsim_lastcallat: null,
  }
}

function statusPayloadFromPatch(
  patch: ContactStatusPatch,
  prefix = "new"
): PatchStatusResult["updated"] {
  const payload: PatchStatusResult["updated"] = {}
  if (patch.new_ccsim_enabled !== undefined)
    payload[`${prefix}_ccsim_enabled`] = patch.new_ccsim_enabled
  if (patch.new_ccsim_reachabilitystatus !== undefined) {
    payload[`${prefix}_ccsim_reachabilitystatus`] =
      patch.new_ccsim_reachabilitystatus
  }
  if (patch.new_ccsim_scenario !== undefined)
    payload[`${prefix}_ccsim_scenario`] = patch.new_ccsim_scenario
  return payload
}

function reachabilityOrUnknown(value: unknown): ReachabilityStatus {
  return typeof value === "string" &&
    [
      "reachable",
      "busy",
      "no_answer",
      "voicemail",
      "disabled",
      "unknown",
    ].includes(value)
    ? (value as ReachabilityStatus)
    : "unknown"
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}
