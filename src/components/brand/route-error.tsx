"use client"

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

import { StatusScreen } from "./status-screen"

/** Fallback UI for a crashed route segment, with a retry and a way home. */
export function RouteError({ error, retry, inline = false }: { error: unknown; retry: () => void; inline?: boolean }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null

  return (
    <StatusScreen
      inline={inline}
      title="Something went wrong"
      description={
        <>
          <p>This part of KTCord hit an unexpected error. Trying again usually fixes it.</p>
          {digest && <p className="mt-2 font-mono text-xs">Error reference: {digest}</p>}
        </>
      }
      actions={
        <>
          <Button size="lg" className="w-full" onClick={retry}>
            Try Again
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/channels/me">Back to Home</Link>
          </Button>
        </>
      }
    />
  )
}
