import {
  LanguagesIcon,
  MessageSquareTextIcon,
  PauseIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import {
  localizedScenarioPreset,
  scenarioLanguageOption,
  scenarioLanguageOptions,
} from "../scenario-language"
import type { Scenario, ScenarioEvent, ScenarioLanguage } from "../types"
import { Section } from "./section"

export function ScenarioEditor({
  scenarios,
  isLoading,
  isSaving,
  saveError,
  onSave,
}: {
  scenarios: Record<string, Scenario>
  isLoading: boolean
  isSaving: boolean
  saveError: unknown
  onSave: (scenarios: Record<string, Scenario>) => void
}) {
  const [draft, setDraft] = React.useState<Record<string, Scenario>>(scenarios)
  const [selectedNumber, setSelectedNumber] = React.useState<string>("")
  const scenarioEntries = React.useMemo(
    () =>
      Object.entries(draft).sort(([, first], [, second]) =>
        first.name.localeCompare(second.name)
      ),
    [draft]
  )

  React.useEffect(() => {
    setDraft(scenarios)
    setSelectedNumber((current) =>
      current && Object.hasOwn(scenarios, current)
        ? current
        : (Object.keys(scenarios).sort()[0] ?? "")
    )
  }, [scenarios])

  const selectedScenario = selectedNumber ? draft[selectedNumber] : null
  const hasScenarios = scenarioEntries.length > 0

  const updateSelected = (updater: (scenario: Scenario) => Scenario) => {
    if (!selectedNumber || !selectedScenario) return
    setDraft((current) => ({
      ...current,
      [selectedNumber]: updater(current[selectedNumber] ?? selectedScenario),
    }))
  }

  const applyLanguage = (
    scenario: Scenario,
    language: ScenarioLanguage
  ): Scenario => {
    const option = scenarioLanguageOption(language)
    if (!scenario.answer) {
      return {
        ...scenario,
        language: option.code,
        locale: option.locale,
        voiceName: option.voiceName,
        events: [],
        messages: [],
        message: null,
      }
    }

    return {
      ...scenario,
      ...localizedScenarioPreset(scenario.name, option.code),
    }
  }

  const applyLanguageToAll = (language: ScenarioLanguage) => {
    setDraft((current) =>
      Object.fromEntries(
        Object.entries(current).map(([number, scenario]) => [
          number,
          applyLanguage(scenario, language),
        ])
      )
    )
  }

  const updateEvent = (index: number, event: ScenarioEvent) => {
    updateSelected((scenario) => ({
      ...scenario,
      events: scenario.events.map((currentEvent, currentIndex) =>
        currentIndex === index ? event : currentEvent
      ),
    }))
  }

  const addEvent = (event: ScenarioEvent) => {
    updateSelected((scenario) => ({
      ...scenario,
      events: [...scenario.events, event],
    }))
  }

  const removeEvent = (index: number) => {
    updateSelected((scenario) => ({
      ...scenario,
      events: scenario.events.filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }))
  }

  return (
    <Section
      title="Scenario Editor"
      meta={
        isLoading
          ? "Loading"
          : `${scenarioEntries.length} scenario${scenarioEntries.length === 1 ? "" : "s"}`
      }
    >
      <div className="grid gap-0 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="border-b p-3 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Scenarios
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasScenarios || isSaving}
              onClick={() => onSave(draft)}
            >
              <SaveIcon />
              Save
            </Button>
          </div>
          <div className="grid gap-1">
            {scenarioEntries.map(([number, scenario]) => (
              <button
                key={number}
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  selectedNumber === number && "bg-muted"
                )}
                onClick={() => setSelectedNumber(number)}
              >
                <span className="block truncate font-medium">
                  {scenario.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {number}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {selectedScenario ? (
            <>
              <div className="grid gap-3 border-b p-4 xl:grid-cols-[minmax(0,1fr)_14rem_14rem] xl:items-end">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Scenario name
                  </span>
                  <Input
                    value={selectedScenario.name}
                    onChange={(event) =>
                      updateSelected((scenario) => ({
                        ...scenario,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Language
                  </span>
                  <Select
                    value={selectedScenario.language}
                    onValueChange={(value) =>
                      updateSelected((scenario) =>
                        applyLanguage(scenario, value as ScenarioLanguage)
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarioLanguageOptions.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          {language.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Apply language to all
                  </span>
                  <Select
                    value={selectedScenario.language}
                    onValueChange={(value) =>
                      applyLanguageToAll(value as ScenarioLanguage)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarioLanguageOptions.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          {language.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <div className="flex flex-wrap items-center gap-3 xl:col-span-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={selectedScenario.answer}
                      onCheckedChange={(checked) =>
                        updateSelected((scenario) => ({
                          ...scenario,
                          answer: checked,
                          events: checked
                            ? scenario.events.length
                              ? scenario.events
                              : localizedScenarioPreset(
                                  scenario.name,
                                  scenario.language
                                ).events
                            : [],
                        }))
                      }
                      size="sm"
                    />
                    Answer call
                  </label>
                  <NumberField
                    label="Answer delay"
                    value={selectedScenario.answerDelaySeconds}
                    suffix="s"
                    onChange={(value) =>
                      updateSelected((scenario) => ({
                        ...scenario,
                        answerDelaySeconds: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Hangup after"
                    value={selectedScenario.hangupAfterSeconds ?? 0}
                    suffix="s"
                    onChange={(value) =>
                      updateSelected((scenario) => ({
                        ...scenario,
                        hangupAfterSeconds: value,
                      }))
                    }
                  />
                  <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <LanguagesIcon className="size-3.5" />
                    {selectedScenario.locale} / {selectedScenario.voiceName}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Call events</div>
                    <div className="text-xs text-muted-foreground">
                      Events run top to bottom when the call is connected.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addEvent({ type: "tts", text: "" })}
                      disabled={!selectedScenario.answer}
                    >
                      <MessageSquareTextIcon />
                      TTS
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addEvent({ type: "pause", seconds: 5 })}
                      disabled={!selectedScenario.answer}
                    >
                      <PauseIcon />
                      Pause
                    </Button>
                  </div>
                </div>

                {selectedScenario.answer && selectedScenario.events.length ? (
                  <div className="grid gap-2">
                    {selectedScenario.events.map((event, index) => (
                      <EventRow
                        key={`${index}-${event.type}`}
                        event={event}
                        index={index}
                        onChange={(nextEvent) => updateEvent(index, nextEvent)}
                        onRemove={() => removeEvent(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    {selectedScenario.answer
                      ? "No events configured"
                      : "This scenario leaves the call unanswered"}
                  </div>
                )}

                {saveError ? (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {saveError instanceof Error
                      ? saveError.message
                      : "Scenario save failed."}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              No scenarios available
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

function EventRow({
  event,
  index,
  onChange,
  onRemove,
}: {
  event: ScenarioEvent
  index: number
  onChange: (event: ScenarioEvent) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start">
      <div className="flex items-center gap-2 text-sm font-medium">
        {event.type === "tts" ? (
          <MessageSquareTextIcon className="size-4 text-success" />
        ) : (
          <PauseIcon className="size-4 text-warning" />
        )}
        {index + 1}. {event.type.toUpperCase()}
      </div>

      {event.type === "tts" ? (
        <textarea
          value={event.text}
          onChange={(changeEvent) =>
            onChange({ type: "tts", text: changeEvent.target.value })
          }
          rows={3}
          className="min-h-20 w-full resize-y rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="Text to speak"
        />
      ) : (
        <NumberField
          label="Pause"
          value={event.seconds}
          suffix="s"
          onChange={(value) => onChange({ type: "pause", seconds: value })}
        />
      )}

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={onRemove}
        aria-label="Remove event"
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid min-w-32 gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={0.5}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </span>
    </label>
  )
}
