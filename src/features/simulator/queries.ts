import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useServerFn } from "@tanstack/react-start"

import {
  getMonitorContacts,
  getMonitorScenarios,
  getMonitorStatus,
  patchMonitorContactStatus,
} from "./functions"
import type { ContactStatusPatch } from "./types"

const simulatorKeys = {
  all: ["simulator"] as const,
  status: (apiKey: string) => [...simulatorKeys.all, "status", apiKey] as const,
  contacts: (apiKey: string) =>
    [...simulatorKeys.all, "contacts", apiKey] as const,
  scenarios: (apiKey: string) =>
    [...simulatorKeys.all, "scenarios", apiKey] as const,
}

export function useMonitorStatusQuery(apiKey: string, autoRefresh: boolean) {
  const getStatus = useServerFn(getMonitorStatus)
  return useQuery({
    queryKey: simulatorKeys.status(apiKey),
    queryFn: () => getStatus({ data: { apiKey } }),
    refetchInterval: autoRefresh ? 3000 : false,
  })
}

export function useMonitorContactsQuery(apiKey: string, autoRefresh: boolean) {
  const getContacts = useServerFn(getMonitorContacts)
  return useQuery({
    queryKey: simulatorKeys.contacts(apiKey),
    queryFn: () => getContacts({ data: { apiKey } }),
    refetchInterval: autoRefresh ? 3000 : false,
  })
}

export function useMonitorScenariosQuery(apiKey: string) {
  const getScenarios = useServerFn(getMonitorScenarios)
  return useQuery({
    queryKey: simulatorKeys.scenarios(apiKey),
    queryFn: () => getScenarios({ data: { apiKey } }),
    staleTime: 60_000,
  })
}

export function usePatchContactStatusMutation(apiKey: string) {
  const queryClient = useQueryClient()
  const patchContact = useServerFn(patchMonitorContactStatus)

  return useMutation({
    mutationFn: (input: { contactId: string; patch: ContactStatusPatch }) =>
      patchContact({
        data: {
          apiKey,
          contactId: input.contactId,
          patch: input.patch,
        },
      }),
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
