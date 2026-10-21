import type { Metadata } from "next"
import Link from "next/link"

import { StatusScreen } from "@/components/brand/status-screen"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <StatusScreen
      title="This page wandered off"
      description="The link may be broken, or the page may have been removed."
      actions={
        <Button asChild size="lg" className="w-full">
          <Link href="/channels/me">Back to KTCord</Link>
        </Button>
      }
    />
  )
}
