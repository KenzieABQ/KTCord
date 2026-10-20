"use client"

import { HashIcon } from "lucide-react"
import Link from "next/link"
import { Fragment, memo, useMemo, useState, type ReactNode } from "react"

import { UserPopover } from "@/components/profile/user-popover"
import { memberDisplayName } from "@/lib/members"
import { isEmojiOnly, parseMarkdown, type MdNode } from "@/lib/markdown/parse"
import { displayNameOf } from "@/lib/profile-display"
import { useProfile } from "@/lib/queries/profiles"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"

const mentionClass =
  "rounded-[3px] bg-primary/30 px-0.5 font-medium text-[#c9cdfb] transition-colors hover:bg-primary hover:text-white"

function UserMention({ id }: { id: string }) {
  const { membersById, serverId } = useChat()
  const member = membersById.get(id)
  const { data: profile } = useProfile(member ? null : id)
  const name = member ? memberDisplayName(member) : profile ? displayNameOf(profile) : "unknown-user"
  return (
    <UserPopover userId={id} serverId={serverId}>
      <button type="button" className={mentionClass}>
        @{name}
      </button>
    </UserPopover>
  )
}

function RoleMention({ id }: { id: string }) {
  const { rolesById } = useChat()
  const role = rolesById.get(id)
  if (!role) return <span className={mentionClass}>@deleted-role</span>
  return (
    <span
      className="rounded-[3px] px-0.5 font-medium"
      style={
        role.color
          ? { color: role.color, backgroundColor: `color-mix(in oklab, ${role.color} 15%, transparent)` }
          : undefined
      }
    >
      @{role.name}
    </span>
  )
}

function ChannelMention({ id }: { id: string }) {
  const { channelsById, basePath } = useChat()
  const channel = channelsById.get(id)
  if (!channel) {
    return (
      <span className={cn(mentionClass, "inline-flex items-center gap-0.5")}>
        <HashIcon className="size-3.5" />
        unknown
      </span>
    )
  }
  return (
    <Link
      href={`${basePath}/${channel.id}`}
      className={cn(mentionClass, "inline-flex items-center gap-0.5 align-bottom")}
    >
      <HashIcon className="size-3.5" />
      {channel.name}
    </Link>
  )
}

function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      role={revealed ? undefined : "button"}
      tabIndex={revealed ? undefined : 0}
      aria-label={revealed ? undefined : "Spoiler, click to reveal"}
      onClick={() => setRevealed(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setRevealed(true)
      }}
      className={cn(
        "rounded-[3px] px-0.5 transition-colors",
        revealed ? "bg-white/10" : "cursor-pointer bg-[#1e1f22] text-transparent select-none hover:bg-[#232428] [&_*]:invisible"
      )}
    >
      {children}
    </span>
  )
}

function renderNodes(nodes: MdNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.value}</Fragment>
      case "br":
        return <br key={i} />
      case "strong":
        return <strong key={i} className="font-bold">{renderNodes(node.children)}</strong>
      case "em":
        return <em key={i}>{renderNodes(node.children)}</em>
      case "underline":
        return <u key={i}>{renderNodes(node.children)}</u>
      case "strike":
        return <s key={i}>{renderNodes(node.children)}</s>
      case "spoiler":
        return <Spoiler key={i}>{renderNodes(node.children)}</Spoiler>
      case "inlineCode":
        return (
          <code key={i} className="rounded-[3px] bg-floating/60 px-1 py-0.5 font-mono text-[0.85em]">
            {node.value}
          </code>
        )
      case "codeBlock":
        return (
          <pre
            key={i}
            className="my-1 max-w-[90%] overflow-x-auto rounded-md border border-border bg-floating/60 p-2 font-mono text-[0.85em] leading-snug whitespace-pre"
            data-lang={node.lang ?? undefined}
          >
            <code>{node.value}</code>
          </pre>
        )
      case "blockquote":
        return (
          <div key={i} className="flex gap-2">
            <span aria-hidden className="w-1 shrink-0 rounded-sm bg-interactive/40" />
            <blockquote className="min-w-0">{renderNodes(node.children)}</blockquote>
          </div>
        )
      case "link":
        return (
          <a
            key={i}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={node.url}
            className="text-link hover:underline"
          >
            {renderNodes(node.children)}
          </a>
        )
      case "mention":
        if (node.kind === "user") return <UserMention key={i} id={node.id} />
        if (node.kind === "role") return <RoleMention key={i} id={node.id} />
        return <ChannelMention key={i} id={node.id} />
      case "everyone":
        return (
          <span key={i} className={mentionClass}>
            @{node.value}
          </span>
        )
    }
  })
}

/** Renders message content. Emoji-only messages show larger, as in Discord. */
export const Markdown = memo(function Markdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const nodes = useMemo(() => parseMarkdown(content), [content])
  const jumbo = useMemo(() => isEmojiOnly(content), [content])
  return (
    <div
      className={cn(
        "leading-[1.375rem] break-words whitespace-pre-wrap text-foreground",
        jumbo && "text-[2.75rem] leading-[3.25rem]",
        className
      )}
    >
      {renderNodes(nodes)}
    </div>
  )
})
