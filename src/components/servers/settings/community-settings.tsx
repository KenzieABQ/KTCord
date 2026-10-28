"use client"

import { PlusIcon, SmilePlusIcon, XIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Emoji } from "@/components/chat/emoji"
import { EmojiPickerPopover } from "@/components/chat/emoji-picker"
import { welcomeChannels, type WelcomeChannel } from "@/components/servers/onboarding"
import { SettingsSection, SettingsToggle, UnsavedChangesBar } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { JoinedServer } from "@/lib/api/servers"
import { errorMessage } from "@/lib/api/errors"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannels, useServer, useServerPermissions, useUpdateServer } from "@/lib/queries/servers"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"
const MAX_WELCOME_CHANNELS = 5
const MAX_RULES = 20

/** What a vanity code may look like (mirrors servers_community_shape). */
export function vanityProblem(code: string): string | null {
  if (!code) return null
  if (!/^[a-z0-9-]+$/.test(code)) return "Use lowercase letters, numbers and dashes."
  if (code.length < 3 || code.length > 32) return "Use 3 to 32 characters."
  if (code.startsWith("-") || code.endsWith("-")) return "It can't start or end with a dash."
  return null
}

function Community({ server }: { server: JoinedServer }) {
  const update = useUpdateServer(server.id)
  const { data: channels } = useChannels(server.id)
  const [welcomeEnabled, setWelcomeEnabled] = useState(server.welcome_enabled)
  const [description, setDescription] = useState(server.description ?? "")
  const [picks, setPicks] = useState<WelcomeChannel[]>(welcomeChannels(server))
  const [rulesEnabled, setRulesEnabled] = useState(server.rules_enabled)
  const [rules, setRules] = useState<string[]>(server.rules)
  const [vanity, setVanity] = useState(server.vanity_code ?? "")

  const pickable = (channels ?? []).filter((c) => c.type !== "category")
  const cleanRules = rules.map((r) => r.trim()).filter(Boolean)
  const cleanPicks = picks.filter((p) => p.channel_id)
  const vanityError = vanityProblem(vanity)
  const patch = {
    welcome_enabled: welcomeEnabled,
    description: description.trim() || null,
    welcome_channels: cleanPicks,
    rules_enabled: rulesEnabled && cleanRules.length > 0,
    rules: cleanRules,
    vanity_code: vanity || null,
  }
  const dirty =
    patch.welcome_enabled !== server.welcome_enabled ||
    patch.description !== (server.description ?? null) ||
    JSON.stringify(cleanPicks) !== JSON.stringify(welcomeChannels(server)) ||
    patch.rules_enabled !== server.rules_enabled ||
    JSON.stringify(cleanRules) !== JSON.stringify(server.rules) ||
    patch.vanity_code !== server.vanity_code

  function reset() {
    setWelcomeEnabled(server.welcome_enabled)
    setDescription(server.description ?? "")
    setPicks(welcomeChannels(server))
    setRulesEnabled(server.rules_enabled)
    setRules(server.rules)
    setVanity(server.vanity_code ?? "")
  }

  function save() {
    if (vanityError) return toast.error(vanityError)
    update.mutate(patch, {
      onSuccess: () => toast.success("Saved."),
      onError: (e) =>
        toast.error(/duplicate|already taken/i.test(errorMessage(e)) ? "That vanity link is taken." : errorMessage(e)),
    })
  }

  return (
    <>
      <SettingsSection title="Welcome Screen" description="Greet new members with what this server is about and where to start.">
        <SettingsToggle
          id="welcome-enabled"
          label="Show the welcome screen"
          description="New members see it the first time they open the server."
          checked={welcomeEnabled}
          onCheckedChange={setWelcomeEnabled}
        />
        <Field className="mt-4">
          <FieldLabel htmlFor="server-description" className={labelClass}>
            Server description
          </FieldLabel>
          <Textarea
            id="server-description"
            value={description}
            maxLength={300}
            rows={3}
            placeholder="What's this server about?"
            onChange={(e) => setDescription(e.target.value)}
          />
          <FieldDescription className="text-right text-xs">{description.length}/300</FieldDescription>
        </Field>
        <div className="mt-4">
          <p className={labelClass}>Recommended channels</p>
          <ul className="mt-2 flex flex-col gap-2">
            {picks.map((pick, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-sidebar p-2">
                <EmojiPickerPopover side="right" align="start" onPick={(emoji) => setPicks(picks.map((p, j) => (j === i ? { ...p, emoji } : p)))}>
                  <button
                    type="button"
                    aria-label="Channel emoji"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-input text-interactive hover:text-interactive-hover"
                  >
                    {pick.emoji ? <Emoji value={pick.emoji} /> : <SmilePlusIcon className="size-4" />}
                  </button>
                </EmojiPickerPopover>
                <Select value={pick.channel_id} onValueChange={(channel_id) => setPicks(picks.map((p, j) => (j === i ? { ...p, channel_id } : p)))}>
                  <SelectTrigger className="w-44 bg-input" aria-label="Channel">
                    <SelectValue placeholder="Pick a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickable.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.type === "voice" ? "🔊 " : "#"}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={pick.description}
                  maxLength={50}
                  placeholder="What's it for?"
                  aria-label="Channel description"
                  onChange={(e) => setPicks(picks.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)))}
                  className="min-w-40 flex-1 bg-input"
                />
                <button
                  type="button"
                  aria-label="Remove channel"
                  onClick={() => setPicks(picks.filter((_, j) => j !== i))}
                  className="rounded text-interactive hover:text-interactive-hover"
                >
                  <XIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {picks.length < MAX_WELCOME_CHANNELS && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setPicks([...picks, { channel_id: "", description: "", emoji: null }])}
            >
              <PlusIcon /> Add Channel
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Rules" description="New members read and accept these before they can send messages or join voice.">
        <SettingsToggle
          id="rules-enabled"
          label="Require new members to accept the rules"
          description="People who are already here aren't affected."
          checked={rulesEnabled}
          onCheckedChange={setRulesEnabled}
        />
        <ol className="mt-4 flex flex-col gap-2">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-right text-sm font-bold text-header">{i + 1}.</span>
              <Textarea
                value={rule}
                maxLength={300}
                rows={1}
                aria-label={`Rule ${i + 1}`}
                onChange={(e) => setRules(rules.map((r, j) => (j === i ? e.target.value : r)))}
                className="min-h-9 resize-none"
              />
              <button
                type="button"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
                className="mt-2 rounded text-interactive hover:text-interactive-hover"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        {rules.length < MAX_RULES && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setRules([...rules, ""])}>
            <PlusIcon /> Add Rule
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title="Vanity URL" description="A memorable invite link that never expires.">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">{typeof window !== "undefined" ? window.location.host : ""}/invite/</span>
          <Input
            value={vanity}
            maxLength={32}
            placeholder="your-server"
            aria-label="Vanity code"
            aria-invalid={Boolean(vanityError)}
            onChange={(e) => setVanity(e.target.value.toLowerCase().replace(/\s/g, "-"))}
          />
        </div>
        {vanityError && <p className="mt-1.5 text-sm text-destructive">{vanityError}</p>}
      </SettingsSection>

      {dirty && <UnsavedChangesBar onReset={reset} onSave={save} saving={update.isPending} />}
    </>
  )
}

/** Server Settings → Community: welcome screen, rules and vanity URL. */
export function CommunitySettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { data: server } = useServer(serverId)
  const { permissions } = useServerPermissions(serverId)
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    return (
      <SettingsSection title="Community">
        <p className="text-muted-foreground">You need the Manage Server permission for this page.</p>
      </SettingsSection>
    )
  }
  if (!server) return null
  return (
    <Community
      key={`${server.welcome_enabled}:${server.description}:${JSON.stringify(server.welcome_channels)}:${server.rules_enabled}:${server.rules.join("|")}:${server.vanity_code}`}
      server={server}
    />
  )
}
