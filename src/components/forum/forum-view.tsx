"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { MessageSquareIcon, MessagesSquareIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { Emoji } from "@/components/chat/emoji"
import { ThreadPanel } from "@/components/chat/thread-panel"
import { UserAvatar } from "@/components/profile/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import type { Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { forumTags, type ForumPost, type ForumTag } from "@/lib/api/forums"
import { parseMarkdown, toPlainText } from "@/lib/markdown/parse"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { useCreateForumPost, useForumPosts } from "@/lib/queries/forums"
import { useChannelPermissions } from "@/lib/queries/channel-permissions"
import { useMembers } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

function TagChip({ tag, active, onClick }: { tag: ForumTag; active?: boolean; onClick?: () => void }) {
  const content = (
    <>
      {tag.emoji && <Emoji value={tag.emoji} />}
      {tag.name}
    </>
  )
  const className = cn(
    "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
    active ? "bg-primary text-white" : "bg-item-selected/70 text-foreground"
  )
  return onClick ? (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn(className, "hover:brightness-110")}>
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  )
}

function NewPostDialog({
  forum,
  open,
  onOpenChange,
  onCreated,
}: {
  forum: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const tags = forumTags(forum)
  const create = useCreateForumPost(forum.id)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!title.trim()) return setError("Give your post a title.")
    if (!content.trim()) return setError("Write something to start the post.")
    create.mutate(
      { title: title.trim(), content: content.trim(), tags: picked },
      {
        onSuccess: (id) => {
          setTitle("")
          setContent("")
          setPicked([])
          onOpenChange(false)
          onCreated(id)
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Post</DialogTitle>
          <DialogDescription>in {forum.name}</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field>
            <FieldLabel htmlFor="post-title" className={labelClass}>
              Title
            </FieldLabel>
            <Input id="post-title" value={title} maxLength={100} autoFocus onChange={(e) => setTitle(e.target.value)} className="bg-input" />
          </Field>
          <Field>
            <FieldLabel htmlFor="post-body" className={labelClass}>
              Message
            </FieldLabel>
            <Textarea id="post-body" value={content} maxLength={2000} rows={6} onChange={(e) => setContent(e.target.value)} className="bg-input" />
          </Field>
          {tags.length > 0 && (
            <fieldset>
              <legend className={`${labelClass} mb-2`}>Tags (up to 5)</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    active={picked.includes(tag.id)}
                    onClick={() =>
                      setPicked((list) =>
                        list.includes(tag.id) ? list.filter((t) => t !== tag.id) : list.length < 5 ? [...list, tag.id] : list
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}
          {error && <FieldError>{error}</FieldError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Post
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PostCard({
  post,
  tags,
  serverId,
  selected,
  onOpen,
}: {
  post: ForumPost
  tags: ForumTag[]
  serverId: string
  selected: boolean
  onOpen: () => void
}) {
  const { data: members } = useMembers(serverId)
  const author = members?.find((m) => m.user_id === post.owner_id)
  const name = author ? memberDisplayName(author) : "Someone"
  const preview = post.first_message ? toPlainText(parseMarkdown(post.first_message)) : ""
  const replies = Math.max(0, post.message_count - 1)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected || undefined}
        className={cn(
          "flex w-full flex-col gap-1.5 rounded-lg bg-card p-4 text-left transition-colors hover:bg-item-hover",
          selected && "ring-2 ring-primary"
        )}
      >
        {post.applied_tags.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {post.applied_tags.map((id) => {
              const tag = tags.find((t) => t.id === id)
              return tag ? <TagChip key={id} tag={tag} /> : null
            })}
          </span>
        )}
        <span className="text-[1.0625rem] font-semibold break-words text-header">{post.name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <UserAvatar userId={post.owner_id ?? post.id} name={name} src={author?.profile.avatar_url} className="size-4" />
          <span className="shrink-0 font-medium text-foreground">{name}:</span>
          <span className="truncate">{preview}</span>
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquareIcon className="size-3.5" /> {replies} {replies === 1 ? "reply" : "replies"}
          </span>
          <span>{formatDistanceToNowStrict(new Date(post.last_message_at), { addSuffix: true })}</span>
        </span>
      </button>
    </li>
  )
}

/** A forum channel: its posts (threads) with tag filters, New Post, and the open post beside. */
export function ForumView({ serverId, channel }: { serverId: string; channel: Channel }) {
  const breakpoint = useBreakpoint()
  const { data: posts, isPending } = useForumPosts(channel.id)
  const { permissions } = useChannelPermissions(serverId, channel.id)
  const canPost = hasPermission(permissions, Permission.SEND_MESSAGES)
  const tags = forumTags(channel)
  const [filter, setFilter] = useState<string[]>([])
  const [composing, setComposing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = useMemo(
    () => (posts ?? []).filter((p) => filter.every((t) => p.applied_tags.includes(t))),
    [posts, filter]
  )

  const panel = openId && (
    <ThreadPanel key={openId} serverId={serverId} threadId={openId} onClose={() => setOpenId(null)} />
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto bg-chat">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {channel.topic && <p className="text-sm break-words text-muted-foreground">{channel.topic}</p>}
            </div>
            <Button disabled={!canPost} onClick={() => setComposing(true)}>
              <PlusIcon /> New Post
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
              {tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  active={filter.includes(tag.id)}
                  onClick={() => setFilter((list) => (list.includes(tag.id) ? list.filter((t) => t !== tag.id) : [...list, tag.id]))}
                />
              ))}
            </div>
          )}
          {isPending ? (
            <p className="py-10 text-center text-muted-foreground">Loading posts…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <MessagesSquareIcon className="size-12" />
              <p className="text-lg font-semibold text-header">{posts?.length ? "No posts match" : "No posts yet"}</p>
              <p>{posts?.length ? "Try other tags." : canPost ? "Start the first conversation." : "Check back later."}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Posts">
              {shown.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  tags={tags}
                  serverId={serverId}
                  selected={post.id === openId}
                  onOpen={() => setOpenId(post.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      {panel &&
        (breakpoint === "desktop" ? (
          <aside aria-label="Post" className="w-[460px] shrink-0 border-l border-border">
            {panel}
          </aside>
        ) : (
          <Sheet open onOpenChange={(open) => !open && setOpenId(null)}>
            <SheetContent side="right" showCloseButton={false} className="w-full max-w-full gap-0 border-0 p-0 sm:max-w-[480px]">
              <SheetTitle className="sr-only">Post</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        ))}
      <NewPostDialog forum={channel} open={composing} onOpenChange={setComposing} onCreated={setOpenId} />
    </div>
  )
}
