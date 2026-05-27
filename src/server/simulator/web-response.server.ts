import { HttpError } from "./security.server"

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ detail: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : String(error)
  return Response.json({ detail: message }, { status: 500 })
}
