"use client"

import { ProfileEditor } from "@/components/profile/profile-editor"
import { SettingsSection } from "@/components/settings/settings-layout"
import { useMyProfile } from "@/lib/queries/profiles"

export default function ProfileSettingsPage() {
  const { data: profile } = useMyProfile()
  if (!profile) return null

  return (
    <SettingsSection title="Profiles" description="How you appear to everyone on KTCord.">
      <ProfileEditor profile={profile} />
    </SettingsSection>
  )
}
