"use client"

import {
  CopyIcon,
  HashIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ReplyIcon,
  TrashIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatMessage } from "@/lib/messages/types"

export type MessageActionHandlers = {
  canEdit: boolean
  canDelete: boolean
  canReply: boolean
  onReply: () => void
  onEdit: () => void
  /** `skipConfirm` is true for the Shift-held toolbar button, as in Discord. */
  onDelete: (skipConfirm: boolean) => void
}

/** basePath is "/channels/<serverId>" or "/channels/me". */
export function messageLink(basePath: string, message: ChatMessage) {
  return `${window.location.origin}${basePath}/${message.channel_id}/${message.id}`
}

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied.`))
}

function ToolbarButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={
            danger
              ? "flex size-8 items-center justify-center text-mention hover:bg-mention/10"
              : "flex size-8 items-center justify-center text-interactive hover:bg-item-hover hover:text-interactive-hover"
          }
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** The floating toolbar shown on hover (and kept open while its menu is). */
export function MessageToolbar({
  basePath,
  message,
  actions,
  shiftHeld,
  onMenuOpenChange,
}: {
  basePath: string
  message: ChatMessage
  actions: MessageActionHandlers
  /** Holding Shift swaps in a one-click Delete, as in Discord. */
  shiftHeld: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-chat shadow-md">
      {shiftHeld && actions.canDelete && (
        <ToolbarButton label="Delete" danger onClick={() => actions.onDelete(true)}>
          <TrashIcon className="size-4" />
        </ToolbarButton>
      )}
      {actions.canReply && (
        <ToolbarButton label="Reply" onClick={actions.onReply}>
          <ReplyIcon className="size-[18px]" />
        </ToolbarButton>
      )}
      {actions.canEdit && (
        <ToolbarButton label="Edit" onClick={actions.onEdit}>
          <PencilIcon className="size-4" />
        </ToolbarButton>
      )}
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              aria-label="More"
              className="flex size-8 items-center justify-center text-interactive outline-none hover:bg-item-hover hover:text-interactive-hover"
            >
              <MoreHorizontalIcon className="size-5" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">More</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52 bg-floating">
          <MessageMenuItems kind="dropdown" basePath={basePath} message={message} actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Shared menu items for the "More" dropdown and the right-click context menu. */
function MessageMenuItems({
  kind,
  basePath,
  message,
  actions,
}: {
  kind: "dropdown" | "context"
  basePath: string
  message: ChatMessage
  actions: MessageActionHandlers
}) {
  const Item = kind === "dropdown" ? DropdownMenuItem : ContextMenuItem
  const Separator = kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator
  const sent = !message.status

  return (
    <>
      {actions.canEdit && (
        <Item onSelect={actions.onEdit}>
          Edit Message <PencilIcon className="ml-auto" />
        </Item>
      )}
      {actions.canReply && (
        <Item onSelect={actions.onReply}>
          Reply <ReplyIcon className="ml-auto" />
        </Item>
      )}
      <Item onSelect={() => copy(message.content, "Text")}>
        Copy Text <CopyIcon className="ml-auto" />
      </Item>
      {sent && (
        <Item onSelect={() => copy(messageLink(basePath, message), "Message link")}>
          Copy Message Link <LinkIcon className="ml-auto" />
        </Item>
      )}
      {actions.canDelete && (
        <>
          <Separator />
          <Item variant="destructive" onSelect={() => actions.onDelete(false)}>
            Delete Message <TrashIcon className="ml-auto" />
          </Item>
        </>
      )}
      {sent && (
        <>
          <Separator />
          <Item onSelect={() => copy(message.id, "Message ID")}>
            Copy Message ID <HashIcon className="ml-auto" />
          </Item>
        </>
      )}
    </>
  )
}

export function MessageContextMenuContent(props: {
  basePath: string
  message: ChatMessage
  actions: MessageActionHandlers
}) {
  return (
    <ContextMenuContent className="w-52 bg-floating">
      <MessageMenuItems kind="context" {...props} />
    </ContextMenuContent>
  )
}

