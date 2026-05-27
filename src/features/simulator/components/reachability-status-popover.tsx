import { Popover } from "@base-ui/react/popover"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { reachabilityStatuses } from "../types"
import type { ReachabilityStatus } from "../types"
import { statusToneClass } from "./status-badge"

export function ReachabilityStatusPopover({
  value,
  onValueChange,
}: {
  value: ReachabilityStatus
  onValueChange: (value: ReachabilityStatus) => void
}) {
  const [open, setOpen] = React.useState(false)
  const currentOptionRef = React.useRef<HTMLButtonElement | null>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const label = statusLabel(value)

  const focusOption = (index: number) => {
    const optionCount = reachabilityStatuses.length
    const normalizedIndex = (index + optionCount) % optionCount
    optionRefs.current[normalizedIndex]?.focus()
  }

  const handlePopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const activeIndex = optionRefs.current.findIndex(
      (option) => option === document.activeElement
    )

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault()
      focusOption(activeIndex === -1 ? 0 : activeIndex + 1)
      return
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault()
      focusOption(
        activeIndex === -1 ? reachabilityStatuses.length - 1 : activeIndex - 1
      )
      return
    }

    if (event.key === "Home") {
      event.preventDefault()
      focusOption(0)
      return
    }

    if (event.key === "End") {
      event.preventDefault()
      focusOption(reachabilityStatuses.length - 1)
    }
  }

  const selectStatus = (nextValue: ReachabilityStatus) => {
    if (nextValue !== value) onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Contact reachability status: ${label}`}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "h-8 cursor-pointer gap-1.5 px-3 text-sm capitalize outline-none hover:bg-muted/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          statusToneClass(value)
        )}
      >
        <span>{label}</span>
        <ChevronDownIcon className="size-3.5 text-current opacity-70" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup
            initialFocus={() => currentOptionRef.current}
            className="w-64 origin-(--transform-origin) rounded-2xl bg-popover p-2 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            onKeyDown={handlePopupKeyDown}
          >
            <Popover.Title className="px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Reachability
            </Popover.Title>
            <div role="radiogroup" aria-label="Contact reachability status">
              {reachabilityStatuses.map((status, index) => {
                const checked = status === value
                return (
                  <button
                    key={status}
                    ref={(node) => {
                      optionRefs.current[index] = node
                      if (checked) currentOptionRef.current = node
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors outline-none hover:bg-accent focus:bg-accent focus:text-accent-foreground"
                    onClick={() => selectStatus(status)}
                  >
                    <StatusOption value={status} />
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-success opacity-0",
                        checked && "opacity-100"
                      )}
                    >
                      <CheckIcon className="size-4" />
                    </span>
                  </button>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function StatusOption({ value }: { value: ReachabilityStatus }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium capitalize">{statusLabel(value)}</span>
      <span className="text-xs text-muted-foreground">
        {statusDescription(value)}
      </span>
    </span>
  )
}

function statusLabel(value: ReachabilityStatus): string {
  return value.replaceAll("_", " ")
}

function statusDescription(value: ReachabilityStatus): string {
  switch (value) {
    case "reachable":
      return "Calls are answered normally."
    case "busy":
      return "Caller reaches a busy state."
    case "no_answer":
      return "Incoming calls are left unanswered."
    case "voicemail":
      return "Caller hears the voicemail scenario."
    case "disabled":
      return "Simulator will ignore this contact."
    case "unknown":
      return "No explicit behavior is set yet."
  }
}
