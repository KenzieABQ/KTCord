"use client"

import { format } from "date-fns"
import { ForwardIcon, MegaphoneIcon } from "@/components/icons"
import Link from "next/link"

import type { Attachment } from "@/lib/api/attachments"
import type { ForwardSnapshot } from "@/lib/messages/types"

import { useChat } from "./chat-context"
import { LinkEmbeds } from "./link-embeds"
import { Markdown } from "./markdown"
import { MessageAttachments } from "./message-attachments"

/**
 * A forwarded message: the original's text and files under a "Forwarded" label, with where
 * it came from when that channel is in this server. Its mentions never ping anyone.
 */
export function ForwardedMessage({ forward, attachments }: { forward: ForwardSnapshot; attachments: Attachment[] }) {
  const { channelsById, basePath } = useChat()
  const source = channelsById.get(forward.channel_id)
  return (
    <div className="mt-0.5 flex max-w-[90%] gap-3">
      <span aria-hidden className="w-1 shrink-0 rounded-sm bg-interactive/40" />
      <div className="min-w-0 flex-1 py-0.5">
        {forward.published ? (
          <p className="mb-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MegaphoneIcon className="size-3.5" /> {forward.server_name} #{forward.channel_name}
          </p>
        ) : (
          <p className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground italic">
            <ForwardIcon className="size-3.5" /> Forwarded
          </p>
        )}
        {forward.content && <Markdown content={forward.content} />}
        {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
        {forward.content && <LinkEmbeds content={forward.content} />}
        <p className="mt-1 text-xs text-muted-foreground">
          {source && (
            <>
              <Link href={`${basePath}/${source.id}/${forward.message_id}`} className="hover:text-interactive-hover hover:underline">
                #{source.name}
              </Link>
              {" • "}
            </>
          )}
          <time dateTime={forward.created_at}>{format(new Date(forward.created_at), "MMM d, yyyy h:mm a")}</time>
        </p>
      </div>
    </div>
  )
}
