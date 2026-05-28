import { Popover } from "@base-ui/react/popover"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { Scenario } from "../types"

export type ScenarioOption = Pick<
  Scenario,
  | "name"
  | "answer"
  | "answerDelaySeconds"
  | "hangupAfterSeconds"
  | "message"
  | "messages"
  | "events"
  | "language"
>

export function ScenarioPopover({
  value,
  options,
  onValueChange,
}: {
  value: string
  options: ScenarioOption[]
  onValueChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const currentOptionRef = React.useRef<HTMLButtonElement | null>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const normalizedOptions = React.useMemo(
    () => ensureScenarioOption(options, value),
    [options, value]
  )

  const focusOption = (index: number) => {
    const optionCount = normalizedOptions.length
    if (!optionCount) return
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
        activeIndex === -1 ? normalizedOptions.length - 1 : activeIndex - 1
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
      focusOption(normalizedOptions.length - 1)
    }
  }

  const selectScenario = (nextValue: string) => {
    if (nextValue !== value) onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Contact scenario: ${value}`}
        className={cn(
          badgeVariants({ variant: "outline" }),
          "h-8 max-w-64 cursor-pointer justify-between gap-2 px-3 text-sm outline-none hover:bg-muted/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        <span className="min-w-0 truncate">{value}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
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
            className="w-80 origin-(--transform-origin) rounded-2xl bg-popover p-2 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            onKeyDown={handlePopupKeyDown}
          >
            <Popover.Title className="px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Scenario
            </Popover.Title>
            <div role="radiogroup" aria-label="Contact scenario">
              {normalizedOptions.map((scenario, index) => {
                const checked = scenario.name === value
                return (
                  <button
                    key={scenario.name}
                    ref={(node) => {
                      optionRefs.current[index] = node
                      if (checked) currentOptionRef.current = node
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors outline-none hover:bg-accent focus:bg-accent focus:text-accent-foreground"
                    onClick={() => selectScenario(scenario.name)}
                  >
                    <ScenarioOptionContent scenario={scenario} />
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

function ScenarioOptionContent({ scenario }: { scenario: ScenarioOption }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">{scenario.name}</span>
      <span className="text-xs text-muted-foreground">
        {scenarioDescription(scenario)}
      </span>
    </span>
  )
}

function scenarioDescription(scenario: ScenarioOption): string {
  if (!scenario.answer) return "Leaves the incoming call unanswered."

  const timing =
    scenario.answerDelaySeconds > 0
      ? `Answers after ${formatSeconds(scenario.answerDelaySeconds)}`
      : "Answers immediately"
  const hangup =
    scenario.hangupAfterSeconds == null
      ? "no automatic hangup"
      : `hangs up after ${formatSeconds(scenario.hangupAfterSeconds)}`
  const messageCount = scenario.messages.length
  const message =
    messageCount > 1
      ? `plays ${messageCount} TTS messages`
      : scenario.message
        ? "plays TTS"
        : "no TTS message"

  return `${timing}, ${message}, ${hangup}.`
}

function formatSeconds(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`
}

function ensureScenarioOption(
  options: ScenarioOption[],
  current: string
): ScenarioOption[] {
  if (!current || options.some((option) => option.name === current)) {
    return options
  }

  return [
    {
      name: current,
      answer: true,
      answerDelaySeconds: 0,
      hangupAfterSeconds: null,
      message: null,
      messages: [],
      events: [],
      language: "de",
    },
    ...options,
  ]
}
