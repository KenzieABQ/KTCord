"use client"

import { format, formatDistanceToNowStrict } from "date-fns"
import { CalendarIcon, MapPinIcon, PlusIcon, StarIcon, Volume2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api/errors"
import { isLive, upcoming, type ScheduledEvent } from "@/lib/api/events"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { useCreateEvent, useEvents, useSetEventStatus, useSetInterest } from "@/lib/queries/events"
import { useChannels, useMembers, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

/** Re-renders every minute, so "starts in" and LIVE stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** "Events" at the top of a server's channel list, with how many are coming up. */
export function EventsRow({ serverId }: { serverId: string }) {
  const { data } = useEvents(serverId)
  const openDialog = useUiStore((s) => s.openDialog)
  const now = useNow()
  const events = upcoming(data ?? [], now)
  const live = events.find((e) => isLive(e, now))
  return (
    <div className="border-b border-border/60 px-2.5 py-2.5">
      <button
        type="button"
        onClick={() => openDialog({ kind: "events", serverId })}
        className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-muted-foreground hover:bg-item-hover hover:text-interactive-hover"
      >
        <CalendarIcon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {live ? <span className="text-status-online">Live: {live.name}</span> : events.length ? `${events.length} ${events.length === 1 ? "Event" : "Events"}` : "Events"}
        </span>
      </button>
    </div>
  )
}

function EventCard({ serverId, event, now }: { serverId: string; event: ScheduledEvent; now: number }) {
  const userId = useUserId()
  const { data: channels } = useChannels(serverId)
  const { data: members } = useMembers(serverId)
  const { permissions } = useServerPermissions(serverId)
  const interest = useSetInterest(serverId)
  const status = useSetEventStatus(serverId)
  const live = isLive(event, now)
  const interested = event.interests.some((i) => i.user_id === userId)
  const channel = channels?.find((c) => c.id === event.channel_id)
  const host = members?.find((m) => m.user_id === event.created_by)
  const canManage = event.created_by === userId || hasPermission(permissions, Permission.MANAGE_EVENTS)
  const onError = (e: unknown) => toast.error(errorMessage(e))
  const starts = new Date(event.starts_at)

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-card p-4">
      <p className={cn("text-xs font-semibold", live ? "text-status-online" : "text-muted-foreground")}>
        {live ? "Happening now" : `${format(starts, "EEE, MMM d · h:mm a")} · in ${formatDistanceToNowStrict(starts)}`}
      </p>
      <h3 className="text-lg font-semibold break-words text-header">{event.name}</h3>
      {event.description && <p className="text-sm break-words whitespace-pre-wrap text-foreground/90">{event.description}</p>}
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {channel ? <Volume2Icon className="size-4" /> : <MapPinIcon className="size-4" />}
        {channel?.name ?? event.location ?? "Somewhere"}
        {host && <span className="ml-auto text-xs">Hosted by {memberDisplayName(host)}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={interested ? "default" : "secondary"}
          aria-pressed={interested}
          disabled={interest.isPending}
          onClick={() => interest.mutate({ id: event.id, interested: !interested }, { onError })}
        >
          <StarIcon className={cn(interested && "fill-current")} /> Interested · {event.interests.length}
        </Button>
        {canManage && event.status === "scheduled" && (
          <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: event.id, status: "active" }, { onError })}>
            Start
          </Button>
        )}
        {canManage && live && (
          <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: event.id, status: "completed" }, { onError })}>
            End Event
          </Button>
        )}
        {canManage && !live && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => status.mutate({ id: event.id, status: "canceled" }, { onError })}
          >
            Cancel Event
          </Button>
        )}
      </div>
    </li>
  )
}

/** The server's upcoming and live events, and Create Event for those who may. */
export function EventsDialog({ serverId }: { serverId: string }) {
  const { data, isPending } = useEvents(serverId)
  const { permissions } = useServerPermissions(serverId)
  const openDialog = useUiStore((s) => s.openDialog)
  const now = useNow()
  const events = upcoming(data ?? [], now)
  const canCreate = hasPermission(permissions, Permission.MANAGE_EVENTS)

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader className="flex-row items-center justify-between gap-3 pr-6">
        <div>
          <DialogTitle>Events</DialogTitle>
          <DialogDescription>{events.length ? `${events.length} coming up` : "Nothing planned yet"}</DialogDescription>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => openDialog({ kind: "create-event", serverId })}>
            <PlusIcon /> Create Event
          </Button>
        )}
      </DialogHeader>
      {isPending ? (
        <p className="py-8 text-center text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <CalendarIcon className="size-10" />
          <p>{canCreate ? "Schedule something for everyone to look forward to." : "Check back later for events."}</p>
        </div>
      ) : (
        <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {events.map((event) => (
            <EventCard key={event.id} serverId={serverId} event={event} now={now} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** datetime-local value for a date, in local time. */
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const ELSEWHERE = "elsewhere"

export function CreateEventDialog({ serverId }: { serverId: string }) {
  const openDialog = useUiStore((s) => s.openDialog)
  const { data: channels } = useChannels(serverId)
  const create = useCreateEvent(serverId)
  const voice = (channels ?? []).filter((c) => c.type === "voice")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [where, setWhere] = useState(voice[0]?.id ?? ELSEWHERE)
  const [location, setLocation] = useState("")
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 3_600_000)
    d.setMinutes(0, 0, 0)
    return localInput(d)
  })
  const [endsAt, setEndsAt] = useState("")
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const start = new Date(startsAt)
    const end = endsAt ? new Date(endsAt) : null
    if (!name.trim()) return setError("Give the event a name.")
    if (Number.isNaN(start.getTime())) return setError("Pick when it starts.")
    if (end && end <= start) return setError("It has to end after it starts.")
    if (where === ELSEWHERE && !location.trim()) return setError("Say where it happens.")
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        channel_id: where === ELSEWHERE ? null : where,
        location: where === ELSEWHERE ? location.trim() : null,
        starts_at: start.toISOString(),
        ends_at: end?.toISOString() ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Event created.")
          openDialog({ kind: "events", serverId })
        },
        onError: (e) => setError(errorMessage(e)),
      }
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>Create Event</DialogTitle>
        <DialogDescription>Members can mark themselves interested and see it at the top of the channel list.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="event-name" className={labelClass}>
          Event Name
        </FieldLabel>
        <Input id="event-name" value={name} maxLength={100} autoFocus onChange={(e) => setName(e.target.value)} className="bg-input" />
      </Field>
      <Field>
        <FieldLabel className={labelClass}>Where</FieldLabel>
        <Select value={where} onValueChange={setWhere}>
          <SelectTrigger className="w-full bg-input" aria-label="Where">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voice.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                Voice: {c.name}
              </SelectItem>
            ))}
            <SelectItem value={ELSEWHERE}>Somewhere else</SelectItem>
          </SelectContent>
        </Select>
        {where === ELSEWHERE && (
          <Input
            value={location}
            maxLength={100}
            placeholder="A place or a link"
            aria-label="Location"
            onChange={(e) => setLocation(e.target.value)}
            className="mt-2 bg-input"
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="event-start" className={labelClass}>
            Starts
          </FieldLabel>
          <Input id="event-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="bg-input" />
        </Field>
        <Field>
          <FieldLabel htmlFor="event-end" className={labelClass}>
            Ends (optional)
          </FieldLabel>
          <Input id="event-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="bg-input" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="event-description" className={labelClass}>
          Description
        </FieldLabel>
        <Textarea
          id="event-description"
          value={description}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-input"
        />
      </Field>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => openDialog({ kind: "events", serverId })}>
          Back
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Create Event
        </Button>
      </div>
    </form>
  )
}
