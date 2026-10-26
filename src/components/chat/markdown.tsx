"use client"

import type { ElementContent, Root } from "hast"
import { HashIcon } from "lucide-react"
import Link from "next/link"
import { Fragment, memo, useEffect, useMemo, useState, type ReactNode } from "react"

import { UserPopover } from "@/components/profile/user-popover"
import { memberDisplayName } from "@/lib/members"
import { isEmojiOnly, parseMarkdown, type MdNode } from "@/lib/markdown/parse"
import { displayNameOf } from "@/lib/profile-display"
import { useProfile } from "@/lib/queries/profiles"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { Emoji } from "./emoji"

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

function renderHighlighted(nodes: ElementContent[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === "text") return <Fragment key={i}>{node.value}</Fragment>
    if (node.type !== "element") return null
    const className = node.properties.className
    return (
      <span key={i} className={Array.isArray(className) ? className.join(" ") : undefined}>
        {renderHighlighted(node.children)}
      </span>
    )
  })
}

/** A fenced code block; with a language (```js) it's syntax-highlighted once the highlighter loads. */
function CodeBlock({ lang, value }: { lang: string | null; value: string }) {
  const [highlighted, setHighlighted] = useState<{ key: string; tree: Root | null } | null>(null)
  const key = `${lang}\u0000${value}`

  useEffect(() => {
    if (!lang) return
    let cancelled = false
    void import("@/lib/markdown/highlight").then(({ highlightCode }) => {
      if (!cancelled) setHighlighted({ key, tree: highlightCode(lang, value) })
    })
    return () => {
      cancelled = true
    }
  }, [key, lang, value])

  const tree = highlighted?.key === key ? highlighted.tree : null
  return (
    <pre
      className="code-block my-1 max-w-[90%] overflow-x-auto rounded-md border border-border bg-floating/60 p-2 font-mono text-[0.85em] leading-snug whitespace-pre"
      data-lang={lang ?? undefined}
    >
      <code>{tree ? renderHighlighted(tree.children as ElementContent[]) : value}</code>
    </pre>
  )
}

const HEADING_CLASS = {
  1: "text-[1.5em]",
  2: "text-[1.25em]",
  3: "text-[1em]",
} as const

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
        return <CodeBlock key={i} lang={node.lang} value={node.value} />
      case "heading": {
        const Tag = `h${node.level}` as const
        return (
          <Tag key={i} className={cn("mt-2 mb-1 leading-[1.375em] font-bold text-header first:mt-0", HEADING_CLASS[node.level])}>
            {renderNodes(node.children)}
          </Tag>
        )
      }
      case "subtext":
        return (
          <small key={i} className="block text-[0.8125em] leading-[1.375em] text-muted-foreground">
            {renderNodes(node.children)}
          </small>
        )
      case "list": {
        const items = node.items.map((item, n) => <li key={n} className="pl-0.5">{renderNodes(item)}</li>)
        if (!node.ordered) {
          return (
            <ul key={i} className="my-0.5 ml-[1.25em] list-disc [&_ul]:my-0 [&_ul]:list-[circle]">
              {items}
            </ul>
          )
        }
        // Room for the widest number in the list.
        const digits = String(node.start + node.items.length - 1).length
        return (
          <ol key={i} start={node.start} className="my-0.5 list-decimal [&_ol]:my-0" style={{ marginLeft: `${digits * 0.6 + 0.8}em` }}>
            {items}
          </ol>
        )
      }
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
      case "customEmoji":
        return <Emoji key={i} value={`<${node.animated ? "a" : ""}:${node.name}:${node.id}>`} />
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
        "leading-[1.375em] break-words whitespace-pre-wrap text-foreground",
        jumbo && "text-[2.75em] leading-[1.2] [&_.custom-emoji]:size-[1.1em]",
        className
      )}
    >
      {renderNodes(nodes)}
    </div>
  )
})
