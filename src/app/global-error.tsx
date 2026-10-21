"use client"

import { RouteError } from "@/components/brand/route-error"

import "./globals.css"

/** Last resort when the root layout fails; it replaces the whole document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full">
        <title>Something went wrong | KTCord</title>
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  )
}
