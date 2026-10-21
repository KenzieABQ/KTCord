"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { CreateThreadDialog } from "@/components/chat/create-thread-dialog"
import { SelectFriendsDialog } from "@/components/dms/dm-dialogs"
import { QuickSwitcher } from "@/components/layout/quick-switcher"
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog"
import { BanMemberDialog, KickMemberDialog } from "@/components/members/moderation-dialogs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api/errors"
import { useLeaveServer, useServer } from "@/lib/queries/servers"
import { useUiStore, type AppDialog } from "@/lib/stores/ui-store"

import { CreateCategoryDialog, CreateChannelDialog, EditChannelDialog } from "./channel-dialogs"
import { InviteDialog } from "./invite-dialog"
import { CreateServerDialog, JoinServerDialog } from "./server-dialogs"

function LeaveServerDialog({ serverId }: { serverId: string }) {
  const router = useRouter()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: server } = useServer(serverId)
  const leaveServer = useLeaveServer()

  async function leave() {
    try {
      await leaveServer.mutateAsync(serverId)
      closeDialog()
      router.replace("/channels/me")
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Leave &apos;{server?.name}&apos;</DialogTitle>
        <DialogDescription>
          Are you sure you want to leave <strong className="text-foreground">{server?.name}</strong>?
          You won&apos;t be able to rejoin this server unless you are re-invited.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-6 -mx-6 -mb-6 rounded-b-xl bg-sidebar px-4 py-3">
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          className="bg-destructive text-white hover:bg-destructive/80"
          onClick={leave}
          disabled={leaveServer.isPending}
        >
          Leave Server
        </Button>
      </DialogFooter>
    </div>
  )
}

function DialogBody({ dialog }: { dialog: AppDialog }) {
  switch (dialog.kind) {
    case "create-server":
      return <CreateServerDialog />
    case "join-server":
      return <JoinServerDialog initialCode={dialog.code} />
    case "create-channel":
      return (
        <CreateChannelDialog
          serverId={dialog.serverId}
          parentId={dialog.parentId}
          initialType={dialog.type}
        />
      )
    case "create-category":
      return <CreateCategoryDialog serverId={dialog.serverId} />
    case "edit-channel":
      return <EditChannelDialog serverId={dialog.serverId} channelId={dialog.channelId} />
    case "invite":
      return <InviteDialog serverId={dialog.serverId} />
    case "leave-server":
      return <LeaveServerDialog serverId={dialog.serverId} />
    case "kick-member":
      return <KickMemberDialog serverId={dialog.serverId} userId={dialog.userId} />
    case "ban-member":
      return <BanMemberDialog serverId={dialog.serverId} userId={dialog.userId} />
    case "create-dm":
      return <SelectFriendsDialog addToChannelId={dialog.addToChannelId} preselect={dialog.preselect} />
    case "create-thread":
      return <CreateThreadDialog channelId={dialog.channelId} messageId={dialog.messageId} defaultName={dialog.defaultName} />
    case "quick-switcher":
    case "shortcuts":
      // These bring their own dialog shells (below).
      return null
  }
}

/** Renders whichever app dialog the UI store has open. Escape closes it. */
export function AppDialogs() {
  const dialog = useUiStore((s) => s.dialog)
  const closeDialog = useUiStore((s) => s.closeDialog)
  const onOpenChange = (open: boolean) => !open && closeDialog()
  const ownShell = dialog?.kind === "quick-switcher" || dialog?.kind === "shortcuts"

  return (
    <>
      <Dialog open={dialog !== null && !ownShell} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-chat p-6 sm:max-w-md">
          {/* Keyed so each dialog starts with fresh state. */}
          {dialog && !ownShell && <DialogBody key={JSON.stringify(dialog)} dialog={dialog} />}
        </DialogContent>
      </Dialog>
      <QuickSwitcher open={dialog?.kind === "quick-switcher"} onOpenChange={onOpenChange} />
      <ShortcutsDialog open={dialog?.kind === "shortcuts"} onOpenChange={onOpenChange} />
    </>
  )
}
