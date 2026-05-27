import type { Scenario } from "@/features/simulator/types"

import { getSettings } from "./config.server"
import { callEvent, simulatorState } from "./state.server"

let clientCache: unknown | null = null

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
  await media.playToAll(
    [
      {
        kind: "textSource",
        text: scenario.message ?? "",
        sourceLocale: scenario.locale,
        voiceName: scenario.voiceName ?? settings.defaultVoiceName,
      },
    ],
    { operationContext }
  )
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
  getCallConnection: (callConnectionId: string) => {
    getCallMedia: () => {
      playToAll: (
        sources: Array<{
          kind: "textSource"
          text: string
          sourceLocale: string
          voiceName: string
        }>,
        options: { operationContext: string }
      ) => Promise<void>
    }
    hangUp: (isForEveryone: boolean) => Promise<void>
  }
}
