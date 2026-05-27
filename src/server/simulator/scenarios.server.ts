import type { Scenario } from "@/features/simulator/types"

import {
  defaultScenario,
  getSettings,
  loadScenarios,
  normalizePhone,
} from "./config.server"

let scenariosCache: Record<string, Scenario> | null = null

export function allScenarios(): Record<string, Scenario> {
  scenariosCache ??= loadScenarios(getSettings())
  return { ...scenariosCache }
}

export function scenarioCount(): number {
  return Object.keys(allScenarios()).length
}

export function scenarioByTargetNumber(
  phoneNumber: string | null | undefined
): Scenario {
  const normalized = normalizePhone(phoneNumber)
  return allScenarios()[normalized] ?? defaultScenario(getSettings())
}

export function scenarioForNameOrNumber(
  name: string,
  phoneNumber: string | null | undefined
): Scenario {
  const byNumber = scenarioByTargetNumber(phoneNumber)
  if (byNumber.name === name) return byNumber
  return (
    Object.values(allScenarios()).find((scenario) => scenario.name === name) ??
    byNumber
  )
}
