import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import {
  inferScenarioLanguage,
  localizedScenarioPreset,
  scenarioLanguageOption,
} from "@/features/simulator/scenario-language"
import type {
  ConfigIssue,
  Scenario,
  ScenarioEvent,
  ScenarioLanguage,
} from "@/features/simulator/types"

const minimumPlaybackSeconds = 45

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

export function configIssues(settings = getSettings()): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const acsProblem = acsConfigurationProblem(settings)
  const ttsProblem = ttsConfigurationProblem(settings)
  const dataverseProblem = dataverseConfigurationProblem(settings)
  const callbackProblem = callbackUrlProblem(settings)

  if (acsProblem) {
    issues.push({
      area: "ACS",
      title: "Azure Communication Services is not ready",
      description: acsProblem,
      envVars: ["ACS_CONNECTION_STRING"],
      learnUrl:
        "https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/call-automation/quickstart-make-an-outbound-call",
    })
  }

  if (ttsProblem) {
    issues.push({
      area: "TTS",
      title: "Text-to-speech endpoint is not ready",
      description: ttsProblem,
      envVars: ["COGNITIVE_SERVICES_ENDPOINT"],
      learnUrl:
        "https://learn.microsoft.com/en-us/azure/communication-services/how-tos/call-automation/play-action",
    })
  }

  if (dataverseProblem) {
    issues.push({
      area: "Dataverse",
      title: "Dataverse connection is not ready",
      description: dataverseProblem,
      envVars: [
        "DATAVERSE_URL",
        "DATAVERSE_TENANT_ID",
        "DATAVERSE_CLIENT_ID",
        "DATAVERSE_CLIENT_SECRET",
        "DATAVERSE_CONTACT_FIELD_PREFIX",
      ],
      learnUrl:
        "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authentication",
    })
  }

  if (callbackProblem) {
    issues.push({
      area: "Callback URL",
      title: "Public callback URL is not valid",
      description: callbackProblem,
      envVars: ["PUBLIC_BASE_URL", "CALLBACK_PATH"],
      learnUrl:
        "https://learn.microsoft.com/en-us/azure/communication-services/concepts/call-automation/call-automation",
    })
  }

  return issues
}

function acsConfigurationProblem(settings: Settings): string | null {
  if (!settings.acsConnectionString) {
    return "Set ACS_CONNECTION_STRING to the connection string from your Azure Communication Services resource."
  }

  const lower = settings.acsConnectionString.toLowerCase()
  if (!lower.includes("endpoint=") || !lower.includes("accesskey=")) {
    return "ACS_CONNECTION_STRING should look like endpoint=<resource endpoint>;accesskey=<access key>."
  }

  return null
}

function ttsConfigurationProblem(settings: Settings): string | null {
  if (!settings.cognitiveServicesEndpoint) {
    return "Set COGNITIVE_SERVICES_ENDPOINT to the Azure AI Services endpoint linked to Call Automation for text-to-speech."
  }

  return validHttpsUrl(settings.cognitiveServicesEndpoint)
    ? null
    : "COGNITIVE_SERVICES_ENDPOINT must be a valid https URL."
}

function dataverseConfigurationProblem(settings: Settings): string | null {
  const missing = [
    ["DATAVERSE_URL", settings.dataverseUrl],
    ["DATAVERSE_TENANT_ID", settings.dataverseTenantId],
    ["DATAVERSE_CLIENT_ID", settings.dataverseClientId],
    ["DATAVERSE_CLIENT_SECRET", settings.dataverseClientSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length) {
    return `Set ${missing.join(", ")} in .env so server-side Dataverse Web API calls can authenticate.`
  }

  return settings.dataverseUrl && validHttpsUrl(settings.dataverseUrl)
    ? null
    : "DATAVERSE_URL must be the https URL of your Dataverse environment, for example https://org.crm4.dynamics.com."
}

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
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

export function saveScenarios(
  scenarios: Record<string, unknown>,
  settings = getSettings()
): Record<string, Scenario> {
  if (!settings.scenariosPath) {
    throw new Error("SCENARIOS_PATH is not configured.")
  }

  const normalized = Object.fromEntries(
    Object.entries(scenarios).map(([number, scenario]) => [
      normalizePhone(number),
      normalizeScenario(scenario, settings),
    ])
  )
  const path = resolve(settings.scenariosPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    `${JSON.stringify(scenariosForStorage(normalized), null, 2)}\n`
  )
  return normalized
}

export function normalizePhone(phoneNumber: string | null | undefined): string {
  return phoneNumber ? phoneNumber.split(/\s+/).join("") : ""
}

export function defaultScenario(settings = getSettings()): Scenario {
  const preset = localizedScenarioPreset(
    "default-answer",
    inferScenarioLanguage(settings.defaultLocale)
  )
  return {
    name: "default-answer",
    answer: true,
    answerDelaySeconds: 0,
    ...preset,
    locale: settings.defaultLocale || preset.locale,
    voiceName: settings.defaultVoiceName || preset.voiceName,
    hangupAfterSeconds: 3,
  }
}

function defaultScenarios(settings: Settings): Record<string, Scenario> {
  const language = inferScenarioLanguage(settings.defaultLocale)
  const instant = localizedScenarioPreset("instant-answer", language)
  const slow = localizedScenarioPreset("slow-answer", language)
  const voicemail = localizedScenarioPreset("voicemail", language)
  return {
    "+491234000001": {
      name: "instant-answer",
      answer: true,
      answerDelaySeconds: 0,
      ...instant,
      hangupAfterSeconds: 3,
    },
    "+491234000002": {
      name: "slow-answer",
      answer: true,
      answerDelaySeconds: 8,
      ...slow,
      hangupAfterSeconds: 3,
    },
    "+491234000003": {
      name: "no-answer",
      answer: false,
      answerDelaySeconds: 0,
      message: null,
      messages: [],
      events: [],
      language,
      locale: settings.defaultLocale,
      voiceName: settings.defaultVoiceName,
      hangupAfterSeconds: 10,
    },
    "+491234000004": {
      name: "voicemail",
      answer: true,
      answerDelaySeconds: 3,
      ...voicemail,
      hangupAfterSeconds: 3,
    },
  }
}

function normalizeScenario(value: unknown, settings: Settings): Scenario {
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const name = String(input.name ?? "default-answer")
  const answer = input.answer == null ? true : Boolean(input.answer)
  const language = scenarioLanguage(input, settings)
  const languageOption = scenarioLanguageOption(language)
  const events = normalizeEvents(input, name, answer, language)
  const messages = messagesFromEvents(events)
  return {
    name,
    answer,
    answerDelaySeconds: numberFromUnknown(input.answerDelaySeconds, 0),
    message: messages.at(0)?.text ?? null,
    messages,
    events,
    language,
    locale: String(input.locale ?? languageOption.locale),
    voiceName:
      input.voiceName == null
        ? languageOption.voiceName
        : String(input.voiceName),
    hangupAfterSeconds:
      input.hangupAfterSeconds == null
        ? 10
        : numberFromUnknown(input.hangupAfterSeconds, 10),
  }
}

function scenarioLanguage(
  input: Record<string, unknown>,
  settings: Settings
): ScenarioLanguage {
  if (typeof input.language === "string") {
    return scenarioLanguageOption(input.language).code
  }
  return inferScenarioLanguage(
    typeof input.locale === "string" ? input.locale : settings.defaultLocale
  )
}

function normalizeEvents(
  input: Record<string, unknown>,
  scenarioName: string,
  answer: boolean,
  language: ScenarioLanguage
): ScenarioEvent[] {
  if (!answer) return []

  const events = Array.isArray(input.events)
    ? input.events.map(normalizeEvent).filter((event) => event !== null)
    : eventsFromMessages(input, scenarioName, language)

  return ensureMinimumPlaybackSeconds(events)
}

function eventsFromMessages(
  input: Record<string, unknown>,
  scenarioName: string,
  language: ScenarioLanguage
): ScenarioEvent[] {
  const rawMessages = Array.isArray(input.messages)
    ? input.messages
    : input.message == null
      ? []
      : [{ text: input.message }]

  const messages = rawMessages.map(normalizeMessage).filter((item) => item.text)
  if (!messages.length) {
    return localizedScenarioPreset(scenarioName, language).events
  }

  return messages.flatMap((message) => [
    { type: "tts" as const, text: message.text },
    { type: "pause" as const, seconds: message.pauseAfterSeconds },
  ])
}

function normalizeEvent(value: unknown): ScenarioEvent | null {
  if (!value || typeof value !== "object") return null

  const input = value as Record<string, unknown>
  if (input.type === "pause") {
    return {
      type: "pause",
      seconds: numberFromUnknown(input.seconds ?? input.pauseAfterSeconds, 0),
    }
  }

  if (input.type === "tts" || input.text != null || input.message != null) {
    const text = String(input.text ?? input.message ?? "")
    return text ? { type: "tts", text } : null
  }

  return null
}

function normalizeMessage(value: unknown): Scenario["messages"][number] {
  if (typeof value === "string") {
    return { text: value, pauseAfterSeconds: 0 }
  }

  if (!value || typeof value !== "object") {
    return { text: "", pauseAfterSeconds: 0 }
  }

  const input = value as Record<string, unknown>
  return {
    text: String(input.text ?? input.message ?? ""),
    pauseAfterSeconds: numberFromUnknown(
      input.pauseAfterSeconds ?? input.pauseSeconds,
      0
    ),
  }
}

function ensureMinimumPlaybackSeconds(
  events: ScenarioEvent[]
): ScenarioEvent[] {
  if (!events.length) return events

  const pauseSeconds = events.reduce(
    (total, event) => total + (event.type === "pause" ? event.seconds : 0),
    0
  )
  if (pauseSeconds >= minimumPlaybackSeconds) return events

  return [
    ...events,
    { type: "pause", seconds: minimumPlaybackSeconds - pauseSeconds },
  ]
}

function messagesFromEvents(events: ScenarioEvent[]): Scenario["messages"] {
  const messages: Scenario["messages"] = []

  for (const event of events) {
    if (event.type === "tts") {
      messages.push({ text: event.text, pauseAfterSeconds: 0 })
      continue
    }

    if (messages.length) {
      messages[messages.length - 1].pauseAfterSeconds += event.seconds
    }
  }

  return messages
}

function scenariosForStorage(
  scenarios: Record<string, Scenario>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(scenarios).map(([phoneNumber, scenario]) => [
      phoneNumber,
      {
        name: scenario.name,
        answer: scenario.answer,
        answerDelaySeconds: scenario.answerDelaySeconds,
        language: scenario.language,
        locale: scenario.locale,
        voiceName: scenario.voiceName,
        hangupAfterSeconds: scenario.hangupAfterSeconds,
        events: scenario.events,
      },
    ])
  )
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
