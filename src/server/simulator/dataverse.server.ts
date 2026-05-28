import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type {
  AddressPreset,
  Contact,
  ContactAddressBatchResult,
  ContactAddressResult,
  ContactConsent,
  ContactConsentPatch,
  ContactConsentResult,
  ContactStatusPatch,
  ConsentValue,
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
let purposeNavigationPropertyCache: string | null = null
let consentPurposeCache: { key: string; id: string } | null = null

const consentEntitySet = "msdynmkt_contactpointconsent4s"
const voiceContactPointType = 534120003
const purposeConsentType = 534120000
const commercialPurposeType = 534120000
const consentValues: Record<ConsentValue, number> = {
  not_set: 534120000,
  opted_in: 534120001,
  opted_out: 534120002,
}
const consentValuesByCode = Object.fromEntries(
  Object.entries(consentValues).map(([key, value]) => [value, key])
) as Record<number, ConsentValue>

const addressPresets: AddressPreset[] = [
  {
    label: "Berlin Mitte",
    line1: "Friedrichstrasse 90",
    city: "Berlin",
    postalCode: "10117",
    country: "Deutschland",
    stateOrProvince: "Berlin",
  },
  {
    label: "Hamburg HafenCity",
    line1: "Am Sandtorkai 30",
    city: "Hamburg",
    postalCode: "20457",
    country: "Deutschland",
    stateOrProvince: "Hamburg",
  },
  {
    label: "Muenchen Altstadt",
    line1: "Theatinerstrasse 8",
    city: "Muenchen",
    postalCode: "80333",
    country: "Deutschland",
    stateOrProvince: "Bayern",
  },
  {
    label: "Koeln Innenstadt",
    line1: "Hohe Strasse 55",
    city: "Koeln",
    postalCode: "50667",
    country: "Deutschland",
    stateOrProvince: "Nordrhein-Westfalen",
  },
  {
    label: "Frankfurt Westend",
    line1: "Bockenheimer Landstrasse 24",
    city: "Frankfurt am Main",
    postalCode: "60323",
    country: "Deutschland",
    stateOrProvince: "Hessen",
  },
]

export async function listContacts(): Promise<Contact[]> {
  const settings = getSettings()
  if (!dataverseConfigured(settings)) return sampleContacts(settings)

  const prefix = settings.dataverseContactFieldPrefix
  const fields = [
    "contactid",
    "fullname",
    "telephone1",
    "address1_line1",
    "address1_city",
    "address1_postalcode",
    "address1_country",
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
    `/api/data/v9.2/contacts?$select=${select}&$filter=${encodeURIComponent(filter)}&$orderby=fullname asc`
  )
  const contacts = (response.value ?? []).map((item) =>
    contactFromDataverse(item, settings)
  )
  return contactsWithConsent(contacts, settings)
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
    patch.new_ccsim_scenario === undefined &&
    patch.new_ccsim_lastcallresult === undefined &&
    patch.new_ccsim_lastcallat === undefined
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

export async function setContactConsent(
  contactId: string,
  patch: ContactConsentPatch
): Promise<ContactConsentResult> {
  const settings = getSettings()
  const contact = await contactById(contactId)
  if (!contact?.telephone1) {
    throw new Error("Contact does not have a business phone number.")
  }

  if (!dataverseConfigured(settings)) {
    return {
      contactid: contactId,
      consent: {
        id: null,
        contactPointValue: contact.telephone1,
        value: patch.value,
        source: settings.dataverseConsentSource,
        reason: settings.dataverseConsentReason,
        modifiedOn: null,
      },
    }
  }

  const existing = await consentByPhoneNumber(contact.telephone1, settings)
  if (existing?.id) {
    await requestDataverse(
      "PATCH",
      `/api/data/v9.2/${consentEntitySet}(${existing.id})`,
      consentPayload(patch.value, settings)
    )
  } else {
    const consentPurposeId = await resolveConsentPurposeId(settings)

    await requestDataverse("POST", `/api/data/v9.2/${consentEntitySet}`, {
      msdynmkt_contactpointvalue: normalizePhone(contact.telephone1),
      msdynmkt_contactpointtype: voiceContactPointType,
      msdynmkt_contactpointconsenttype: purposeConsentType,
      ...consentPayload(patch.value, settings),
      [`${await purposeNavigationProperty()}@odata.bind`]: `/msdynmkt_purposes(${cleanGuid(consentPurposeId)})`,
    })
  }

  return {
    contactid: contactId,
    consent: await consentByPhoneNumber(contact.telephone1, settings),
  }
}

export async function removeContactConsent(
  contactId: string
): Promise<ContactConsentResult> {
  const settings = getSettings()
  const contact = await contactById(contactId)
  if (!contact?.telephone1) {
    throw new Error("Contact does not have a business phone number.")
  }

  if (!dataverseConfigured(settings)) {
    return { contactid: contactId, consent: null }
  }

  const existing = await consentByPhoneNumber(contact.telephone1, settings)
  if (existing?.id) {
    await requestDataverse(
      "DELETE",
      `/api/data/v9.2/${consentEntitySet}(${existing.id})`
    )
  }

  return { contactid: contactId, consent: null }
}

export async function randomizeContactAddress(
  contactId: string
): Promise<ContactAddressResult> {
  const settings = getSettings()
  const contact = await contactById(contactId)
  if (!contact) throw new Error("Contact was not found.")

  return applyRandomAddress(contact, settings)
}

export async function randomizeAllContactAddresses(): Promise<ContactAddressBatchResult> {
  const settings = getSettings()
  const contacts = await listContacts()
  const updated: ContactAddressResult[] = []

  for (const contact of contacts) {
    updated.push(await applyRandomAddress(contact, settings))
  }

  return { updated }
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

async function contactById(contactId: string): Promise<Contact | null> {
  const contacts = await listContacts()
  return contacts.find((contact) => contact.contactid === contactId) ?? null
}

async function contactsWithConsent(
  contacts: Contact[],
  settings: Settings
): Promise<Contact[]> {
  const consentByPhone = await consentsByPhoneNumber(
    contacts.map((contact) => contact.telephone1).filter(Boolean) as string[],
    settings
  )

  return contacts.map((contact) => ({
    ...contact,
    consent: contact.telephone1
      ? (consentByPhone.get(normalizePhone(contact.telephone1)) ?? null)
      : null,
  }))
}

async function consentsByPhoneNumber(
  phoneNumbers: string[],
  settings: Settings
): Promise<Map<string, ContactConsent>> {
  const normalizedPhones = Array.from(
    new Set(phoneNumbers.map(normalizePhone).filter(Boolean))
  )
  const consents = new Map<string, ContactConsent>()
  if (!normalizedPhones.length) return consents

  const valuesFilter = normalizedPhones
    .map((phone) => `msdynmkt_contactpointvalue eq '${odataString(phone)}'`)
    .join(" or ")
  const consentPurposeId = shouldScopeConsentPurpose(settings)
    ? await resolveConsentPurposeId(settings)
    : null
  const purposeFilter = consentPurposeId
    ? ` and _msdynmkt_purposeid_value eq ${cleanGuid(consentPurposeId)}`
    : ""
  const filter =
    `msdynmkt_contactpointtype eq ${voiceContactPointType}` +
    ` and msdynmkt_contactpointconsenttype eq ${purposeConsentType}` +
    ` and (${valuesFilter})` +
    purposeFilter
  const select = [
    "msdynmkt_contactpointconsent4id",
    "msdynmkt_contactpointvalue",
    "msdynmkt_value",
    "msdynmkt_source",
    "msdynmkt_reason",
    "modifiedon",
  ].join(",")

  const response = await requestDataverse<{
    value?: Array<Record<string, unknown>>
  }>(
    "GET",
    `/api/data/v9.2/${consentEntitySet}?$select=${select}&$filter=${encodeURIComponent(
      filter
    )}&$orderby=modifiedon desc`
  )

  for (const item of response.value ?? []) {
    const consent = consentFromDataverse(item)
    const phone = normalizePhone(consent.contactPointValue)
    if (phone && !consents.has(phone)) consents.set(phone, consent)
  }

  return consents
}

async function consentByPhoneNumber(
  phoneNumber: string,
  settings: Settings
): Promise<ContactConsent | null> {
  return (
    (await consentsByPhoneNumber([phoneNumber], settings)).get(
      normalizePhone(phoneNumber)
    ) ?? null
  )
}

async function resolveConsentPurposeId(settings: Settings): Promise<string> {
  if (settings.dataverseConsentPurposeId) {
    return cleanGuid(settings.dataverseConsentPurposeId)
  }

  const cacheKey = [
    settings.dataverseUrl,
    (settings.dataverseConsentPurposeName ?? "Commercial").toLowerCase(),
  ].join("|")
  if (consentPurposeCache?.key === cacheKey) return consentPurposeCache.id

  const purposes = await listConsentPurposes()
  const purpose = chooseConsentPurpose(
    purposes,
    settings.dataverseConsentPurposeName ?? "Commercial"
  )
  if (!purpose) {
    throw new Error(
      "No Dataverse consent purpose found. Create a Customer Insights - Journeys purpose or set DATAVERSE_CONSENT_PURPOSE_ID."
    )
  }

  consentPurposeCache = { key: cacheKey, id: purpose.id }
  return purpose.id
}

function shouldScopeConsentPurpose(settings: Settings): boolean {
  return Boolean(
    settings.dataverseConsentPurposeId || settings.dataverseConsentPurposeName
  )
}

async function listConsentPurposes(): Promise<ConsentPurpose[]> {
  const select = [
    "msdynmkt_purposeid",
    "msdynmkt_name",
    "msdynmkt_type",
    "msdynmkt_enforcementmodel",
    "msdynmkt_smsenforcementmodel",
    "msdynmkt_voiceenforcementmodel",
  ].join(",")

  const response = await requestDataverse<{
    value?: Array<Record<string, unknown>>
  }>("GET", `/api/data/v9.2/msdynmkt_purposes?$select=${select}`)

  return (response.value ?? [])
    .map(purposeFromDataverse)
    .filter((purpose): purpose is ConsentPurpose => Boolean(purpose))
}

export type ConsentPurpose = {
  id: string
  name: string | null
  type: number | null
  enforcementModel: number | null
  smsEnforcementModel: number | null
  voiceEnforcementModel: number | null
}

export function chooseConsentPurpose(
  purposes: ConsentPurpose[],
  preferredName = "Commercial"
): ConsentPurpose | null {
  const preferredNameLower = preferredName.trim().toLowerCase()
  const withVoice = purposes.filter(
    (purpose) => purpose.voiceEnforcementModel != null
  )
  const candidates = withVoice.length ? withVoice : purposes
  if (!candidates.length) return null

  return (
    candidates.find(
      (purpose) => purpose.name?.trim().toLowerCase() === preferredNameLower
    ) ??
    candidates.find((purpose) => purpose.type === commercialPurposeType) ??
    purposes.find(
      (purpose) => purpose.name?.trim().toLowerCase() === preferredNameLower
    ) ??
    purposes.find((purpose) => purpose.type === commercialPurposeType) ??
    candidates[0]
  )
}

async function purposeNavigationProperty(): Promise<string> {
  if (purposeNavigationPropertyCache) return purposeNavigationPropertyCache

  try {
    const response = await requestDataverse<{
      value?: Array<Record<string, unknown>>
    }>(
      "GET",
      "/api/data/v9.2/EntityDefinitions(LogicalName='msdynmkt_contactpointconsent4')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName&$filter=ReferencingAttribute eq 'msdynmkt_purposeid'"
    )
    const nav = response.value
      ?.map((item) =>
        stringOrNull(item.ReferencingEntityNavigationPropertyName)
      )
      .find(Boolean)
    if (nav) {
      purposeNavigationPropertyCache = nav
      return nav
    }
  } catch {
    // Fall back to the common generated navigation property name below.
  }

  purposeNavigationPropertyCache = "msdynmkt_PurposeId"
  return purposeNavigationPropertyCache
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
      ? sortContactsByName(payload.map(normalizeContact))
      : [fallbackContact()]
  } catch {
    return [fallbackContact()]
  }
}

function sortContactsByName(contacts: Contact[]): Contact[] {
  return [...contacts].sort((left, right) =>
    left.fullname.localeCompare(right.fullname, undefined, {
      sensitivity: "base",
      numeric: true,
    })
  )
}

function normalizeContact(value: unknown): Contact {
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    contactid: String(input.contactid ?? "sample-001"),
    fullname: String(input.fullname ?? ""),
    telephone1: stringOrNull(input.telephone1),
    address1_line1: stringOrNull(input.address1_line1),
    address1_city: stringOrNull(input.address1_city),
    address1_postalcode: stringOrNull(input.address1_postalcode),
    address1_country: stringOrNull(input.address1_country),
    new_ccsim_enabled: Boolean(input.new_ccsim_enabled),
    new_ccsim_reachabilitystatus: reachabilityOrUnknown(
      input.new_ccsim_reachabilitystatus
    ),
    new_ccsim_scenario: stringOrNull(input.new_ccsim_scenario),
    new_ccsim_lastcallresult: stringOrNull(input.new_ccsim_lastcallresult),
    new_ccsim_lastcallat: stringOrNull(input.new_ccsim_lastcallat),
    consent: normalizeConsent(input.consent),
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
    address1_line1: stringOrNull(item.address1_line1),
    address1_city: stringOrNull(item.address1_city),
    address1_postalcode: stringOrNull(item.address1_postalcode),
    address1_country: stringOrNull(item.address1_country),
    new_ccsim_enabled: Boolean(item[`${prefix}_ccsim_enabled`]),
    new_ccsim_reachabilitystatus: reachabilityOrUnknown(
      item[`${prefix}_ccsim_reachabilitystatus`]
    ),
    new_ccsim_scenario: stringOrNull(item[`${prefix}_ccsim_scenario`]),
    new_ccsim_lastcallresult: stringOrNull(
      item[`${prefix}_ccsim_lastcallresult`]
    ),
    new_ccsim_lastcallat: stringOrNull(item[`${prefix}_ccsim_lastcallat`]),
    consent: null,
  }
}

function fallbackContact(): Contact {
  return {
    contactid: "sample-001",
    fullname: "Test Customer 001",
    telephone1: "+491234000001",
    address1_line1: "Friedrichstrasse 90",
    address1_city: "Berlin",
    address1_postalcode: "10117",
    address1_country: "Deutschland",
    new_ccsim_enabled: true,
    new_ccsim_reachabilitystatus: "reachable",
    new_ccsim_scenario: "instant-answer",
    new_ccsim_lastcallresult: null,
    new_ccsim_lastcallat: null,
    consent: null,
  }
}

function normalizeConsent(value: unknown): ContactConsent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const contactPointValue = stringOrNull(input.contactPointValue)
  if (!contactPointValue) return null
  return {
    id: stringOrNull(input.id),
    contactPointValue,
    value: consentValueOrUnknown(input.value),
    source: numberOrNull(input.source),
    reason: stringOrNull(input.reason),
    modifiedOn: stringOrNull(input.modifiedOn),
  }
}

function consentFromDataverse(item: Record<string, unknown>): ContactConsent {
  return {
    id: stringOrNull(item.msdynmkt_contactpointconsent4id),
    contactPointValue: String(item.msdynmkt_contactpointvalue ?? ""),
    value: consentValueOrUnknown(item.msdynmkt_value),
    source: numberOrNull(item.msdynmkt_source),
    reason: stringOrNull(item.msdynmkt_reason),
    modifiedOn: stringOrNull(item.modifiedon),
  }
}

function purposeFromDataverse(
  item: Record<string, unknown>
): ConsentPurpose | null {
  const id = stringOrNull(item.msdynmkt_purposeid)
  if (!id) return null

  return {
    id: cleanGuid(id),
    name: stringOrNull(item.msdynmkt_name),
    type: numberOrNull(item.msdynmkt_type),
    enforcementModel: numberOrNull(item.msdynmkt_enforcementmodel),
    smsEnforcementModel: numberOrNull(item.msdynmkt_smsenforcementmodel),
    voiceEnforcementModel: numberOrNull(item.msdynmkt_voiceenforcementmodel),
  }
}

async function applyRandomAddress(
  contact: Contact,
  settings: Settings
): Promise<ContactAddressResult> {
  const nextAddress = pickAddressPreset(contact.address1_city)

  if (dataverseConfigured(settings)) {
    await requestDataverse(
      "PATCH",
      `/api/data/v9.2/contacts(${contact.contactid})`,
      {
        address1_line1: nextAddress.line1,
        address1_city: nextAddress.city,
        address1_postalcode: nextAddress.postalCode,
        address1_country: nextAddress.country,
        address1_stateorprovince: nextAddress.stateOrProvince,
      }
    )
  }

  return {
    contactid: contact.contactid,
    previousCity: contact.address1_city,
    appliedAddress: nextAddress,
    contact: {
      ...contact,
      address1_line1: nextAddress.line1,
      address1_city: nextAddress.city,
      address1_postalcode: nextAddress.postalCode,
      address1_country: nextAddress.country,
    },
  }
}

function pickAddressPreset(currentCity: string | null): AddressPreset {
  const normalizedCurrentCity = currentCity?.trim().toLocaleLowerCase("de-DE")
  const candidates = normalizedCurrentCity
    ? addressPresets.filter(
        (address) =>
          address.city.trim().toLocaleLowerCase("de-DE") !==
          normalizedCurrentCity
      )
    : addressPresets

  const pool = candidates.length ? candidates : addressPresets
  return pool[Math.floor(Math.random() * pool.length)] ?? addressPresets[0]
}

function consentPayload(
  value: Extract<ConsentValue, "opted_in" | "opted_out">,
  settings: Settings
): Record<string, unknown> {
  return {
    msdynmkt_value: consentValues[value],
    msdynmkt_source: settings.dataverseConsentSource,
    msdynmkt_reason: settings.dataverseConsentReason,
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
  if (patch.new_ccsim_lastcallresult !== undefined)
    payload[`${prefix}_ccsim_lastcallresult`] = patch.new_ccsim_lastcallresult
  if (patch.new_ccsim_lastcallat !== undefined)
    payload[`${prefix}_ccsim_lastcallat`] = patch.new_ccsim_lastcallat
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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function consentValueOrUnknown(value: unknown): ContactConsent["value"] {
  if (typeof value === "string") {
    if (["not_set", "opted_in", "opted_out"].includes(value)) {
      return value as ConsentValue
    }
    return "unknown"
  }
  if (typeof value === "number") return consentValuesByCode[value] ?? "unknown"
  return "unknown"
}

function cleanGuid(value: string): string {
  return value.replace(/[{}]/g, "")
}

function odataString(value: string): string {
  return value.replaceAll("'", "''")
}
