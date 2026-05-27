import type { ActiveCall, CallEvent } from "@/features/simulator/types"

import { getSettings } from "./config.server"

type FindCallInput = {
  operationContext?: string | null
  callConnectionId?: string | null
  serverCallId?: string | null
}

class SimulatorState {
  private callsByOperation = new Map<string, ActiveCall>()
  private operationByConnection = new Map<string, string>()
  private operationByServerCall = new Map<string, string>()
  private events: CallEvent[] = []
  private errors: CallEvent[] = []
  private seenEventIds = new Set<string>()

  rememberEventId(eventId: string | null | undefined): boolean {
    if (!eventId) return false
    if (this.seenEventIds.has(eventId)) return true
    this.seenEventIds.add(eventId)
    return false
  }

  upsertCall(call: ActiveCall): ActiveCall {
    this.callsByOperation.set(call.operation_context, call)
    if (call.call_connection_id) {
      this.operationByConnection.set(
        call.call_connection_id,
        call.operation_context
      )
    }
    if (call.server_call_id) {
      this.operationByServerCall.set(
        call.server_call_id,
        call.operation_context
      )
    }
    return call
  }

  findCall(input: FindCallInput): ActiveCall | null {
    if (
      input.operationContext &&
      this.callsByOperation.has(input.operationContext)
    ) {
      return this.callsByOperation.get(input.operationContext) ?? null
    }
    if (
      input.callConnectionId &&
      this.operationByConnection.has(input.callConnectionId)
    ) {
      const operation = this.operationByConnection.get(input.callConnectionId)
      return operation ? (this.callsByOperation.get(operation) ?? null) : null
    }
    if (
      input.serverCallId &&
      this.operationByServerCall.has(input.serverCallId)
    ) {
      const operation = this.operationByServerCall.get(input.serverCallId)
      return operation ? (this.callsByOperation.get(operation) ?? null) : null
    }
    return null
  }

  addEvent(event: CallEvent): void {
    const limit = getSettings().recentEventLimit
    this.events = [event, ...this.events].slice(0, limit)
    if (event.error) {
      this.errors = [event, ...this.errors].slice(0, limit)
    }
  }

  activeCalls(): ActiveCall[] {
    return Array.from(this.callsByOperation.values()).filter(
      (call) => !["disconnected", "failed", "no_answer"].includes(call.state)
    )
  }

  recentEvents(): CallEvent[] {
    return this.events
  }

  recentErrors(): CallEvent[] {
    return this.errors
  }
}

export const simulatorState = new SimulatorState()

export function utcNow(): string {
  return new Date().toISOString()
}

export function callEvent(
  input: Omit<CallEvent, "occurred_at" | "raw"> & { raw?: string | null }
): CallEvent {
  return {
    ...input,
    occurred_at: utcNow(),
    raw: input.raw ?? null,
  }
}
