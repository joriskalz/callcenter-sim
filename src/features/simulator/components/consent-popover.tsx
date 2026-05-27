import { Popover } from "@base-ui/react/popover"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  CircleSlashIcon,
  LoaderCircleIcon,
  MinusCircleIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  ShieldXIcon,
  XCircleIcon,
} from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  usePatchContactConsentMutation,
  useRemoveContactConsentMutation,
} from "../queries"
import type { ContactConsent } from "../types"

export function ConsentPopover({
  contactId,
  phoneNumber,
  consent,
  apiKey,
}: {
  contactId: string
  phoneNumber: string | null
  consent: ContactConsent | null
  apiKey: string
}) {
  const [open, setOpen] = React.useState(false)
  const patchMutation = usePatchContactConsentMutation(apiKey)
  const removeMutation = useRemoveContactConsentMutation(apiKey)
  const isPending = patchMutation.isPending || removeMutation.isPending
  const isError = patchMutation.isError || removeMutation.isError
  const current = consent?.value ?? "unknown"

  const setConsent = (value: "opted_in" | "opted_out") => {
    patchMutation.mutate({ contactId, patch: { value } })
  }

  const removeConsent = () => {
    removeMutation.mutate({ contactId })
  }

  React.useEffect(() => {
    if (patchMutation.isSuccess || removeMutation.isSuccess) setOpen(false)
  }, [patchMutation.isSuccess, removeMutation.isSuccess])

  React.useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Voice consent: ${consentLabel(current)}`}
        disabled={!phoneNumber}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full border bg-input/30 text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          consentTone(current)
        )}
      >
        <ConsentIcon value={current} className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup
            className="w-80 origin-(--transform-origin) rounded-2xl bg-popover p-3 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
          >
            <Popover.Title className="text-sm font-medium">
              Voice consent
            </Popover.Title>
            <Popover.Description className="mt-1 text-xs text-muted-foreground">
              {phoneNumber ?? "No business phone number"}
            </Popover.Description>

            <div
              className={cn(
                "mt-3 rounded-xl border bg-input/20 p-3",
                consentSurfaceTone(current)
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-background",
                    consentTone(current)
                  )}
                >
                  <ConsentIcon value={current} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Current status
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", consentTone(current))}
                    >
                      {consentLabel(current)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {consentStatusDescription(current)}
                  </div>
                  <div className="mt-1 text-xs break-words text-muted-foreground">
                    {consentRecordDescription(consent)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Change status
              </div>
              <div className="grid gap-2">
                <ConsentActionButton
                  icon={CheckCircle2Icon}
                  title="Opt in"
                  description="Allow voice contact for this number."
                  selected={current === "opted_in"}
                  tone="success"
                  disabled={!phoneNumber || isPending}
                  onClick={() => setConsent("opted_in")}
                />
                <ConsentActionButton
                  icon={XCircleIcon}
                  title="Opt out"
                  description="Block voice contact for this number."
                  selected={current === "opted_out"}
                  tone="destructive"
                  disabled={!phoneNumber || isPending}
                  onClick={() => setConsent("opted_out")}
                />
              </div>
            </div>

            <div className="mt-3 border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2 text-muted-foreground disabled:opacity-60"
                disabled={!phoneNumber || !consent?.id || isPending}
                onClick={removeConsent}
              >
                <MinusCircleIcon className="size-4" />
                <span className="grid text-left">
                  <span className="text-sm font-medium">
                    Remove consent record
                  </span>
                  <span className="text-xs">
                    {consent?.id
                      ? "Clear the Dataverse consent row."
                      : "No Dataverse record to remove."}
                  </span>
                </span>
              </Button>
            </div>

            <ConsentMutationState
              isPending={isPending}
              isError={isError}
              error={patchMutation.error ?? removeMutation.error}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ConsentActionButton({
  icon: Icon,
  title,
  description,
  selected,
  tone,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  selected: boolean
  tone: "success" | "destructive"
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors outline-none hover:bg-input/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        selected &&
          tone === "success" &&
          "border-success/35 bg-success/10 text-success",
        selected &&
          tone === "destructive" &&
          "border-destructive/35 bg-destructive/10 text-destructive"
      )}
    >
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
        {selected ? (
          <Icon className="size-4" />
        ) : (
          <CircleIcon className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

function ConsentMutationState({
  isPending,
  isError,
  error,
}: {
  isPending: boolean
  isError: boolean
  error: unknown
}) {
  if (isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        Saving consent
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-3 flex items-start gap-2 text-xs text-destructive">
        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {error instanceof Error ? error.message : "Consent update failed."}
        </span>
      </div>
    )
  }

  return null
}

function ConsentIcon({
  value,
  className,
}: {
  value: ContactConsent["value"] | "unknown"
  className?: string
}) {
  if (value === "opted_in") return <ShieldCheckIcon className={className} />
  if (value === "opted_out") return <ShieldXIcon className={className} />
  if (value === "not_set") return <CircleSlashIcon className={className} />
  return <ShieldQuestionIcon className={className} />
}

function consentLabel(value: ContactConsent["value"] | "unknown"): string {
  switch (value) {
    case "opted_in":
      return "Opted in"
    case "opted_out":
      return "Opted out"
    case "not_set":
      return "Not set"
    case "unknown":
      return "No consent"
  }
}

function consentStatusDescription(
  value: ContactConsent["value"] | "unknown"
): string {
  switch (value) {
    case "opted_in":
      return "Voice calls are allowed."
    case "opted_out":
      return "Voice calls are blocked."
    case "not_set":
      return "No explicit voice preference is set."
    case "unknown":
      return "No consent status is available yet."
  }
}

function consentRecordDescription(consent: ContactConsent | null): string {
  if (!consent?.id) return "No Dataverse consent record exists yet."
  return consent.reason || "Consent record stored in Dataverse."
}

function consentTone(value: ContactConsent["value"] | "unknown"): string {
  if (value === "opted_in") return "border-success/35 text-success"
  if (value === "opted_out") return "border-destructive/35 text-destructive"
  if (value === "not_set") return "border-warning/35 text-warning"
  return "border-border"
}

function consentSurfaceTone(
  value: ContactConsent["value"] | "unknown"
): string {
  if (value === "opted_in") return "border-success/25 bg-success/5"
  if (value === "opted_out") return "border-destructive/25 bg-destructive/5"
  if (value === "not_set") return "border-warning/25 bg-warning/5"
  return "border-border bg-input/20"
}
