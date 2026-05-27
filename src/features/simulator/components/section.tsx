import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function Section({
  title,
  meta,
  children,
  className,
}: {
  title: string
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta ? (
          <div className="text-sm text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {children}
    </section>
  )
}
