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
  locale: string
  voiceName: string | null
  hangupAfterSeconds: number | null
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

export type ContactStatusPatch = {
  new_ccsim_enabled?: boolean | null
  new_ccsim_reachabilitystatus?: ReachabilityStatus | null
  new_ccsim_scenario?: string | null
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
  monitor_auth_configured: boolean
  webhook_secret_configured: boolean
  scenario_count: number
  public_base_url: string
  callback_url: string
  callback_url_valid: boolean
  callback_url_problem: string | null
}

export type AppStatus = {
  status: string
  version: string
  config: ConfigStatus
  active_call_count: number
  active_calls: ActiveCall[]
  recent_events: CallEvent[]
  recent_errors: CallEvent[]
}

export type MonitorCredentials = {
  apiKey?: string
}

export type PatchStatusResult = {
  contactid: string
  updated: Record<string, string | boolean | null>
}
