"use client"

import { format, formatDistanceToNowStrict } from "date-fns"
import { TrashIcon } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "@/lib/toast"

import { SplashScreen } from "@/components/brand/splash-screen"
import {
  SettingsLayout,
  SettingsSection,
  UnsavedChangesBar,
  type SettingsNavGroup,
} from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/api/errors"
import { uploadServerIcon } from "@/lib/api/storage"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import {
  useDeleteServer,
  useInvites,
  useMembers,
  useRevokeInvite,
  useServer,
  useServerPermissions,
  useUpdateServer,
} from "@/lib/queries/servers"

import { BannerPicker, IconPicker } from "./server-dialogs"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

function useServerIdParam() {
  return useParams<{ serverId: string }>().serverId
}

/** Full-page Server Settings frame. Sections appear only to members with the matching permission. */
export function ServerSettingsShell({ children }: { children: ReactNode }) {
  const serverId = useServerIdParam()
  const router = useRouter()
  const { data: server, isPending } = useServer(serverId)
  const { ready, permissions } = useServerPermissions(serverId)
  const can = (bit: number) => hasPermission(permissions, bit)

  useEffect(() => {
    if (!isPending && !server) router.replace("/channels/me")
  }, [isPending, server, router])

  if (!server || !ready) return <SplashScreen message="Loading settings…" />

  const base = `/servers/${serverId}/settings`
  const items = [
    can(Permission.MANAGE_SERVER) && { href: `${base}/overview`, label: "Overview" },
    can(Permission.MANAGE_ROLES) && { href: `${base}/roles`, label: "Roles" },
    can(Permission.MANAGE_EXPRESSIONS) && { href: `${base}/emoji`, label: "Emoji" },
    can(Permission.MANAGE_SERVER) && { href: `${base}/community`, label: "Community" },
  ].filter(Boolean) as SettingsNavGroup["items"]
  const managementItems = [
    [Permission.MANAGE_ROLES, Permission.KICK_MEMBERS, Permission.BAN_MEMBERS, Permission.MODERATE_MEMBERS].some(can) && {
      href: `${base}/members`,
      label: "Members",
    },
    can(Permission.MANAGE_SERVER) && { href: `${base}/invites`, label: "Invites" },
    can(Permission.BAN_MEMBERS) && { href: `${base}/bans`, label: "Bans" },
  ].filter(Boolean) as SettingsNavGroup["items"]
  const moderationItems = [
    can(Permission.MANAGE_SERVER) && { href: `${base}/automod`, label: "AutoMod" },
    can(Permission.VIEW_AUDIT_LOG) && { href: `${base}/audit-log`, label: "Audit Log" },
  ].filter(Boolean) as SettingsNavGroup["items"]

  const nav: SettingsNavGroup[] = [
    { heading: server.name, items },
    { heading: "Moderation", items: moderationItems },
    { heading: "User Management", items: managementItems },
  ].filter((group) => group.items.length > 0)

  return (
    <SettingsLayout nav={nav} closeHref={`/channels/${serverId}`}>
      {nav.length > 0 ? (
        children
      ) : (
        <SettingsSection title="Server Settings">
          <p className="text-muted-foreground">You don&apos;t have permission to manage this server.</p>
        </SettingsSection>
      )}
    </SettingsLayout>
  )
}

/** Wraps a settings page that needs MANAGE_SERVER. */
function RequireManageServer({ children }: { children: ReactNode }) {
  const serverId = useServerIdParam()
  const { permissions } = useServerPermissions(serverId)
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    return (
      <SettingsSection title="Server Settings">
        <p className="text-muted-foreground">You need the Manage Server permission for this page.</p>
      </SettingsSection>
    )
  }
  return children
}

function DeleteServerDialog({
  open,
  onOpenChange,
  serverId,
  serverName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  serverName: string
}) {
  const router = useRouter()
  const deleteServer = useDeleteServer()
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (typed.trim() !== serverName) {
      setError("You didn't enter the server name correctly.")
      return
    }
    try {
      await deleteServer.mutateAsync(serverId)
      router.replace("/channels/me")
      toast.success(`Deleted ${serverName}.`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &apos;{serverName}&apos;</DialogTitle>
          <DialogDescription>
            Are you sure? This deletes every channel, message and role in the server. It can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="confirm-server-name" className={labelClass}>
            Enter server name
          </FieldLabel>
          <Input
            id="confirm-server-name"
            value={typed}
            autoFocus
            onChange={(e) => {
              setTyped(e.target.value)
              setError(null)
            }}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <DialogFooter className="-mx-6 -mb-6 mt-2 rounded-b-xl bg-sidebar px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/80"
            onClick={confirm}
            disabled={deleteServer.isPending}
          >
            Delete Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ServerOverviewSettings() {
  return (
    <RequireManageServer>
      <ServerOverviewForm />
    </RequireManageServer>
  )
}

function ServerOverviewForm() {
  const serverId = useServerIdParam()
  const { data: server } = useServer(serverId)
  const { isOwner } = useServerPermissions(serverId)
  const updateServer = useUpdateServer(serverId)

  const [name, setName] = useState(server?.name ?? "")
  const [icon, setIcon] = useState<{ blob: Blob; url: string } | "remove" | null>(null)
  const [banner, setBanner] = useState<{ blob: Blob; url: string } | "remove" | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!icon || icon === "remove") return
    return () => URL.revokeObjectURL(icon.url)
  }, [icon])
  useEffect(() => {
    if (!banner || banner === "remove") return
    return () => URL.revokeObjectURL(banner.url)
  }, [banner])

  if (!server) return null
  const dirty = name.trim() !== server.name || icon !== null || banner !== null
  const previewUrl = icon === "remove" ? null : icon ? icon.url : server.icon_url
  const bannerPreview = banner === "remove" ? null : banner ? banner.url : server.banner_url

  async function save() {
    if (name.trim().length < 2) {
      toast.error("Server names need at least 2 characters.")
      return
    }
    setSaving(true)
    try {
      let iconUrl = server!.icon_url
      if (icon === "remove") iconUrl = null
      else if (icon) iconUrl = await uploadServerIcon(serverId, icon.blob)
      let bannerUrl = server!.banner_url
      if (banner === "remove") bannerUrl = null
      else if (banner) bannerUrl = await uploadServerIcon(serverId, banner.blob)
      await updateServer.mutateAsync({ name: name.trim(), icon_url: iconUrl, banner_url: bannerUrl })
      setIcon(null)
      setBanner(null)
      toast.success("Server updated.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SettingsSection title="Server Overview">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <IconPicker
              previewUrl={previewUrl}
              onPicked={(blob) => setIcon({ blob, url: URL.createObjectURL(blob) })}
              label="Change"
            />
            {previewUrl && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => setIcon("remove")}
              >
                Remove
              </button>
            )}
            <p className="max-w-32 text-center text-xs text-muted-foreground">
              We recommend an image of at least 512×512.
            </p>
          </div>
          <Field className="flex-1">
            <FieldLabel htmlFor="server-name-setting" className={labelClass}>
              Server name
            </FieldLabel>
            <Input
              id="server-name-setting"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-8">
          <p className={labelClass}>Server Banner</p>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Shown at the top of the channel list. 960×540 or larger works best; GIFs play.
          </p>
          <BannerPicker
            previewUrl={bannerPreview}
            onPicked={(blob) => setBanner({ blob, url: URL.createObjectURL(blob) })}
            onRemove={bannerPreview ? () => setBanner("remove") : undefined}
          />
        </div>
        {dirty && (
          <UnsavedChangesBar
            onReset={() => {
              setName(server.name)
              setIcon(null)
              setBanner(null)
            }}
            onSave={() => void save()}
            saving={saving}
          />
        )}
      </SettingsSection>

      {isOwner && (
        <SettingsSection title="Delete Server" description="Permanently delete this server and everything in it.">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon /> Delete Server
          </Button>
          <DeleteServerDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            serverId={serverId}
            serverName={server.name}
          />
        </SettingsSection>
      )}
    </>
  )
}

export function ServerInvitesSettings() {
  return (
    <RequireManageServer>
      <InvitesList />
    </RequireManageServer>
  )
}

function InvitesList() {
  const serverId = useServerIdParam()
  const { data: invites, isPending } = useInvites(serverId)
  const { data: members } = useMembers(serverId)
  const revoke = useRevokeInvite(serverId)

  const nameOf = (userId: string | null) => {
    const member = members?.find((m) => m.user_id === userId)
    return member ? memberDisplayName(member) : "Former member"
  }

  return (
    <SettingsSection
      title="Invites"
      description="Here's a list of all active invite links. You can revoke any one."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className={labelClass}>
              <th className="py-2 pr-4 font-bold">Inviter</th>
              <th className="py-2 pr-4 font-bold">Invite code</th>
              <th className="py-2 pr-4 font-bold">Uses</th>
              <th className="py-2 pr-4 font-bold">Expires</th>
              <th className="sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="py-2">
                    <Skeleton className="h-8 w-full bg-item-selected/60" />
                  </td>
                </tr>
              ))}
            {invites?.map((invite) => {
              const expired = invite.expires_at && new Date(invite.expires_at) < new Date()
              return (
                <tr key={invite.code} className="group border-t border-border">
                  <td className="py-2.5 pr-4 text-foreground">{nameOf(invite.created_by)}</td>
                  <td className="py-2.5 pr-4 font-mono text-foreground">{invite.code}</td>
                  <td className="py-2.5 pr-4 text-foreground">
                    {invite.uses}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ""}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {invite.expires_at ? (
                      <Tooltip>
                        <TooltipTrigger>
                          {expired ? "Expired" : formatDistanceToNowStrict(new Date(invite.expires_at))}
                        </TooltipTrigger>
                        <TooltipContent>{format(new Date(invite.expires_at), "PPpp")}</TooltipContent>
                      </Tooltip>
                    ) : (
                      "Never"
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() =>
                        revoke.mutate(invite.code, { onError: (err) => toast.error(errorMessage(err)) })
                      }
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              )
            })}
            {invites?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No invites yet. Use <strong>Invite People</strong> in the server menu to make one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  )
}

