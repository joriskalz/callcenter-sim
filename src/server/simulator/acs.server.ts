import type { Scenario } from "@/features/simulator/types"

import { getSettings, voicemailToneUrl } from "./config.server"
import { callEvent, simulatorState } from "./state.server"

let clientCache: unknown | null = null
const maxSsmlBreakSeconds = 20

export async function answerCall(
  incomingCallContext: string,
  callbackUrl: string,
  operationContext: string
): Promise<string | null> {
  const settings = getSettings()
  const client = await getClient()
  if (!client) {
    simulatorState.addEvent(
      callEvent({
        event_type: "Simulator.AnswerSkipped",
        message: "ACS is not configured; answerCall was skipped.",
        server_call_id: null,
        call_connection_id: null,
        operation_context: operationContext,
        scenario_name: null,
        to_number: null,
        error: null,
      })
    )
    return null
  }

  const result = await client.answerCall(incomingCallContext, callbackUrl, {
    operationContext,
    callIntelligenceOptions: settings.cognitiveServicesEndpoint
      ? { cognitiveServicesEndpoint: settings.cognitiveServicesEndpoint }
      : undefined,
  })

  return result.callConnectionProperties.callConnectionId ?? null
}

export async function rejectIncomingCall(
  incomingCallContext: string,
  callRejectReason: "busy" | "forbidden" | "none",
  operationContext: string
): Promise<void> {
  const client = await getClient()
  if (!client) {
    simulatorState.addEvent(
      callEvent({
        event_type: "Simulator.RejectSkipped",
        message: "ACS is not configured; rejectCall was skipped.",
        server_call_id: null,
        call_connection_id: null,
        operation_context: operationContext,
        scenario_name: null,
        to_number: null,
        error: null,
      })
    )
    return
  }

  await client.rejectCall(incomingCallContext, { callRejectReason })
}

export async function playText(
  callConnectionId: string,
  scenario: Scenario,
  operationContext: string
): Promise<void> {
  const client = await getClient()
  if (!client) {
    simulatorState.addEvent(
      callEvent({
        event_type: "Simulator.PlaySkipped",
        message: "ACS is not configured; playToAll was skipped.",
        server_call_id: null,
        call_connection_id: callConnectionId,
        operation_context: operationContext,
        scenario_name: scenario.name,
        to_number: null,
        error: null,
      })
    )
    return
  }

  const settings = getSettings()
  const media = client.getCallConnection(callConnectionId).getCallMedia()
  await media.playToAll([playSourceForScenario(scenario, settings)], {
    operationContext,
  })
}

export async function hangUp(callConnectionId: string): Promise<void> {
  const client = await getClient()
  if (!client) {
    simulatorState.addEvent(
      callEvent({
        event_type: "Simulator.HangupSkipped",
        message: "ACS is not configured; hangUp was skipped.",
        server_call_id: null,
        call_connection_id: callConnectionId,
        operation_context: null,
        scenario_name: null,
        to_number: null,
        error: null,
      })
    )
    return
  }

  await client.getCallConnection(callConnectionId).hangUp(true)
}

async function getClient(): Promise<AcsClient | null> {
  const settings = getSettings()
  if (!settings.acsConnectionString) return null
  if (clientCache) return clientCache as AcsClient

  const { CallAutomationClient } =
    await import("@azure/communication-call-automation")
  clientCache = new CallAutomationClient(settings.acsConnectionString)
  return clientCache as AcsClient
}

type AcsClient = {
  answerCall: (
    incomingCallContext: string,
    callbackUrl: string,
    options: {
      operationContext: string
      callIntelligenceOptions?: { cognitiveServicesEndpoint: string }
    }
  ) => Promise<{ callConnectionProperties: { callConnectionId?: string } }>
  rejectCall: (
    incomingCallContext: string,
    options: { callRejectReason: "busy" | "forbidden" | "none" }
  ) => Promise<void>
  getCallConnection: (callConnectionId: string) => {
    getCallMedia: () => {
      playToAll: (
        sources: PlaySource[],
        options: { operationContext: string }
      ) => Promise<void>
    }
    hangUp: (isForEveryone: boolean) => Promise<void>
  }
}

type PlaySource = {
  kind: "ssmlSource"
  ssmlText: string
}

function playSourceForScenario(
  scenario: Scenario,
  settings: ReturnType<typeof getSettings>
): PlaySource {
  const ssmlText = ssmlForScenario(scenario, settings)
  if (scenario.name === "voicemail") {
    return {
      kind: "ssmlSource",
      ssmlText: ssmlText.replace(
        "</voice></speak>",
        `<break time="500ms"/><audio src="${escapeXmlAttribute(
          voicemailToneUrl(settings)
        )}"/></voice></speak>`
      ),
    }
  }

  return {
    kind: "ssmlSource",
    ssmlText,
  }
}

function ssmlForScenario(
  scenario: Scenario,
  settings: ReturnType<typeof getSettings>
): string {
  const locale = scenario.locale || settings.defaultLocale
  const voiceName = scenario.voiceName ?? settings.defaultVoiceName
  const events = scenario.events.length
    ? scenario.events
    : scenario.messages.length
      ? scenario.messages.flatMap((message) => [
          { type: "tts" as const, text: message.text },
          { type: "pause" as const, seconds: message.pauseAfterSeconds },
        ])
      : scenario.message
        ? [{ type: "tts" as const, text: scenario.message }]
        : []

  return (
    `<speak version="1.0" xml:lang="${escapeXmlAttribute(locale)}">` +
    `<voice name="${escapeXmlAttribute(voiceName)}">` +
    events
      .map((event) =>
        event.type === "tts"
          ? escapeXmlText(event.text)
          : breakTag(event.seconds)
      )
      .join("") +
    `</voice></speak>`
  )
}

function breakTag(seconds: number): string {
  if (seconds <= 0) return ""

  const tags: string[] = []
  let remainingMs = Math.round(seconds * 1000)
  const maxBreakMs = maxSsmlBreakSeconds * 1000
  while (remainingMs > 0) {
    const chunkMs = Math.min(remainingMs, maxBreakMs)
    tags.push(`<break time="${chunkMs}ms"/>`)
    remainingMs -= chunkMs
  }
  return tags.join("")
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
