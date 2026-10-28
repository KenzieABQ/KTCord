"use client"

import { AtSignIcon, MessageSquareXIcon, PlusIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "@/lib/toast"

import { SettingsSection } from "@/components/settings/settings-layout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api/errors"
import type { AutomodRule } from "@/lib/api/moderation"
import {
  AUTOMOD_KEYWORD_MAX_LENGTH,
  AUTOMOD_KEYWORD_RULE_LIMIT,
  AUTOMOD_MAX_ALLOWED,
  AUTOMOD_MAX_KEYWORDS,
  DEFAULT_MENTION_LIMIT,
  parseWordList,
} from "@/lib/automod"
import { hasPermission, Permission } from "@/lib/permissions"
import {
  useAutomodRules,
  useDeleteAutomodRule,
  useSaveAutomodRule,
  useToggleAutomodRule,
} from "@/lib/queries/moderation"
import { useRoles, useServerPermissions } from "@/lib/queries/servers"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

type Editing = { kind: AutomodRule["kind"]; rule?: AutomodRule }

function RuleDialog({
  serverId,
  editing,
  onClose,
}: {
  serverId: string
  editing: Editing
  onClose: () => void
}) {
  const { rule, kind } = editing
  const { data: roles } = useRoles(serverId)
  const save = useSaveAutomodRule(serverId)
  const remove = useDeleteAutomodRule(serverId)
  const [name, setName] = useState(rule?.name ?? (kind === "keyword" ? "Custom Words" : "Block Mention Spam"))
  const [keywords, setKeywords] = useState(rule?.keywords.join(", ") ?? "")
  const [allowed, setAllowed] = useState(rule?.allow_list.join(", ") ?? "")
  const [limit, setLimit] = useState(String(rule?.mention_limit ?? DEFAULT_MENTION_LIMIT))
  const [exempt, setExempt] = useState<string[]>(rule?.exempt_role_ids ?? [])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const words = parseWordList(keywords)
  const allowWords = parseWordList(allowed)
  const limitNumber = Number(limit)
  const error =
    !name.trim()
      ? "Give the rule a name."
      : kind === "keyword" && words.words.length === 0
        ? "Add at least one word to block."
        : kind === "keyword" && words.words.length > AUTOMOD_MAX_KEYWORDS
          ? `A rule can block up to ${AUTOMOD_MAX_KEYWORDS} words.`
          : allowWords.words.length > AUTOMOD_MAX_ALLOWED
            ? `A rule can allow up to ${AUTOMOD_MAX_ALLOWED} words.`
            : words.tooLong || allowWords.tooLong
              ? `Words can be up to ${AUTOMOD_KEYWORD_MAX_LENGTH} characters.`
              : kind === "mention_spam" && !(Number.isInteger(limitNumber) && limitNumber >= 1 && limitNumber <= 50)
                ? "The limit must be a whole number from 1 to 50."
                : null
  const [showError, setShowError] = useState(false)

  function submit() {
    if (error) {
      setShowError(true)
      return
    }
    save.mutate(
      {
        id: rule?.id,
        input: {
          name: name.trim(),
          kind,
          enabled: rule?.enabled ?? true,
          keywords: kind === "keyword" ? words.words : [],
          allow_list: kind === "keyword" ? allowWords.words : [],
          mention_limit: kind === "mention_spam" ? limitNumber : null,
          exempt_role_ids: exempt,
        },
      },
      {
        onSuccess: () => {
          toast.success(rule ? "Rule saved." : "Rule created.")
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  const assignable = (roles ?? []).filter((r) => !r.is_default).sort((a, b) => b.position - a.position)

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-chat p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {rule ? "Edit Rule" : kind === "keyword" ? "Create Keyword Rule" : "Set Up Mention Spam"}
            </DialogTitle>
            <DialogDescription>
              {kind === "keyword"
                ? "Messages with any of these words are blocked before anyone sees them."
                : "Messages that mention too many different people or roles are blocked."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="automod-rule"
            className="mt-2 flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field>
              <FieldLabel htmlFor="automod-name" className={labelClass}>
                Rule name
              </FieldLabel>
              <Input
                id="automod-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                className="bg-input"
              />
            </Field>

            {kind === "keyword" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="automod-keywords" className={labelClass}>
                    Words to block
                  </FieldLabel>
                  <Textarea
                    id="automod-keywords"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="cat*, *dog, *bird*, bad phrase"
                    rows={4}
                    className="bg-input"
                  />
                  <FieldDescription>
                    Separate with commas. Use * as a wildcard: <code>cat*</code> matches &ldquo;catapult&rdquo;,{" "}
                    <code>*cat</code> matches &ldquo;bobcat&rdquo;, and <code>*cat*</code> matches anything with
                    &ldquo;cat&rdquo; in it.
                    <span className="mt-1 block text-right tabular-nums">
                      {words.words.length} / {AUTOMOD_MAX_KEYWORDS}
                    </span>
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="automod-allowed" className={labelClass}>
                    Allowed words
                  </FieldLabel>
                  <Textarea
                    id="automod-allowed"
                    value={allowed}
                    onChange={(e) => setAllowed(e.target.value)}
                    placeholder="concatenate, scatter"
                    rows={2}
                    className="bg-input"
                  />
                  <FieldDescription>
                    These never trigger the rule, even when they match a wildcard.
                    <span className="mt-1 block text-right tabular-nums">
                      {allowWords.words.length} / {AUTOMOD_MAX_ALLOWED}
                    </span>
                  </FieldDescription>
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="automod-limit" className={labelClass}>
                  Mention limit
                </FieldLabel>
                <Input
                  id="automod-limit"
                  type="number"
                  min={1}
                  max={50}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-28 bg-input"
                />
                <FieldDescription>
                  The most unique people and roles one message can mention (1–50).
                </FieldDescription>
              </Field>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className={`${labelClass} mb-2`}>Exempt roles</legend>
              {assignable.length === 0 ? (
                <p className="text-sm text-muted-foreground">This server has no roles to exempt yet.</p>
              ) : (
                <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-md bg-sidebar p-2">
                  {assignable.map((role) => (
                    <li key={role.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-item-hover">
                        <Checkbox
                          checked={exempt.includes(role.id)}
                          onCheckedChange={(on) =>
                            setExempt((list) => (on ? [...list, role.id] : list.filter((id) => id !== role.id)))
                          }
                        />
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                        <span className="truncate text-foreground">{role.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Members with Manage Server or Administrator are always exempt.
              </p>
            </fieldset>

            {showError && error && <FieldError>{error}</FieldError>}
          </form>

          <div className="mt-2 flex items-center justify-between gap-2">
            {rule ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Rule
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" form="automod-rule" disabled={save.isPending}>
                {rule ? "Save Changes" : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-chat">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{rule?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>AutoMod will stop enforcing this rule. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/80"
              onClick={() =>
                rule &&
                remove.mutate(rule.id, {
                  onSuccess: () => {
                    toast.success("Rule deleted.")
                    onClose()
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RuleCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-header">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function RuleControls({
  rule,
  onEdit,
  onToggle,
}: {
  rule: AutomodRule
  onEdit: () => void
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Button variant="secondary" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Switch checked={rule.enabled} onCheckedChange={onToggle} aria-label={`${rule.name} enabled`} />
    </div>
  )
}

function keywordSummary(rule: AutomodRule) {
  const shown = rule.keywords.slice(0, 4).join(", ")
  const more = rule.keywords.length - 4
  return more > 0 ? `${shown} and ${more} more` : shown
}

/** Server Settings → AutoMod: block messages with chosen words or too many mentions. */
export function AutomodSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { permissions } = useServerPermissions(serverId)
  const allowed = hasPermission(permissions, Permission.MANAGE_SERVER)
  const { data: rules, isPending } = useAutomodRules(serverId, allowed)
  const toggle = useToggleAutomodRule(serverId)
  const [editing, setEditing] = useState<Editing | null>(null)

  if (!allowed) {
    return (
      <SettingsSection title="AutoMod">
        <p className="text-muted-foreground">You need the Manage Server permission to set up AutoMod.</p>
      </SettingsSection>
    )
  }

  const onToggle = (rule: AutomodRule) => (enabled: boolean) =>
    toggle.mutate(
      { id: rule.id, enabled },
      { onError: (e) => toast.error(errorMessage(e)) }
    )
  const mentionRule = rules?.find((r) => r.kind === "mention_spam")
  const keywordRules = rules?.filter((r) => r.kind === "keyword") ?? []

  return (
    <SettingsSection
      title="AutoMod"
      description="AutoMod blocks messages with words or mentions you don't want in your server, before anyone sees them."
    >
      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-item-selected/60" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="automod-mentions" className="flex flex-col gap-3">
            <h2 id="automod-mentions" className={labelClass}>
              Mention spam
            </h2>
            <RuleCard
              icon={<AtSignIcon className="size-5" />}
              title={mentionRule?.name ?? "Block Mention Spam"}
              description={
                mentionRule
                  ? `Blocks messages with more than ${mentionRule.mention_limit} unique mentions.`
                  : "Block messages that mention lots of people or roles at once."
              }
            >
              {mentionRule ? (
                <RuleControls
                  rule={mentionRule}
                  onEdit={() => setEditing({ kind: "mention_spam", rule: mentionRule })}
                  onToggle={onToggle(mentionRule)}
                />
              ) : (
                <Button size="sm" onClick={() => setEditing({ kind: "mention_spam" })}>
                  Set Up
                </Button>
              )}
            </RuleCard>
          </section>

          <section aria-labelledby="automod-keywords-heading" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="automod-keywords-heading" className={labelClass}>
                Custom words · {keywordRules.length} / {AUTOMOD_KEYWORD_RULE_LIMIT}
              </h2>
              <Button
                size="sm"
                variant="secondary"
                disabled={keywordRules.length >= AUTOMOD_KEYWORD_RULE_LIMIT}
                onClick={() => setEditing({ kind: "keyword" })}
              >
                <PlusIcon /> Create Keyword Rule
              </Button>
            </div>
            {keywordRules.length === 0 ? (
              <RuleCard
                icon={<MessageSquareXIcon className="size-5" />}
                title="Block Custom Words"
                description="Block messages with words or phrases you choose, with wildcards and exceptions."
              >
                <Button size="sm" onClick={() => setEditing({ kind: "keyword" })}>
                  Set Up
                </Button>
              </RuleCard>
            ) : (
              keywordRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  icon={<MessageSquareXIcon className="size-5" />}
                  title={rule.name}
                  description={`Blocks: ${keywordSummary(rule)}`}
                >
                  <RuleControls
                    rule={rule}
                    onEdit={() => setEditing({ kind: "keyword", rule })}
                    onToggle={onToggle(rule)}
                  />
                </RuleCard>
              ))
            )}
          </section>
        </div>
      )}

      {editing && (
        <RuleDialog
          key={editing.rule?.id ?? editing.kind}
          serverId={serverId}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsSection>
  )
}
