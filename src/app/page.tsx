import { redirect } from "next/navigation"

// proxy.ts routes "/" to /channels/me or /login; this is the fallback.
export default function RootPage() {
  redirect("/channels/me")
}
