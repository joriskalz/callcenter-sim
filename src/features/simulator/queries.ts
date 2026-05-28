import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  AppStatus,
  Contact,
  ContactAddressBatchResult,
  ContactAddressResult,
  ContactConsentPatch,
  ContactConsentResult,
  ContactStatusPatch,
  PatchStatusResult,
  Scenario,
  SetupStatus,
} from "./types"

const simulatorKeys = {
  all: ["simulator"] as const,
  status: (apiKey: string) => [...simulatorKeys.all, "status", apiKey] as const,
  contacts: (apiKey: string) =>
    [...simulatorKeys.all, "contacts", apiKey] as const,
  scenarios: (apiKey: string) =>
    [...simulatorKeys.all, "scenarios", apiKey] as const,
  setup: () => [...simulatorKeys.all, "setup"] as const,
}

export function useSetupStatusQuery() {
  return useQuery({
    queryKey: simulatorKeys.setup(),
    queryFn: () => fetchJson<SetupStatus>("/api/setup"),
    staleTime: 3000,
  })
}

export function useMonitorStatusQuery(apiKey: string, autoRefresh: boolean) {
  const enabled = Boolean(apiKey)

  return useQuery({
    queryKey: simulatorKeys.status(apiKey),
    queryFn: () => fetchMonitorJson<AppStatus>("/api/status", apiKey),
    enabled,
    refetchInterval: enabled && autoRefresh ? 3000 : false,
  })
}

export function useMonitorContactsQuery(apiKey: string, autoRefresh: boolean) {
  const enabled = Boolean(apiKey)

  return useQuery({
    queryKey: simulatorKeys.contacts(apiKey),
    queryFn: () => fetchMonitorJson<Contact[]>("/api/contacts", apiKey),
    enabled,
    refetchInterval: enabled && autoRefresh ? 3000 : false,
  })
}

export function useMonitorScenariosQuery(apiKey: string) {
  return useQuery({
    queryKey: simulatorKeys.scenarios(apiKey),
    queryFn: () =>
      fetchMonitorJson<Record<string, Scenario>>("/api/scenarios", apiKey),
    enabled: Boolean(apiKey),
    staleTime: 60_000,
  })
}

export function usePatchContactStatusMutation(apiKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { contactId: string; patch: ContactStatusPatch }) =>
      fetchMonitorJson<PatchStatusResult>(
        `/api/contacts/${encodeURIComponent(input.contactId)}/simulator-status`,
        apiKey,
        {
          method: "PATCH",
          body: JSON.stringify(input.patch),
        }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: simulatorKeys.status(apiKey),
        }),
        queryClient.invalidateQueries({
          queryKey: simulatorKeys.contacts(apiKey),
        }),
      ])
    },
  })
}

export function usePatchContactConsentMutation(apiKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { contactId: string; patch: ContactConsentPatch }) =>
      fetchMonitorJson<ContactConsentResult>(
        `/api/contacts/${encodeURIComponent(input.contactId)}/consent`,
        apiKey,
        {
          method: "PATCH",
          body: JSON.stringify(input.patch),
        }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: simulatorKeys.contacts(apiKey),
      })
    },
  })
}

export function useRemoveContactConsentMutation(apiKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { contactId: string }) =>
      fetchMonitorJson<ContactConsentResult>(
        `/api/contacts/${encodeURIComponent(input.contactId)}/consent`,
        apiKey,
        { method: "DELETE" }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: simulatorKeys.contacts(apiKey),
      })
    },
  })
}

export function useRandomizeContactAddressMutation(apiKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { contactId: string }) =>
      fetchMonitorJson<ContactAddressResult>(
        `/api/contacts/${encodeURIComponent(input.contactId)}/address`,
        apiKey,
        { method: "PATCH" }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: simulatorKeys.contacts(apiKey),
      })
    },
  })
}

export function useRandomizeAllContactAddressesMutation(apiKey: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchMonitorJson<ContactAddressBatchResult>(
        "/api/contacts/address",
        apiKey,
        { method: "PATCH" }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: simulatorKeys.contacts(apiKey),
      })
    },
  })
}

async function fetchMonitorJson<T>(
  path: string,
  apiKey: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-monitor-api-key": apiKey } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const message = await errorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as T
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const message = await errorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as T
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail || `${response.status} ${response.statusText}`
  } catch {
    return `${response.status} ${response.statusText}`
  }
}
