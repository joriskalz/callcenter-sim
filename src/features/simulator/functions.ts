import { createServerFn } from "@tanstack/react-start"

import type { ContactStatusPatch, MonitorCredentials } from "./types"

import {
  appStatus,
  contacts,
  patchStatus,
  scenarios,
} from "@/server/simulator/service.server"
import { requireMonitorAccessFromServerFn } from "@/server/simulator/security.server"

type PatchContactInput = MonitorCredentials & {
  contactId: string
  patch: ContactStatusPatch
}

const credentials = (
  data: MonitorCredentials | undefined
): MonitorCredentials => ({
  apiKey: typeof data?.apiKey === "string" ? data.apiKey : undefined,
})

export const getMonitorStatus = createServerFn({ method: "GET" })
  .inputValidator(credentials)
  .handler(({ data }) => {
    requireMonitorAccessFromServerFn(data.apiKey)
    return appStatus()
  })

export const getMonitorContacts = createServerFn({ method: "GET" })
  .inputValidator(credentials)
  .handler(async ({ data }) => {
    requireMonitorAccessFromServerFn(data.apiKey)
    return contacts()
  })

export const getMonitorScenarios = createServerFn({ method: "GET" })
  .inputValidator(credentials)
  .handler(({ data }) => {
    requireMonitorAccessFromServerFn(data.apiKey)
    return scenarios()
  })

export const patchMonitorContactStatus = createServerFn({ method: "POST" })
  .inputValidator((data: PatchContactInput) => data)
  .handler(async ({ data }) => {
    requireMonitorAccessFromServerFn(data.apiKey)
    return patchStatus(data.contactId, data.patch)
  })
