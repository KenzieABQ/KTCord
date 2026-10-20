import type { Metadata } from "next"

import { FriendsView } from "@/components/friends/friends-view"

export const metadata: Metadata = { title: "Friends" }

export default function HomePage() {
  return <FriendsView />
}
