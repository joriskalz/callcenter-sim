export const reachabilityStatuses = [
  "reachable",
  "busy",
  "no_answer",
  "voicemail",
  "disabled",
  "unknown",
] as const

export type ReachabilityStatus = (typeof reachabilityStatuses)[number]

export type CallState =
  | "incoming"
  | "answering"
  | "busy"
  | "connected"
  | "disabled"
  | "playing"
  | "waiting_after_play"
  | "hanging_up"
  | "disconnected"
  | "failed"
  | "no_answer"

export type Scenario = {
  name: string
  answer: boolean
  answerDelaySeconds: number
  message: string | null
  messages: ScenarioMessage[]
  events: ScenarioEvent[]
  language: ScenarioLanguage
  locale: string
  voiceName: string | null
  hangupAfterSeconds: number | null
}

export type ScenarioLanguage =
  | "en"
  | "es"
  | "fr"
  | "ar"
  | "it"
  | "nl"
  | "pt"
  | "de"

export type ScenarioMessage = {
  text: string
  pauseAfterSeconds: number
}

export type ScenarioEvent =
  | {
      type: "tts"
      text: string
    }
  | {
      type: "pause"
      seconds: number
    }

export type Contact = {
  contactid: string
  fullname: string
  telephone1: string | null
  address1_line1: string | null
  address1_city: string | null
  address1_postalcode: string | null
  address1_country: string | null
  new_ccsim_enabled: boolean
  new_ccsim_reachabilitystatus: ReachabilityStatus
  new_ccsim_scenario: string | null
  new_ccsim_lastcallresult: string | null
  new_ccsim_lastcallat: string | null
  consent: ContactConsent | null
}

export type ProactiveEngagementConfig = {
  id: string
  name: string
}

export type StartProactiveExperimentInput = {
  configId: string
  contactIds: string[]
}

export type ProactiveExperimentDeliveryResult = {
  contactid: string
  fullname: string
  telephone1: string | null
  deliveryId: string | null
  error: string | null
}

export type StartProactiveExperimentResult = {
  requested: number
  created: ProactiveExperimentDeliveryResult[]
  failed: ProactiveExperimentDeliveryResult[]
}

export type DeleteProactiveDeliveriesResult = {
  deleted: number
  failed: Array<{
    id: string
    error: string
  }>
}

export type ContactStatusPatch = {
  new_ccsim_enabled?: boolean | null
  new_ccsim_reachabilitystatus?: ReachabilityStatus | null
  new_ccsim_scenario?: string | null
  new_ccsim_lastcallresult?: string | null
  new_ccsim_lastcallat?: string | null
}

export type ConsentValue = "not_set" | "opted_in" | "opted_out"

export type ContactConsent = {
  id: string | null
  contactPointValue: string
  value: ConsentValue | "unknown"
  source: number | null
  reason: string | null
  modifiedOn: string | null
}

export type ContactConsentPatch = {
  value: Extract<ConsentValue, "opted_in" | "opted_out">
}

export type ContactConsentResult = {
  contactid: string
  consent: ContactConsent | null
}

export type AddressPreset = {
  label: string
  line1: string
  city: string
  postalCode: string
  country: string
  stateOrProvince: string
}

export type ContactAddressResult = {
  contactid: string
  contact: Contact
  previousCity: string | null
  appliedAddress: AddressPreset
}

export type ContactAddressBatchResult = {
  updated: ContactAddressResult[]
}

export type ActiveCall = {
  server_call_id: string | null
  call_connection_id: string | null
  operation_context: string
  from_number: string | null
  to_number: string | null
  scenario_name: string
  state: CallState
  current_action: string | null
  incoming_call_time: string
  answer_time: string | null
  call_connected_time: string | null
  play_started_time: string | null
  play_completed_time: string | null
  hangup_time: string | null
  call_disconnected_time: string | null
  result: string | null
  error: string | null
}

export type ProactiveDelivery = {
  id: string
  delivery_id: string | null
  tracking_id: string | null
  call_id: string | null
  channel: string | null
  dial_mode_type: string | null
  to_address: string | null
  from_address: string | null
  engagement_type: string | null
  speech_detected: boolean | null
  status: string | null
  state: string | null
  result: string | null
  disposition_codes: string | null
  contact_id: string | null
  conversation_id: string | null
  batch_id: string | null
  queue_id: string | null
  country: string | null
  postal_code: string | null
  sequence_number: number | null
  ttl_in_seconds: number | null
  version_number: number | null
  start_date: string | null
  end_date: string | null
  result_date: string | null
  created_on: string | null
  modified_on: string | null
  call_record: DataverseRecordLink | null
  contact_record: DataverseRecordLink | null
}

export type DataverseRecordLink = {
  id: string
  entity_logical_name: string
  display_name: string
  url: string
}

export type DeliveryCorrelation = "call_id" | "phone" | "unmatched"

export type DeliveryTimeline = {
  id: string
  correlation: DeliveryCorrelation
  to_number: string | null
  contact_id: string | null
  delivery: ProactiveDelivery
  simulator_call: ActiveCall | null
  simulator_events: CallEvent[]
}

export type CallEvent = {
  event_type: string
  message: string
  occurred_at: string
  server_call_id: string | null
  call_connection_id: string | null
  operation_context: string | null
  scenario_name: string | null
  to_number: string | null
  error: string | null
  raw: string | null
}

export type ConfigStatus = {
  acs_configured: boolean
  tts_configured: boolean
  dataverse_configured: boolean
  config_issues: ConfigIssue[]
  monitor_auth_configured: boolean
  webhook_secret_configured: boolean
  scenario_count: number
  public_base_url: string
  callback_url: string
  callback_url_valid: boolean
  callback_url_problem: string | null
}

export type ConfigIssue = {
  area: "Monitor" | "ACS" | "TTS" | "Dataverse" | "Callback URL"
  title: string
  description: string
  envVars: string[]
  learnUrl?: string
}

export type AppStatus = {
  status: string
  version: string
  config: ConfigStatus
  active_call_count: number
  active_calls: ActiveCall[]
  delivery_timelines: DeliveryTimeline[]
  delivery_error: string | null
  recent_events: CallEvent[]
  recent_errors: CallEvent[]
}

export type SetupStatus = {
  monitor_auth_configured: boolean
  config_issues: ConfigIssue[]
}

export type MonitorCredentials = {
  apiKey?: string
}

export type PatchStatusResult = {
  contactid: string
  updated: Record<string, string | boolean | null>
}
