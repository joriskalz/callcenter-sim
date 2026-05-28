import { AlertTriangleIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import type { ConfigIssue } from "../types"
import { Section } from "./section"

export function ConfigHelpPanel({
  issues,
  contactsError,
}: {
  issues: ConfigIssue[]
  contactsError: unknown
}) {
  const visibleIssues = issues.length
    ? issues
    : contactsError
      ? [dataverseRuntimeIssue(contactsError)]
      : []

  return (
    <Section
      title="Setup required"
      meta={`${visibleIssues.length} issue${visibleIssues.length === 1 ? "" : "s"}`}
    >
      <div className="grid gap-4 p-4">
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Monitor data is hidden until the simulator setup is complete.
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Contacts, active calls, and the event stream depend on monitor
              access plus server-side ACS, text-to-speech, and Dataverse
              settings. Add or fix the values below in your local `.env`, then
              let the dev server reload.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {visibleIssues.map((issue) => (
            <SetupIssueCard
              key={`${issue.area}-${issue.title}`}
              issue={issue}
            />
          ))}
        </div>
      </div>
    </Section>
  )
}

function SetupIssueCard({ issue }: { issue: ConfigIssue }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2">
            {issue.area}
          </Badge>
          <h3 className="text-sm font-semibold">{issue.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {issue.description}
          </p>
        </div>
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-4 rounded-md border bg-input/20 p-3">
        <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          .env values
        </div>
        <div className="grid gap-1.5">
          {issue.envVars.map((envVar) => (
            <code key={envVar} className="text-xs">
              {envVar}=
            </code>
          ))}
        </div>
      </div>

      {issue.learnUrl ? (
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="mt-4"
          render={
            <a href={issue.learnUrl} target="_blank" rel="noreferrer">
              Microsoft Learn
              <ExternalLinkIcon />
            </a>
          }
        />
      ) : null}
    </div>
  )
}

function dataverseRuntimeIssue(error: unknown): ConfigIssue {
  return {
    area: "Dataverse",
    title: "Dataverse request failed",
    description:
      error instanceof Error
        ? error.message
        : "The Dataverse Web API request failed. Check the URL, tenant, client id, client secret, app user permissions, and table/field names.",
    envVars: [
      "DATAVERSE_URL",
      "DATAVERSE_TENANT_ID",
      "DATAVERSE_CLIENT_ID",
      "DATAVERSE_CLIENT_SECRET",
      "DATAVERSE_CONTACT_FIELD_PREFIX",
    ],
    learnUrl:
      "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authentication",
  }
}
