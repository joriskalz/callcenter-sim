import { randomUUID } from "node:crypto"

import type {
  ActiveCall,
  AppStatus,
  CallEvent,
  ContactAddressBatchResult,
  ContactAddressResult,
  ContactConsentPatch,
  ContactConsentResult,
  DeleteProactiveDeliveriesResult,
  ContactStatusPatch,
  DeliveryCorrelation,
  DeliveryTimeline,
  PatchStatusResult,
  ProactiveDelivery,
  ProactiveEngagementConfig,
  StartProactiveExperimentResult,
  ReachabilityStatus,
  Scenario,
  SetupStatus,
} from "@/features/simulator/types"

import { answerCall, hangUp, playText, rejectIncomingCall } from "./acs.server"
import {
  acsConfigured,
  callbackUrl,
  callbackUrlProblem,
  configIssues,
  dataverseConfigured,
  getSettings,
  normalizePhone,
} from "./config.server"
import {
  contactByPhoneNumber,
  createProactiveVoiceDelivery,
  deleteRecentProactiveDeliveries,
  listContacts,
  listProactiveEngagementConfigs,
  listRecentProactiveDeliveries,
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
  updateScenarios,
} from "./scenarios.server"
import { callEvent, simulatorState, utcNow } from "./state.server"

/** Max simulator events surfaced per timeline. */
const maxTimelineEvents = 12

/**
 * When attaching context-less callbacks (e.g. ParticipantsUpdated, which
 * sometimes arrive without operationContext) to a chosen attempt, allow this
 * much slack (ms) on either side of the attempt's window.
 */
const contextlessWindowMs = 2000

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

export function setupStatus(): SetupStatus {
  const settings = getSettings()
  return {
    monitor_auth_configured: Boolean(settings.monitorApiKey),
    config_issues: configIssues(settings),
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
      config_issues: configIssues(settings),
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
    delivery_timelines: [],
    delivery_error: null,
    recent_events: simulatorState.recentEvents(),
    recent_errors: simulatorState.recentErrors(),
  }
}

export async function monitorStatus(): Promise<AppStatus> {
  const status = appStatus()

  try {
    const deliveries = await listRecentProactiveDeliveries()
    return {
      ...status,
      delivery_timelines: buildDeliveryTimelines(
        deliveries,
        simulatorState.recentCalls(),
        simulatorState.recentEvents()
      ),
      delivery_error: null,
    }
  } catch (error) {
    return {
      ...status,
      delivery_timelines: [],
      delivery_error: errorMessage(error),
    }
  }
}

export async function contacts() {
  return listContacts()
}

export async function proactiveEngagementConfigs(): Promise<
  ProactiveEngagementConfig[]
> {
  return listProactiveEngagementConfigs()
}

export async function proactiveDeliveries(): Promise<ProactiveDelivery[]> {
  return listRecentProactiveDeliveries(50)
}

export async function deleteProactiveDeliveries(): Promise<DeleteProactiveDeliveriesResult> {
  return deleteRecentProactiveDeliveries()
}

export async function startProactiveExperiment(
  payload: unknown
): Promise<StartProactiveExperimentResult> {
  const input = startProactiveExperimentInput(payload)

  if (!input.configId.trim()) {
    throw new Error("Select a proactive engagement config.")
  }
  if (!Array.isArray(input.contactIds) || !input.contactIds.length) {
    throw new Error("Select at least one contact.")
  }

  const selectedIds = new Set(input.contactIds)
  const selectedContacts = (await listContacts()).filter((contact) =>
    selectedIds.has(contact.contactid)
  )
  const result: StartProactiveExperimentResult = {
    requested: input.contactIds.length,
    created: [],
    failed: [],
  }

  for (const contact of selectedContacts) {
    if (!contact.telephone1) {
      result.failed.push({
        contactid: contact.contactid,
        fullname: contact.fullname,
        telephone1: contact.telephone1,
        deliveryId: null,
        error: "Contact does not have telephone1.",
      })
      continue
    }

    try {
      const response = await createProactiveVoiceDelivery({
        configId: input.configId,
        contactId: contact.contactid,
        phoneNumber: contact.telephone1,
        inputAttributes: {
          source: "call-simulator",
          fullName: contact.fullname,
        },
      })

      result.created.push({
        contactid: contact.contactid,
        fullname: contact.fullname,
        telephone1: contact.telephone1,
        deliveryId: response.DeliveryId ?? null,
        error: null,
      })
    } catch (error) {
      result.failed.push({
        contactid: contact.contactid,
        fullname: contact.fullname,
        telephone1: contact.telephone1,
        deliveryId: null,
        error: errorMessage(error),
      })
    }
  }

  for (const missingContactId of input.contactIds.filter(
    (contactId) =>
      !selectedContacts.some((contact) => contact.contactid === contactId)
  )) {
    result.failed.push({
      contactid: missingContactId,
      fullname: "Unknown contact",
      telephone1: null,
      deliveryId: null,
      error: "Contact was not found.",
    })
  }

  return result
}

function startProactiveExperimentInput(payload: unknown): {
  configId: string
  contactIds: string[]
} {
  const input =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {}

  return {
    configId: typeof input.configId === "string" ? input.configId : "",
    contactIds: Array.isArray(input.contactIds)
      ? input.contactIds.filter(
          (contactId): contactId is string => typeof contactId === "string"
        )
      : [],
  }
}

export async function patchStatus(
  contactId: string,
  patch: ContactStatusPatch
): Promise<PatchStatusResult> {
  if (
    patch.new_ccsim_enabled == null &&
    patch.new_ccsim_reachabilitystatus == null &&
    patch.new_ccsim_scenario === undefined &&
    patch.new_ccsim_lastcallresult === undefined &&
    patch.new_ccsim_lastcallat === undefined
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

export function saveScenarioDefinitions(
  payload: Record<string, unknown>
): Record<string, Scenario> {
  return updateScenarios(payload)
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
  const incomingCallTime = utcNow()

  const call: ActiveCall = {
    server_call_id: serverCallId,
    call_connection_id: null,
    operation_context: operationContext,
    from_number: fromNumber,
    to_number: toNumber,
    scenario_name: scenario.name,
    state: "incoming",
    current_action: "incoming call received",
    incoming_call_time: incomingCallTime,
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

  if (contact) {
    void recordContactIncomingCall(contact.contactid, incomingCallTime, call)
  }

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

async function recordContactIncomingCall(
  contactId: string,
  incomingCallTime: string,
  call: ActiveCall
): Promise<void> {
  try {
    await patchContactStatus(contactId, {
      new_ccsim_lastcallresult: "IncomingCall",
      new_ccsim_lastcallat: incomingCallTime,
    })
  } catch (error) {
    simulatorState.addEvent(
      eventFromCall(
        "Dataverse.LastCall.Error",
        "Updating contact last-call fields failed.",
        call,
        errorMessage(error)
      )
    )
  }
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
      // Preserve operationContext when ACS provides it so the timeline can
      // group callbacks with the call attempt they belong to. Fall back to
      // the matched call's context for callbacks (e.g. ParticipantsUpdated)
      // that omit it.
      operation_context: operationContext ?? call?.operation_context ?? null,
      scenario_name: call?.scenario_name ?? null,
      to_number: call?.to_number ?? null,
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

/* -------------------------------------------------------------------------- */
/* Delivery ↔ call/event correlation                                          */
/* -------------------------------------------------------------------------- */

export function buildDeliveryTimelines(
  deliveries: ProactiveDelivery[],
  calls: ActiveCall[],
  events: CallEvent[]
): DeliveryTimeline[] {
  return deliveries.map((delivery) => {
    const match = deliveryCallMatch(delivery, calls)
    const toNumber = delivery.to_address ?? match.call?.to_number ?? null

    const simulatorEvents = match.call
      ? eventsForCall(events, match.call)
      : eventsForPhoneAttempt(events, toNumber, delivery)

    return {
      id: delivery.id,
      correlation: match.correlation,
      to_number: toNumber,
      contact_id: delivery.contact_id ?? null,
      delivery,
      simulator_call: match.call,
      simulator_events: simulatorEvents,
    }
  })
}

/**
 * Strict event selection for a matched call: take events whose context,
 * connection id, or server call id matches the call, plus context-less
 * callbacks that fall inside the matched events' time window. This deliberately
 * does NOT fall back to a phone-number union, so events from other call
 * attempts to the same number can never contaminate the timeline.
 */
function eventsForCall(events: CallEvent[], call: ActiveCall): CallEvent[] {
  const matched = events.filter((event) => {
    if (event.operation_context === call.operation_context) return true
    if (
      call.call_connection_id &&
      event.call_connection_id === call.call_connection_id
    ) {
      return true
    }
    if (
      call.server_call_id &&
      event.server_call_id === call.server_call_id
    ) {
      return true
    }
    return false
  })

  return attachContextlessCallbacks(matched, events).slice(-maxTimelineEvents)
}

/**
 * Event selection for an unmatched (phone-only) delivery. Without a live call
 * to anchor on, we group all events for the phone number by operation_context
 * and select the single attempt whose activity is closest to the delivery's
 * result/start time. This replaces the previous "last 8 events for this number"
 * behavior that mixed unrelated call attempts together.
 */
function eventsForPhoneAttempt(
  events: CallEvent[],
  toNumber: string | null,
  delivery: ProactiveDelivery
): CallEvent[] {
  const phone = normalizePhone(toNumber)
  if (!phone) return []

  const phoneEvents = events.filter(
    (event) => normalizePhone(event.to_number) === phone
  )
  if (!phoneEvents.length) return []

  const groups = groupEventsByContext(phoneEvents)
  if (!groups.length) {
    return phoneEvents
      .slice()
      .sort(byOccurredAt)
      .slice(-maxTimelineEvents)
  }

  const anchor = deliveryAnchorTime(delivery)

  // Pick the group whose midpoint is closest to the delivery anchor; when there
  // is no usable anchor, pick the most recent (and richest) attempt.
  const chosen = groups
    .slice()
    .sort((left, right) => {
      if (anchor !== null) {
        const leftDistance = Math.abs(groupMidpoint(left) - anchor)
        const rightDistance = Math.abs(groupMidpoint(right) - anchor)
        if (leftDistance !== rightDistance) return leftDistance - rightDistance
      }
      // Tie-break / no-anchor: richer attempt, then more recent.
      if (left.length !== right.length) return right.length - left.length
      return groupMidpoint(right) - groupMidpoint(left)
    })[0]

  return attachContextlessCallbacks(chosen, phoneEvents).slice(
    -maxTimelineEvents
  )
}

/** Group events by operation_context (ignoring context-less callbacks). */
function groupEventsByContext(events: CallEvent[]): CallEvent[][] {
  const groups = new Map<string, CallEvent[]>()
  for (const event of events) {
    const key = event.operation_context ?? event.call_connection_id
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(event)
    else groups.set(key, [event])
  }
  return Array.from(groups.values()).map((group) => group.slice().sort(byOccurredAt))
}

/**
 * Fold context-less callbacks (events lacking operation_context, e.g. some
 * ParticipantsUpdated) into a chosen attempt when they fall within (or just
 * outside) the attempt's time window.
 */
function attachContextlessCallbacks(
  chosen: CallEvent[],
  pool: CallEvent[]
): CallEvent[] {
  if (!chosen.length) return chosen.slice().sort(byOccurredAt)

  const chosenKeys = new Set(chosen.map((event) => event.operation_context))
  const start = firstEpoch(chosen)
  const end = lastEpoch(chosen)

  const adopted = pool.filter((event) => {
    if (event.operation_context && chosenKeys.has(event.operation_context)) {
      return false
    }
    if (event.operation_context) return false
    const epoch = Date.parse(event.occurred_at)
    return (
      Number.isFinite(epoch) &&
      epoch >= start - contextlessWindowMs &&
      epoch <= end + contextlessWindowMs
    )
  })

  return [...chosen, ...adopted].sort(byOccurredAt)
}

function deliveryCallMatch(
  delivery: ProactiveDelivery,
  calls: ActiveCall[]
): { call: ActiveCall | null; correlation: DeliveryCorrelation } {
  const callId = delivery.call_id?.trim()
  if (callId) {
    const callIdMatch = calls.find(
      (call) =>
        call.server_call_id === callId ||
        call.call_connection_id === callId ||
        call.operation_context === callId
    )
    if (callIdMatch) return { call: callIdMatch, correlation: "call_id" }
  }

  const deliveryPhone = normalizePhone(delivery.to_address)
  if (!deliveryPhone) return { call: null, correlation: "unmatched" }

  const phoneMatches = calls.filter(
    (call) => normalizePhone(call.to_number) === deliveryPhone
  )
  if (!phoneMatches.length) return { call: null, correlation: "unmatched" }

  const closest = closestCallByTime(delivery, phoneMatches)
  return closest
    ? { call: closest, correlation: "phone" }
    : { call: null, correlation: "unmatched" }
}

/**
 * Null-safe closest-call selection. Anchors on the delivery's result/end time
 * (where the call actually happens for completed deliveries) before falling
 * back to start/created times. Calls with unparseable incoming times are sorted
 * last rather than producing NaN comparisons.
 */
function closestCallByTime(
  delivery: ProactiveDelivery,
  calls: ActiveCall[]
): ActiveCall | null {
  if (!calls.length) return null

  const anchor = deliveryAnchorTime(delivery)
  if (anchor === null) {
    // No anchor: prefer the most recent call to this number.
    return [...calls].sort(
      (left, right) =>
        (timestamp(right.incoming_call_time) ?? 0) -
        (timestamp(left.incoming_call_time) ?? 0)
    )[0]
  }

  return [...calls].sort(
    (left, right) =>
      callDistance(left, anchor) - callDistance(right, anchor)
  )[0]
}

function callDistance(call: ActiveCall, anchor: number): number {
  const time = timestamp(call.incoming_call_time)
  return time === null ? Number.POSITIVE_INFINITY : Math.abs(time - anchor)
}

/**
 * The most representative time for "when this delivery's call happened".
 * For completed deliveries the call lines up with the result; created_on can be
 * many minutes earlier (in observed data, ~40 min), so it is the last resort.
 */
function deliveryAnchorTime(delivery: ProactiveDelivery): number | null {
  return (
    timestamp(delivery.result_date) ??
    timestamp(delivery.end_date) ??
    timestamp(delivery.start_date) ??
    timestamp(delivery.modified_on) ??
    timestamp(delivery.created_on)
  )
}

function groupMidpoint(events: CallEvent[]): number {
  return (firstEpoch(events) + lastEpoch(events)) / 2
}

function firstEpoch(events: CallEvent[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const event of events) {
    const epoch = Date.parse(event.occurred_at)
    if (Number.isFinite(epoch) && epoch < min) min = epoch
  }
  return Number.isFinite(min) ? min : 0
}

function lastEpoch(events: CallEvent[]): number {
  let max = Number.NEGATIVE_INFINITY
  for (const event of events) {
    const epoch = Date.parse(event.occurred_at)
    if (Number.isFinite(epoch) && epoch > max) max = epoch
  }
  return Number.isFinite(max) ? max : 0
}

function byOccurredAt(left: CallEvent, right: CallEvent): number {
  return Date.parse(left.occurred_at) - Date.parse(right.occurred_at)
}

function timestamp(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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