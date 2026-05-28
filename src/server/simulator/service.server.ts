import { randomUUID } from "node:crypto"

import type {
  ActiveCall,
  AppStatus,
  CallEvent,
  ContactAddressBatchResult,
  ContactAddressResult,
  ContactConsentPatch,
  ContactConsentResult,
  ContactStatusPatch,
  PatchStatusResult,
  ReachabilityStatus,
  Scenario,
} from "@/features/simulator/types"

import { answerCall, hangUp, playText, rejectIncomingCall } from "./acs.server"
import {
  acsConfigured,
  callbackUrl,
  callbackUrlProblem,
  dataverseConfigured,
  getSettings,
} from "./config.server"
import {
  contactByPhoneNumber,
  listContacts,
  patchContactStatus,
  randomizeAllContactAddresses,
  randomizeContactAddress,
  removeContactConsent,
  setContactConsent,
} from "./dataverse.server"
import {
  asEventList,
  eventData,
  eventType,
  extractPhone,
  isRecord,
  validationCode,
} from "./event-parsing.server"
import {
  allScenarios,
  scenarioByTargetNumber,
  scenarioCount,
  scenarioForNameOrNumber,
} from "./scenarios.server"
import { callEvent, simulatorState, utcNow } from "./state.server"

export function healthStatus(): Record<string, unknown> {
  const settings = getSettings()
  return {
    status: "ok",
    version: settings.appVersion,
    acsConfigured: acsConfigured(settings),
    ttsConfigured: Boolean(settings.cognitiveServicesEndpoint),
    dataverseConfigured: dataverseConfigured(settings),
  }
}

export function appStatus(): AppStatus {
  const settings = getSettings()
  const problem = callbackUrlProblem(settings)
  const activeCalls = simulatorState.activeCalls()
  return {
    status: "ok",
    version: settings.appVersion,
    config: {
      acs_configured: acsConfigured(settings),
      tts_configured: Boolean(settings.cognitiveServicesEndpoint),
      dataverse_configured: dataverseConfigured(settings),
      monitor_auth_configured: Boolean(settings.monitorApiKey),
      webhook_secret_configured: Boolean(settings.webhookSharedSecret),
      scenario_count: scenarioCount(),
      public_base_url: settings.publicBaseUrl,
      callback_url: callbackUrl(settings),
      callback_url_valid: problem === null,
      callback_url_problem: problem,
    },
    active_call_count: activeCalls.length,
    active_calls: activeCalls,
    recent_events: simulatorState.recentEvents(),
    recent_errors: simulatorState.recentErrors(),
  }
}

export async function contacts() {
  return listContacts()
}

export async function patchStatus(
  contactId: string,
  patch: ContactStatusPatch
): Promise<PatchStatusResult> {
  if (
    patch.new_ccsim_enabled == null &&
    patch.new_ccsim_reachabilitystatus == null &&
    patch.new_ccsim_scenario === undefined
  ) {
    throw new Error("At least one simulator status field is required.")
  }
  return patchContactStatus(contactId, patch)
}

export async function patchConsent(
  contactId: string,
  patch: ContactConsentPatch
): Promise<ContactConsentResult> {
  return setContactConsent(contactId, patch)
}

export async function removeConsent(
  contactId: string
): Promise<ContactConsentResult> {
  return removeContactConsent(contactId)
}

export async function randomizeAddress(
  contactId: string
): Promise<ContactAddressResult> {
  return randomizeContactAddress(contactId)
}

export async function randomizeAllAddresses(): Promise<ContactAddressBatchResult> {
  return randomizeAllContactAddresses()
}

export function scenarios(): Record<string, Scenario> {
  return allScenarios()
}

export async function handleIncomingCallPayload(
  payload: unknown
): Promise<Response> {
  const events = asEventList(payload)
  const code = validationCode(events)
  if (code) {
    simulatorState.addEvent(
      callEvent({
        event_type: "Microsoft.EventGrid.SubscriptionValidationEvent",
        message: "Event Grid subscription validation was answered.",
        server_call_id: null,
        call_connection_id: null,
        operation_context: null,
        scenario_name: null,
        to_number: null,
        error: null,
      })
    )
    return Response.json({ validationResponse: code })
  }

  let accepted = 0
  for (const event of events) {
    if (event.id && simulatorState.rememberEventId(String(event.id))) continue
    if (eventType(event) !== "Microsoft.Communication.IncomingCall") continue
    accepted += 1
    await handleIncomingCallEvent(eventData(event))
  }

  return Response.json({ accepted }, { status: 202 })
}

export async function handleCallbackPayload(
  payload: unknown
): Promise<Response> {
  const events = asEventList(payload)
  let handled = 0

  for (const event of events) {
    if (event.id && simulatorState.rememberEventId(String(event.id))) continue
    handled += 1
    handleCallbackEvent(event)
  }

  return Response.json({ handled }, { status: 202 })
}

async function handleIncomingCallEvent(
  data: Record<string, unknown>
): Promise<void> {
  const incomingCallContext =
    typeof data.incomingCallContext === "string"
      ? data.incomingCallContext
      : null
  const serverCallId =
    typeof data.serverCallId === "string" ? data.serverCallId : null
  const fromNumber = extractPhone(data.from)
  const toNumber = extractPhone(data.to)
  const contact = await contactByPhoneNumber(toNumber)
  const reachabilityStatus = contact?.new_ccsim_reachabilitystatus ?? "unknown"
  const scenario = scenarioForIncomingCall(
    reachabilityStatus,
    contact?.new_ccsim_scenario,
    toNumber
  )
  const operationContext = `ccsim:${scenario.name}:${randomUUID()}`

  const call: ActiveCall = {
    server_call_id: serverCallId,
    call_connection_id: null,
    operation_context: operationContext,
    from_number: fromNumber,
    to_number: toNumber,
    scenario_name: scenario.name,
    state: "incoming",
    current_action: "incoming call received",
    incoming_call_time: utcNow(),
    answer_time: null,
    call_connected_time: null,
    play_started_time: null,
    play_completed_time: null,
    hangup_time: null,
    call_disconnected_time: null,
    result: null,
    error: null,
  }

  simulatorState.upsertCall(call)
  simulatorState.addEvent(
    callEvent({
      event_type: "IncomingCall",
      message: `Incoming call routed to scenario '${scenario.name}'.`,
      server_call_id: serverCallId,
      call_connection_id: null,
      operation_context: operationContext,
      scenario_name: scenario.name,
      to_number: toNumber,
      error: null,
    })
  )

  if (reachabilityStatus === "busy") {
    rejectCallByStatus(incomingCallContext, call, "busy")
    return
  }

  if (reachabilityStatus === "disabled") {
    rejectCallByStatus(incomingCallContext, call, "disabled")
    return
  }

  if (reachabilityStatus === "no_answer") {
    leaveCallUnanswered(
      call,
      "Status.NoAnswer",
      "Contact status is configured not to answer this call."
    )
    return
  }

  if (!scenario.answer) {
    leaveCallUnanswered(
      call,
      "Scenario.NoAnswer",
      "Scenario is configured not to answer this call."
    )
    return
  }

  if (!incomingCallContext) {
    call.state = "failed"
    call.error = "IncomingCall event did not include incomingCallContext."
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall(
        "IncomingCall.Error",
        "IncomingCall cannot be answered without incomingCallContext.",
        call,
        call.error
      )
    )
    return
  }

  call.state = "answering"
  call.current_action = "answer scheduled"
  simulatorState.upsertCall(call)
  void answerAfterDelay(incomingCallContext, scenario, operationContext)
}

function scenarioForIncomingCall(
  reachabilityStatus: ReachabilityStatus,
  selectedScenario: string | null | undefined,
  toNumber: string | null
): Scenario {
  if (reachabilityStatus === "voicemail") {
    return scenarioForNameOrNumber("voicemail", toNumber)
  }
  return selectedScenario
    ? scenarioForNameOrNumber(selectedScenario, toNumber)
    : scenarioByTargetNumber(toNumber)
}

function rejectCallByStatus(
  incomingCallContext: string | null,
  call: ActiveCall,
  status: "busy" | "disabled"
): void {
  if (!incomingCallContext) {
    call.state = "failed"
    call.error = "IncomingCall event did not include incomingCallContext."
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall(
        "IncomingCall.Error",
        `IncomingCall cannot be rejected as ${status} without incomingCallContext.`,
        call,
        call.error
      )
    )
    return
  }

  call.state = status
  call.result = status
  call.current_action =
    status === "busy" ? "rejectCall busy" : "rejectCall forbidden"
  simulatorState.upsertCall(call)
  void rejectCallWithReason(
    incomingCallContext,
    status === "busy" ? "busy" : "forbidden",
    call.operation_context
  )
}

function leaveCallUnanswered(
  call: ActiveCall,
  eventTypeValue: string,
  message: string
): void {
  call.state = "no_answer"
  call.result = "no_answer"
  call.current_action = "left unanswered"
  simulatorState.upsertCall(call)
  simulatorState.addEvent(eventFromCall(eventTypeValue, message, call))
}

async function rejectCallWithReason(
  incomingCallContext: string,
  reason: "busy" | "forbidden",
  operationContext: string
): Promise<void> {
  const call = simulatorState.findCall({ operationContext })
  if (!call) return

  try {
    await rejectIncomingCall(incomingCallContext, reason, operationContext)
    simulatorState.addEvent(
      eventFromCall(
        reason === "busy" ? "Reject.Busy" : "Reject.Forbidden",
        reason === "busy"
          ? "rejectCall was invoked with Busy."
          : "rejectCall was invoked with Forbidden.",
        call
      )
    )
  } catch (error) {
    call.state = "failed"
    call.error = errorMessage(error)
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("Reject.Error", "rejectCall failed.", call, call.error)
    )
  }
}

async function answerAfterDelay(
  incomingCallContext: string,
  scenario: Scenario,
  operationContext: string
): Promise<void> {
  const call = simulatorState.findCall({ operationContext })
  if (!call) return

  try {
    if (scenario.answerDelaySeconds) {
      call.current_action = `waiting ${scenario.answerDelaySeconds}s before answer`
      simulatorState.upsertCall(call)
      await delay(scenario.answerDelaySeconds)
    }

    call.answer_time = utcNow()
    call.current_action = "answerCall"
    simulatorState.upsertCall(call)

    const callConnectionId = await answerCall(
      incomingCallContext,
      callbackUrl(),
      operationContext
    )
    if (callConnectionId) call.call_connection_id = callConnectionId
    call.current_action = "waiting for CallConnected callback"
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("Answer", "answerCall was invoked.", call)
    )
  } catch (error) {
    call.state = "failed"
    call.error = errorMessage(error)
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("Answer.Error", "answerCall failed.", call, call.error)
    )
  }
}

function handleCallbackEvent(event: Record<string, unknown>): void {
  const data = eventData(event)
  const callbackType = eventType(event).split(".").at(-1) || "Callback"
  const callConnectionId = stringOrNull(data.callConnectionId)
  const serverCallId = stringOrNull(data.serverCallId)
  const operationContext = stringOrNull(data.operationContext)
  const call = simulatorState.findCall({
    operationContext,
    callConnectionId,
    serverCallId,
  })

  if (callConnectionId && call) call.call_connection_id = callConnectionId

  if (callbackType === "CallConnected" && call) {
    call.state = "connected"
    call.call_connected_time = utcNow()
    call.current_action = "call connected"
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("CallConnected", "Call connected.", call)
    )
    void playForCall(
      call.operation_context,
      scenarioForNameOrNumber(call.scenario_name, call.to_number)
    )
    return
  }

  if (callbackType === "PlayCompleted" && call) {
    call.state = "waiting_after_play"
    call.play_completed_time = utcNow()
    call.current_action = "play completed"
    call.result = "played"
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("PlayCompleted", "TTS play completed.", call)
    )
    const scenario = scenarioForNameOrNumber(call.scenario_name, call.to_number)
    if (scenario.hangupAfterSeconds !== null) {
      void hangupAfterDelay(call.operation_context, scenario.hangupAfterSeconds)
    }
    return
  }

  if (callbackType === "RecognizeCompleted" && call) {
    simulatorState.addEvent(
      eventFromCall("RecognizeCompleted", "Recognize completed.", call)
    )
    return
  }

  if (callbackType === "CallDisconnected" && call) {
    call.state = "disconnected"
    call.call_disconnected_time = utcNow()
    call.current_action = "call disconnected"
    call.result = call.result || "disconnected"
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("CallDisconnected", "Call disconnected.", call)
    )
    return
  }

  const error = callbackError(data)
  simulatorState.addEvent(
    callEvent({
      event_type: callbackType,
      message: `Callback received: ${callbackType}.`,
      server_call_id: serverCallId,
      call_connection_id: callConnectionId,
      operation_context: operationContext,
      scenario_name: null,
      to_number: null,
      error,
      raw: error ? JSON.stringify({ data }) : null,
    })
  )
}

async function playForCall(
  operationContext: string,
  scenario: Scenario
): Promise<void> {
  const call = simulatorState.findCall({ operationContext })
  if (!call?.call_connection_id) return

  try {
    call.state = "playing"
    call.play_started_time = utcNow()
    call.current_action = "play TTS"
    simulatorState.upsertCall(call)
    await playText(call.call_connection_id, scenario, operationContext)
    simulatorState.addEvent(
      eventFromCall("PlayStarted", "TTS play was invoked.", call)
    )
  } catch (error) {
    call.state = "failed"
    call.error = errorMessage(error)
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("Play.Error", "TTS play failed.", call, call.error)
    )
  }
}

async function hangupAfterDelay(
  operationContext: string,
  delaySeconds: number
): Promise<void> {
  const call = simulatorState.findCall({ operationContext })
  if (!call?.call_connection_id) return

  try {
    if (delaySeconds) {
      call.current_action = `waiting ${delaySeconds}s before hangup`
      simulatorState.upsertCall(call)
      await delay(delaySeconds)
    }
    call.state = "hanging_up"
    call.hangup_time = utcNow()
    call.current_action = "hangUp"
    simulatorState.upsertCall(call)
    await hangUp(call.call_connection_id)
    simulatorState.addEvent(
      eventFromCall("Hangup", "hangUp was invoked.", call)
    )
  } catch (error) {
    call.state = "failed"
    call.error = errorMessage(error)
    simulatorState.upsertCall(call)
    simulatorState.addEvent(
      eventFromCall("Hangup.Error", "hangUp failed.", call, call.error)
    )
  }
}

function eventFromCall(
  eventTypeValue: string,
  message: string,
  call: ActiveCall,
  error: string | null = null
): CallEvent {
  return callEvent({
    event_type: eventTypeValue,
    message,
    server_call_id: call.server_call_id,
    call_connection_id: call.call_connection_id,
    operation_context: call.operation_context,
    scenario_name: call.scenario_name,
    to_number: call.to_number,
    error,
  })
}

function callbackError(data: Record<string, unknown>): string | null {
  if (!isRecord(data.resultInformation)) return null
  const code = numericResultCode(data.resultInformation.code)
  const subCode = numericResultCode(data.resultInformation.subCode)
  const message = String(data.resultInformation.message ?? "").trim()

  if (code === null) return null
  if ((code === 0 || (code >= 200 && code < 400)) && (subCode ?? 0) === 0) {
    return null
  }

  return [String(code), message].filter(Boolean).join(": ")
}

function numericResultCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string" || !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function delay(seconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, seconds * 1000))
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
