import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { Scenario } from "@/features/simulator/types"

const defaultMessage =
  "Hallo, dies ist ein automatisierter Testkunde fuer Dynamics 365 Contact Center. " +
  "Der Anruf wurde erfolgreich angenommen. Bitte fahren Sie mit dem Test fort."

export type Settings = {
  appVersion: string
  publicBaseUrl: string
  callbackPath: string
  acsConnectionString: string | null
  cognitiveServicesEndpoint: string | null
  defaultLocale: string
  defaultVoiceName: string
  scenariosPath: string | null
  sampleContactsPath: string | null
  monitorApiKey: string | null
  webhookSharedSecret: string | null
  recentEventLimit: number
  dataverseUrl: string | null
  dataverseTenantId: string | null
  dataverseClientId: string | null
  dataverseClientSecret: string | null
  dataverseContactFieldPrefix: string
  dataverseConsentPurposeId: string | null
  dataverseConsentPurposeName: string | null
  dataverseConsentReason: string
  dataverseConsentSource: number
}

export function getSettings(): Settings {
  return {
    appVersion: env("APP_VERSION") ?? "0.1.0",
    publicBaseUrl: env("PUBLIC_BASE_URL") ?? "http://localhost:3000",
    callbackPath: env("CALLBACK_PATH") ?? "/api/callbacks",
    acsConnectionString: valueOrNull(env("ACS_CONNECTION_STRING")),
    cognitiveServicesEndpoint: valueOrNull(env("COGNITIVE_SERVICES_ENDPOINT")),
    defaultLocale: env("DEFAULT_LOCALE") ?? "de-DE",
    defaultVoiceName: env("DEFAULT_VOICE_NAME") ?? "de-DE-KatjaNeural",
    scenariosPath: env("SCENARIOS_PATH") ?? "config/scenarios.sample.json",
    sampleContactsPath:
      env("SAMPLE_CONTACTS_PATH") ?? "config/contacts.sample.json",
    monitorApiKey: valueOrNull(env("MONITOR_API_KEY")),
    webhookSharedSecret: valueOrNull(env("WEBHOOK_SHARED_SECRET")),
    recentEventLimit: numberFromEnv(env("RECENT_EVENT_LIMIT"), 100),
    dataverseUrl: valueOrNull(env("DATAVERSE_URL")),
    dataverseTenantId: valueOrNull(env("DATAVERSE_TENANT_ID")),
    dataverseClientId: valueOrNull(env("DATAVERSE_CLIENT_ID")),
    dataverseClientSecret: valueOrNull(env("DATAVERSE_CLIENT_SECRET")),
    dataverseContactFieldPrefix: env("DATAVERSE_CONTACT_FIELD_PREFIX") ?? "new",
    dataverseConsentPurposeId: valueOrNull(env("DATAVERSE_CONSENT_PURPOSE_ID")),
    dataverseConsentPurposeName: valueOrNull(
      env("DATAVERSE_CONSENT_PURPOSE_NAME")
    ),
    dataverseConsentReason:
      env("DATAVERSE_CONSENT_REASON") ??
      "Managed from call center simulator monitor",
    dataverseConsentSource: numberFromEnv(
      env("DATAVERSE_CONSENT_SOURCE"),
      534120000
    ),
  }
}

export function callbackUrl(settings = getSettings()): string {
  return publicUrl(settings.callbackPath, settings)
}

export function publicUrl(path: string, settings = getSettings()): string {
  const baseUrl = settings.publicBaseUrl.replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

export function voicemailToneUrl(settings = getSettings()): string {
  return publicUrl("/api/media/voicemail-tone/wav", settings)
}

export function acsConfigured(settings = getSettings()): boolean {
  return Boolean(settings.acsConnectionString)
}

export function dataverseConfigured(settings = getSettings()): boolean {
  return Boolean(
    settings.dataverseUrl &&
    settings.dataverseTenantId &&
    settings.dataverseClientId &&
    settings.dataverseClientSecret
  )
}

export function callbackUrlProblem(settings = getSettings()): string | null {
  let parsed: URL
  try {
    parsed = new URL(callbackUrl(settings))
  } catch {
    return "Callback URL must be a valid URL."
  }

  if (parsed.protocol !== "https:") return "Callback URL must use https."
  if (!parsed.host) return "Callback URL must include a public host."
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    return "Callback URL must not point to localhost."
  }
  if (parsed.search || parsed.hash) {
    return "Callback URL must not include query string or fragment."
  }
  return null
}

export function loadScenarios(
  settings = getSettings()
): Record<string, Scenario> {
  if (!settings.scenariosPath) return defaultScenarios(settings)

  try {
    const payload = JSON.parse(
      readFileSync(resolve(settings.scenariosPath), "utf8")
    )
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return defaultScenarios(settings)
    }

    return Object.fromEntries(
      Object.entries(payload).map(([number, scenario]) => [
        normalizePhone(number),
        normalizeScenario(scenario, settings),
      ])
    )
  } catch {
    return defaultScenarios(settings)
  }
}

export function normalizePhone(phoneNumber: string | null | undefined): string {
  return phoneNumber ? phoneNumber.split(/\s+/).join("") : ""
}

export function defaultScenario(settings = getSettings()): Scenario {
  return {
    name: "default-answer",
    answer: true,
    answerDelaySeconds: 0,
    message: defaultMessage,
    locale: settings.defaultLocale,
    voiceName: settings.defaultVoiceName,
    hangupAfterSeconds: 10,
  }
}

function defaultScenarios(settings: Settings): Record<string, Scenario> {
  return {
    "+491234000001": {
      name: "instant-answer",
      answer: true,
      answerDelaySeconds: 0,
      message: "Hallo, ich nehme sofort ab.",
      locale: "de-DE",
      voiceName: "de-DE-KatjaNeural",
      hangupAfterSeconds: 10,
    },
    "+491234000002": {
      name: "slow-answer",
      answer: true,
      answerDelaySeconds: 8,
      message: "Hallo, ich habe etwas spaeter abgenommen.",
      locale: "de-DE",
      voiceName: "de-DE-KatjaNeural",
      hangupAfterSeconds: 15,
    },
    "+491234000003": {
      name: "no-answer",
      answer: false,
      answerDelaySeconds: 0,
      message: null,
      locale: settings.defaultLocale,
      voiceName: settings.defaultVoiceName,
      hangupAfterSeconds: 10,
    },
    "+491234000004": {
      name: "voicemail",
      answer: true,
      answerDelaySeconds: 3,
      message:
        "Sie haben die Voicemail erreicht. Bitte hinterlassen Sie eine Nachricht nach dem Ton.",
      locale: "de-DE",
      voiceName: "de-DE-KatjaNeural",
      hangupAfterSeconds: 20,
    },
  }
}

function normalizeScenario(value: unknown, settings: Settings): Scenario {
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    name: String(input.name ?? "default-answer"),
    answer: input.answer == null ? true : Boolean(input.answer),
    answerDelaySeconds: numberFromUnknown(input.answerDelaySeconds, 0),
    message: input.message == null ? null : String(input.message),
    locale: String(input.locale ?? settings.defaultLocale),
    voiceName: input.voiceName == null ? null : String(input.voiceName),
    hangupAfterSeconds:
      input.hangupAfterSeconds == null
        ? 10
        : numberFromUnknown(input.hangupAfterSeconds, 10),
  }
}

function valueOrNull(value: string | undefined): string | null {
  return value && value.trim() ? value : null
}

function env(name: string): string | undefined {
  return process.env[name] ?? localEnv()[name]
}

let localEnvCache: Record<string, string> | null = null

function localEnv(): Record<string, string> {
  if (localEnvCache) return localEnvCache

  try {
    localEnvCache = Object.fromEntries(
      readFileSync(resolve(".env"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const equalsIndex = line.indexOf("=")
          if (equalsIndex === -1) return [line, ""]
          const key = line.slice(0, equalsIndex).trim()
          const value = line.slice(equalsIndex + 1).trim()
          return [key, unquote(value)]
        })
    )
  } catch {
    localEnvCache = {}
  }

  return localEnvCache
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  return value == null ? fallback : numberFromUnknown(value, fallback)
}

function numberFromUnknown(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}
