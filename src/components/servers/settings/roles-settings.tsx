"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon, LockIcon, PlusIcon, ShieldIcon, TrashIcon, UsersIcon } from "@/components/icons"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { SettingsSection, UnsavedChangesBar } from "@/components/settings/settings-layout"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorMessage } from "@/lib/api/errors"
import type { Role } from "@/lib/api/members"
import { PERMISSION_GROUPS, permissionBit, ROLE_COLORS } from "@/lib/permission-labels"
import { hasPermission, Permission } from "@/lib/permissions"
import { useCreateRole, useDeleteRole, useReorderRoles, useUpdateRole } from "@/lib/queries/moderation"
import { useMembers, useRoles, useServerPermissions } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"

const labelClass = "text-xs font-bold tracking-wide uppercase text-muted-foreground"

type Draft = { name: string; color: string | null; permissions: number; hoist: boolean; mentionable: boolean }

const draftOf = (role: Role): Draft => ({
  name: role.name,
  color: role.color,
  permissions: role.permissions,
  hoist: role.hoist,
  mentionable: role.mentionable,
})

function RoleRow({
  role,
  selected,
  memberCount,
  movable,
  onSelect,
}: {
  role: Role
  selected: boolean
  memberCount: number
  movable: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
    disabled: !movable,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group flex items-center rounded-md", isDragging && "relative z-10 opacity-70")}
    >
      <span
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${role.name}`}
        className={cn(
          "flex w-5 shrink-0 cursor-grab justify-center text-muted-foreground opacity-0 group-hover:opacity-100",
          !movable && "invisible"
        )}
      >
        <GripVerticalIcon className="size-4" />
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          selected ? "bg-item-selected text-interactive-active" : "text-interactive hover:bg-item-hover"
        )}
      >
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
        <span className="min-w-0 flex-1 truncate font-medium">{role.name}</span>
        {!movable && !role.is_default && <LockIcon className="size-3 shrink-0" aria-label="Above your highest role" />}
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
          {memberCount}
          <UsersIcon className="size-3" />
        </span>
      </button>
    </div>
  )
}

function RoleEditor({
  serverId,
  role,
  editable,
  onDeleted,
}: {
  serverId: string
  role: Role
  editable: boolean
  onDeleted: () => void
}) {
  const updateRole = useUpdateRole(serverId)
  const deleteRole = useDeleteRole(serverId)
  const { permissions: myPermissions, isOwner } = useServerPermissions(serverId)
  const [draft, setDraft] = useState<Draft>(() => draftOf(role))
  const original = draftOf(role)
  const dirty = JSON.stringify(draft) !== JSON.stringify(original)

  async function save() {
    try {
      await updateRole.mutateAsync({
        roleId: role.id,
        patch: {
          name: draft.name !== original.name ? draft.name : undefined,
          color: draft.color !== original.color ? draft.color : undefined,
          permissions: draft.permissions !== original.permissions ? draft.permissions : undefined,
          hoist: draft.hoist !== original.hoist ? draft.hoist : undefined,
          mentionable: draft.mentionable !== original.mentionable ? draft.mentionable : undefined,
        },
      })
      toast.success("Role saved.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function remove() {
    try {
      await deleteRole.mutateAsync(role.id)
      onDeleted()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete "${role.name}"`}
        description="Are you sure? Members with this role keep their other roles. This can't be undone."
        confirmLabel="Delete Role"
        onConfirm={() => void remove()}
      />
      <h2 className="mb-3 truncate text-base font-semibold text-header">
        Edit role — {role.is_default ? "@everyone" : role.name}
      </h2>
      {!editable && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-sidebar p-2 text-sm text-muted-foreground">
          <LockIcon className="size-4 shrink-0" /> You can only edit roles below your highest role.
        </p>
      )}

      <Tabs defaultValue={role.is_default ? "permissions" : "display"}>
        <TabsList className="mb-4">
          {!role.is_default && <TabsTrigger value="display">Display</TabsTrigger>}
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {!role.is_default && (
          <TabsContent value="display" className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="role-name" className={labelClass}>
                Role name
              </FieldLabel>
              <Input
                id="role-name"
                value={draft.name}
                maxLength={100}
                disabled={!editable}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>

            <Field>
              <FieldLabel className={labelClass}>Role color</FieldLabel>
              <FieldDescription className="text-xs">Members use the color of their highest colored role.</FieldDescription>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setDraft({ ...draft, color: null })}
                  aria-label="Default color"
                  aria-pressed={draft.color === null}
                  className={cn(
                    "size-10 rounded-md bg-[#99aab5]",
                    draft.color === null && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                />
                <label
                  className="relative size-10 cursor-pointer overflow-hidden rounded-md border border-border"
                  style={{ backgroundColor: draft.color ?? "transparent" }}
                >
                  <span className="sr-only">Custom color</span>
                  <input
                    type="color"
                    disabled={!editable}
                    value={draft.color ?? "#99aab5"}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <div className="grid grid-cols-10 gap-1.5">
                  {ROLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      disabled={!editable}
                      aria-label={color}
                      aria-pressed={draft.color === color}
                      onClick={() => setDraft({ ...draft, color })}
                      className={cn(
                        "size-[18px] rounded-sm",
                        draft.color === color && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </Field>

            <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <span>
                <span className="block text-sm font-medium text-header">
                  Display role members separately from online members
                </span>
              </span>
              <Switch
                checked={draft.hoist}
                disabled={!editable}
                onCheckedChange={(hoist) => setDraft({ ...draft, hoist })}
              />
            </label>
            <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <span>
                <span className="block text-sm font-medium text-header">Allow anyone to @mention this role</span>
                <span className="block text-xs text-muted-foreground">
                  Members with &quot;Mention @everyone&quot; can always ping it.
                </span>
              </span>
              <Switch
                checked={draft.mentionable}
                disabled={!editable}
                onCheckedChange={(mentionable) => setDraft({ ...draft, mentionable })}
              />
            </label>

            {editable && (
              <Button variant="destructive" className="self-start" onClick={() => setConfirmingDelete(true)} disabled={deleteRole.isPending}>
                <TrashIcon /> Delete Role
              </Button>
            )}
          </TabsContent>
        )}

        <TabsContent value="permissions" className="flex flex-col gap-6">
          {role.is_default && (
            <p className="text-sm text-muted-foreground">
              These apply to every member, including people without any other role.
            </p>
          )}
          {PERMISSION_GROUPS.map((group) => (
            <section key={group.heading}>
              <h3 className={cn(labelClass, "mb-2")}>{group.heading}</h3>
              <div className="flex flex-col divide-y divide-border">
                {group.permissions.map((perm) => {
                  const bit = permissionBit(perm.key)
                  const on = hasPermission(draft.permissions, bit)
                  // Non-owners can't grant what they don't have.
                  const grantable = isOwner || hasPermission(myPermissions, bit)
                  return (
                    <label key={perm.key} className="flex items-start justify-between gap-4 py-3">
                      <span>
                        <span className="block text-sm font-medium text-header">{perm.label}</span>
                        <span className="block text-xs text-muted-foreground">{perm.description}</span>
                      </span>
                      <Switch
                        checked={on}
                        disabled={!editable || (!on && !grantable)}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            permissions: checked ? draft.permissions | bit : draft.permissions & ~bit,
                          })
                        }
                      />
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>

      {dirty && editable && (
        <UnsavedChangesBar onReset={() => setDraft(original)} onSave={() => void save()} saving={updateRole.isPending} />
      )}
    </div>
  )
}

/** Server Settings → Roles: list (drag to reorder), create, and edit display and permissions. */
export function RolesSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)
  const { permissions, topPosition, isOwner } = useServerPermissions(serverId)
  const createRole = useCreateRole(serverId)
  const reorder = useReorderRoles(serverId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const ordered = useMemo(
    () => [...(roles ?? [])].filter((r) => !r.is_default).sort((a, b) => b.position - a.position),
    [roles]
  )
  const everyone = roles?.find((r) => r.is_default)
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of members ?? []) for (const id of m.role_ids) map.set(id, (map.get(id) ?? 0) + 1)
    return map
  }, [members])

  if (!hasPermission(permissions, Permission.MANAGE_ROLES)) {
    return (
      <SettingsSection title="Roles">
        <p className="text-muted-foreground">You need the Manage Roles permission to edit roles.</p>
      </SettingsSection>
    )
  }

  const canEdit = (role: Role) => isOwner || role.position < topPosition
  const selected = roles?.find((r) => r.id === selectedId) ?? ordered[0] ?? everyone

  async function create() {
    try {
      const role = await createRole.mutateAsync({ name: "new role" })
      setSelectedId(role.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ordered.findIndex((r) => r.id === active.id)
    const to = ordered.findIndex((r) => r.id === over.id)
    const next = arrayMove(ordered, from, to)
    reorder.mutate(
      next.map((r) => r.id),
      { onError: (error) => toast.error(errorMessage(error)) }
    )
  }

  return (
    <SettingsSection
      title="Roles"
      description="Use roles to group members and give them permissions. Drag to reorder: higher roles can manage lower ones."
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 lg:w-60">
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Roles — {ordered.length}</span>
            <Button size="sm" onClick={create} disabled={createRole.isPending}>
              <PlusIcon /> Create Role
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-0.5">
                {ordered.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    selected={selected?.id === role.id}
                    memberCount={counts.get(role.id) ?? 0}
                    movable={canEdit(role)}
                    onSelect={() => setSelectedId(role.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {everyone && (
            <button
              type="button"
              onClick={() => setSelectedId(everyone.id)}
              className={cn(
                "mt-3 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm",
                selected?.id === everyone.id ? "bg-item-selected text-interactive-active" : "text-interactive hover:bg-item-hover"
              )}
            >
              <ShieldIcon className="size-4" />
              <span className="flex-1">
                <span className="block font-medium">Default Permissions</span>
                <span className="block text-xs text-muted-foreground">@everyone • applies to all members</span>
              </span>
            </button>
          )}
        </div>

        {selected && (
          <RoleEditor
            key={selected.id}
            serverId={serverId}
            role={selected}
            editable={canEdit(selected)}
            onDeleted={() => setSelectedId(null)}
          />
        )}
      </div>
    </SettingsSection>
  )
}
